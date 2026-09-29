package com.upimonitor.app.notification

import android.content.Context
import android.media.AudioManager
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.util.Log
import java.util.Locale

object VoiceSpeaker : TextToSpeech.OnInitListener {

    private const val TAG = "VoiceSpeaker"
    private var tts: TextToSpeech? = null
    private var isInitialized = false
    var isVoiceEnabled: Boolean = true

    fun init(context: Context) {
        if (tts == null) {
            try {
                tts = TextToSpeech(context.applicationContext, this)
            } catch (e: Exception) {
                Log.e(TAG, "Error creating TextToSpeech: ${e.message}", e)
            }
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val result = tts?.setLanguage(Locale("en", "IN"))
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                tts?.setLanguage(Locale.US)
            }
            tts?.setPitch(1.0f)
            tts?.setSpeechRate(0.95f)
            isInitialized = true
            Log.i(TAG, "TextToSpeech Soundbox initialized successfully")
        } else {
            Log.e(TAG, "TextToSpeech initialization failed with status: $status")
        }
    }

    fun speak(text: String) {
        if (!isVoiceEnabled) return
        if (tts == null || !isInitialized) {
            Log.w(TAG, "TextToSpeech not ready yet, text: $text")
            return
        }

        try {
            val utteranceId = "upi_voice_" + System.currentTimeMillis()
            val params = Bundle()
            params.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_NOTIFICATION)
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
            Log.i(TAG, "Announced via voice: $text")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to speak text: ${e.message}", e)
        }
    }

    fun speakPayment(payment: ParsedPayment) {
        val amount = if (payment.amount % 1.0 == 0.0) {
            payment.amount.toLong().toString()
        } else {
            String.format(Locale.US, "%.2f", payment.amount)
        }
        val appName = payment.sourceApp.ifBlank { payment.source.getDisplayName() }
        val senderPart = if (!payment.senderName.isNullOrBlank() &&
            !payment.senderName.equals("Unknown Sender", ignoreCase = true) &&
            !payment.senderName.equals("UPI Sender", ignoreCase = true) &&
            !payment.senderName.equals("Google Pay User", ignoreCase = true) &&
            !payment.senderName.equals("PhonePe User", ignoreCase = true) &&
            !payment.senderName.equals("Paytm User", ignoreCase = true) &&
            !payment.senderName.equals("Business Customer", ignoreCase = true)
        ) {
            "by ${payment.senderName}"
        } else {
            ""
        }

        val speechText = if (senderPart.isNotBlank()) {
            "Rupees $amount received on $appName $senderPart"
        } else {
            "Rupees $amount received on $appName"
        }

        speak(speechText)
    }

    fun shutdown() {
        try {
            tts?.stop()
            tts?.shutdown()
        } catch (e: Exception) {
            Log.e(TAG, "Error shutting down TTS: ${e.message}", e)
        }
        tts = null
        isInitialized = false
    }
}
