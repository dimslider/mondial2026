package com.home.tvremote

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import org.json.JSONArray
import org.json.JSONObject

/**
 * Owns the connection to the selected TV: state machine, reconnects, queued commands.
 * The brand-specific protocol lives in a [Driver]. All state is touched only on the main thread.
 */
class TvClient(context: Context, private val emit: (JSONObject) -> Unit) {

    private val prefs = context.getSharedPreferences("tv", Context.MODE_PRIVATE)
    private val main = Handler(Looper.getMainLooper())
    private var driver: Driver? = null
    private var generation = 0
    private var attempt = 0
    private var active = false
    private var state = "idle"
    private val pending = ArrayList<Pair<Long, (Driver) -> Unit>>()

    val ip: String? get() = prefs.getString("ip", null)
    private val type: String get() = prefs.getString("type", null) ?: Driver.SAMSUNG
    private val mac: String? get() = prefs.getString("mac", null)
    private val name: String? get() = prefs.getString("name", null)
    val isConnected: Boolean get() = state == "connected"

    private val retry = Runnable { if (active) connect() }

    private fun post(block: () -> Unit) {
        main.post { block() }
    }

    /** Storage shared with drivers: keys starting with "@" are global, the rest are per TV. */
    private fun storeKey(key: String, forType: String, forIp: String): String =
        if (key.startsWith("@")) key else "$forType:$forIp:$key"

    fun identity(): ClientIdentity = AndroidTvDriver.loadIdentity(object : Session {
        override fun connected() {}
        override fun waitingForUser(kind: String) {}
        override fun denied() {}
        override fun closed() {}
        override fun apps(list: JSONArray) {}
        override fun macAddress(mac: String) {}
        override fun toast(text: String) {}
        override fun load(key: String) = prefs.getString(key, null)
        override fun store(key: String, value: String?) {
            prefs.edit().putString(key, value).apply()
        }
    })

    fun start() = post {
        active = true
        if (driver == null && state != "denied") connect() else emitStatus()
    }

    fun stop() = post {
        active = false
        main.removeCallbacks(retry)
        generation++
        driver?.close()
        driver = null
        if (state != "noTv") state = "idle"
    }

    fun reconnect() = post {
        attempt = 0
        connect()
    }

    fun requestStatus() = post { emitStatus() }

    fun setTv(ip: String, type: String, name: String?, mac: String?) = post {
        prefs.edit()
            .putString("ip", ip)
            .putString("type", type)
            .putString("name", name ?: "TV")
            .putString("mac", mac ?: "")
            .apply()
        attempt = 0
        connect()
    }

    fun resetPairing() = post {
        val all = prefs.all.keys.filter { it.startsWith("$type:$ip:") || it == "token_$ip" }
        prefs.edit().apply { all.forEach { remove(it) } }.apply()
        attempt = 0
        connect()
    }

    fun submitPin(pin: String) = post { driver?.submitPin(pin) }

    fun sendKey(key: String) = command { d ->
        if (!d.key(key)) toast("הכפתור הזה לא נתמך בטלוויזיה הזו")
    }

    fun sendText(text: String) = command { d ->
        if (!d.text(text)) toast("הקלדה לא נתמכת בטלוויזיה הזו")
    }

    fun launchApp(appId: String, appType: Int) = command { it.launch(appId, appType) }

    fun requestApps() = command { it.requestApps() }

    fun power() = post {
        if (isConnected) {
            driver?.key("KEY_POWER")
            return@post
        }
        val m = mac
        val target = ip
        if (!m.isNullOrEmpty()) {
            Thread { Net.wakeOnLan(m, target) }.start()
            toast("שולח הדלקה לטלוויזיה…")
        }
        // Android TVs often keep the remote service alive in standby: queue a power key.
        if (type == Driver.ANDROID_TV) queue { it.key("KEY_POWER") }
        attempt = 0
        if (state != "connecting") connect()
    }

    private fun command(action: (Driver) -> Unit) = post {
        val d = driver
        if (isConnected && d != null) {
            action(d)
            return@post
        }
        queue(action)
        if (driver == null || state == "denied") {
            attempt = 0
            connect()
        }
    }

    private fun queue(action: (Driver) -> Unit) {
        pending.add(SystemClock.elapsedRealtime() to action)
        while (pending.size > 10) pending.removeAt(0)
    }

    private fun connect() {
        main.removeCallbacks(retry)
        val ip = ip ?: run {
            setState("noTv")
            return
        }
        val gen = ++generation
        driver?.close()
        setState(if (attempt == 0) "connecting" else "reconnecting")
        val d = Driver.create(type, ip, sessionFor(gen, type, ip))
        driver = d
        d.connect()
    }

    private fun sessionFor(gen: Int, tvType: String, tvIp: String) = object : Session {
        private fun onMain(block: () -> Unit) {
            main.post { if (gen == generation) block() }
        }

        override fun connected() = onMain {
            attempt = 0
            setState("connected")
            flushPending()
            driver?.requestApps()
        }

        override fun waitingForUser(kind: String) = onMain { setState(if (kind == "pin") "pin" else "pairing") }

        override fun denied() = onMain {
            driver?.close()
            driver = null
            setState("denied")
        }

        override fun closed() = onMain { dropped() }

        override fun apps(list: JSONArray) = onMain { emit(JSONObject().put("type", "apps").put("apps", list)) }

        override fun macAddress(mac: String) = onMain {
            if (mac.isNotEmpty() && mac != this@TvClient.mac) prefs.edit().putString("mac", mac).apply()
        }

        override fun toast(text: String) = onMain { this@TvClient.toast(text) }

        override fun load(key: String): String? =
            prefs.getString(storeKey(key, tvType, tvIp), null)
                // Version 1 stored the Samsung token as "token_<ip>".
                ?: if (key == "token" && tvType == Driver.SAMSUNG) prefs.getString("token_$tvIp", null) else null

        override fun store(key: String, value: String?) {
            prefs.edit().putString(storeKey(key, tvType, tvIp), value).apply()
        }
    }

    private fun flushPending() {
        val now = SystemClock.elapsedRealtime()
        val toRun = pending.filter { now - it.first < 8000 }.map { it.second }
        pending.clear()
        driver?.let { d -> toRun.forEach { it(d) } }
    }

    private fun dropped() {
        driver?.close()
        driver = null
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
                .put("tvType", if (ip == null) "" else type)
                .put("name", name ?: "")
                .put("mac", mac ?: "")
        )
    }

    private fun toast(text: String) {
        emit(JSONObject().put("type", "toast").put("text", text))
    }
}
