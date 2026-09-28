package com.upimonitor.app.bridge

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.gson.Gson
import com.upimonitor.app.notification.*
import com.upimonitor.app.notification.providers.GooglePayBusinessParser

class NotificationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "NotificationModule"
        private var reactContextInstance: ReactApplicationContext? = null

        fun emitPaymentReceived(payment: ParsedPayment) {
            val json = Gson().toJson(payment)
            reactContextInstance
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("onPaymentReceived", json)
        }
    }

    private val syncManager = SyncManager(reactContext)

    init {
        reactContextInstance = reactContext
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun isNotificationAccessGranted(promise: Promise) {
        try {
            val pkgName = reactContext.packageName
            val flat = Settings.Secure.getString(
                reactContext.contentResolver,
                "enabled_notification_listeners"
            )
            if (!TextUtils.isEmpty(flat)) {
                val names = flat.split(":").toTypedArray()
                for (name in names) {
                    val cn = ComponentName.unflattenFromString(name)
                    if (cn != null && TextUtils.equals(pkgName, cn.packageName)) {
                        promise.resolve(true)
                        return
                    }
                }
            }
            promise.resolve(false)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun openNotificationSettings(promise: Promise) {
        try {
            val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getStoredPayments(promise: Promise) {
        try {
            val list = PaymentNotificationListener.getSavedPayments(reactContext)
            val json = Gson().toJson(list)
            promise.resolve(json)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getDebugNotifications(promise: Promise) {
        try {
            val list = PaymentNotificationListener.getDebugNotifications(reactContext)
            val json = Gson().toJson(list)
            promise.resolve(json)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getServerUrl(promise: Promise) {
        promise.resolve(syncManager.serverUrl)
    }

    @ReactMethod
    fun setServerUrl(url: String, promise: Promise) {
        syncManager.serverUrl = url.trim()
        promise.resolve(true)
    }

    @ReactMethod
    fun testServerConnection(url: String, promise: Promise) {
        syncManager.testConnection(url.trim()) { success, message ->
            val map = Arguments.createMap()
            map.putBoolean("success", success)
            map.putString("message", message)
            promise.resolve(map)
        }
    }

    @ReactMethod
    fun simulatePayment(
        platformStr: String,
        amount: Double,
        sender: String,
        account: String,
        promise: Promise
    ) {
        try {
            val source = try {
                PaymentSource.valueOf(platformStr.uppercase())
            } catch (e: Exception) {
                PaymentSource.GOOGLE_PAY
            }

            val mockPayment = ParsedPayment(
                id = ParserUtils.generatePaymentId(),
                amount = amount,
                currency = "INR",
                senderName = sender,
                targetAccount = account,
                source = source,
                sourceApp = source.getDisplayName(),
                transactionType = TransactionType.CREDIT,
                transactionReference = "SIM" + System.currentTimeMillis().toString().takeLast(10),
                receivedAt = System.currentTimeMillis(),
                rawTitle = "${source.getDisplayName()} Alert",
                rawText = "₹$amount received from $sender credited to $account",
                confidence = 1.0f
            )

            PaymentNotificationListener.savePayment(reactContext, mockPayment)
            emitPaymentReceived(mockPayment)
            syncManager.syncPayment(mockPayment)

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Keep for RN Event Emitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep for RN Event Emitter
    }
}
