package com.home.tvremote

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Owns the connection to the selected TV: saved TVs, state machine, reconnects, queued commands.
 * One instance per process, shared by the remote screen, the notification, the widget and timers.
 * The brand-specific protocol lives in a [Driver]. All state is touched only on the main thread.
 */
class TvClient private constructor(private val context: Context) {

    companion object {
        @Volatile
        private var instance: TvClient? = null

        fun get(context: Context): TvClient =
            instance ?: synchronized(this) { instance ?: TvClient(context.applicationContext).also { instance = it } }
    }

    private val prefs = context.getSharedPreferences("tv", Context.MODE_PRIVATE)
    private val main = Handler(Looper.getMainLooper())
    private val listeners = CopyOnWriteArrayList<(JSONObject) -> Unit>()
    private val holders = HashSet<String>()
    private var driver: Driver? = null
    private var generation = 0
    private var attempt = 0
    private var state = "idle"
    private val pending = ArrayList<Pair<Long, (Driver) -> Unit>>()
    private val logLines = java.util.ArrayDeque<String>()

    private fun addLog(line: String) = synchronized(logLines) {
        val t = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date())
        logLines.addLast("$t $line")
        while (logLines.size > 80) logLines.removeFirst()
    }

    /** Recent connection events, for the "copy diagnostics" button. */
    fun diagnostics(version: String): String {
        val head = "TV Remote $version · ${type} · ${ip ?: "-"} · state=$state · android=${android.os.Build.VERSION.SDK_INT}"
        return head + "\n" + synchronized(logLines) { logLines.joinToString("\n") }
    }

    val ip: String? get() = prefs.getString("ip", null)
    private val type: String get() = prefs.getString("type", null) ?: Driver.SAMSUNG
    private val mac: String? get() = prefs.getString("mac", null)
    private val name: String? get() = prefs.getString("name", null)
    val isConnected: Boolean get() = state == "connected"
    val stateName: String get() = state

    /** Short name for the current TV: the user's label, else the TV's own name. */
    val displayName: String
        get() = savedTvs().let { list ->
            (0 until list.length()).map { list.getJSONObject(it) }.firstOrNull { it.optString("ip") == ip }
                ?.optString("label")?.takeIf { it.isNotEmpty() }
        } ?: name ?: "TV"

    private val retry = Runnable { if (holders.isNotEmpty()) connect() }

    private fun post(block: () -> Unit) {
        main.post { block() }
    }

    fun addListener(l: (JSONObject) -> Unit) = listeners.add(l)
    fun removeListener(l: (JSONObject) -> Unit) = listeners.remove(l)
    private fun emit(j: JSONObject) = listeners.forEach { it(j) }

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

    // ------------------------------------------------------------ lifecycle

    /** Something wants the connection kept open (the remote screen, the notification...). */
    fun acquire(tag: String) = post {
        holders.add(tag)
        if (driver == null && state != "denied") connect() else emitStatus()
    }

    fun release(tag: String) = post {
        holders.remove(tag)
        if (holders.isEmpty()) disconnect()
    }

    private fun disconnect() {
        main.removeCallbacks(retry)
        generation++
        driver?.close()
        driver = null
        if (state != "noTv") state = "idle"
        emitStatus()
    }

    fun reconnect() = post {
        attempt = 0
        connect()
    }

    fun requestStatus() = post { emitStatus() }

    // ------------------------------------------------------------ saved TVs

    fun savedTvs(): JSONArray {
        prefs.getString("tvs", null)?.let {
            try {
                return JSONArray(it)
            } catch (_: Exception) {
            }
        }
        // Versions before the TV list kept only the current TV.
        val list = JSONArray()
        ip?.let { list.put(JSONObject().put("ip", it).put("type", type).put("name", name ?: "TV").put("label", "").put("mac", mac ?: "")) }
        return list
    }

    private fun saveTvs(list: JSONArray) {
        prefs.edit().putString("tvs", list.toString()).apply()
    }

    private fun updateSaved(ip: String, change: (JSONObject) -> Unit) {
        val list = savedTvs()
        for (i in 0 until list.length()) if (list.getJSONObject(i).optString("ip") == ip) change(list.getJSONObject(i))
        saveTvs(list)
    }

    /** Adds (or updates) a TV and makes it the current one. */
    fun setTv(ip: String, type: String, name: String?, mac: String?) = post {
        val list = savedTvs()
        val entry: JSONObject = (0 until list.length()).map { list.getJSONObject(it) }.firstOrNull { it.optString("ip") == ip }
            ?: JSONObject().put("ip", ip).put("label", "").also { list.put(it) }
        entry.put("type", type).put("name", name ?: "TV")
        if (!mac.isNullOrEmpty()) entry.put("mac", mac)
        saveTvs(list)
        switchTo(entry)
    }

    /** Switches to a TV from the saved list. */
    fun selectTv(ip: String) = post {
        val list = savedTvs()
        for (i in 0 until list.length()) if (list.getJSONObject(i).optString("ip") == ip) switchTo(list.getJSONObject(i))
    }

    private fun switchTo(tv: JSONObject) {
        prefs.edit()
            .putString("ip", tv.optString("ip"))
            .putString("type", tv.optString("type", Driver.SAMSUNG))
            .putString("name", tv.optString("name", "TV"))
            .putString("mac", tv.optString("mac", ""))
            .apply()
        pending.clear()
        attempt = 0
        connect()
        RemoteWidget.refresh(context)
    }

    fun renameTv(ip: String, label: String) = post {
        updateSaved(ip) { it.put("label", label.trim()) }
        emitStatus()
        RemoteWidget.refresh(context)
    }

    fun removeTv(ip: String) = post {
        val list = savedTvs()
        val kept = JSONArray()
        for (i in 0 until list.length()) list.getJSONObject(i).let { if (it.optString("ip") != ip) kept.put(it) }
        saveTvs(kept)
        prefs.edit().apply { prefs.all.keys.filter { it.contains(":$ip:") || it == "token_$ip" }.forEach { remove(it) } }.apply()
        if (ip == this.ip) {
            if (kept.length() > 0) switchTo(kept.getJSONObject(0))
            else {
                prefs.edit().remove("ip").remove("type").remove("name").remove("mac").apply()
                disconnect()
                setState("noTv")
            }
        } else emitStatus()
    }

    fun resetPairing() = post {
        val all = prefs.all.keys.filter { it.startsWith("$type:$ip:") || it == "token_$ip" }
        prefs.edit().apply { all.forEach { remove(it) } }.apply()
        attempt = 0
        connect()
    }

    // ------------------------------------------------------------ commands

    fun submitPin(pin: String) = post { driver?.submitPin(pin) }

    fun log(line: String) = addLog(line)

    fun sendKey(key: String) = command { d ->
        if (!d.key(key)) toast("הכפתור הזה לא נתמך בטלוויזיה הזו")
    }

    fun sendText(text: String) = command { d ->
        if (!d.text(text)) toast("הקלדה לא נתמכת בטלוויזיה הזו")
    }

    fun launchApp(appId: String, appType: Int) = command { it.launch(appId, appType) }

    fun requestApps() = command { it.requestApps() }


    /** Turns the TV off without ever turning it on (sleep timer). */
    fun powerOff() = command { it.powerOff() }

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

    // ------------------------------------------------------------ connection

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
            if (mac.isNotEmpty() && mac != this@TvClient.mac) {
                prefs.edit().putString("mac", mac).apply()
                updateSaved(tvIp) { it.put("mac", mac) }
            }
        }

        override fun toast(text: String) = onMain { this@TvClient.toast(text) }

        override fun keyboardShown() = onMain {
            addLog("tv keyboard opened")
            emit(JSONObject().put("type", "keyboard"))
        }

        override fun log(line: String) = addLog(line)

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
        if (holders.isEmpty() || state == "denied") {
            state = "idle"
            emitStatus()
            return
        }
        attempt++
        setState("reconnecting")
        // On screen: retry quickly. Background only (notification, call mute): go easy on the battery.
        val cap = if ("screen" in holders) 8_000L else 60_000L
        val delay = minOf(cap, 500L shl minOf(attempt, 7))
        main.postDelayed(retry, delay)
    }

    private fun setState(s: String) {
        if (s != state) addLog("state: $s")
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
                .put("label", if (ip == null) "" else displayName)
                .put("mac", mac ?: "")
                .put("tvs", savedTvs())
                .put("sleepAt", SleepTimer.endsAt(prefs))
        )
    }

    private fun toast(text: String) {
        emit(JSONObject().put("type", "toast").put("text", text))
    }
}
