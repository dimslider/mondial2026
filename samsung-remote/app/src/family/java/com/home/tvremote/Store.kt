package com.home.tvremote

import android.app.Activity
import android.content.Context

/** Family build (installed from GitHub): free, everything unlocked, nothing to buy or rate. */
@Suppress("UNUSED_PARAMETER")
object Store {
    fun start(activity: Activity, onChange: () -> Unit) {}
    fun refresh() {}
    fun isPro(context: Context): Boolean = true
    fun licenseJson(context: Context): String = """{"state":"family","daysLeft":0,"price":null}"""
    fun buy(activity: Activity) {}
    fun restore(activity: Activity) {}
    fun askReview(activity: Activity) {}
}
