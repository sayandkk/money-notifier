package com.upimonitor.app.notification

import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

object DuplicateDetector {

    // Ultra-short debounce window (2 seconds) solely to prevent duplicate Android OS notification callbacks of the exact same notification post.
    // Repeating payments from the same person (even a few seconds later) are fully allowed and announced!
    private const val DEBOUNCE_WINDOW_MS = 2000L

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

        // Key on exact source, amount, sender, ref, and timestamp bucket
        val key = if (!ref.isNullOrBlank()) {
            "${source.name}|REF|${ref.trim()}|${timestamp / 2000}"
        } else {
            buildString {
                append(source.name).append("|")
                append(String.format(Locale.US, "%.2f", amount)).append("|")
                append(sender?.trim()?.lowercase() ?: "").append("|")
                append(timestamp / 2000)
            }
        }

        val lastSeen = cache[key]
        if (lastSeen != null && (timestamp - lastSeen) < DEBOUNCE_WINDOW_MS) {
            return true
        }

        cache[key] = timestamp
        return false
    }

    private fun cleanupOldEntries(now: Long) {
        val iterator = cache.entries.iterator()
        while (iterator.hasNext()) {
            val entry = iterator.next()
            if (now - entry.value > DEBOUNCE_WINDOW_MS) {
                iterator.remove()
            }
        }
    }

    fun clear() {
        cache.clear()
    }
}
