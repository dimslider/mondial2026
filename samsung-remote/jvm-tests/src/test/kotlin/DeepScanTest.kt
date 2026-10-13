package com.home.tvremote

import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.json.JSONArray
import java.net.InetAddress
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DeepScanTest {

    @Test
    fun findsInstalledAppsInsideTheRangesAndRemembersThem() {
        val asked = java.util.Collections.synchronizedSet(HashSet<String>())
        val rest = MockWebServer()
        rest.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val id = request.path!!.substringAfterLast('/')
                asked.add(id)
                return when (id) {
                    "3202009021600" -> MockResponse().setBody("""{"id":"3202009021600","name":"STING+ by yes","running":false}""")
                    "3202307031002" -> MockResponse().setBody("""{"id":"3202307031002","name":"Stremio"}""")
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }
        rest.start(InetAddress.getByName("127.0.0.1"), 8001)
        try {
            val s = TestSession()
            val progress = LinkedBlockingQueue<ScanProgress>()
            val d = SamsungDriver("127.0.0.1", s)
            d.deepScan("2009:21590:21610 2307:31000:31005") { progress.add(it) }
            var last: ScanProgress
            do { last = progress.poll(30, TimeUnit.SECONDS)!! } while (!last.finished)
            assertEquals(27, last.total)
            assertEquals(27, last.done)
            assertEquals(2, last.found)
            assertEquals(27, asked.size, "every id in the ranges is checked once")
            assertTrue("3202009021590" in asked && "3202307031005" in asked)
            val stored = JSONArray(s.storage["foundApps"])
            val names = (0 until stored.length()).map { stored.getJSONObject(it).getString("name") }.toSet()
            assertEquals(setOf("STING+ by yes", "Stremio"), names)
            assertTrue(s.apps!!.length() >= 2)

            // Quick list later (TV ignores the ws request): includes what the deep scan found.
            val s2 = TestSession().apply { storage.putAll(s.storage) }
            SamsungDriver("127.0.0.1", s2).requestApps()
            s2.await("apps:", 30)
            val ids = (0 until s2.apps!!.length()).map { s2.apps!!.getJSONObject(it).getString("appId") }
            assertTrue("3202009021600" in ids && "3202307031002" in ids, ids.toString())
        } finally {
            rest.shutdown()
        }
    }

    @Test
    fun givesUpWhenTheTvStopsAnswering() {
        val s = TestSession()
        val progress = LinkedBlockingQueue<ScanProgress>()
        // Nothing listens on 127.0.0.1:8001 here: every request fails.
        SamsungDriver("127.0.0.1", s).deepScan("2009:20000:22000") { progress.add(it) }
        var last: ScanProgress
        do { last = progress.poll(60, TimeUnit.SECONDS)!! } while (!last.finished)
        assertTrue(last.done < 400, "stopped after ${last.done} of ${last.total}")
    }
}
