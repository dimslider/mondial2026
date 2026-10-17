package com.home.tvremote

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import org.json.JSONObject

/**
 * Google Play build: a free trial with everything unlocked, then a one-time purchase
 * (in-app product [PRODUCT]). The last known purchase state is cached so the remote keeps
 * working offline.
 */
object Store {
    private const val PRODUCT = "full_unlock"
    private const val TRIAL_DAYS = 7
    private const val DAY = 24 * 60 * 60 * 1000L

    private val main = Handler(Looper.getMainLooper())
    private lateinit var app: Context
    private var client: BillingClient? = null
    private var details: ProductDetails? = null
    private var onChange: (() -> Unit)? = null

    private fun prefs(c: Context) = c.getSharedPreferences("store", Context.MODE_PRIVATE)

    fun start(activity: Activity, onChange: () -> Unit) {
        app = activity.applicationContext
        this.onChange = onChange
        trialStart(app)
        connect()
    }

    /** Re-checks purchases (refunds, purchases made on another device). */
    fun refresh() {
        if (client?.isReady == true) queryPurchases(report = false) else if (::app.isInitialized) connect()
    }

    // ------------------------------------------------------------ state

    private fun trialStart(c: Context): Long {
        val saved = prefs(c).getLong("trialStart", 0L)
        val installed = try {
            c.packageManager.getPackageInfo(c.packageName, 0).firstInstallTime
        } catch (_: Exception) {
            System.currentTimeMillis()
        }
        val start = if (saved > 0) minOf(saved, installed) else installed
        if (start != saved) prefs(c).edit().putLong("trialStart", start).apply()
        return start
    }

    private fun daysLeft(c: Context): Int {
        val used = ((System.currentTimeMillis() - trialStart(c)).coerceAtLeast(0) / DAY).toInt()
        return (TRIAL_DAYS - used).coerceAtLeast(0)
    }

    fun licenseJson(c: Context): String {
        val left = daysLeft(c)
        val state = when {
            prefs(c).getBoolean("purchased", false) -> "purchased"
            left > 0 -> "trial"
            else -> "expired"
        }
        return JSONObject()
            .put("state", state)
            .put("daysLeft", left)
            .put("price", details?.oneTimePurchaseOfferDetails?.formattedPrice ?: JSONObject.NULL)
            .toString()
    }

    private fun changed() = main.post { onChange?.invoke() }

    private fun toast(name: String) = main.post { TvClient.get(app).toast("@$name") }

    // ------------------------------------------------------------ Play Billing

    private val purchasesListener = PurchasesUpdatedListener { result, purchases ->
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> handle(purchases.orEmpty(), report = true, fromQuery = false)
            BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> queryPurchases(report = true)
            else -> {}
        }
    }

    private fun connect() {
        val c = client ?: BillingClient.newBuilder(app)
            .setListener(purchasesListener)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build()
            .also { client = it }
        if (c.isReady) return
        c.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode != BillingClient.BillingResponseCode.OK) return
                queryDetails()
                queryPurchases(report = false)
            }

            override fun onBillingServiceDisconnected() {}
        })
    }

    private fun queryDetails() {
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                listOf(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(PRODUCT)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
                )
            )
            .build()
        client?.queryProductDetailsAsync(params) { result, found ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                details = found.productDetailsList.firstOrNull()
                changed()
            }
        }
    }

    private fun queryPurchases(report: Boolean) {
        val params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build()
        client?.queryPurchasesAsync(params) { result, purchases ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) handle(purchases, report, fromQuery = true)
        }
    }

    private fun handle(purchases: List<Purchase>, report: Boolean, fromQuery: Boolean) {
        val mine = purchases.filter { PRODUCT in it.products }
        val owned = mine.any { it.purchaseState == Purchase.PurchaseState.PURCHASED }
        val pending = mine.any { it.purchaseState == Purchase.PurchaseState.PENDING }
        for (p in mine) {
            if (p.purchaseState == Purchase.PurchaseState.PURCHASED && !p.isAcknowledged) {
                client?.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.purchaseToken).build()) {}
            }
        }
        // A query is the full picture (it also catches refunds); a purchase update only adds.
        if (fromQuery || owned) prefs(app).edit().putBoolean("purchased", owned).apply()
        if (report) toast(
            when {
                owned -> if (fromQuery) "restore_done" else "purchase_done"
                pending -> "purchase_pending"
                else -> "restore_none"
            }
        )
        changed()
    }

    fun buy(activity: Activity) {
        val c = client
        val d = details
        if (c == null || !c.isReady || d == null) {
            toast("purchase_unavailable")
            connect()
            return
        }
        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d).build()))
            .build()
        c.launchBillingFlow(activity, params)
    }

    fun restore(activity: Activity) {
        if (client?.isReady == true) queryPurchases(report = true) else {
            toast("purchase_unavailable")
            connect()
        }
    }
}
