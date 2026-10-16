package com.home.tvremote

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.speech.RecognizerIntent
import android.view.KeyEvent
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject
import java.util.Collections

class MainActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var tv: TvClient
    private val ui by lazy { getSharedPreferences("ui", MODE_PRIVATE) }
    private val vibrator by lazy { getSystemService(Vibrator::class.java) }
    private val listener: (JSONObject) -> Unit = { msg -> toJs(msg) }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        web.setBackgroundColor(0xFF0E1116.toInt())
        web.overScrollMode = View.OVER_SCROLL_NEVER
        web.isVerticalScrollBarEnabled = false
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true

        tv = TvClient.get(this)
        web.addJavascriptInterface(Bridge(), "Android")
        setContentView(web)
        web.loadUrl("file:///android_asset/remote.html")
        // The Android TV client certificate takes a moment to generate; do it ahead of time.
        Thread { tv.identity() }.start()
        RemoteService.sync(this)
    }

    private fun toJs(msg: JSONObject) {
        runOnUiThread { web.evaluateJavascript("window.onTv&&window.onTv($msg)", null) }
    }

    override fun onStart() {
        super.onStart()
        tv.addListener(listener)
        tv.acquire("screen")
        RemoteService.appOpened(this)
    }

    override fun onStop() {
        super.onStop()
        // Never leave a held button repeating while the app isn't visible.
        web.evaluateJavascript("window.stopRepeat&&stopRepeat()", null)
        tv.removeListener(listener)
        tv.release("screen")
    }

    override fun onDestroy() {
        // Exited for good (not just sent to the background, not rotated): same as swiping it away.
        if (isFinishing && !isChangingConfigurations) RemoteService.appClosed(this)
        super.onDestroy()
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

    private fun startVoice() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_PROMPT, "מה לחפש בטלוויזיה?")
            .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        try {
            @Suppress("DEPRECATION")
            startActivityForResult(intent, VOICE_REQUEST)
        } catch (e: ActivityNotFoundException) {
            toJs(JSONObject().put("type", "toast").put("text", "זיהוי דיבור לא זמין בטלפון הזה"))
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != VOICE_REQUEST || resultCode != RESULT_OK) return
        val text = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull() ?: return
        toJs(JSONObject().put("type", "voice").put("text", text))
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        val granted = grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }
        val what = if (requestCode == PHONE_REQUEST) "phone" else "notifications"
        toJs(JSONObject().put("type", "permission").put("what", what).put("granted", granted))
        RemoteService.sync(this)
    }

    @Suppress("unused")
    inner class Bridge {
        /** "notifications" or "phone"; answers through a "permission" message. */
        @JavascriptInterface
        fun requestPermission(what: String) = runOnUiThread {
            val perm = when (what) {
                "phone" -> Manifest.permission.READ_PHONE_STATE
                else -> if (Build.VERSION.SDK_INT >= 33) Manifest.permission.POST_NOTIFICATIONS else null
            }
            val code = if (what == "phone") PHONE_REQUEST else NOTIFY_REQUEST
            if (perm == null || checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED) {
                toJs(JSONObject().put("type", "permission").put("what", what).put("granted", true))
                RemoteService.sync(this@MainActivity)
            } else {
                requestPermissions(arrayOf(perm), code)
            }
        }

        /** Re-applies settings that background features depend on. */
        @JavascriptInterface
        fun applyQuickSettings() = RemoteService.sync(this@MainActivity)

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
        fun selectTv(ip: String, type: String, name: String, mac: String) = tv.setTv(ip, type, name, mac)

        @JavascriptInterface
        fun switchTv(ip: String) = tv.selectTv(ip)

        @JavascriptInterface
        fun renameTv(ip: String, label: String) = tv.renameTv(ip, label)

        @JavascriptInterface
        fun removeTv(ip: String) = tv.removeTv(ip)

        @JavascriptInterface
        fun submitPin(pin: String) = tv.submitPin(pin)

        @JavascriptInterface
        fun voice() = runOnUiThread { startVoice() }

        @JavascriptInterface
        fun sleepTimer(minutes: Int) {
            if (minutes > 0) SleepTimer.set(this@MainActivity, minutes) else SleepTimer.cancel(this@MainActivity)
            tv.requestStatus()
        }

        @JavascriptInterface
        fun connectIp(ip: String) {
            Thread {
                val info = Net.identify(ip.trim(), tv.identity())
                if (info != null) {
                    tv.setTv(info.getString("ip"), info.getString("type"), info.optString("name"), info.optString("mac"))
                } else {
                    toJs(JSONObject().put("type", "toast").put("text", "לא נמצאה טלוויזיה בכתובת הזו (היא דלוקה?)"))
                }
            }.start()
        }

        @JavascriptInterface
        fun scan() {
            val found = Collections.synchronizedSet(HashSet<String>())
            Net.scan(
                identity = { tv.identity() },
                onFound = { dev ->
                    found.add(dev.optString("ip"))
                    toJs(JSONObject().put("type", "scanFound").put("device", dev))
                },
                onDone = { me ->
                    toJs(JSONObject().put("type", "scanDone").put("ok", me != null).put("count", found.size))
                }
            )
        }

        @JavascriptInterface
        fun copyDiagnostics() = runOnUiThread {
            val text = tv.diagnostics(version())
            val cm = getSystemService(android.content.ClipboardManager::class.java)
            cm?.setPrimaryClip(android.content.ClipData.newPlainText("TV Remote diagnostics", text))
            toJs(JSONObject().put("type", "toast").put("text", "המידע הועתק – אפשר להדביק בצ'אט"))
        }

        /** Keeps the screen on (long app scans stop when the phone goes to sleep). */
        @JavascriptInterface
        fun keepScreenOn(on: Boolean) = runOnUiThread {
            if (on) window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            else window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
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

    companion object {
        private const val VOICE_REQUEST = 7
        private const val NOTIFY_REQUEST = 8
        private const val PHONE_REQUEST = 9
    }
}
