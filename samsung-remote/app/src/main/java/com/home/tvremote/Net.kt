package com.home.tvremote

import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.NetworkInterface
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

/** Network helpers: TV discovery on the local network, device info and Wake-on-LAN. */
object Net {

    // Samsung TVs use a self-signed certificate on port 8002; only ever used on the home LAN.
    private val trustAll = object : X509TrustManager {
        override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
        override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
        override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
    }

    private val ssl: SSLContext = SSLContext.getInstance("TLS").apply {
        init(null, arrayOf<TrustManager>(trustAll), SecureRandom())
    }

    val ws: OkHttpClient = OkHttpClient.Builder()
        .sslSocketFactory(ssl.socketFactory, trustAll)
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

    /** Reads http://ip:8001/api/v2/ — returns null when no Samsung TV answers at that address. */
    fun deviceInfo(ip: String): JSONObject? {
        return try {
            val req = Request.Builder().url("http://$ip:8001/api/v2/").build()
            probe.newCall(req).execute().use { r ->
                if (!r.isSuccessful) return null
                val body = r.body?.string() ?: return null
                val j = JSONObject(body)
                val d = j.optJSONObject("device") ?: return null
                val name = d.optString("name").ifEmpty { j.optString("name") }.ifEmpty { "Samsung TV" }
                JSONObject()
                    .put("ip", ip)
                    .put("name", name)
                    .put("model", d.optString("modelName"))
                    .put("mac", d.optString("wifiMac"))
                    .put("power", d.optString("PowerState"))
            }
        } catch (e: Exception) {
            null
        }
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

    /** Probes every address of the phone's /24 subnet in parallel. */
    fun scan(onFound: (JSONObject) -> Unit, onDone: (String?) -> Unit) {
        Thread {
            val me = localIPv4()
            if (me == null) {
                onDone(null)
                return@Thread
            }
            val base = me.substringBeforeLast('.')
            val pool = Executors.newFixedThreadPool(48)
            for (i in 1..254) {
                val ip = "$base.$i"
                if (ip == me) continue
                pool.execute { deviceInfo(ip)?.let(onFound) }
            }
            pool.shutdown()
            pool.awaitTermination(40, TimeUnit.SECONDS)
            onDone(me)
        }.start()
    }

    /** Magic packet; works when "Power On with Mobile" is enabled on the TV. */
    fun wakeOnLan(mac: String, ip: String?) {
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
