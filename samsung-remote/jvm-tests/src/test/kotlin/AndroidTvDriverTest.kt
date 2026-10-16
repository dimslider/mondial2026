package com.home.tvremote

import java.io.BufferedInputStream
import java.io.OutputStream
import java.net.InetAddress
import java.security.interfaces.RSAPublicKey
import java.util.Base64
import java.util.Collections
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLServerSocket
import javax.net.ssl.SSLSocket
import kotlin.concurrent.thread
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/** Fake Android TV implementing the server side of pairing (6467) and remote (6466). */
class FakeAndroidTv {
    val identity = ClientIdentity.generate("atvremote/fake/fake/Fake TV/AA:BB:CC:DD:EE:FF")
    val paired: MutableSet<String> = Collections.synchronizedSet(HashSet())
    val codes = LinkedBlockingQueue<String>()
    val received = LinkedBlockingQueue<ProtoMsg>()
    @Volatile var configureReply: ProtoMsg? = null
    private val sockets = ArrayList<SSLServerSocket>()

    fun start() {
        val ctx = identity.sslContext()
        for ((port, handler) in listOf(6466 to ::handleRemote, 6467 to ::handlePairing)) {
            val ss = ctx.serverSocketFactory.createServerSocket(port, 5, InetAddress.getByName("127.0.0.1")) as SSLServerSocket
            ss.needClientAuth = true
            sockets.add(ss)
            thread(isDaemon = true) {
                while (!ss.isClosed) {
                    val s = try { ss.accept() as SSLSocket } catch (e: Exception) { break }
                    thread(isDaemon = true) { try { handler(s) } catch (_: Exception) { } finally { s.close() } }
                }
            }
        }
    }

    fun stop() = sockets.forEach { it.close() }

    private fun clientKey(s: SSLSocket): String {
        s.startHandshake()
        return Base64.getEncoder().encodeToString(s.session.peerCertificates[0].encoded)
    }

    private fun write(o: OutputStream, w: ProtoWriter) { o.write(ProtoWriter.frame(w.toByteArray())); o.flush() }

    private fun handleRemote(s: SSLSocket) {
        if (clientKey(s) !in paired) return // unknown certificate: hang up
        val o = s.outputStream
        val inp = BufferedInputStream(s.inputStream)
        write(o, ProtoWriter().message(1, ProtoWriter().int(1, 0x27FL).message(2, ProtoWriter().string(1, "Fake").string(2, "Fake"))))
        while (true) {
            val m = ProtoMsg.parse(ProtoWriter.readFrame(inp) ?: return)
            when {
                m.has(1) -> { configureReply = m; write(o, ProtoWriter().message(2, ProtoWriter())) }
                m.has(2) -> { write(o, ProtoWriter().message(40, ProtoWriter().int(1, 1))); write(o, ProtoWriter().message(8, ProtoWriter().int(1, 7))) }
                m.has(9) -> received.add(m)
                else -> received.add(m)
            }
        }
    }

    private fun handlePairing(s: SSLSocket) {
        val key = clientKey(s)
        val clientPub = s.session.peerCertificates[0].publicKey as RSAPublicKey
        val o = s.outputStream
        val inp = BufferedInputStream(s.inputStream)
        fun reply(body: (ProtoWriter) -> Unit, status: Int = 200) {
            val w = ProtoWriter().int(1, 2).int(2, status); body(w); write(o, w)
        }
        var code = ""
        while (true) {
            val m = ProtoMsg.parse(ProtoWriter.readFrame(inp) ?: return)
            assertEquals(2L, m.int(1)); assertEquals(200L, m.int(2))
            when {
                m.has(10) -> {
                    assertEquals("atvremote", m.msg(10)!!.string(1))
                    reply({ it.message(11, ProtoWriter().string(1, "Fake TV")) })
                }
                m.has(20) -> {
                    val enc = m.msg(20)!!.msg(1)!!
                    assertEquals(3L, enc.int(1)); assertEquals(6L, enc.int(2))
                    reply({ it.message(20, ProtoWriter().message(1, ProtoWriter().int(1, 3).int(2, 6)).int(3, 1)) })
                }
                m.has(30) -> {
                    val last4 = "%04X".format((0..0xFFFF).random())
                    code = (0..255).map { "%02X".format(it) + last4 }
                        .first { Certs.pairingSecret(clientPub, identity.publicKey, it) != null }
                    reply({ it.message(31, ProtoWriter()) })
                    codes.add(code) // "shown on screen"
                }
                m.has(40) -> {
                    val expected = Certs.pairingSecret(clientPub, identity.publicKey, code)!!
                    if (expected.contentEquals(m.msg(40)!!.bytes(1))) {
                        paired.add(key)
                        reply({ it.message(41, ProtoWriter()) })
                    } else reply({}, 402)
                }
            }
        }
    }
}

class AndroidTvDriverTest {
    private val tv = FakeAndroidTv().apply { start() }

    @AfterTest
    fun tearDown() = tv.stop()

    private fun nextNonPing(): ProtoMsg {
        while (true) {
            val m = tv.received.poll(5, TimeUnit.SECONDS) ?: error("no message from driver")
            if (!m.has(9)) return m
        }
    }

    @Test
    fun pairsThenControlsAndReconnectsWithoutPairing() {
        val session = TestSession()
        val d = AndroidTvDriver("127.0.0.1", session)
        d.connect()
        session.await("wait:pin")
        val code = tv.codes.poll(10, TimeUnit.SECONDS)!!

        // a mistyped code is caught locally and asked again
        val wrong = "%02X".format((code.substring(0, 2).toInt(16) + 1) % 256) + code.substring(2)
        d.submitPin(wrong)
        session.await("toast:הקוד שגוי")
        session.await("wait:pin")

        d.submitPin(code.lowercase())
        session.await("connected")
        assertTrue(session.storage.containsKey("@identity"))

        val cfg = assertNotNull(tv.configureReply).msg(1)!!
        assertEquals(0x27FL and (1L or 2L or 4L or 32L or 64L or 512L), cfg.int(1))
        assertEquals("atvremote", cfg.msg(2)!!.string(5))

        assertTrue(d.key("KEY_VOLUP"))
        nextNonPing().msg(10)!!.let { assertEquals(24L, it.int(1)); assertEquals(3L, it.int(2)) }
        assertTrue(d.key("KEY_3"))
        assertEquals(10L, nextNonPing().msg(10)!!.int(1))
        d.launch("https://www.netflix.com/title", 0)
        assertEquals("https://www.netflix.com/title", nextNonPing().msg(90)!!.string(1))
        d.launch("com.spotify.tv.android", 0)
        assertEquals("spotify://", nextNonPing().msg(90)!!.string(1))
        d.launch("org.xbmc.kodi", 0)
        assertEquals("market://launch?id=org.xbmc.kodi", nextNonPing().msg(90)!!.string(1))
        d.text("hi")
        nextNonPing().msg(21)!!.msg(3)!!.msg(2)!!.let { assertEquals("hi", it.string(3)); assertEquals(1L, it.int(1)) }
        assertEquals(false, d.key("KEY_AMBIENT"))
        d.close()

        // same stored identity: connects straight away
        val again = TestSession().apply { storage.putAll(session.storage) }
        val d2 = AndroidTvDriver("127.0.0.1", again)
        d2.connect()
        assertEquals("connected", again.await("connected"))
        assertTrue(again.events.none { it.startsWith("wait:") })
        d2.close()
    }

    @Test
    fun reportsClosedWhenNothingListens() {
        tv.stop()
        val s = TestSession()
        AndroidTvDriver("127.0.0.1", s).connect()
        s.await("closed")
        assertTrue(s.events.none { it.startsWith("wait:") })
    }
}
