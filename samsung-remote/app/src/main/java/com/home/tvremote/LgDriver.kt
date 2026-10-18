package com.home.tvremote

import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * LG webOS (2014+): SSAP over WebSocket (wss://<ip>:3001, older firmware ws://<ip>:3000).
 * First connection shows an "Allow" prompt on the TV; the returned client-key is stored.
 * Remote buttons go through a second "pointer input" socket that the TV hands out.
 */
class LgDriver(ip: String, session: Session) : Driver(ip, session) {

    @Volatile
    private var ws: WebSocket? = null

    @Volatile
    private var input: WebSocket? = null

    @Volatile
    private var closedByUs = false

    @Volatile
    private var registered = false

    private val ids = AtomicInteger(1)
    private val callbacks = ConcurrentHashMap<String, (JSONObject) -> Unit>()

    override fun connect() {
        // Newer firmware only accepts wss:3001; remember which one worked last time.
        val secureFirst = session.load("secure") != "0"
        open(secureFirst, allowFallback = true)
    }

    private fun open(secure: Boolean, allowFallback: Boolean) {
        val url = if (secure) "wss://$ip:3001" else "ws://$ip:3000"
        var opened = false
        ws = Net.ws.newWebSocket(Request.Builder().url(url).build(), object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                opened = true
                session.store("secure", if (secure) "1" else "0")
                webSocket.send(registerMessage().toString())
            }

            override fun onMessage(webSocket: WebSocket, text: String) = handle(text)

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = dropped()

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                if (closedByUs) return
                if (!opened && allowFallback) open(!secure, allowFallback = false) else dropped()
            }
        })
    }

    private fun dropped() {
        if (closedByUs) return
        closedByUs = true
        input?.cancel()
        ws?.cancel()
        session.closed()
    }

    override fun close() {
        closedByUs = true
        input?.cancel()
        ws?.cancel()
    }

    private fun registerMessage(): JSONObject {
        val payload = JSONObject()
            .put("forcePairing", false)
            .put("pairingType", "PROMPT")
            .put(
                "manifest", JSONObject()
                    .put("appVersion", "1.1")
                    .put("manifestVersion", 1)
                    .put("permissions", JSONArray(PERMISSIONS))
            )
        session.load("clientKey")?.let { payload.put("client-key", it) }
        return JSONObject().put("type", "register").put("id", "register_0").put("payload", payload)
    }

    private fun handle(text: String) {
        val msg = try {
            JSONObject(text)
        } catch (e: Exception) {
            return
        }
        val id = msg.optString("id")
        val type = msg.optString("type")
        val payload = msg.optJSONObject("payload") ?: JSONObject()

        if (id == "register_0") {
            when (type) {
                "response" -> if (payload.optString("pairingType") == "PROMPT") session.waitingForUser("prompt")
                "registered" -> {
                    payload.optString("client-key").takeIf { it.isNotEmpty() }?.let { session.store("clientKey", it) }
                    registered = true
                    openInputSocket()
                }

                "error" -> {
                    closedByUs = true
                    ws?.cancel()
                    session.denied()
                }
            }
            return
        }
        callbacks.remove(id)?.invoke(payload)
    }

    private fun request(uri: String, payload: JSONObject = JSONObject(), callback: ((JSONObject) -> Unit)? = null) {
        val id = "req_" + ids.getAndIncrement()
        if (callback != null) callbacks[id] = callback
        ws?.send(
            JSONObject().put("id", id).put("type", "request").put("uri", "ssap://$uri").put("payload", payload).toString()
        )
    }

    private fun openInputSocket() {
        request("com.webos.service.networkinput/getPointerInputSocket") { res ->
            val path = res.optString("socketPath")
            if (path.isEmpty()) {
                dropped()
                return@request
            }
            input = Net.ws.newWebSocket(Request.Builder().url(path).build(), object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) {
                    session.connected()
                    fetchMac()
                }

                override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                    webSocket.close(1000, null)
                }

                override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = dropped()
                override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) = dropped()
            })
        }
    }

    private fun fetchMac() {
        request("com.webos.service.connectionmanager/getinfo") { res ->
            val macs = listOfNotNull(
                res.optJSONObject("wiredInfo")?.optString("macAddress"),
                res.optJSONObject("wifiInfo")?.optString("macAddress")
            ).filter { it.isNotEmpty() }
            if (macs.isNotEmpty()) session.macAddress(macs.joinToString(","))
        }
    }

    private fun button(name: String) {
        input?.send("type:button\nname:$name\n\n")
    }

    override fun key(key: String): Boolean {
        when (key) {
            "KEY_POWER" -> request("system/turnOff")
            "KEY_SOURCE" -> request("system.launcher/launch", JSONObject().put("id", "com.webos.app.inputpicker"))
            else -> button(BUTTONS[key] ?: return false)
        }
        return true
    }

    override fun pointerMove(dx: Int, dy: Int): Boolean {
        input?.send("type:move\ndx:$dx\ndy:$dy\ndown:0\n\n")
        return true
    }

    override fun pointerClick(): Boolean {
        input?.send("type:click\n\n")
        return true
    }

    override fun pointerScroll(dy: Int): Boolean {
        input?.send("type:scroll\ndx:0\ndy:$dy\n\n")
        return true
    }

    override fun text(text: String): Boolean {
        request("com.webos.service.ime/insertText", JSONObject().put("text", text).put("replace", false))
        return true
    }

    override fun launch(appId: String, appType: Int) {
        request("system.launcher/launch", JSONObject().put("id", appId))
    }

    override fun requestApps() {
        request("com.webos.applicationManager/listLaunchPoints") { res ->
            val points = res.optJSONArray("launchPoints") ?: return@request
            val out = JSONArray()
            for (i in 0 until points.length()) {
                val p = points.optJSONObject(i) ?: continue
                out.put(JSONObject().put("appId", p.optString("id")).put("name", p.optString("title")).put("app_type", 0))
            }
            session.apps(out)
        }
    }

    companion object {
        private val PERMISSIONS = listOf(
            "APP_TO_APP", "CLOSE", "CONTROL_AUDIO", "CONTROL_DISPLAY", "CONTROL_INPUT_JOYSTICK",
            "CONTROL_INPUT_MEDIA_PLAYBACK", "CONTROL_INPUT_MEDIA_RECORDING", "CONTROL_INPUT_TEXT",
            "CONTROL_INPUT_TV", "CONTROL_MOUSE_AND_KEYBOARD", "CONTROL_POWER", "CONTROL_TV_SCREEN",
            "LAUNCH", "LAUNCH_WEBAPP", "READ_APP_STATUS", "READ_COUNTRY_INFO", "READ_CURRENT_CHANNEL",
            "READ_INPUT_DEVICE_LIST", "READ_INSTALLED_APPS", "READ_LGE_SDX", "READ_LGE_TV_INPUT_EVENTS",
            "READ_NETWORK_STATE", "READ_NOTIFICATIONS", "READ_POWER_STATE", "READ_RUNNING_APPS",
            "READ_SETTINGS", "READ_TV_CHANNEL_LIST", "READ_TV_CURRENT_TIME", "READ_UPDATE_INFO",
            "SEARCH", "TEST_OPEN", "TEST_PROTECTED", "TEST_SECURE", "UPDATE_FROM_REMOTE_APP",
            "WRITE_NOTIFICATION_ALERT", "WRITE_NOTIFICATION_TOAST", "WRITE_SETTINGS"
        )

        val BUTTONS: Map<String, String> = mapOf(
            "KEY_UP" to "UP", "KEY_DOWN" to "DOWN", "KEY_LEFT" to "LEFT", "KEY_RIGHT" to "RIGHT",
            "KEY_ENTER" to "ENTER", "KEY_RETURN" to "BACK", "KEY_HOME" to "HOME", "KEY_MENU" to "MENU",
            "KEY_VOLUP" to "VOLUMEUP", "KEY_VOLDOWN" to "VOLUMEDOWN", "KEY_MUTE" to "MUTE",
            "KEY_CHUP" to "CHANNELUP", "KEY_CHDOWN" to "CHANNELDOWN",
            "KEY_RED" to "RED", "KEY_GREEN" to "GREEN", "KEY_YELLOW" to "YELLOW", "KEY_CYAN" to "BLUE",
            "KEY_PLAY" to "PLAY", "KEY_PAUSE" to "PAUSE", "KEY_STOP" to "STOP",
            "KEY_REWIND" to "REWIND", "KEY_FF" to "FASTFORWARD", "KEY_REC" to "RECORD",
            "KEY_INFO" to "INFO", "KEY_GUIDE" to "GUIDE", "KEY_EXIT" to "EXIT", "KEY_CH_LIST" to "LIST",
            "KEY_CAPTION" to "CC", "KEY_TOOLS" to "QMENU", "KEY_PICTURE_SIZE" to "ASPECT_RATIO",
        ) + (0..9).associate { "KEY_$it" to "$it" }
    }
}
