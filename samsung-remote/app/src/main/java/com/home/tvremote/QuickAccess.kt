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
import android.media.AudioManager
import android.media.VolumeProvider
import android.media.session.MediaSession
import android.media.session.PlaybackState
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

    private val main = Handler(Looper.getMainLooper())

    @Volatile
    private var nextIsPause = true

    fun ui(context: Context) = context.getSharedPreferences("ui", Context.MODE_PRIVATE)

    /** Sends [key] to the current TV, connecting first if needed, then lets go of the connection. */
    fun perform(context: Context, key: String) {
        instanceContext = context.applicationContext
        val tv = TvClient.get(context)
        tv.acquire("quick")
        when (key) {
            POWER -> tv.power()
            PLAY_PAUSE -> {
                tv.sendKey(if (nextIsPause) "KEY_PAUSE" else "KEY_PLAY")
                nextIsPause = !nextIsPause
            }
            else -> tv.sendKey(key)
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
        val done = goAsync()
        QuickActions.perform(context, key)
        // Give the connection a few seconds to open and deliver the key.
        Handler(Looper.getMainLooper()).postDelayed({ done.finish() }, 8_000)
    }
}

/**
 * Optional always-on service: the control notification, the phone's volume keys
 * (through a remote-volume media session, only while the TV is connected) and the
 * mute-on-call feature.
 */
class RemoteService : Service() {

    companion object {
        private const val CHANNEL = "quick"
        private const val NOTIFICATION_ID = 1

        fun wanted(context: Context): Boolean {
            val p = QuickActions.ui(context)
            return p.getString("quickControls", "0") == "1" || p.getString("callAction", "off") != "off"
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
    private var session: MediaSession? = null
    private var calls: CallWatcher? = null
    private var state = ""
    private var actedOnCall = ""

    private val listener: (JSONObject) -> Unit = { m ->
        if (m.optString("type") == "status") main.post { onStatus(m.optString("state")) }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        tv = TvClient.get(this)
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CHANNEL, "שליטה מהירה", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) }
        )
        showNotification()
        tv.addListener(listener)
        tv.acquire("service")
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
        session?.release()
        session = null
        calls?.stop()
        calls = null
        super.onDestroy()
    }

    private fun onStatus(s: String) {
        if (s == state) return
        state = s
        session?.isActive = s == "connected"
        showNotification()
    }

    private fun applySettings() {
        val p = QuickActions.ui(this)
        val quick = p.getString("quickControls", "0") == "1"
        val volume = quick && p.getString("lockVolume", "1") != "0"
        if (volume && session == null) session = createSession()
        if (!volume) {
            session?.release()
            session = null
        }
        session?.isActive = state == "connected"

        val callAction = p.getString("callAction", "off") ?: "off"
        val allowed = checkSelfPermission(android.Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED
        if (callAction != "off" && allowed && calls == null) calls = CallWatcher(this) { onCallState(it) }.also { it.start() }
        if (callAction == "off" && calls != null) {
            calls?.stop()
            calls = null
        }
        showNotification()
    }

    private fun createSession() = MediaSession(this, "TvRemote").apply {
        setPlaybackToRemote(object : VolumeProvider(VOLUME_CONTROL_RELATIVE, 100, 50) {
            override fun onAdjustVolume(direction: Int) {
                when (direction) {
                    AudioManager.ADJUST_RAISE -> tv.sendKey("KEY_VOLUP")
                    AudioManager.ADJUST_LOWER -> tv.sendKey("KEY_VOLDOWN")
                    AudioManager.ADJUST_TOGGLE_MUTE, AudioManager.ADJUST_MUTE, AudioManager.ADJUST_UNMUTE -> tv.sendKey("KEY_MUTE")
                }
            }
        })
        // The system routes volume keys to an active session that reports playback.
        setPlaybackState(PlaybackState.Builder().setState(PlaybackState.STATE_PLAYING, 0, 1f).build())
    }

    private fun onCallState(callState: Int) {
        val action = QuickActions.ui(this).getString("callAction", "off") ?: "off"
        when (callState) {
            TelephonyManager.CALL_STATE_RINGING, TelephonyManager.CALL_STATE_OFFHOOK -> {
                if (actedOnCall.isEmpty() && tv.isConnected && action != "off") {
                    tv.sendKey(if (action == "pause") "KEY_PAUSE" else "KEY_MUTE")
                    actedOnCall = action
                }
            }

            TelephonyManager.CALL_STATE_IDLE -> {
                when (actedOnCall) {
                    "pause" -> tv.sendKey("KEY_PLAY")
                    "mute" -> tv.sendKey("KEY_MUTE")
                }
                actedOnCall = ""
            }
        }
    }

    private fun showNotification() {
        val quick = QuickActions.ui(this).getString("quickControls", "0") == "1"
        val b = Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_remote)
            .setContentIntent(QuickActions.openApp(this))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setCategory(Notification.CATEGORY_SERVICE)
        if (quick) {
            val v = RemoteViews(packageName, R.layout.notification_remote)
            v.setTextViewText(R.id.q_title, tv.displayName + if (state == "connected") "" else " · לא מחובר")
            QuickActions.bindButtons(this, v)
            b.setStyle(Notification.DecoratedCustomViewStyle()).setCustomContentView(v)
        } else {
            b.setContentTitle("השתקה בזמן שיחה פעילה").setContentText(tv.displayName)
        }
        val n = b.build()
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        else startForeground(NOTIFICATION_ID, n)
    }
}

/** Phone call state, through the API each Android version supports. */
class CallWatcher(private val context: Context, private val onChange: (Int) -> Unit) {
    private val tm = context.getSystemService(TelephonyManager::class.java)
    private var callback: Any? = null

    fun start() {
        try {
            if (Build.VERSION.SDK_INT >= 31) {
                val c = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                    override fun onCallStateChanged(state: Int) = onChange(state)
                }
                tm.registerTelephonyCallback(context.mainExecutor, c)
                callback = c
            } else {
                @Suppress("DEPRECATION")
                val l = object : PhoneStateListener() {
                    @Deprecated("Deprecated in Java")
                    override fun onCallStateChanged(state: Int, phoneNumber: String?) = onChange(state)
                }
                @Suppress("DEPRECATION")
                tm.listen(l, PhoneStateListener.LISTEN_CALL_STATE)
                callback = l
            }
        } catch (_: SecurityException) {
        }
    }

    fun stop() {
        val c = callback ?: return
        @Suppress("DEPRECATION")
        if (c is PhoneStateListener) tm.listen(c, PhoneStateListener.LISTEN_NONE)
        else if (Build.VERSION.SDK_INT >= 31 && c is TelephonyCallback) tm.unregisterTelephonyCallback(c)
        callback = null
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
            QuickActions.bindButtons(context, v)
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
        QuickActions.perform(this, "KEY_MUTE")
    }
}
