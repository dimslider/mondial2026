package com.home.tvremote

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.KeyEvent
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var tv: TvClient
    private val ui by lazy { getSharedPreferences("ui", MODE_PRIVATE) }
    private val vibrator by lazy { getSystemService(Vibrator::class.java) }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        web.setBackgroundColor(0xFF0F141B.toInt())
        web.overScrollMode = View.OVER_SCROLL_NEVER
        web.isVerticalScrollBarEnabled = false
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true

        tv = TvClient(this) { msg -> toJs(msg) }
        web.addJavascriptInterface(Bridge(), "Android")
        setContentView(web)
        web.loadUrl("file:///android_asset/remote.html")
    }

    private fun toJs(msg: JSONObject) {
        runOnUiThread { web.evaluateJavascript("window.onTv&&window.onTv($msg)", null) }
    }

    override fun onStart() {
        super.onStart()
        tv.start()
    }

    override fun onStop() {
        super.onStop()
        tv.stop()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val key = when (event.keyCode) {
            KeyEvent.KEYCODE_VOLUME_UP -> "KEY_VOLUP"
            KeyEvent.KEYCODE_VOLUME_DOWN -> "KEY_VOLDOWN"
            else -> null
        }
        if (key != null && ui.getString("hwVolume", "1") != "0" && tv.ip != null) {
            if (event.action == KeyEvent.ACTION_DOWN) tv.sendKey(key)
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        web.evaluateJavascript("window.handleBack?handleBack():false") { result ->
            if (result != "true") finish()
        }
    }

    @Suppress("unused")
    inner class Bridge {
        @JavascriptInterface
        fun key(key: String) = tv.sendKey(key)

        @JavascriptInterface
        fun text(text: String) = tv.sendText(text)

        @JavascriptInterface
        fun launch(appId: String, appType: Int) = tv.launchApp(appId, appType)

        @JavascriptInterface
        fun power() = tv.power()

        @JavascriptInterface
        fun refreshApps() = tv.requestApps()

        @JavascriptInterface
        fun status() = tv.requestStatus()

        @JavascriptInterface
        fun reconnect() = tv.reconnect()

        @JavascriptInterface
        fun resetPairing() = tv.resetPairing()

        @JavascriptInterface
        fun selectTv(ip: String, name: String, mac: String) = tv.setTv(ip, name, mac)

        @JavascriptInterface
        fun connectIp(ip: String) {
            Thread {
                val info = Net.deviceInfo(ip.trim())
                if (info != null) {
                    tv.setTv(info.getString("ip"), info.optString("name"), info.optString("mac"))
                } else {
                    // Not answering on 8001 (maybe off) — still try to connect directly.
                    tv.setTv(ip.trim(), "Samsung TV", null)
                }
            }.start()
        }

        @JavascriptInterface
        fun scan() {
            val found = JSONArray()
            Net.scan(
                onFound = { dev ->
                    synchronized(found) { found.put(dev) }
                    toJs(JSONObject().put("type", "scanFound").put("device", dev))
                },
                onDone = { me ->
                    toJs(JSONObject().put("type", "scanDone").put("ok", me != null).put("count", found.length()))
                }
            )
        }

        @JavascriptInterface
        fun haptic() {
            try {
                vibrator?.vibrate(VibrationEffect.createOneShot(14, VibrationEffect.DEFAULT_AMPLITUDE))
            } catch (_: Exception) {
            }
        }

        @JavascriptInterface
        fun getPref(key: String, def: String): String = ui.getString(key, def) ?: def

        @JavascriptInterface
        fun setPref(key: String, value: String) {
            ui.edit().putString(key, value).apply()
        }

        @JavascriptInterface
        fun version(): String = try {
            packageManager.getPackageInfo(packageName, 0).versionName ?: ""
        } catch (_: Exception) {
            ""
        }
    }
}
