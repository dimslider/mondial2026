package com.home.tvremote

import org.json.JSONArray
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.test.fail

class TestSession : Session {
    val events = LinkedBlockingQueue<String>()
    val storage = ConcurrentHashMap<String, String>()
    @Volatile var apps: JSONArray? = null

    override fun connected() { events.add("connected") }
    override fun waitingForUser(kind: String) { events.add("wait:$kind") }
    override fun denied() { events.add("denied") }
    override fun closed() { events.add("closed") }
    override fun apps(list: JSONArray) { apps = list; events.add("apps:${list.length()}") }
    override fun macAddress(mac: String) { events.add("mac:$mac") }
    override fun toast(text: String) { events.add("toast:$text") }
    override fun load(key: String): String? = storage[key]
    override fun store(key: String, value: String?) { if (value == null) storage.remove(key) else storage[key] = value }

    /** Waits for an event starting with [prefix]; fails on unexpected terminal events. */
    fun await(prefix: String, seconds: Long = 15): String {
        val deadline = System.currentTimeMillis() + seconds * 1000
        val seen = ArrayList<String>()
        while (true) {
            val left = deadline - System.currentTimeMillis()
            if (left <= 0) fail("timed out waiting for '$prefix', saw $seen")
            val e = events.poll(left, TimeUnit.MILLISECONDS) ?: continue
            seen.add(e)
            if (e.startsWith(prefix)) return e
        }
    }
}
