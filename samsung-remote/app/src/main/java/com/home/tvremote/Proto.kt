package com.home.tvremote

import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.io.InputStream

/** Minimal protobuf encoder — just what the Android TV remote protocol needs. */
class ProtoWriter {
    private val out = ByteArrayOutputStream()

    fun int(field: Int, value: Long): ProtoWriter {
        tag(field, 0)
        rawVarint(value)
        return this
    }

    fun int(field: Int, value: Int): ProtoWriter = int(field, value.toLong())

    fun bytes(field: Int, value: ByteArray): ProtoWriter {
        tag(field, 2)
        rawVarint(value.size.toLong())
        out.write(value)
        return this
    }

    fun string(field: Int, value: String): ProtoWriter = bytes(field, value.toByteArray(Charsets.UTF_8))

    fun message(field: Int, value: ProtoWriter): ProtoWriter = bytes(field, value.toByteArray())

    fun toByteArray(): ByteArray = out.toByteArray()

    private fun tag(field: Int, wireType: Int) = rawVarint(((field shl 3) or wireType).toLong())

    private fun rawVarint(value: Long) = writeVarint(out, value)

    companion object {
        fun writeVarint(out: ByteArrayOutputStream, value: Long) {
            var v = value
            while (true) {
                if (v and 0x7FL.inv() == 0L) {
                    out.write(v.toInt())
                    return
                }
                out.write(((v and 0x7F) or 0x80).toInt())
                v = v ushr 7
            }
        }

        /** Length-prefixed frame, as sent on the wire. */
        fun frame(message: ByteArray): ByteArray {
            val out = ByteArrayOutputStream()
            writeVarint(out, message.size.toLong())
            out.write(message)
            return out.toByteArray()
        }

        fun readVarint(input: InputStream): Long? {
            var result = 0L
            var shift = 0
            while (true) {
                val b = input.read()
                if (b < 0) {
                    if (shift == 0) return null
                    throw EOFException()
                }
                result = result or ((b and 0x7F).toLong() shl shift)
                if (b and 0x80 == 0) return result
                shift += 7
                if (shift > 63) throw EOFException("bad varint")
            }
        }

        /** Reads one length-prefixed frame; null at end of stream. */
        fun readFrame(input: InputStream): ByteArray? {
            val len = readVarint(input) ?: return null
            if (len < 0 || len > 1_000_000) throw EOFException("bad frame length $len")
            val buf = ByteArray(len.toInt())
            var off = 0
            while (off < buf.size) {
                val n = input.read(buf, off, buf.size - off)
                if (n < 0) throw EOFException()
                off += n
            }
            return buf
        }
    }
}

/** Parsed protobuf message: field number -> values (Long for varints, ByteArray for length-delimited). */
class ProtoMsg private constructor(private val fields: Map<Int, List<Any>>) {

    fun has(field: Int) = fields.containsKey(field)

    fun int(field: Int): Long? = fields[field]?.lastOrNull() as? Long

    fun bytes(field: Int): ByteArray? = fields[field]?.lastOrNull() as? ByteArray

    fun string(field: Int): String? = bytes(field)?.toString(Charsets.UTF_8)

    fun msg(field: Int): ProtoMsg? = bytes(field)?.let { parse(it) }

    companion object {
        fun parse(data: ByteArray): ProtoMsg {
            val fields = HashMap<Int, MutableList<Any>>()
            var pos = 0
            fun varint(): Long {
                var result = 0L
                var shift = 0
                while (true) {
                    if (pos >= data.size) throw IllegalArgumentException("truncated varint")
                    val b = data[pos++].toInt() and 0xFF
                    result = result or ((b and 0x7F).toLong() shl shift)
                    if (b and 0x80 == 0) return result
                    shift += 7
                }
            }
            while (pos < data.size) {
                val key = varint()
                val field = (key ushr 3).toInt()
                when ((key and 7).toInt()) {
                    0 -> fields.getOrPut(field) { ArrayList() }.add(varint())
                    1 -> pos += 8
                    2 -> {
                        val len = varint().toInt()
                        if (len < 0 || pos + len > data.size) throw IllegalArgumentException("truncated field")
                        fields.getOrPut(field) { ArrayList() }.add(data.copyOfRange(pos, pos + len))
                        pos += len
                    }
                    5 -> pos += 4
                    else -> throw IllegalArgumentException("unsupported wire type")
                }
            }
            return ProtoMsg(fields)
        }
    }
}
