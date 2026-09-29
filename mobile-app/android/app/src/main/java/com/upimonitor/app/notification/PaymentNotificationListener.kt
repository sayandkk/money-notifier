package com.upimonitor.app.notification

import android.app.Notification
import android.content.Context
import android.content.Intent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.upimonitor.app.bridge.NotificationModule
import com.upimonitor.app.notification.providers.*

class PaymentNotificationListener : NotificationListenerService() {

    companion object {
        private const val TAG = "PaymentNotification"
        private const val PREFS_NAME = "upi_payments_storage"
        private const val KEY_PAYMENTS = "saved_payments"
        private const val KEY_DEBUG_NOTIFS = "debug_notifications"
        private const val MAX_SAVED = 150
        private const val MAX_DEBUG = 30

        var isServiceRunning = false
            private set

        fun getSavedPayments(context: Context): List<ParsedPayment> {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = prefs.getString(KEY_PAYMENTS, null) ?: return emptyList()
            return try {
                val type = object : TypeToken<List<ParsedPayment>>() {}.type
                Gson().fromJson(json, type) ?: emptyList()
            } catch (e: Exception) {
                emptyList()
            }
        }

        fun savePayment(context: Context, payment: ParsedPayment) {
            val current = getSavedPayments(context).toMutableList()
            // Check for existing ID
            if (current.none { it.id == payment.id }) {
                current.add(0, payment)
                if (current.size > MAX_SAVED) {
                    current.removeAt(current.lastIndex)
                }
                val json = Gson().toJson(current)
                context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putString(KEY_PAYMENTS, json)
                    .apply()
            }
        }

        fun getDebugNotifications(context: Context): List<NotificationData> {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = prefs.getString(KEY_DEBUG_NOTIFS, null) ?: return emptyList()
            return try {
                val type = object : TypeToken<List<NotificationData>>() {}.type
                Gson().fromJson(json, type) ?: emptyList()
            } catch (e: Exception) {
                emptyList()
            }
        }

        private fun saveDebugNotification(context: Context, notif: NotificationData) {
            val current = getDebugNotifications(context).toMutableList()
            current.add(0, notif)
            if (current.size > MAX_DEBUG) {
                current.removeAt(current.lastIndex)
            }
            val json = Gson().toJson(current)
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_DEBUG_NOTIFS, json)
                .apply()
        }
    }

    private val parsers: List<PaymentSourceParser> by lazy {
        listOf(
            GooglePayBusinessParser(),
            GooglePayParser(),
            PhonePeParser(),
            PaytmParser(),
            GenericUpiParser()
        )
    }

    private lateinit var syncManager: SyncManager

    override fun onCreate() {
        super.onCreate()
        isServiceRunning = true
        syncManager = SyncManager(applicationContext)
        VoiceSpeaker.init(applicationContext)
        Log.i(TAG, "PaymentNotificationListener Service Started")
    }

    override fun onDestroy() {
        super.onDestroy()
        isServiceRunning = false
        VoiceSpeaker.shutdown()
        Log.i(TAG, "PaymentNotificationListener Service Destroyed")
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return

        val packageName = sbn.packageName ?: return
        val notification = sbn.notification ?: return
        val extras = notification.extras ?: return

        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
        val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString()
        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()

        // Ignore empty notifications
        if (title.isBlank() && text.isBlank()) return

        val notificationData = NotificationData(
            packageName = packageName,
            title = title,
            text = text,
            subText = subText,
            bigText = bigText,
            timestamp = sbn.postTime
        )

        // Store into debug list for inspector
        saveDebugNotification(applicationContext, notificationData)

        // Run through payment parsers
        for (parser in parsers) {
            try {
                if (parser.canParse(packageName, notificationData)) {
                    val parsed = parser.parse(notificationData)
                    if (parsed != null && parsed.transactionType == TransactionType.CREDIT) {
                        Log.i(TAG, "Successfully parsed with ${parser::class.simpleName}: ₹${parsed.amount} from ${parsed.senderName}")
                        handleIncomingPayment(parsed)
                        break
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error in parser ${parser::class.simpleName}: ${e.message}", e)
            }
        }
    }

    private fun handleIncomingPayment(payment: ParsedPayment) {
        // Duplicate check
        val isDup = DuplicateDetector.isDuplicate(
            source = payment.source,
            amount = payment.amount,
            sender = payment.senderName,
            ref = payment.transactionReference,
            timestamp = payment.receivedAt
        )

        if (isDup) {
            Log.d(TAG, "Suppressed duplicate notification for payment ${payment.amount}")
            return
        }

        Log.i(TAG, "Payment Detected: ₹${payment.amount} from ${payment.senderName} on ${payment.sourceApp}")

        // 1. Save locally in device storage
        savePayment(applicationContext, payment)

        // 2. Play Soundbox Voice Announcement aloud on phone
        VoiceSpeaker.speakPayment(payment)

        // 3. Broadcast live event to React Native UI
        NotificationModule.emitPaymentReceived(payment)

        // 4. Sync to Desktop Electron App
        syncManager.syncPayment(payment) { success, error ->
            if (success) {
                Log.d(TAG, "Payment successfully synced to Electron desktop")
            } else {
                Log.w(TAG, "Payment desktop sync note: $error")
            }
        }
    }
}
