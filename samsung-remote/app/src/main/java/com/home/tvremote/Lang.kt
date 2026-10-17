package com.home.tvremote

import android.content.Context
import android.content.res.Configuration
import java.util.Locale

/**
 * The app's own language choice (English or Hebrew), independent of the phone's language.
 * The page stores it under "lang"; native texts (notifications, toasts) follow it here.
 */
object Lang {
    fun code(context: Context): String {
        val saved = context.getSharedPreferences("ui", Context.MODE_PRIVATE).getString("lang", "").orEmpty()
        if (saved == "en" || saved == "he") return saved
        val phone = Locale.getDefault().language
        return if (phone == "he" || phone == "iw") "he" else "en"
    }

    fun set(context: Context, code: String) {
        context.getSharedPreferences("ui", Context.MODE_PRIVATE).edit().putString("lang", code).apply()
    }

    /** A context whose resources speak the chosen language. */
    fun ctx(context: Context): Context {
        val locale = Locale(if (code(context) == "he") "iw" else "en")
        val config = Configuration(context.resources.configuration).apply { setLocale(locale) }
        return context.createConfigurationContext(config)
    }

    fun s(context: Context, id: Int, vararg args: Any): String = ctx(context).getString(id, *args)
}
