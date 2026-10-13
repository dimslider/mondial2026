package com.home.tvremote

import org.json.JSONArray

/** Callbacks from a driver to the controller. May be called from any thread. */
interface Session {
    /** Ready to receive commands. */
    fun connected()

    /** Waiting for the user: "prompt" = approve on the TV, "pin" = type the code shown on the TV. */
    fun waitingForUser(kind: String)

    /** The TV refused the pairing. */
    fun denied()

    /** Connection lost or could not be opened. */
    fun closed()

    fun apps(list: JSONArray)
    fun macAddress(mac: String)
    fun toast(text: String)

    /** Diagnostic log line (shown under "copy diagnostics" in settings). */
    fun log(line: String) {}

    /** Small persistent per-TV storage (tokens, keys). */
    fun load(key: String): String?
    fun store(key: String, value: String?)
}

/**
 * One connection to one TV. Commands use the Samsung-style key names the UI sends
 * (KEY_UP, KEY_VOLUP, ...); each driver translates them.
 */
/** Deep app scan progress: ids checked so far, total, apps found by this scan, finished. */
data class ScanProgress(val done: Int, val total: Int, val found: Int, val finished: Boolean, val msPerCheck: Int)

abstract class Driver(protected val ip: String, protected val session: Session) {
    abstract fun connect()
    abstract fun close()

    /** Returns false if this TV has no equivalent of [key]. */
    abstract fun key(key: String): Boolean
    open fun text(text: String): Boolean = false

    /** [appId] is a Samsung app id, an LG app id or an Android TV app link, depending on the driver. */
    abstract fun launch(appId: String, appType: Int)
    open fun requestApps() {}

    /**
     * Searches the TV for installed apps beyond the known list. Reports progress
     * (checked, total, finished) and found apps through [Session.apps]. Returns false if unsupported.
     */
    open fun deepScanApps(onProgress: (ScanProgress) -> Unit): Boolean = false
    open fun stopScan() {}

    /** Turns the TV off; must never turn it on (used by the sleep timer). */
    open fun powerOff() {
        key("KEY_POWER")
    }
    open fun submitPin(pin: String) {}

    companion object {
        const val SAMSUNG = "samsung"
        const val LG = "lg"
        const val ANDROID_TV = "androidtv"

        fun create(type: String, ip: String, session: Session): Driver = when (type) {
            LG -> LgDriver(ip, session)
            ANDROID_TV -> AndroidTvDriver(ip, session)
            else -> SamsungDriver(ip, session)
        }
    }
}
