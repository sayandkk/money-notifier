package com.upimonitor.app.notification

import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

object DuplicateDetector {

    private const val DEFAULT_WINDOW_MS = 180_000L // 3 minutes

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

        // If UTR / Ref is available, key on source + ref
        val key = if (!ref.isNullOrBlank()) {
            "${source.name}|REF|${ref.trim()}"
        } else {
            buildString {
                append(source.name).append("|")
                append(String.format(Locale.US, "%.2f", amount)).append("|")
                append(sender?.trim()?.lowercase() ?: "")
            }
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
