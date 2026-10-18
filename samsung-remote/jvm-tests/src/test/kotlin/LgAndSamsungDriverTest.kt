package com.home.tvremote

import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.tls.HandshakeCertificates
import okhttp3.tls.HeldCertificate
import org.json.JSONArray
import org.json.JSONObject
import java.net.InetAddress
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class LgAndSamsungDriverTest {

    @Test
    fun lgPromptsRegistersAndSendsButtons() {
        val requests = LinkedBlockingQueue<JSONObject>()
        val pointer = LinkedBlockingQueue<String>()
        val server = MockWebServer()
        server.enqueue(MockResponse().withWebSocketUpgrade(object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                val j = JSONObject(text)
                if (j.getString("type") == "register") {
                    requests.add(j)
                    webSocket.send(JSONObject().put("type", "response").put("id", "register_0")
                        .put("payload", JSONObject().put("pairingType", "PROMPT")).toString())
                    webSocket.send(JSONObject().put("type", "registered").put("id", "register_0")
                        .put("payload", JSONObject().put("client-key", "KEY1")).toString())
                    return
                }
                requests.add(j)
                val payload = when (j.getString("uri")) {
                    "ssap://com.webos.service.networkinput/getPointerInputSocket" ->
                        JSONObject().put("socketPath", "ws://127.0.0.1:3000/pointer")
                    "ssap://com.webos.service.connectionmanager/getinfo" ->
                        JSONObject().put("wiredInfo", JSONObject().put("macAddress", "11:22:33:44:55:66"))
                    "ssap://com.webos.applicationManager/listLaunchPoints" ->
                        JSONObject().put("launchPoints", JSONArray().put(JSONObject().put("id", "netflix").put("title", "Netflix")))
                    else -> JSONObject().put("returnValue", true)
                }
                webSocket.send(JSONObject().put("type", "response").put("id", j.getString("id")).put("payload", payload).toString())
            }
        }))
        server.enqueue(MockResponse().withWebSocketUpgrade(object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) { pointer.add(text) }
        }))
        server.start(InetAddress.getByName("127.0.0.1"), 3000)
        try {
            val s = TestSession()
            val d = LgDriver("127.0.0.1", s)
            d.connect() // wss:3001 is closed here, so this also exercises the ws:3000 fallback
            s.await("wait:prompt")
            s.await("connected")
            assertEquals("KEY1", s.storage["clientKey"])
            assertEquals("0", s.storage["secure"])
            s.await("mac:11:22:33:44:55:66")

            assertTrue(d.key("KEY_VOLUP"))
            assertEquals("type:button\nname:VOLUMEUP\n\n", pointer.poll(5, TimeUnit.SECONDS))
            assertTrue(d.key("KEY_7"))
            assertEquals("type:button\nname:7\n\n", pointer.poll(5, TimeUnit.SECONDS))
            assertEquals(false, d.key("KEY_AMBIENT"))
            assertTrue(d.pointerMove(12, -5))
            assertEquals("type:move\ndx:12\ndy:-5\ndown:0\n\n", pointer.poll(5, TimeUnit.SECONDS))
            assertTrue(d.pointerClick())
            assertEquals("type:click\n\n", pointer.poll(5, TimeUnit.SECONDS))
            assertTrue(d.pointerScroll(30))
            assertEquals("type:scroll\ndx:0\ndy:30\n\n", pointer.poll(5, TimeUnit.SECONDS))

            d.key("KEY_POWER")
            d.launch("netflix", 0)
            d.text("abc")
            d.requestApps()
            s.await("apps:1")
            assertEquals("netflix", s.apps!!.getJSONObject(0).getString("appId"))
            val uris = generateSequence { requests.poll(2, TimeUnit.SECONDS) }.map { it.optString("uri", it.optString("type")) }.toList()
            assertTrue("ssap://system/turnOff" in uris, uris.toString())
            assertTrue("ssap://system.launcher/launch" in uris, uris.toString())
            assertTrue("ssap://com.webos.service.ime/insertText" in uris, uris.toString())
            d.close()
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun lgSendsStoredClientKey() {
        val got = LinkedBlockingQueue<JSONObject>()
        val server = MockWebServer()
        server.enqueue(MockResponse().withWebSocketUpgrade(object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                got.add(JSONObject(text))
                webSocket.send(JSONObject().put("type", "error").put("id", "register_0").put("error", "403 denied").toString())
            }
        }))
        server.start(InetAddress.getByName("127.0.0.1"), 3000)
        try {
            val s = TestSession().apply { storage["clientKey"] = "OLD"; storage["secure"] = "0" }
            LgDriver("127.0.0.1", s).connect()
            s.await("denied")
            assertEquals("OLD", got.poll(5, TimeUnit.SECONDS)!!.getJSONObject("payload").getString("client-key"))
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun samsungAppListFallsBackToRestWhenTvIgnoresTheRequest() {
        val localhost = HeldCertificate.Builder().addSubjectAlternativeName("127.0.0.1").build()
        val certs = HandshakeCertificates.Builder().heldCertificate(localhost).build()
        val ws = MockWebServer()
        ws.useHttps(certs.sslSocketFactory(), false)
        ws.enqueue(MockResponse().withWebSocketUpgrade(object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                webSocket.send(JSONObject().put("event", "ms.channel.connect").put("data", JSONObject()).toString())
            }
            // never answers ed.installedApp.get, like many newer firmwares
        }))
        ws.start(InetAddress.getByName("127.0.0.1"), 8002)
        val rest = MockWebServer()
        rest.dispatcher = object : okhttp3.mockwebserver.Dispatcher() {
            override fun dispatch(request: okhttp3.mockwebserver.RecordedRequest): MockResponse = when (request.path) {
                "/api/v2/applications/3201907018807" -> MockResponse().setBody("""{"id":"3201907018807","name":"Netflix","running":false}""")
                "/api/v2/applications/111299001912" -> MockResponse().setBody("""{"id":"111299001912","name":"YouTube"}""")
                else -> MockResponse().setResponseCode(404)
            }
        }
        rest.start(InetAddress.getByName("127.0.0.1"), 8001)
        try {
            val s = TestSession()
            val d = SamsungDriver("127.0.0.1", s)
            d.connect()
            s.await("connected")
            d.requestApps()
            s.await("apps:2", 20)
            val ids = (0 until s.apps!!.length()).map { s.apps!!.getJSONObject(it).getString("appId") }
            assertEquals(setOf("3201907018807", "111299001912"), ids.toSet(), "order varies: the quick check runs in parallel")
            d.close()
        } finally {
            ws.shutdown()
            rest.shutdown()
        }
    }

    @Test
    fun samsungUsesTokenAndSendsKeys() {
        val localhost = HeldCertificate.Builder().addSubjectAlternativeName("127.0.0.1").build()
        val certs = HandshakeCertificates.Builder().heldCertificate(localhost).build()
        val msgs = LinkedBlockingQueue<JSONObject>()
        val paths = LinkedBlockingQueue<String>()
        val server = MockWebServer()
        server.useHttps(certs.sslSocketFactory(), false)
        server.enqueue(MockResponse().withWebSocketUpgrade(object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                webSocket.send(JSONObject().put("event", "ms.channel.connect").put("data", JSONObject().put("token", "T1")).toString())
                webSocket.send(JSONObject().put("event", "ms.remote.imeStart").put("data", JSONObject()).toString())
            }
            override fun onMessage(webSocket: WebSocket, text: String) { msgs.add(JSONObject(text)) }
        }))
        server.start(InetAddress.getByName("127.0.0.1"), 8002)
        try {
            val s = TestSession().apply { storage["token"] = "T0" }
            val d = SamsungDriver("127.0.0.1", s)
            d.connect()
            s.await("connected")
            paths.add(server.takeRequest(5, TimeUnit.SECONDS)!!.path!!)
            assertTrue(paths.peek().contains("token=T0"), paths.peek())
            assertEquals("T1", s.storage["token"])
            s.await("keyboard")
            d.key("KEY_HOME")
            msgs.poll(5, TimeUnit.SECONDS)!!.getJSONObject("params").let {
                assertEquals("KEY_HOME", it.getString("DataOfCmd")); assertEquals("Click", it.getString("Cmd"))
            }
            // typing: "text received" broadcast first, then the base64 text
            d.text("שלום")
            msgs.poll(5, TimeUnit.SECONDS)!!.let { assertEquals("custom.remote.textReceived", it.getJSONObject("params").getString("event")) }
            msgs.poll(5, TimeUnit.SECONDS)!!.getJSONObject("params").let {
                assertEquals("SendInputString", it.getString("TypeOfRemote"))
                assertEquals("שלום", String(java.util.Base64.getDecoder().decode(it.getString("Cmd"))))
            }
            assertTrue(d.pointerMove(7, -3))
            msgs.poll(5, TimeUnit.SECONDS)!!.getJSONObject("params").let {
                assertEquals("ProcessMouseDevice", it.getString("TypeOfRemote")); assertEquals("Move", it.getString("Cmd"))
                assertEquals(7, it.getJSONObject("Position").getInt("x")); assertEquals(-3, it.getJSONObject("Position").getInt("y"))
            }
            assertTrue(d.pointerClick())
            assertEquals("LeftClick", msgs.poll(5, TimeUnit.SECONDS)!!.getJSONObject("params").getString("Cmd"))
            assertEquals(false, d.pointerScroll(10))
            d.launch("111299001912", 2)
            msgs.poll(5, TimeUnit.SECONDS)!!.getJSONObject("params").getJSONObject("data").let {
                assertEquals("111299001912", it.getString("appId")); assertEquals("DEEP_LINK", it.getString("action_type"))
            }
            d.close()
        } finally {
            server.shutdown()
        }
    }
}
