package com.home.tvremote

import java.io.ByteArrayOutputStream
import java.math.BigInteger
import java.net.InetSocketAddress
import java.net.Socket
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.Principal
import java.security.PrivateKey
import java.security.SecureRandom
import java.security.Signature
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.security.interfaces.RSAPublicKey
import java.security.spec.PKCS8EncodedKeySpec
import java.text.SimpleDateFormat
import java.util.Base64
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import javax.net.ssl.KeyManager
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocket
import javax.net.ssl.TrustManager
import javax.net.ssl.X509KeyManager
import javax.net.ssl.X509TrustManager

/** Client identity (RSA key + self-signed certificate) used for Android TV pairing. */
class ClientIdentity(val privateKey: PrivateKey, val certificate: X509Certificate) {

    val publicKey: RSAPublicKey get() = certificate.publicKey as RSAPublicKey

    fun serialize(): String =
        Base64.getEncoder().encodeToString(privateKey.encoded) + "|" +
            Base64.getEncoder().encodeToString(certificate.encoded)

    /** TLS context presenting this identity and accepting the TV's self-signed certificate. */
    fun sslContext(): SSLContext {
        val km = object : X509KeyManager {
            override fun getClientAliases(keyType: String?, issuers: Array<out Principal>?): Array<String> = arrayOf(ALIAS)
            override fun chooseClientAlias(keyType: Array<out String>?, issuers: Array<out Principal>?, socket: Socket?): String = ALIAS
            override fun getServerAliases(keyType: String?, issuers: Array<out Principal>?): Array<String> = arrayOf(ALIAS)
            override fun chooseServerAlias(keyType: String?, issuers: Array<out Principal>?, socket: Socket?): String = ALIAS
            override fun getCertificateChain(alias: String?): Array<X509Certificate> = arrayOf(certificate)
            override fun getPrivateKey(alias: String?): PrivateKey = privateKey
        }
        return SSLContext.getInstance("TLS").apply {
            init(arrayOf<KeyManager>(km), arrayOf<TrustManager>(Certs.trustAll), SecureRandom())
        }
    }

    companion object {
        private const val ALIAS = "client"

        fun deserialize(s: String?): ClientIdentity? = try {
            val (k, c) = s!!.split("|")
            val key = KeyFactory.getInstance("RSA").generatePrivate(PKCS8EncodedKeySpec(Base64.getDecoder().decode(k)))
            val cert = CertificateFactory.getInstance("X.509")
                .generateCertificate(Base64.getDecoder().decode(c).inputStream()) as X509Certificate
            ClientIdentity(key, cert)
        } catch (e: Exception) {
            null
        }

        fun generate(commonName: String): ClientIdentity {
            val kp = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
            val der = Certs.selfSignedCertificate(commonName, kp.public.encoded, kp.private)
            val cert = CertificateFactory.getInstance("X.509").generateCertificate(der.inputStream()) as X509Certificate
            return ClientIdentity(kp.private, cert)
        }
    }
}

object Certs {

    val trustAll = object : X509TrustManager {
        override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
        override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
        override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
    }

    fun connectTls(ctx: SSLContext, host: String, port: Int, timeoutMs: Int): SSLSocket {
        val raw = Socket()
        try {
            raw.connect(InetSocketAddress(host, port), timeoutMs)
            raw.soTimeout = timeoutMs
            val s = ctx.socketFactory.createSocket(raw, host, port, true) as SSLSocket
            s.startHandshake()
            return s
        } catch (e: Exception) {
            try {
                raw.close()
            } catch (_: Exception) {
            }
            throw e
        }
    }

    /**
     * Android TV pairing secret: SHA-256 over both public keys and the last 4 hex digits of the
     * code shown on the TV. The first byte of the hash must equal the code's first 2 hex digits,
     * which lets us detect a mistyped code before sending it.
     */
    fun pairingSecret(client: RSAPublicKey, server: RSAPublicKey, code: String): ByteArray? {
        val c = code.trim().uppercase()
        if (c.length != 6 || !c.all { it in "0123456789ABCDEF" }) return null
        val md = MessageDigest.getInstance("SHA-256")
        md.update(unsignedBytes(client.modulus))
        md.update(unsignedBytes(client.publicExponent))
        md.update(unsignedBytes(server.modulus))
        md.update(unsignedBytes(server.publicExponent))
        md.update(hex(c.substring(2)))
        val hash = md.digest()
        return if ((hash[0].toInt() and 0xFF) == c.substring(0, 2).toInt(16)) hash else null
    }

    private fun unsignedBytes(n: BigInteger): ByteArray {
        var h = n.toString(16)
        if (h.length % 2 == 1) h = "0$h"
        return hex(h)
    }

    private fun hex(s: String): ByteArray = ByteArray(s.length / 2) { s.substring(it * 2, it * 2 + 2).toInt(16).toByte() }

    // ---- minimal DER encoding for a self-signed X.509 v3 certificate ----

    fun selfSignedCertificate(commonName: String, spki: ByteArray, key: PrivateKey): ByteArray {
        val sha256WithRsa = seq(oid("1.2.840.113549.1.1.11"), byteArrayOf(0x05, 0x00))
        val name = seq(set(seq(oid("2.5.4.3"), tlv(0x0C, commonName.toByteArray(Charsets.UTF_8)))))
        val now = System.currentTimeMillis()
        val validity = seq(utcTime(Date(now - 86_400_000L)), utcTime(Date(now + 20L * 365 * 86_400_000L)))
        val serial = BigInteger(63, SecureRandom()).add(BigInteger.ONE)
        val tbs = seq(
            tlv(0xA0, tlv(0x02, byteArrayOf(2))),
            tlv(0x02, serial.toByteArray()),
            sha256WithRsa,
            name,
            validity,
            name,
            spki
        )
        val sig = Signature.getInstance("SHA256withRSA").run {
            initSign(key)
            update(tbs)
            sign()
        }
        return seq(tbs, sha256WithRsa, tlv(0x03, byteArrayOf(0) + sig))
    }

    private fun utcTime(d: Date): ByteArray {
        val f = SimpleDateFormat("yyMMddHHmmss'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
        return tlv(0x17, f.format(d).toByteArray(Charsets.US_ASCII))
    }

    private fun oid(dotted: String): ByteArray {
        val parts = dotted.split(".").map { it.toLong() }
        val out = ByteArrayOutputStream()
        out.write((parts[0] * 40 + parts[1]).toInt())
        for (p in parts.drop(2)) {
            val stack = ArrayList<Int>()
            var v = p
            stack.add((v and 0x7F).toInt())
            v = v shr 7
            while (v > 0) {
                stack.add(((v and 0x7F) or 0x80).toInt())
                v = v shr 7
            }
            for (b in stack.reversed()) out.write(b)
        }
        return tlv(0x06, out.toByteArray())
    }

    private fun seq(vararg parts: ByteArray) = tlv(0x30, concat(parts))
    private fun set(vararg parts: ByteArray) = tlv(0x31, concat(parts))

    private fun concat(parts: Array<out ByteArray>): ByteArray {
        val out = ByteArrayOutputStream()
        parts.forEach { out.write(it) }
        return out.toByteArray()
    }

    private fun tlv(tag: Int, content: ByteArray): ByteArray {
        val out = ByteArrayOutputStream()
        out.write(tag)
        val len = content.size
        when {
            len < 0x80 -> out.write(len)
            len < 0x100 -> {
                out.write(0x81); out.write(len)
            }
            len < 0x10000 -> {
                out.write(0x82); out.write(len shr 8); out.write(len and 0xFF)
            }
            else -> {
                out.write(0x83); out.write(len shr 16); out.write((len shr 8) and 0xFF); out.write(len and 0xFF)
            }
        }
        out.write(content)
        return out.toByteArray()
    }
}
