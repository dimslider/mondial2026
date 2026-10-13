package com.home.tvremote

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper

/** "Turn the TV off in N minutes". Uses an inexact alarm, so it may fire a minute or two late. */
object SleepTimer {

    fun endsAt(prefs: SharedPreferences): Long =
        prefs.getLong("sleepAt", 0L).takeIf { it > System.currentTimeMillis() } ?: 0L

    fun set(context: Context, minutes: Int) {
        val at = System.currentTimeMillis() + minutes * 60_000L
        prefs(context).edit().putLong("sleepAt", at).apply()
        alarms(context).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent(context))
    }

    fun cancel(context: Context) {
        prefs(context).edit().remove("sleepAt").apply()
        alarms(context).cancel(intent(context))
    }

    private fun prefs(context: Context) = context.getSharedPreferences("tv", Context.MODE_PRIVATE)

    private fun alarms(context: Context) = context.getSystemService(AlarmManager::class.java)

    private fun intent(context: Context): PendingIntent = PendingIntent.getBroadcast(
        context, 0, Intent(context, SleepReceiver::class.java),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
}

class SleepReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        context.getSharedPreferences("tv", Context.MODE_PRIVATE).edit().remove("sleepAt").apply()
        val tv = TvClient.get(context)
        val done = goAsync()
        tv.acquire("sleep")
        tv.powerOff()
        Handler(Looper.getMainLooper()).postDelayed({
            tv.release("sleep")
            done.finish()
        }, 9_000)
    }
}
