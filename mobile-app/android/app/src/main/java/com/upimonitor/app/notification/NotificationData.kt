package com.upimonitor.app.notification

data class NotificationData(
    val packageName: String,
    val title: String,
    val text: String,
    val subText: String? = null,
    val bigText: String? = null,
    val timestamp: Long = System.currentTimeMillis()
) {
    fun getCombinedText(): String {
        return buildString {
            if (title.isNotBlank()) append(title).append(" ")
            if (text.isNotBlank()) append(text).append(" ")
            if (!subText.isNullOrBlank()) append(subText).append(" ")
            if (!bigText.isNullOrBlank()) append(bigText)
        }.trim()
    }
}
