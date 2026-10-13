package com.home.tvremote

import java.io.ByteArrayInputStream
import java.security.Signature
import java.security.cert.X509Certificate
import javax.security.auth.x500.X500Principal
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ProtoAndCertTest {

    @Test
    fun protoRoundTrip() {
        val w = ProtoWriter()
            .int(1, 2)
            .int(2, 200)
            .int(3, 622L)
            .int(4, -1)
            .message(10, ProtoWriter().string(1, "atvremote").string(2, "שלט"))
            .bytes(40, byteArrayOf(1, 2, 3))
        val framed = ProtoWriter.frame(w.toByteArray())
        val read = ProtoWriter.readFrame(ByteArrayInputStream(framed))!!
        val m = ProtoMsg.parse(read)
        assertEquals(2L, m.int(1))
        assertEquals(200L, m.int(2))
        assertEquals(622L, m.int(3))
        assertEquals(-1L, m.int(4))
        assertEquals("atvremote", m.msg(10)!!.string(1))
        assertEquals("שלט", m.msg(10)!!.string(2))
        assertContentEquals(byteArrayOf(1, 2, 3), m.bytes(40))
        assertTrue(!m.has(11))
    }

    @Test
    fun protoMatchesKnownEncoding() {
        // OuterMessage{protocol_version:2, status:200} encoded by the reference protobuf library
        val expected = byteArrayOf(0x08, 0x02, 0x10, 0xC8.toByte(), 0x01)
        assertContentEquals(expected, ProtoWriter().int(1, 2).int(2, 200).toByteArray())
    }

    @Test
    fun selfSignedCertificateIsValid() {
        val id = ClientIdentity.generate("atvremote")
        val cert: X509Certificate = id.certificate
        cert.checkValidity()
        cert.verify(cert.publicKey)
        assertEquals("CN=atvremote", cert.subjectX500Principal.name)
        assertEquals(3, cert.version)
        // serialization round trip, and the restored key matches the certificate
        val back = ClientIdentity.deserialize(id.serialize())!!
        val sig = Signature.getInstance("SHA256withRSA").apply { initSign(back.privateKey); update(byteArrayOf(9)) }.sign()
        assertTrue(Signature.getInstance("SHA256withRSA").apply { initVerify(back.certificate); update(byteArrayOf(9)) }.verify(sig))
        assertNull(ClientIdentity.deserialize("garbage"))
    }

    @Test
    fun pairingSecretMatchesPythonReference() {
        val client = ClientIdentity.generate("client").publicKey
        val server = ClientIdentity.generate("server").publicKey
        val last4 = "3F9A"
        // Same computation as androidtvremote2/pairing.py, run through python.
        val py = """
import hashlib, sys
cn, ce, sn, se, code4 = sys.argv[1:]
cn, ce, sn, se = (int(x, 16) for x in (cn, ce, sn, se))
h = hashlib.sha256()
h.update(bytes.fromhex(f"{cn:X}"))
h.update(bytes.fromhex(f"0{ce:X}"))
h.update(bytes.fromhex(f"{sn:X}"))
h.update(bytes.fromhex(f"0{se:X}"))
h.update(bytes.fromhex(code4))
d = h.digest()
print(f"{d[0]:02X}" + code4, d.hex())
""".trimIndent()
        val p = ProcessBuilder(
            "python3", "-I", "-c", py,
            client.modulus.toString(16), client.publicExponent.toString(16),
            server.modulus.toString(16), server.publicExponent.toString(16), last4
        ).redirectErrorStream(true).start()
        val out = p.inputStream.bufferedReader().readText().trim()
        assertEquals(0, p.waitFor(), out)
        val (code, hashHex) = out.split(" ")
        val secret = Certs.pairingSecret(client, server, code)
        assertNotNull(secret, "code $code should validate")
        assertEquals(hashHex, secret.joinToString("") { "%02x".format(it) })
        assertNotNull(Certs.pairingSecret(client, server, code.lowercase()))
        // any other first byte must be rejected locally
        val wrong = "%02X".format((code.substring(0, 2).toInt(16) + 1) % 256) + last4
        assertNull(Certs.pairingSecret(client, server, wrong))
        assertNull(Certs.pairingSecret(client, server, "12345"))
        assertNull(Certs.pairingSecret(client, server, "ZZZZZZ"))
    }

    @Test
    fun parsesAndroidTvCertificateSubjects() {
        assertEquals(
            "SHIELD Android TV" to "00:11:22:33:44:55",
            Net.parseAtvSubject(X500Principal("CN=atvremote/darcy/darcy/SHIELD Android TV/00:11:22:33:44:55"))
        )
        assertEquals(
            "Nexus Player" to "00:11:22:33:44:55",
            Net.parseAtvSubject(X500Principal("DNQ=fugu/fugu/Nexus Player, CN=atvremote/00:11:22:33:44:55"))
        )
        assertEquals("TCL 55C635" to "", Net.parseAtvSubject(X500Principal("CN=TCL 55C635")))
    }
}
