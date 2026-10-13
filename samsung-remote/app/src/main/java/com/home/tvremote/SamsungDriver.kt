package com.home.tvremote

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.net.URLEncoder
import java.util.Base64

/** Samsung Tizen (2016+): WebSocket remote API on wss://<ip>:8002, "Allow" prompt on first use. */
class SamsungDriver(ip: String, session: Session) : Driver(ip, session) {

    @Volatile
    private var ws: WebSocket? = null

    @Volatile
    private var closedByUs = false

    override fun connect() {
        val appName = Base64.getEncoder().encodeToString(APP_NAME.toByteArray())
        val url = StringBuilder("wss://$ip:8002/api/v2/channels/samsung.remote.control?name=")
            .append(URLEncoder.encode(appName, "UTF-8"))
        session.load("token")?.let { url.append("&token=").append(it) }

        ws = Net.ws.newWebSocket(Request.Builder().url(url.toString()).build(), object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {}

            override fun onMessage(webSocket: WebSocket, text: String) = handle(text)

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                if (!closedByUs) session.closed()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                if (!closedByUs) session.closed()
            }
        })
    }

    override fun close() {
        closedByUs = true
        ws?.cancel()
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
                if (token.isNotEmpty()) session.store("token", token)
                session.connected()
            }

            "ms.channel.unauthorized", "ms.channel.timeOut" -> {
                closedByUs = true
                ws?.close(1000, null)
                session.denied()
            }

            "ed.installedApp.get" -> {
                msg.optJSONObject("data")?.optJSONArray("data")?.let { session.apps(it) }
            }
        }
    }

    private fun send(json: JSONObject) {
        ws?.send(json.toString())
    }

    override fun key(key: String): Boolean {
        send(
            JSONObject()
                .put("method", "ms.remote.control")
                .put(
                    "params", JSONObject()
                        .put("Cmd", "Click")
                        .put("DataOfCmd", key)
                        .put("Option", "false")
                        .put("TypeOfRemote", "SendRemoteKey")
                )
        )
        return true
    }

    override fun text(text: String): Boolean {
        val b64 = Base64.getEncoder().encodeToString(text.toByteArray(Charsets.UTF_8))
        send(
            JSONObject()
                .put("method", "ms.remote.control")
                .put(
                    "params", JSONObject()
                        .put("Cmd", b64)
                        .put("DataOfCmd", "base64")
                        .put("TypeOfRemote", "SendInputString")
                )
        )
        return true
    }

    /** appType 2 = web/Tizen app (DEEP_LINK), 4 = native app (NATIVE_LAUNCH). */
    override fun launch(appId: String, appType: Int) {
        send(
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
                                .put("metaTag", "")
                        )
                )
        )
        // Many Tizen firmwares ignore the WebSocket launch; the REST endpoint is more reliable.
        Thread {
            val body = ByteArray(0).toRequestBody("application/json".toMediaType())
            for (base in listOf("http://$ip:8001", "https://$ip:8002")) {
                try {
                    val req = Request.Builder().url("$base/api/v2/applications/$appId").post(body).build()
                    Net.ws.newCall(req).execute().use { if (it.isSuccessful) return@Thread }
                } catch (_: Exception) {
                }
            }
        }.start()
    }

    override fun requestApps() {
        send(
            JSONObject()
                .put("method", "ms.channel.emit")
                .put("params", JSONObject().put("event", "ed.installedApp.get").put("to", "host"))
        )
    }

    companion object {
        private const val APP_NAME = "Home Remote"
    }
}
