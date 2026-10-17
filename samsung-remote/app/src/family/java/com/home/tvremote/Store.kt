package com.home.tvremote

import android.app.Activity
import android.content.Context

/** Family build (installed from GitHub): free, nothing to buy. */
object Store {
    fun start(activity: Activity, onChange: () -> Unit) {}
    fun refresh() {}
    fun licenseJson(context: Context): String = """{"state":"family","daysLeft":0,"price":null}"""
    fun buy(activity: Activity) {}
    fun restore(activity: Activity) {}
}
