package com.home.tvremote

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import android.widget.RemoteViews
import org.json.JSONObject

/** Buttons outside the app (notification, widget, tiles) all end up here. */
object QuickActions {
    const val ACTION = "com.home.tvremote.ACTION"
    const val EXTRA_KEY = "key"
    const val POWER = "@power"
    const val PLAY_PAUSE = "@playpause"
    const val HIDE = "@hide"

    private val main = Handler(Looper.getMainLooper())

    @Volatile
    private var nextIsPause = true

    private var lastKey = ""
    private var lastAt = 0L

    fun ui(context: Context) = context.getSharedPreferences("ui", Context.MODE_PRIVATE)

    /** Sends [key] to the current TV, connecting first if needed, then lets go of the connection. */
    fun perform(context: Context, key: String, onDone: () -> Unit = {}) {
        instanceContext = context.applicationContext
        val tv = TvClient.get(context)
        if (!Store.isPro(context)) {
            // Widget / tile buttons are Pro: they open the app instead (where the upsell is).
            tv.log("quick button: $key ignored (Pro)")
            onDone()
            return
        }
        // The lock screen sometimes delivers one tap twice: ignore an identical press within 400 ms.
        val now = android.os.SystemClock.elapsedRealtime()
        synchronized(this) {
            if (key == lastKey && now - lastAt < 400) {
                tv.log("quick button: $key ignored (double tap)")
                onDone()
                return
            }
            lastKey = key
            lastAt = now
        }
        tv.log("quick button: $key (state=${tv.stateName})")
        tv.acquire("quick")
        when (key) {
            POWER -> {
                tv.power()
                onDone()
            }
            PLAY_PAUSE -> {
                val k = if (nextIsPause) "KEY_PAUSE" else "KEY_PLAY"
                tv.sendKey(k, 4_000) {
                    nextIsPause = k == "KEY_PLAY"
                    onDone()
                }
            }
            // A press waits at most 4 s for the connection, then it is dropped (never sent late).
            else -> tv.sendKey(key, 4_000) { onDone() }
        }
        main.removeCallbacks(releaseQuick)
        main.postDelayed(releaseQuick, 60_000)
    }

    private val releaseQuick = Runnable { instanceContext?.let { TvClient.get(it).release("quick") } }

    @Volatile
    private var instanceContext: Context? = null

    fun intent(context: Context, key: String, requestCode: Int): PendingIntent {
        val i = Intent(context, ActionReceiver::class.java).setAction(ACTION).putExtra(EXTRA_KEY, key)
        return PendingIntent.getBroadcast(context, requestCode, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    fun openApp(context: Context): PendingIntent = PendingIntent.getActivity(
        context, 0,
        Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_IMMUTABLE
    )

    /** Wires the shared button ids used by both the notification and the widget layouts. */
    fun bindButtons(context: Context, v: RemoteViews) {
        v.setOnClickPendingIntent(R.id.q_power, intent(context, POWER, 1))
        v.setOnClickPendingIntent(R.id.q_voldown, intent(context, "KEY_VOLDOWN", 2))
        v.setOnClickPendingIntent(R.id.q_mute, intent(context, "KEY_MUTE", 3))
        v.setOnClickPendingIntent(R.id.q_volup, intent(context, "KEY_VOLUP", 4))
        v.setOnClickPendingIntent(R.id.q_playpause, intent(context, PLAY_PAUSE, 5))
    }
}

class ActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val key = intent.getStringExtra(QuickActions.EXTRA_KEY) ?: return
        if (key == QuickActions.HIDE) {
            // The X on the notification: hide the controls until the app is opened again.
            RemoteService.hideUntilAppOpens(context, "closed with X")
            return
        }
        // Android hands this receiver one tap at a time, so it must let go as soon as the key is
        // out: holding it longer queues the following taps, which then trickle in long after.
        val done = goAsync()
        val finished = java.util.concurrent.atomic.AtomicBoolean(false)
        val finish = { if (finished.compareAndSet(false, true)) done.finish() }
        QuickActions.perform(context, key) { finish() }
        Handler(Looper.getMainLooper()).postDelayed({ finish() }, 4_500)
    }
}

/**
 * Optional always-on service: the control notification and the mute-on-call feature.
 */
class RemoteService : Service() {

    companion object {
        private const val CHANNEL = "quick"
        private const val NOTIFICATION_ID = 1

        private const val WAIT_CHANNEL = "quick_wait"

        /** Controls switched on in settings and not closed (X / app swiped away) since the app was last opened. */
        fun controlsOn(context: Context): Boolean {
            val p = QuickActions.ui(context)
            return Store.isPro(context) && p.getString("quickControls", "0") == "1" && p.getString("quickHidden", "0") != "1"
        }

        /** The call setting in effect: "off", "mute" or "pause" (a Pro feature). */
        fun callAction(context: Context): String =
            if (Store.isPro(context)) QuickActions.ui(context).getString("callAction", "off") ?: "off" else "off"

        /** Closing the app (not just leaving it) switches all background features off until it is opened again. */
        fun wanted(context: Context): Boolean = QuickActions.ui(context).getString("appClosed", "0") != "1" &&
            (controlsOn(context) || callAction(context) != "off")

        fun appClosed(context: Context) {
            QuickActions.ui(context).edit().putString("appClosed", "1").apply()
            TvClient.get(context).log("app closed: background features off until it is opened")
            sync(context)
        }

        fun hideUntilAppOpens(context: Context, why: String) {
            if (QuickActions.ui(context).getString("quickControls", "0") != "1") return
            QuickActions.ui(context).edit().putString("quickHidden", "1").apply()
            TvClient.get(context).log("quick controls hidden: $why")
            sync(context)
        }

        /** The app was opened: bring the controls back if they are switched on. */
        fun appOpened(context: Context) {
            QuickActions.ui(context).edit().remove("quickHidden").remove("appClosed").apply()
            sync(context)
        }

        /** Starts or stops the service to match the settings. */
        fun sync(context: Context) {
            val i = Intent(context, RemoteService::class.java)
            try {
                if (wanted(context)) context.startForegroundService(i) else context.stopService(i)
            } catch (_: Exception) {
            }
        }
    }

    private lateinit var tv: TvClient
    private val main = Handler(Looper.getMainLooper())
    private var calls: CallWatcher? = null
    private var state = ""
    private var actedOnCall = ""
    private var callPending = false
    private var callsAllowed = false
    private var inCallNow = false

    private val listener: (JSONObject) -> Unit = { m ->
        if (m.optString("type") == "status") main.post { onStatus(m.optString("state")) }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        tv = TvClient.get(this)
        getSystemService(NotificationManager::class.java).createNotificationChannels(listOf(
            NotificationChannel(CHANNEL, Lang.s(this, R.string.ch_quick), NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) },
            NotificationChannel(WAIT_CHANNEL, Lang.s(this, R.string.ch_background), NotificationManager.IMPORTANCE_MIN).apply {
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_SECRET
            }
        ))
        showNotification()
        tv.addListener(listener)
        tv.acquire("service")
        watchWifi()
    }

    // ------------------------------------------------------------ Wi-Fi: controls only make sense at home

    private var onWifi = true
    private var wifiCallback: android.net.ConnectivityManager.NetworkCallback? = null

    private fun watchWifi() {
        val cm = getSystemService(android.net.ConnectivityManager::class.java)
        onWifi = cm.getNetworkCapabilities(cm.activeNetwork)?.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI) == true
        val wifiNets = HashSet<android.net.Network>()
        val cb = object : android.net.ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: android.net.Network) {
                main.post {
                    wifiNets.add(network)
                    setWifi(true)
                }
            }

            override fun onLost(network: android.net.Network) {
                main.post {
                    wifiNets.remove(network)
                    setWifi(wifiNets.isNotEmpty())
                }
            }
        }
        try {
            cm.registerNetworkCallback(
                android.net.NetworkRequest.Builder().addTransportType(android.net.NetworkCapabilities.TRANSPORT_WIFI).build(), cb
            )
            wifiCallback = cb
        } catch (_: Exception) {
        }
    }

    private fun setWifi(on: Boolean) {
        if (on == onWifi) return
        onWifi = on
        tv.log("wifi: ${if (on) "connected" else "lost"}")
        showNotification()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // The app was swiped away: the user is done with the remote for now.
        appClosed(this)
        super.onTaskRemoved(rootIntent)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        showNotification()
        if (!wanted(this)) {
            stopSelf()
            return START_NOT_STICKY
        }
        applySettings()
        return START_STICKY
    }

    override fun onDestroy() {
        tv.removeListener(listener)
        tv.release("service")
        wifiCallback?.let { try { getSystemService(android.net.ConnectivityManager::class.java).unregisterNetworkCallback(it) } catch (_: Exception) {} }
        calls?.stop()
        calls = null
        super.onDestroy()
    }

    private fun onStatus(s: String) {
        if (s == state) return
        state = s
        showNotification()
    }

    private fun applySettings() {
        val p = QuickActions.ui(this)
        val callAction = callAction(this)
        val allowed = checkSelfPermission(android.Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED
        if (callAction != "off" && !allowed) tv.log("phone: no phone permission, only internet calls are seen")
        // Permission granted after the watcher started: restart it so it also listens to the phone.
        if (calls != null && allowed && !callsAllowed) {
            calls?.stop()
            calls = null
        }
        if (callAction != "off" && calls == null) {
            callsAllowed = allowed
            calls = CallWatcher(this) { active, why -> onCallState(active, why) }.also { it.start() }
            tv.log("phone: watching calls ($callAction) via ${calls?.sources}")
        }
        if (callAction == "off" && calls != null) {
            calls?.stop()
            calls = null
        }
        showNotification()
    }

    private fun onCallState(inCall: Boolean, why: String) {
        val action = callAction(this)
        tv.log("phone: ${if (inCall) "call" else "no call"} ($why, action=$action, tv=${tv.stateName})")
        inCallNow = inCall
        if (inCall) {
            if (actedOnCall.isEmpty() && !callPending && action != "off") {
                // Connects if needed; remember the action only once the key really reached the TV,
                // so the end of the call never toggles back something that was never done.
                callPending = true
                tv.acquire("call")
                tv.sendKey(if (action == "pause") "KEY_PAUSE" else "KEY_MUTE", 10_000) {
                    tv.log("phone: TV ${if (action == "pause") "paused" else "muted"}")
                    // The call already ended while we were connecting: undo right away.
                    if (inCallNow) actedOnCall = action
                    else tv.sendKey(if (action == "pause") "KEY_PLAY" else "KEY_MUTE", 10_000)
                }
                main.postDelayed({ callPending = false }, 10_000)
            }
        } else {
            when (actedOnCall) {
                "pause" -> tv.sendKey("KEY_PLAY", 10_000)
                "mute" -> tv.sendKey("KEY_MUTE", 10_000)
            }
            actedOnCall = ""
            callPending = false
            main.postDelayed({ tv.release("call") }, 15_000)
        }
    }

    private fun showNotification() {
        val controls = controlsOn(this)
        val quick = controls && onWifi
        val calls = callAction(this) != "off"
        // Controls on but away from Wi-Fi, no call muting: keep a minimised, silent placeholder
        // (no lock screen, no status icon) so the controls can come back when Wi-Fi does.
        val waiting = controls && !onWifi && !calls
        // Without the controls, the notification only exists because Android requires one for
        // background work (call muting / waiting for Wi-Fi): keep it minimised, off the lock screen.
        val b = Notification.Builder(this, if (quick) CHANNEL else WAIT_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_remote)
            .setContentIntent(QuickActions.openApp(this))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setCategory(Notification.CATEGORY_SERVICE)
        if (quick) {
            val v = RemoteViews(packageName, R.layout.notification_remote)
            v.setTextViewText(R.id.q_title, tv.displayName + if (state == "connected") "" else " · " + Lang.s(this, R.string.not_connected))
            QuickActions.bindButtons(this, v)
            v.setOnClickPendingIntent(R.id.q_close, QuickActions.intent(this, QuickActions.HIDE, 6))
            b.setStyle(Notification.DecoratedCustomViewStyle()).setCustomContentView(v)
        } else if (waiting) {
            b.setContentTitle(Lang.s(this, R.string.wait_wifi)).setVisibility(Notification.VISIBILITY_SECRET)
        } else {
            b.setContentTitle(Lang.s(this, R.string.call_mute_active)).setContentText(tv.displayName).setVisibility(Notification.VISIBILITY_SECRET)
        }
        val n = b.build()
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        else startForeground(NOTIFICATION_ID, n)
    }
}

/**
 * "Is the phone in a call?" from every source available, since each one misses some cases:
 * the telephony callback (default SIM), the phone-state broadcast (any SIM), and the audio
 * mode (also WhatsApp and other internet calls; needs no permission, Android 12+).
 * Reports changes only: true when a call starts ringing or is answered, false when all is quiet.
 */
class CallWatcher(private val context: Context, private val onChange: (Boolean, String) -> Unit) {
    private val tm = context.getSystemService(TelephonyManager::class.java)
    private val audio = context.getSystemService(android.media.AudioManager::class.java)
    private val main = Handler(Looper.getMainLooper())
    private var callback: Any? = null
    private var receiver: BroadcastReceiver? = null
    private var modeListener: Any? = null

    private var telephony = false
    private var broadcast = false
    private var audioCall = false
    private var active = false

    private fun update(why: String) {
        val now = telephony || broadcast || audioCall
        if (now == active) return
        active = now
        onChange(now, why)
    }

    fun start() {
        val allowed = context.checkSelfPermission(android.Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED
        if (allowed) {
            try {
                if (Build.VERSION.SDK_INT >= 31) {
                    val c = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                        override fun onCallStateChanged(state: Int) {
                            telephony = state != TelephonyManager.CALL_STATE_IDLE
                            update("phone state $state")
                        }
                    }
                    tm.registerTelephonyCallback(context.mainExecutor, c)
                    callback = c
                } else {
                    @Suppress("DEPRECATION")
                    val l = object : PhoneStateListener() {
                        @Deprecated("Deprecated in Java")
                        override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                            telephony = state != TelephonyManager.CALL_STATE_IDLE
                            update("phone state $state")
                        }
                    }
                    @Suppress("DEPRECATION")
                    tm.listen(l, PhoneStateListener.LISTEN_CALL_STATE)
                    callback = l
                }
            } catch (_: Exception) {
            }
            val r = object : BroadcastReceiver() {
                override fun onReceive(c: Context, intent: Intent) {
                    val st = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
                    broadcast = st != TelephonyManager.EXTRA_STATE_IDLE
                    update("call broadcast $st")
                }
            }
            try {
                val filter = android.content.IntentFilter(TelephonyManager.ACTION_PHONE_STATE_CHANGED)
                if (Build.VERSION.SDK_INT >= 33) context.registerReceiver(r, filter, Context.RECEIVER_EXPORTED)
                else context.registerReceiver(r, filter)
                receiver = r
            } catch (_: Exception) {
            }
        }
        if (Build.VERSION.SDK_INT >= 31) {
            val l = android.media.AudioManager.OnModeChangedListener { mode ->
                main.post {
                    audioCall = mode != android.media.AudioManager.MODE_NORMAL
                    update("audio mode $mode")
                }
            }
            try {
                audio.addOnModeChangedListener(context.mainExecutor, l)
                modeListener = l
            } catch (_: Exception) {
            }
        }
    }

    /** Which sources are listening, for the diagnostics log. */
    val sources: String
        get() = listOfNotNull(
            callback?.let { "phone" }, receiver?.let { "broadcast" }, modeListener?.let { "audio" }
        ).joinToString("+").ifEmpty { "none" }

    fun stop() {
        when (val c = callback) {
            is PhoneStateListener -> @Suppress("DEPRECATION") tm.listen(c, PhoneStateListener.LISTEN_NONE)
            null -> {}
            else -> if (Build.VERSION.SDK_INT >= 31 && c is TelephonyCallback) tm.unregisterTelephonyCallback(c)
        }
        callback = null
        receiver?.let { try { context.unregisterReceiver(it) } catch (_: Exception) {} }
        receiver = null
        if (Build.VERSION.SDK_INT >= 31) (modeListener as? android.media.AudioManager.OnModeChangedListener)?.let {
            audio.removeOnModeChangedListener(it)
        }
        modeListener = null
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            RemoteService.sync(context)
        }
    }
}

class RemoteWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        manager.updateAppWidget(ids, views(context))
    }

    companion object {
        private fun views(context: Context): RemoteViews {
            val v = RemoteViews(context.packageName, R.layout.widget_remote)
            v.setTextViewText(R.id.q_title, TvClient.get(context).displayName)
            v.setOnClickPendingIntent(R.id.q_title, QuickActions.openApp(context))
            if (Store.isPro(context)) QuickActions.bindButtons(context, v)
            else for (id in intArrayOf(R.id.q_power, R.id.q_voldown, R.id.q_mute, R.id.q_volup, R.id.q_playpause)) {
                v.setOnClickPendingIntent(id, QuickActions.openApp(context)) // Pro: opens the app (upsell)
            }
            return v
        }

        fun refresh(context: Context) {
            val m = AppWidgetManager.getInstance(context) ?: return
            val ids = m.getAppWidgetIds(ComponentName(context, RemoteWidget::class.java))
            if (ids.isNotEmpty()) m.updateAppWidget(ids, views(context))
        }
    }
}

/** Quick Settings tile: opens the remote. */
class OpenRemoteTile : TileService() {
    override fun onStartListening() {
        qsTile?.apply {
            state = Tile.STATE_INACTIVE
            updateTile()
        }
    }

    override fun onClick() {
        val i = Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (Build.VERSION.SDK_INT >= 34) {
            startActivityAndCollapse(PendingIntent.getActivity(this, 0, i, PendingIntent.FLAG_IMMUTABLE))
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(i)
        }
    }
}

/** Quick Settings tile: mutes / unmutes the TV without opening anything. */
class MuteTile : TileService() {
    override fun onStartListening() {
        qsTile?.apply {
            state = Tile.STATE_INACTIVE
            updateTile()
        }
    }

    override fun onClick() {
        if (Store.isPro(this)) {
            QuickActions.perform(this, "KEY_MUTE")
            return
        }
        // Pro feature: open the app instead.
        val i = Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (Build.VERSION.SDK_INT >= 34) {
            startActivityAndCollapse(PendingIntent.getActivity(this, 0, i, PendingIntent.FLAG_IMMUTABLE))
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(i)
        }
    }
}
