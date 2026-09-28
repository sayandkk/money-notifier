package com.upimonitor.app.notification

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.google.gson.Gson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class SyncManager(private val context: Context) {

    companion object {
        private const val TAG = "SyncManager"
        private const val PREFS_NAME = "upi_sync_prefs"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_AUTO_SYNC = "auto_sync_enabled"
        private const val DEFAULT_URL = "http://192.168.1.100:8999/api/payment"
    }

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO)

    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .writeTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .build()

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, DEFAULT_URL) ?: DEFAULT_URL
        set(value) = prefs.edit().putString(KEY_SERVER_URL, value).apply()

    var isAutoSyncEnabled: Boolean
        get() = prefs.getBoolean(KEY_AUTO_SYNC, true)
        set(value) = prefs.edit().putBoolean(KEY_AUTO_SYNC, value).apply()

    fun syncPayment(payment: ParsedPayment, onResult: ((Boolean, String?) -> Unit)? = null) {
        if (!isAutoSyncEnabled) {
            onResult?.invoke(false, "Auto-sync disabled")
            return
        }

        val url = serverUrl
        if (url.isBlank()) {
            onResult?.invoke(false, "Desktop server URL is empty")
            return
        }

        scope.launch {
            try {
                val json = gson.toJson(payment)
                val mediaType = "application/json; charset=utf-8".toMediaType()
                val body = json.toRequestBody(mediaType)
                val request = Request.Builder()
                    .url(url)
                    .post(body)
                    .build()

                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        Log.d(TAG, "Successfully synced payment ${payment.id} to desktop")
                        onResult?.invoke(true, null)
                    } else {
                        val errMsg = "HTTP ${response.code}: ${response.message}"
                        Log.w(TAG, "Sync failed: $errMsg")
                        onResult?.invoke(false, errMsg)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error syncing payment to desktop: ${e.message}")
                onResult?.invoke(false, e.message)
            }
        }
    }

    fun testConnection(targetUrl: String, callback: (Boolean, String) -> Unit) {
        scope.launch {
            try {
                val testUrl = if (targetUrl.endsWith("/api/payment")) {
                    targetUrl.replace("/api/payment", "/api/status")
                } else if (targetUrl.endsWith("/")) {
                    "${targetUrl}api/status"
                } else {
                    "$targetUrl/api/status"
                }

                val request = Request.Builder()
                    .url(testUrl)
                    .get()
                    .build()

                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        callback(true, "Connected to Desktop Dashboard successfully!")
                    } else {
                        callback(false, "Server replied with code ${response.code}")
                    }
                }
            } catch (e: Exception) {
                callback(false, "Connection error: ${e.message ?: "Failed to reach desktop"}")
            }
        }
    }
}
