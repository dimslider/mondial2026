package com.home.tvremote

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager

/**
 * "Turn the TV off in N minutes". A foreground service keeps the phone awake just enough to
 * fire on time (plain alarms can be delayed a long way while the phone sleeps), and shows the
 * countdown with a cancel button. An inexact alarm is kept as a backup.
 */
object SleepTimer {

    fun endsAt(prefs: SharedPreferences): Long =
        prefs.getLong("sleepAt", 0L).takeIf { it > System.currentTimeMillis() } ?: 0L

    fun set(context: Context, minutes: Int) {
        val at = System.currentTimeMillis() + minutes * 60_000L
        prefs(context).edit().putLong("sleepAt", at).apply()
        alarms(context).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, backupIntent(context))
        TvClient.get(context).log("sleep timer set: $minutes min")
        context.startForegroundService(Intent(context, SleepService::class.java))
    }

    fun cancel(context: Context) {
        prefs(context).edit().remove("sleepAt").apply()
        alarms(context).cancel(backupIntent(context))
        context.stopService(Intent(context, SleepService::class.java))
        TvClient.get(context).log("sleep timer cancelled")
    }

    /** Turns the TV off, keeping the connection open long enough for the command to go out. */
    fun fire(context: Context, done: () -> Unit) {
        prefs(context).edit().remove("sleepAt").apply()
        alarms(context).cancel(backupIntent(context))
        val tv = TvClient.get(context)
        tv.log("sleep timer: turning the TV off")
        tv.acquire("sleep")
        tv.powerOff()
        Handler(Looper.getMainLooper()).postDelayed({
            tv.release("sleep")
            tv.requestStatus()
            done()
        }, 15_000)
    }

    private fun prefs(context: Context) = context.getSharedPreferences("tv", Context.MODE_PRIVATE)

    private fun alarms(context: Context) = context.getSystemService(AlarmManager::class.java)

    private fun backupIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
        context, 0, Intent(context, SleepReceiver::class.java),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
}

class SleepService : Service() {
    private val main = Handler(Looper.getMainLooper())
    private var wakeLock: PowerManager.WakeLock? = null
    private var firing = false

    private val tick = object : Runnable {
        override fun run() {
            // The raw value: once the time has passed, endsAt() would already say "no timer".
            val at = getSharedPreferences("tv", MODE_PRIVATE).getLong("sleepAt", 0L)
            when {
                firing -> return
                at == 0L -> {
                    TvClient.get(this@SleepService).log("sleep service: no timer, stopping")
                    stopSelf()
                }
                System.currentTimeMillis() - at > 120_000 -> {
                    // Long overdue (the phone was off, say): don't switch the TV off out of the blue.
                    getSharedPreferences("tv", MODE_PRIVATE).edit().remove("sleepAt").apply()
                    stopSelf()
                }
                at - System.currentTimeMillis() <= 1_000 -> {
                    firing = true
                    show("מכבה את הטלוויזיה…")
                    SleepTimer.fire(this@SleepService) { stopSelf() }
                }
                else -> {
                    val left = (at - System.currentTimeMillis() + 59_999) / 60_000
                    TvClient.get(this@SleepService).log("sleep service: ${(at - System.currentTimeMillis()) / 1000}s left")
                    show("הטלוויזיה תכבה בעוד $left דק׳")
                    main.postDelayed(this, minOf(30_000L, at - System.currentTimeMillis()))
                }
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_CANCEL) {
            show("הטיימר בוטל")
            SleepTimer.cancel(this)
            return START_NOT_STICKY
        }
        val at = SleepTimer.endsAt(getSharedPreferences("tv", MODE_PRIVATE))
        show("טיימר שינה")
        if (at == 0L && !firing) {
            TvClient.get(this).log("sleep service: started without a timer")
            stopSelf()
            return START_NOT_STICKY
        }
        // Keep the CPU running until the timer fires, so the countdown isn't delayed by sleep.
        wakeLock?.release()
        wakeLock = getSystemService(PowerManager::class.java)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "TvRemote:sleepTimer")
            .apply { acquire(at - System.currentTimeMillis() + 60_000) }
        main.removeCallbacks(tick)
        main.post(tick)
        return START_STICKY
    }

    override fun onDestroy() {
        main.removeCallbacks(tick)
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        super.onDestroy()
    }

    private fun show(text: String) {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "טיימר שינה", NotificationManager.IMPORTANCE_LOW))
        val cancel = PendingIntent.getService(
            this, 1, Intent(this, SleepService::class.java).setAction(ACTION_CANCEL),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val n = Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_remote)
            .setContentTitle(text)
            .setContentText(TvClient.get(this).displayName)
            .setContentIntent(QuickActions.openApp(this))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .addAction(Notification.Action.Builder(null, "בטל", cancel).build())
            .build()
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        else startForeground(NOTIFICATION_ID, n)
    }

    companion object {
        private const val CHANNEL = "sleep"
        private const val NOTIFICATION_ID = 2
        private const val ACTION_CANCEL = "com.home.tvremote.SLEEP_CANCEL"
    }
}

/** Backup in case the service was killed: fires if the timer is still due. */
class SleepReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val prefs = context.getSharedPreferences("tv", Context.MODE_PRIVATE)
        val at = prefs.getLong("sleepAt", 0L)
        if (at == 0L || at - System.currentTimeMillis() > 60_000) return
        TvClient.get(context).log("sleep alarm (backup) fired")
        val done = goAsync()
        SleepTimer.fire(context) { done.finish() }
    }
}
