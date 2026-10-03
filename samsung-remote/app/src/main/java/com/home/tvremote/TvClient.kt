package com.home.tvremote

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Base64
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.net.URLEncoder

/**
 * Connection to a Samsung Tizen TV (2016+) over its local WebSocket remote-control API
 * (wss://<ip>:8002). The first connection shows an "Allow" prompt on the TV; the token
 * it returns is stored so later connections are silent.
 * All state is touched only on the main thread.
 */
class TvClient(context: Context, private val emit: (JSONObject) -> Unit) {

    companion object {
        private const val APP_NAME = "Home Remote"
    }

    private val prefs = context.getSharedPreferences("tv", Context.MODE_PRIVATE)
    private val main = Handler(Looper.getMainLooper())
    private var ws: WebSocket? = null
    private var generation = 0
    private var attempt = 0
    private var active = false
    private var state = "idle"
    private val pending = ArrayList<Pair<Long, String>>()

    val ip: String? get() = prefs.getString("ip", null)
    private val mac: String? get() = prefs.getString("mac", null)
    private val name: String? get() = prefs.getString("name", null)
    val isConnected: Boolean get() = state == "connected"

    private val retry = Runnable { if (active) connect() }
    private val showPairing = Runnable { if (state == "connecting" || state == "reconnecting") setState("pairing") }

    private fun post(block: () -> Unit) {
        main.post { block() }
    }

    fun start() = post {
        active = true
        if (ws == null && state != "denied") connect() else emitStatus()
    }

    fun stop() = post {
        active = false
        main.removeCallbacks(retry)
        main.removeCallbacks(showPairing)
        generation++
        ws?.close(1000, null)
        ws = null
        if (state != "noTv") state = "idle"
    }

    fun reconnect() = post {
        attempt = 0
        connect()
    }

    fun requestStatus() = post { emitStatus() }

    fun setTv(ip: String, name: String?, mac: String?) = post {
        prefs.edit()
            .putString("ip", ip)
            .putString("name", name ?: "Samsung TV")
            .putString("mac", mac ?: "")
            .apply()
        attempt = 0
        connect()
    }

    fun resetPairing() = post {
        ip?.let { prefs.edit().remove("token_$it").apply() }
        attempt = 0
        connect()
    }

    fun sendKey(key: String) = sendRaw(
        JSONObject()
            .put("method", "ms.remote.control")
            .put(
                "params", JSONObject()
                    .put("Cmd", "Click")
                    .put("DataOfCmd", key)
                    .put("Option", "false")
                    .put("TypeOfRemote", "SendRemoteKey")
            ).toString()
    )

    fun sendText(text: String) {
        val b64 = Base64.encodeToString(text.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
        sendRaw(
            JSONObject()
                .put("method", "ms.remote.control")
                .put(
                    "params", JSONObject()
                        .put("Cmd", b64)
                        .put("DataOfCmd", "base64")
                        .put("TypeOfRemote", "SendInputString")
                ).toString()
        )
    }

    /** appType 2 = web/Tizen app (DEEP_LINK), 4 = native app (NATIVE_LAUNCH). */
    fun launchApp(appId: String, appType: Int) = sendRaw(
        JSONObject()
            .put("method", "ms.channel.emit")
            .put(
                "params", JSONObject()
                    .put("event", "ed.apps.launch")
                    .put("to", "host")
                    .put(
                        "data", JSONObject()
                            .put("appId", appId)
                            .put("action_type", if (appType == 4) "NATIVE_LAUNCH" else "DEEP_LINK")
                    )
            ).toString()
    )

    fun requestApps() = sendRaw(
        JSONObject()
            .put("method", "ms.channel.emit")
            .put("params", JSONObject().put("event", "ed.installedApp.get").put("to", "host"))
            .toString()
    )

    fun power() = post {
        if (isConnected) {
            sendKey("KEY_POWER")
        } else {
            val m = mac
            val target = ip
            if (!m.isNullOrEmpty()) {
                Thread { Net.wakeOnLan(m, target) }.start()
                toast("שולח הדלקה לטלוויזיה…")
            } else {
                toast("הטלוויזיה לא מחוברת")
            }
            attempt = 0
            connect()
        }
    }

    private fun sendRaw(json: String) = post {
        if (isConnected && ws?.send(json) == true) return@post
        pending.add(SystemClock.elapsedRealtime() to json)
        while (pending.size > 10) pending.removeAt(0)
        if (ws == null || state == "denied") {
            attempt = 0
            connect()
        }
    }

    private fun connect() {
        main.removeCallbacks(retry)
        main.removeCallbacks(showPairing)
        val ip = ip ?: run {
            setState("noTv")
            return
        }
        val gen = ++generation
        ws?.cancel()
        ws = null
        setState(if (attempt == 0) "connecting" else "reconnecting")

        val appName = Base64.encodeToString(APP_NAME.toByteArray(), Base64.NO_WRAP)
        val url = StringBuilder("wss://$ip:8002/api/v2/channels/samsung.remote.control?name=")
            .append(URLEncoder.encode(appName, "UTF-8"))
        prefs.getString("token_$ip", null)?.let { url.append("&token=").append(it) }

        val request = try {
            Request.Builder().url(url.toString()).build()
        } catch (e: Exception) {
            setState("badIp")
            return
        }
        ws = Net.ws.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                main.post { if (gen == generation) main.postDelayed(showPairing, 1500) }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                main.post { if (gen == generation) handle(text) }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                main.post { if (gen == generation) dropped() }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                main.post { if (gen == generation) dropped() }
            }
        })
    }

    private fun handle(text: String) {
        val msg = try {
            JSONObject(text)
        } catch (e: Exception) {
            return
        }
        when (msg.optString("event")) {
            "ms.channel.connect" -> {
                val token = msg.optJSONObject("data")?.optString("token").orEmpty()
                if (token.isNotEmpty()) ip?.let { prefs.edit().putString("token_$it", token).apply() }
                attempt = 0
                main.removeCallbacks(showPairing)
                setState("connected")
                flushPending()
                requestApps()
            }

            "ms.channel.unauthorized", "ms.channel.timeOut" -> {
                main.removeCallbacks(showPairing)
                setState("denied")
                ws?.close(1000, null)
            }

            "ed.installedApp.get" -> {
                val list = msg.optJSONObject("data")?.optJSONArray("data") ?: return
                emit(JSONObject().put("type", "apps").put("apps", list))
            }
        }
    }

    private fun flushPending() {
        val now = SystemClock.elapsedRealtime()
        val toSend = pending.filter { now - it.first < 5000 }.map { it.second }
        pending.clear()
        for (json in toSend) ws?.send(json)
    }

    private fun dropped() {
        ws = null
        main.removeCallbacks(showPairing)
        if (!active || state == "denied") return
        attempt++
        setState("reconnecting")
        val delay = minOf(8000L, 500L shl minOf(attempt, 4))
        main.postDelayed(retry, delay)
    }

    private fun setState(s: String) {
        state = s
        emitStatus()
    }

    private fun emitStatus() {
        emit(
            JSONObject()
                .put("type", "status")
                .put("state", state)
                .put("ip", ip ?: "")
                .put("name", name ?: "")
                .put("mac", mac ?: "")
        )
    }

    private fun toast(text: String) {
        emit(JSONObject().put("type", "toast").put("text", text))
    }
}
