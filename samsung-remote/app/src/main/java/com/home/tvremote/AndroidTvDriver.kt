package com.home.tvremote

import java.io.BufferedInputStream
import java.io.IOException
import java.io.OutputStream
import java.security.cert.X509Certificate
import java.security.interfaces.RSAPublicKey
import java.util.concurrent.Executors
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLException
import javax.net.ssl.SSLSocket

/**
 * Android TV / Google TV (Sony, TCL, Philips, Xiaomi, Chromecast...) — "Android TV Remote v2".
 * TLS with a client certificate; protobuf messages framed by a varint length.
 *  - port 6466: remote control (keys, app links, text)
 *  - port 6467: pairing — the TV shows a 6-character code that the user types in.
 */
class AndroidTvDriver(ip: String, session: Session) : Driver(ip, session) {

    @Volatile
    private var socket: SSLSocket? = null
    @Volatile
    private var out: OutputStream? = null
    private val writer = Executors.newSingleThreadExecutor()

    @Volatile
    private var closedByUs = false

    @Volatile
    private var started = false

    @Volatile
    private var gotMessage = false
    private val pins = LinkedBlockingQueue<String>()

    @Volatile
    private var activeFeatures = 0L

    @Volatile
    private var imeCounter = 0L

    @Volatile
    private var imeFieldCounter = 0L

    private val identity: ClientIdentity by lazy { loadIdentity(session) }

    override fun connect() {
        Thread({ run() }, "atv-$ip").start()
    }

    override fun close() {
        closedByUs = true
        pins.offer("")
        writer.shutdownNow()
        try {
            socket?.close()
        } catch (_: Exception) {
        }
    }

    override fun submitPin(pin: String) {
        pins.offer(pin)
    }

    private fun run() {
        var needPairing = false
        try {
            // A TV that doesn't know our certificate either fails the TLS handshake or
            // closes the connection right after it, before sending anything.
            needPairing = remoteSession() && !gotMessage
        } catch (e: SSLException) {
            needPairing = !gotMessage
        } catch (e: IOException) {
            needPairing = socket != null && !gotMessage
        } catch (e: Exception) {
        }
        if (closedByUs) return
        if (needPairing) {
            try {
                if (pair()) {
                    started = false
                    gotMessage = false
                    try {
                        remoteSession()
                    } catch (_: Exception) {
                    }
                }
            } catch (_: Exception) {
            }
        }
        if (!closedByUs) session.closed()
    }

    // ------------------------------------------------------------ remote (6466)

    /** Returns true if the TLS connection was established (and later ended). */
    private fun remoteSession(): Boolean {
        socket = null
        gotMessage = false
        val s = Certs.connectTls(identity.sslContext(), ip, REMOTE_PORT, 5000)
        socket = s
        // The TV pings every ~5 s; a long silence means the connection is gone.
        s.soTimeout = 20_000
        out = s.outputStream
        val input = BufferedInputStream(s.inputStream)
        while (!closedByUs) {
            val frame = ProtoWriter.readFrame(input) ?: break
            gotMessage = true
            handleRemote(ProtoMsg.parse(frame))
        }
        try {
            s.close()
        } catch (_: Exception) {
        }
        return true
    }

    private fun handleRemote(m: ProtoMsg) {
        when {
            m.has(1) -> { // remote_configure
                val supported = m.msg(1)?.int(1) ?: 0L
                activeFeatures = WANTED_FEATURES and supported
                send(
                    ProtoWriter().message(
                        1, ProtoWriter()
                            .int(1, activeFeatures)
                            .message(
                                2, ProtoWriter()
                                    .string(1, "TV Remote")
                                    .string(2, "Home")
                                    .int(3, 1)
                                    .string(4, "1")
                                    .string(5, "atvremote")
                                    .string(6, "1.0.0")
                            )
                    )
                )
            }

            m.has(2) -> send(ProtoWriter().message(2, ProtoWriter().int(1, activeFeatures))) // remote_set_active
            m.has(8) -> { // remote_ping_request
                send(ProtoWriter().message(9, ProtoWriter().int(1, m.msg(8)?.int(1) ?: 0L)))
                markStarted()
            }

            m.has(40) -> { // remote_start: tells whether the screen is on
                val on = (m.msg(40)?.int(1) ?: 0L) == 1L
                if (screenOn != on) session.log("tv screen: ${if (on) "on" else "off"}")
                screenOn = on
                markStarted()
            }
            m.has(21) -> { // remote_ime_batch_edit
                val b = m.msg(21)
                imeCounter = b?.int(1) ?: imeCounter
                imeFieldCounter = b?.int(2) ?: imeFieldCounter
            }
        }
    }

    private fun markStarted() {
        if (!started) {
            started = true
            session.connected()
        }
    }

    private fun send(msg: ProtoWriter) {
        val bytes = ProtoWriter.frame(msg.toByteArray())
        try {
            writer.execute {
                try {
                    out?.write(bytes)
                    out?.flush()
                } catch (_: Exception) {
                    try {
                        socket?.close()
                    } catch (_: Exception) {
                    }
                }
            }
        } catch (_: Exception) {
            // writer shut down: driver closed
        }
    }

    /** The TV's own report of its screen state; null until it says. */
    @Volatile
    private var screenOn: Boolean? = null

    override fun key(key: String): Boolean {
        // In standby some TVs keep this connection but ignore POWER; WAKEUP only ever turns on.
        val wake = key == "KEY_POWER" && screenOn == false
        if (key == "KEY_POWER" || key == "KEY_WAKEUP") session.log("power key: ${if (wake) "WAKEUP (screen is off)" else key} screen=$screenOn")
        val code = (if (wake) KEYCODES["KEY_WAKEUP"] else KEYCODES[key]) ?: return false
        send(ProtoWriter().message(10, ProtoWriter().int(1, code).int(2, DIRECTION_SHORT)))
        return true
    }

    override fun text(text: String): Boolean {
        if (text.isEmpty()) return true
        val pos = text.length - 1
        val obj = ProtoWriter().int(1, pos).int(2, pos).string(3, text)
        val edit = ProtoWriter().int(1, 1).message(2, obj)
        send(ProtoWriter().message(21, ProtoWriter().int(1, imeCounter).int(2, imeFieldCounter).message(3, edit)))
        return true
    }

    override fun powerOff() {
        key("KEY_SLEEP") // KEYCODE_SLEEP only ever puts the device to sleep
    }

    /** [appId] is an app link ("https://www.netflix.com/title") or a package name. */
    override fun launch(appId: String, appType: Int) {
        // A package name: prefer the app's own link. "market://launch" opens the Play Store
        // page instead of the app on many Google TV models.
        val link = if (appId.contains(":")) appId else APP_LINKS[appId] ?: "market://launch?id=$appId"
        session.log("launch: $link")
        send(ProtoWriter().message(90, ProtoWriter().string(1, link)))
    }

    // ------------------------------------------------------------ pairing (6467)

    /** Returns true once the TV accepted the code. */
    private fun pair(): Boolean {
        val s = Certs.connectTls(identity.sslContext(), ip, PAIRING_PORT, 5000)
        socket = s
        s.soTimeout = 15_000
        val o = s.outputStream
        val input = BufferedInputStream(s.inputStream)
        val serverKey = (s.session.peerCertificates[0] as X509Certificate).publicKey as RSAPublicKey

        fun sendPairing(body: (ProtoWriter) -> Unit) {
            val w = ProtoWriter().int(1, 2).int(2, STATUS_OK)
            body(w)
            o.write(ProtoWriter.frame(w.toByteArray()))
            o.flush()
        }

        val hexEncoding = ProtoWriter().int(1, ENCODING_HEX).int(2, 6)
        sendPairing { it.message(10, ProtoWriter().string(1, "atvremote").string(2, CLIENT_NAME)) }
        try {
            while (!closedByUs) {
                val m = ProtoMsg.parse(ProtoWriter.readFrame(input) ?: return false)
                val status = m.int(2) ?: STATUS_OK
                if (status != STATUS_OK) {
                    session.toast(if (status == STATUS_BAD_SECRET) "הקוד שגוי – נסה שוב" else "הצימוד נכשל")
                    return false
                }
                when {
                    m.has(11) -> sendPairing { it.message(20, ProtoWriter().message(1, hexEncoding).int(3, ROLE_INPUT)) }
                    m.has(20) -> sendPairing { it.message(30, ProtoWriter().message(1, hexEncoding).int(2, ROLE_INPUT)) }
                    m.has(31) -> { // configuration_ack: the TV now shows the code
                        session.waitingForUser("pin")
                        s.soTimeout = 0
                        while (true) {
                            val pin = pins.poll(5, TimeUnit.MINUTES) ?: return false
                            if (closedByUs || pin.isEmpty()) return false
                            val secret = Certs.pairingSecret(identity.publicKey, serverKey, pin)
                            if (secret == null) {
                                session.toast("הקוד שגוי – בדוק את הקוד שעל המסך")
                                session.waitingForUser("pin")
                                continue
                            }
                            s.soTimeout = 15_000
                            sendPairing { it.message(40, ProtoWriter().bytes(1, secret)) }
                            break
                        }
                    }

                    m.has(41) -> return true // secret_ack
                }
            }
            return false
        } finally {
            try {
                s.close()
            } catch (_: Exception) {
            }
        }
    }

    companion object {
        const val REMOTE_PORT = 6466
        const val PAIRING_PORT = 6467
        private const val CLIENT_NAME = "TV Remote"
        private const val STATUS_OK = 200L
        private const val STATUS_BAD_SECRET = 402L
        private const val ENCODING_HEX = 3
        private const val ROLE_INPUT = 1
        private const val DIRECTION_SHORT = 3

        // Feature flags: PING | KEY | IME | POWER | VOLUME | APP_LINK
        private const val WANTED_FEATURES = 1L or 2L or 4L or 32L or 64L or 512L

        /** One client certificate per app install, shared by all Android TVs. */
        @Volatile
        private var cachedIdentity: ClientIdentity? = null

        @Synchronized
        fun loadIdentity(session: Session): ClientIdentity {
            cachedIdentity?.let { return it }
            val id = ClientIdentity.deserialize(session.load("@identity"))
                ?: ClientIdentity.generate("atvremote").also { session.store("@identity", it.serialize()) }
            cachedIdentity = id
            return id
        }

        /** Links that open each app directly (package name -> link). */
        val APP_LINKS: Map<String, String> = mapOf(
            "com.netflix.ninja" to "https://www.netflix.com/title",
            "com.google.android.youtube.tv" to "https://www.youtube.com",
            "com.google.android.youtube.tvmusic" to "https://music.youtube.com",
            "com.spotify.tv.android" to "spotify://",
            "com.disney.disneyplus" to "https://www.disneyplus.com",
            "com.amazon.amazonvideo.livingroom" to "https://app.primevideo.com",
            "com.apple.atve.androidtv.appletv" to "https://tv.apple.com",
            "com.wbd.stream" to "https://play.max.com",
            "tv.twitch.android.app" to "twitch://home",
            "com.plexapp.android" to "plex://",
        )

        /** Android KeyEvent codes. */
        val KEYCODES: Map<String, Int> = mapOf(
            "KEY_UP" to 19, "KEY_DOWN" to 20, "KEY_LEFT" to 21, "KEY_RIGHT" to 22, "KEY_ENTER" to 23,
            "KEY_RETURN" to 4, "KEY_HOME" to 3, "KEY_MENU" to 176, "KEY_POWER" to 26,
            "KEY_VOLUP" to 24, "KEY_VOLDOWN" to 25, "KEY_MUTE" to 164,
            "KEY_CHUP" to 166, "KEY_CHDOWN" to 167, "KEY_PRECH" to 229,
            "KEY_RED" to 183, "KEY_GREEN" to 184, "KEY_YELLOW" to 185, "KEY_CYAN" to 186,
            "KEY_PLAY" to 126, "KEY_PAUSE" to 127, "KEY_STOP" to 86, "KEY_REWIND" to 89, "KEY_FF" to 90,
            "KEY_REC" to 130, "KEY_INFO" to 165, "KEY_GUIDE" to 172, "KEY_EXIT" to 4,
            "KEY_CAPTION" to 175, "KEY_TOOLS" to 82, "KEY_SOURCE" to 178, "KEY_SLEEP" to 223,
            "KEY_ALL_APPS" to 284, "KEY_WAKEUP" to 224,
        ) + (0..9).associate { "KEY_$it" to 7 + it }
    }
}
