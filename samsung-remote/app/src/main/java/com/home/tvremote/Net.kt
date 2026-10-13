package com.home.tvremote

import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.Socket
import java.net.URLDecoder
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.security.auth.x500.X500Principal

/** Network helpers: TV discovery on the local network, device info and Wake-on-LAN. */
object Net {

    private val insecureSsl: SSLContext = SSLContext.getInstance("TLS").apply {
        init(null, arrayOf<TrustManager>(Certs.trustAll), SecureRandom())
    }

    // TVs use self-signed certificates; only ever used on the home LAN.
    val ws: OkHttpClient = OkHttpClient.Builder()
        .sslSocketFactory(insecureSsl.socketFactory, Certs.trustAll)
        .hostnameVerifier { _, _ -> true }
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.SECONDS)
        .pingInterval(15, TimeUnit.SECONDS)
        .build()

    private val probe: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(800, TimeUnit.MILLISECONDS)
        .readTimeout(2, TimeUnit.SECONDS)
        .callTimeout(3, TimeUnit.SECONDS)
        .build()

    private fun device(type: String, ip: String, name: String, model: String = "", mac: String = "", power: String = "") =
        JSONObject().put("type", type).put("ip", ip).put("name", name).put("model", model).put("mac", mac).put("power", power)

    /** Samsung: http://ip:8001/api/v2/ — null when no Samsung TV answers at that address. */
    fun samsungInfo(ip: String): JSONObject? {
        return try {
            val req = Request.Builder().url("http://$ip:8001/api/v2/").build()
            probe.newCall(req).execute().use { r ->
                if (!r.isSuccessful) return null
                val j = JSONObject(r.body?.string() ?: return null)
                val d = j.optJSONObject("device") ?: return null
                val name = d.optString("name").ifEmpty { j.optString("name") }.ifEmpty { "Samsung TV" }
                device(Driver.SAMSUNG, ip, name, d.optString("modelName"), d.optString("wifiMac"), d.optString("PowerState"))
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Android TV: the pairing service's certificate subject carries the device name and MAC,
     * e.g. "CN=atvremote/darcy/darcy/SHIELD Android TV/XX:XX:XX:XX:XX:XX".
     */
    fun androidTvInfo(ip: String, identity: ClientIdentity?): JSONObject? {
        if (!portOpen(ip, AndroidTvDriver.REMOTE_PORT, 600)) return null
        var name = "Android TV"
        var mac = ""
        try {
            val ctx = identity?.sslContext() ?: insecureSsl
            Certs.connectTls(ctx, ip, AndroidTvDriver.PAIRING_PORT, 1500).use { s ->
                val cert = s.session.peerCertificates[0] as X509Certificate
                parseAtvSubject(cert.subjectX500Principal)?.let {
                    name = it.first
                    mac = it.second
                }
            }
        } catch (_: Exception) {
        }
        return device(Driver.ANDROID_TV, ip, name, mac = mac)
    }

    fun parseAtvSubject(p: X500Principal): Pair<String, String>? {
        val attrs = p.getName(X500Principal.RFC2253, mapOf("2.5.4.46" to "DNQ"))
            .split(Regex("(?<!\\\\),"))
            .mapNotNull { part ->
                val i = part.indexOf('=')
                if (i < 0) null else part.substring(0, i).trim().uppercase() to part.substring(i + 1).replace("\\", "")
            }.toMap()
        val cn = attrs["CN"] ?: return null
        val dnq = attrs["DNQ"].orEmpty()
        val parts = cn.split("/")
        val name = when {
            dnq.isNotEmpty() -> dnq.split("/").last()
            parts.size > 1 -> parts[parts.size - 2]
            else -> cn
        }
        val mac = parts.last().takeIf { Regex("([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}").matches(it) }.orEmpty()
        return name.trim().ifEmpty { "Android TV" } to mac
    }

    fun portOpen(ip: String, port: Int, timeoutMs: Int): Boolean = try {
        Socket().use { it.connect(InetSocketAddress(ip, port), timeoutMs) }
        true
    } catch (e: Exception) {
        false
    }

    /** Identifies whatever TV answers at [ip]; used for manual IP entry. */
    fun identify(ip: String, identity: ClientIdentity?): JSONObject? =
        samsungInfo(ip)
            ?: androidTvInfo(ip, identity)
            ?: if (portOpen(ip, 3001, 1000) || portOpen(ip, 3000, 1000)) {
                device(Driver.LG, ip, ssdpLg(1500)[ip] ?: "LG TV")
            } else null

    /** LG webOS TVs answer SSDP searches for their "second screen" service. */
    fun ssdpLg(waitMs: Int): Map<String, String> {
        val found = HashMap<String, String>()
        try {
            DatagramSocket().use { s ->
                s.soTimeout = 300
                val msg = ("M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\n" +
                    "MX: 2\r\nST: urn:lge-com:service:webos-second-screen:1\r\n\r\n").toByteArray()
                val group = InetAddress.getByName("239.255.255.250")
                repeat(2) { s.send(DatagramPacket(msg, msg.size, group, 1900)) }
                val deadline = System.currentTimeMillis() + waitMs
                val buf = ByteArray(4096)
                while (System.currentTimeMillis() < deadline) {
                    val pkt = DatagramPacket(buf, buf.size)
                    try {
                        s.receive(pkt)
                    } catch (_: Exception) {
                        continue
                    }
                    val ip = pkt.address.hostAddress ?: continue
                    if (found.containsKey(ip)) continue
                    val headers = String(pkt.data, 0, pkt.length).split("\r\n")
                        .mapNotNull { l -> l.indexOf(':').takeIf { it > 0 }?.let { l.substring(0, it).trim().lowercase() to l.substring(it + 1).trim() } }
                        .toMap()
                    val dlnaName = headers["dlnadevicename.lge.com"]?.let { URLDecoder.decode(it, "UTF-8") }
                    found[ip] = dlnaName ?: headers["location"]?.let { friendlyName(it) } ?: "LG TV"
                }
            }
        } catch (_: Exception) {
        }
        return found
    }

    private fun friendlyName(location: String): String? = try {
        probe.newCall(Request.Builder().url(location).build()).execute().use { r ->
            Regex("<friendlyName>([^<]+)</friendlyName>").find(r.body?.string().orEmpty())?.groupValues?.get(1)
        }
    } catch (_: Exception) {
        null
    }

    fun localIPv4(): String? {
        val ifaces = try {
            NetworkInterface.getNetworkInterfaces()?.toList() ?: return null
        } catch (e: Exception) {
            return null
        }
        val candidates = ifaces
            .filter { it.isUp && !it.isLoopback }
            .flatMap { ni ->
                ni.inetAddresses.toList()
                    .filterIsInstance<Inet4Address>()
                    .filter { it.isSiteLocalAddress }
                    .map { ni.name to (it.hostAddress ?: "") }
            }
            .filter { it.second.isNotEmpty() }
        return (candidates.firstOrNull { it.first.startsWith("wlan") } ?: candidates.firstOrNull())?.second
    }

    /** Probes every address of the phone's /24 subnet for Samsung, LG and Android TVs. */
    fun scan(identity: () -> ClientIdentity?, onFound: (JSONObject) -> Unit, onDone: (String?) -> Unit) {
        Thread {
            val id = try {
                identity()
            } catch (_: Exception) {
                null
            }
            val me = localIPv4()
            if (me == null) {
                onDone(null)
                return@Thread
            }
            val reported = ConcurrentHashMap<String, JSONObject>()
            fun report(d: JSONObject) {
                reported[d.getString("ip")] = d
                onFound(d)
            }

            var lgNames: Map<String, String> = emptyMap()
            val ssdp = Thread { lgNames = ssdpLg(3000) }.apply { start() }

            val base = me.substringBeforeLast('.')
            val pool = Executors.newFixedThreadPool(96)
            for (i in 1..254) {
                val ip = "$base.$i"
                if (ip == me) continue
                pool.execute {
                    val d = samsungInfo(ip)
                        ?: androidTvInfo(ip, id)
                        ?: if (portOpen(ip, 3001, 600)) device(Driver.LG, ip, "LG TV") else null
                    if (d != null) report(d)
                }
            }
            pool.shutdown()
            pool.awaitTermination(60, TimeUnit.SECONDS)
            ssdp.join(5000)

            // LG TVs found by SSDP: add missing ones and fill in their real names.
            for ((ip, name) in lgNames) {
                val d = reported[ip]
                if (d == null) report(device(Driver.LG, ip, name))
                else if (d.optString("type") == Driver.LG && d.optString("name") != name) report(d.put("name", name))
            }
            onDone(me)
        }.start()
    }

    /** Magic packet, sent to every MAC in a comma-separated list. */
    fun wakeOnLan(macs: String, ip: String?) {
        for (mac in macs.split(',').map { it.trim() }.filter { it.isNotEmpty() }) wakeOne(mac, ip)
    }

    private fun wakeOne(mac: String, ip: String?) {
        try {
            val parts = mac.split(':', '-')
            if (parts.size != 6) return
            val macBytes = parts.map { it.toInt(16).toByte() }
            val packet = ByteArray(6 + 16 * 6)
            for (i in 0 until 6) packet[i] = 0xFF.toByte()
            for (rep in 0 until 16) for (i in 0 until 6) packet[6 + rep * 6 + i] = macBytes[i]

            val targets = mutableListOf("255.255.255.255")
            if (ip != null) {
                targets.add(ip.substringBeforeLast('.') + ".255")
                targets.add(ip)
            }
            DatagramSocket().use { s ->
                s.broadcast = true
                repeat(3) {
                    for (t in targets) for (port in intArrayOf(9, 7)) {
                        try {
                            s.send(DatagramPacket(packet, packet.size, InetAddress.getByName(t), port))
                        } catch (_: Exception) {
                        }
                    }
                    Thread.sleep(120)
                }
            }
        } catch (_: Exception) {
        }
    }
}
