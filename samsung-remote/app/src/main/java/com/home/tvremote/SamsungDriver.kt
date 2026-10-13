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

    @Volatile
    private var appsAnswered = false

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
        scanning = false
        ws?.cancel()
    }

    private fun handle(text: String) {
        session.log("in: " + text.take(600))
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
                val list = parseAppList(msg.opt("data"))
                if (list != null && list.length() > 0) {
                    appsAnswered = true
                    session.apps(list)
                }
            }
        }
    }

    private fun send(json: JSONObject) {
        if (json.optString("method") != "ms.remote.control") session.log("out: " + json.toString().take(300))
        ws?.send(json.toString())
    }

    /** The list arrives as data.data on most models; accept a bare array or a JSON string too. */
    private fun parseAppList(data: Any?): org.json.JSONArray? = when (data) {
        is org.json.JSONArray -> data
        is JSONObject -> parseAppList(data.opt("data"))
        is String -> try {
            parseAppList(org.json.JSONTokener(data).nextValue())
        } catch (_: Exception) {
            null
        }
        else -> null
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

    override fun powerOff() {
        // KEY_POWER toggles, and some models keep this socket open in standby: check first.
        Thread {
            val power = Net.samsungInfo(ip)?.optString("power").orEmpty()
            if (power.isEmpty() || power == "on") key("KEY_POWER")
        }.start()
    }

    /** Apps found by the quick check and the deep scan, merged with ones remembered from earlier scans. */
    private val quickFound = org.json.JSONArray()

    private fun foundApps(): org.json.JSONArray = try {
        org.json.JSONArray(session.load("foundApps") ?: "[]")
    } catch (_: Exception) {
        org.json.JSONArray()
    }

    private fun merged(): org.json.JSONArray {
        val out = org.json.JSONArray()
        val ids = HashSet<String>()
        for (list in listOf(quickFound, foundApps())) synchronized(list) {
            for (i in 0 until list.length()) {
                val a = list.getJSONObject(i)
                if (ids.add(a.getString("appId"))) out.put(a)
            }
        }
        return out
    }

    /** Status of one app over REST: its name if installed, null if not (or no answer). */
    private fun probe(id: String): String? {
        val url = "http://$ip:8001/api/v2/applications/$id"
        var (code, body) = Net.httpGet(url)
        if (code == -1) {
            Thread.sleep(200)
            val again = Net.httpGet(url)
            code = again.first
            body = again.second
        }
        if (code !in 200..299) return null
        return try {
            JSONObject(body).optString("name")
        } catch (_: Exception) {
            ""
        }
    }

    override fun requestApps() {
        appsAnswered = false
        send(
            JSONObject()
                .put("method", "ms.channel.emit")
                .put("params", JSONObject().put("event", "ed.installedApp.get").put("to", "host"))
        )
        // Many newer firmwares never answer that request. Fall back to asking the REST API
        // about known apps: it only answers for apps that are installed.
        Thread {
            Thread.sleep(2500)
            if (appsAnswered || closedByUs) return@Thread
            val pool = java.util.concurrent.Executors.newFixedThreadPool(6)
            val seen = java.util.Collections.synchronizedSet(HashSet<String>())
            for ((name, id) in KNOWN_APPS) pool.execute {
                if (closedByUs || name in seen) return@execute
                val real = probe(id) ?: return@execute
                if (!seen.add(name)) return@execute
                synchronized(quickFound) {
                    quickFound.put(JSONObject().put("appId", id).put("name", real.ifEmpty { name }).put("app_type", 2))
                }
            }
            pool.shutdown()
            pool.awaitTermination(60, java.util.concurrent.TimeUnit.SECONDS)
            session.log("app list: no answer from the TV; ${quickFound.length()} known apps installed, ${foundApps().length()} from deep scans")
            if (!appsAnswered && !closedByUs) session.apps(merged())
        }.start()
    }

    @Volatile
    private var scanning = false
    private val foundLock = Any()

    override fun stopScan() {
        scanning = false
    }

    override fun deepScanApps(onProgress: (Int, Int, Boolean) -> Unit): Boolean = deepScan(SAMSUNG_ID_RANGES, onProgress)

    /**
     * Tizen store app ids are "320" + yymm (registration month) + a 6-digit counter that grows over
     * time, so each month's counters fall in a narrow range. [ranges] lists those ranges
     * ("yymm:first:last ..."); every id in them is checked over REST.
     */
    internal fun deepScan(ranges: String, onProgress: (Int, Int, Boolean) -> Unit): Boolean {
        if (scanning) return true
        scanning = true
        Thread {
            val ids = ArrayList<String>()
            for (r in ranges.trim().split(Regex("\\s+"))) {
                val (m, lo, hi) = r.split(":").map { it.toInt() }
                for (seq in lo..hi) ids.add("320%04d%06d".format(m, seq))
            }
            val known = HashSet<String>()
            merged().let { for (i in 0 until it.length()) known.add(it.getJSONObject(i).getString("appId")) }
            for ((_, id) in KNOWN_APPS) known.add(id)
            val next = java.util.concurrent.atomic.AtomicInteger(0)
            val done = java.util.concurrent.atomic.AtomicInteger(0)
            val failures = java.util.concurrent.atomic.AtomicInteger(0)
            session.log("deep scan: ${ids.size} ids")
            val workers = (1..8).map {
                Thread {
                    while (scanning && !closedByUs) {
                        val i = next.getAndIncrement()
                        if (i >= ids.size) break
                        val id = ids[i]
                        val (code, body) = Net.httpGet("http://$ip:8001/api/v2/applications/$id")
                        if (code == -1) {
                            // The TV stopped answering altogether: give up rather than hammer it.
                            if (failures.incrementAndGet() > 100) scanning = false
                        } else failures.set(0)
                        if (code in 200..299 && known.add(id)) {
                            val name = try {
                                JSONObject(body).optString("name")
                            } catch (_: Exception) {
                                ""
                            }.ifEmpty { id }
                            synchronized(foundLock) {
                                val all = foundApps()
                                all.put(JSONObject().put("appId", id).put("name", name).put("app_type", 2))
                                session.store("foundApps", all.toString())
                            }
                            session.log("deep scan found $id $name")
                            session.apps(merged())
                        }
                        val d = done.incrementAndGet()
                        if (d % 200 == 0) onProgress(d, ids.size, false)
                    }
                }.apply { start() }
            }
            workers.forEach { it.join() }
            val stoppedEarly = scanning.not() && done.get() < ids.size
            scanning = false
            session.log("deep scan ${if (stoppedEarly) "stopped" else "finished"} after ${done.get()} ids")
            onProgress(done.get(), ids.size, true)
        }.start()
        return true
    }

    companion object {
        private const val APP_NAME = "Home Remote"

        /** Tizen app ids of popular apps (some apps have several ids across model years). */
        val KNOWN_APPS = listOf(
            "Netflix" to "3201907018807", "Netflix" to "11101200001", "Netflix" to "org.tizen.netflix-app",
            "YouTube" to "111299001912", "YouTube Kids" to "3201611010983", "YouTube TV" to "3201707014489",
            "Spotify" to "3201606009684", "Disney+" to "3201901017640", "Disney+" to "3202009021709", "Disney+" to "3202204027038",
            "Prime Video" to "3201910019365", "Prime Video" to "3201512006785", "Prime Video" to "org.tizen.ignition",
            "Apple TV" to "3201807016597", "Apple Music" to "3201908019041", "Max" to "3202301029760", "HBO Max" to "3201601007230",
            "HBO GO" to "3201706012478", "Paramount+" to "3201710014981", "Paramount+" to "3202110025305",
            "Peacock" to "3202006020991", "Hulu" to "3201601007625", "Plex" to "3201512006963", "Emby" to "3201606009872",
            "Twitch" to "3202203026841", "TikTok" to "3202008021577", "Facebook Watch" to "11091000000",
            "Pluto TV" to "3201808016802", "Tubi" to "3201504001965", "Rakuten TV" to "3201511006428", "DAZN" to "3201806016390",
            "Red Bull TV" to "3201602007756", "Steam Link" to "3201702011851", "Xbox" to "3202203026799",
            "Amazon Music" to "3201710014874", "TIDAL" to "3201805016367", "Deezer" to "3201608010191", "TuneIn" to "121299000101",
            "Kan 11" to "3201803015997", "Mako" to "3201506003716", "Reshet 13" to "3201812017600", "13 Now" to "3201905018499",
            "Gallery" to "3201710015037", "Universal Guide" to "3201710015067", "Internet" to "org.tizen.browser",
            "Internet" to "3201907018784", "Internet" to "3202010022079", "SmartThings" to "3201710015016",
            "SmartThings" to "3201910019378", "Google Meet" to "3202008021439", "IPTV Smarters" to "3201812017585",
            "IPTV Smarters Pro" to "3202009021808", "Smart IPTV" to "3202102022877", "Discovery+" to "3201803015944",
            "SkyShowtime" to "3202208028071", "Viaplay" to "11111300404", "Shudder" to "3201902017887", "ESPN" to "3201708014618",
            "Jellyfin" to "AprZAARz4r.Jellyfin", "TizenBrew" to "xvvl3S1bvH.TizenBrewStandalone",
        )
    }
}
