package com.upimonitor.app.notification

import java.util.concurrent.ConcurrentHashMap

object DuplicateDetector {

    private const val DEFAULT_WINDOW_MS = 180_000L // 3 minutes

    private data class Entry(val hash: String, val timestamp: Long)

    private val cache = ConcurrentHashMap<String, Long>()

    @Synchronized
    fun isDuplicate(
        source: PaymentSource,
        amount: Double,
        sender: String?,
        ref: String?,
        timestamp: Long = System.currentTimeMillis()
    ): Boolean {
        cleanupOldEntries(timestamp)

        val key = buildString {
            append(source.name).append("|")
            append(String.format("%.2f", amount)).append("|")
            append(sender?.trim()?.lowercase() ?: "").append("|")
            append(ref?.trim() ?: "")
        }

        val lastSeen = cache[key]
        if (lastSeen != null && (timestamp - lastSeen) < DEFAULT_WINDOW_MS) {
            return true
        }

        cache[key] = timestamp
        return false
    }

    private fun cleanupOldEntries(now: Long) {
        val iterator = cache.entries.iterator()
        while (iterator.hasNext()) {
            val entry = iterator.next()
            if (now - entry.value > DEFAULT_WINDOW_MS) {
                iterator.remove()
            }
        }
    }

    fun clear() {
        cache.clear()
    }
}
