package com.home.tvremote

import android.app.Activity
import android.content.Context
import android.os.SystemClock

/**
 * When to show Google Play's rating card: only after the remote has clearly worked for a while
 * (several days, several sessions, many keys delivered), never right after an error, and at most
 * once every few months. Google may still decide not to show it.
 */
object Rating {
    private const val DAY = 24 * 60 * 60 * 1000L

    private fun prefs(c: Context) = c.getSharedPreferences("rating", Context.MODE_PRIVATE)

    @Volatile
    private var lastProblemAt = 0L

    /** A key reached the TV. */
    fun keyDelivered(c: Context) {
        val p = prefs(c)
        p.edit().putInt("keys", p.getInt("keys", 0) + 1).apply()
    }

    /** Something went wrong (error message shown, connection lost): don't ask for a while. */
    fun problem() {
        lastProblemAt = SystemClock.elapsedRealtime()
    }

    /** The remote screen was opened. */
    fun opened(c: Context) {
        val p = prefs(c)
        p.edit().putInt("opens", p.getInt("opens", 0) + 1).apply()
    }

    /** Called a few seconds into a working (connected) session on the remote screen. */
    fun maybeAsk(activity: Activity) {
        val p = prefs(activity)
        val now = System.currentTimeMillis()
        val installed = try {
            activity.packageManager.getPackageInfo(activity.packageName, 0).firstInstallTime
        } catch (_: Exception) {
            now
        }
        val ready = now - installed >= 3 * DAY &&
            p.getInt("opens", 0) >= 5 &&
            p.getInt("keys", 0) >= 40 &&
            now - p.getLong("askedAt", 0L) >= 120 * DAY &&
            (lastProblemAt == 0L || SystemClock.elapsedRealtime() - lastProblemAt > 10 * 60_000L)
        if (!ready) return
        p.edit().putLong("askedAt", now).apply()
        Store.askReview(activity)
    }
}
