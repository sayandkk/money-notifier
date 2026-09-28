package com.upimonitor.app.notification

import java.util.UUID
import java.util.regex.Pattern

interface PaymentSourceParser {
    fun canParse(packageName: String, notification: NotificationData): Boolean
    fun parse(notification: NotificationData): ParsedPayment?
}

object ParserUtils {

    // Matches Indian currency formats: ₹500, ₹1,000, ₹1,25,000.50, INR 500, Rs. 1,000
    private val AMOUNT_PATTERN = Pattern.compile(
        "(?i)(?:₹|INR|Rs\\.?)\\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\\.[0-9]{1,2})?|[0-9]+(?:\\.[0-9]{1,2})?)"
    )

    // Reference ID / UTR
    private val UTR_PATTERN = Pattern.compile(
        "(?i)(?:upi(?:\\s*ref)?(?:\\s*id)?|utr|ref(?:\\s*no)?|txn(?:\\s*id)?)\\s*[:#-]?\\s*([a-zA-Z0-9]{8,22})"
    )

    // Negative indicators: outgoing payments, OTPs, promotional
    private val NEGATIVE_KEYWORDS = listOf(
        "sent to", "paid to", "payment to", "debited", "debited from",
        "transferred to", "otp", "one time password", "verification code",
        "login successful", "cashback scratch card", "unlock rewards", "earn cash"
    )

    // Positive incoming keywords
    private val INCOMING_KEYWORDS = listOf(
        "received", "credited", "received from", "payment received",
        "money received", "upi credit", "credited to", "deposited", "sent you"
    )

    fun isIncomingPayment(text: String): Boolean {
        val lower = text.lowercase()
        for (neg in NEGATIVE_KEYWORDS) {
            if (lower.contains(neg)) return false
        }
        for (pos in INCOMING_KEYWORDS) {
            if (lower.contains(pos)) return true
        }
        return false
    }

    fun extractAmount(text: String): Double? {
        val matcher = AMOUNT_PATTERN.matcher(text)
        if (matcher.find()) {
            val raw = matcher.group(1)?.replace(",", "")?.trim() ?: return null
            return raw.toDoubleOrNull()
        }
        return null
    }

    fun extractReference(text: String): String? {
        val matcher = UTR_PATTERN.matcher(text)
        if (matcher.find()) {
            return matcher.group(1)?.trim()
        }
        return null
    }

    fun cleanSenderName(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        val cleaned = raw.replace(Regex("(?i)^(from|by|to|mr\\.?|mrs\\.?|ms\\.?)\\s+"), "")
            .replace(Regex("(?i)\\s+(credited|received|on|via|through|using).*$"), "")
            .replace(Regex("[^a-zA-Z0-9\\s.'-]"), "")
            .trim()
        return if (cleaned.length in 2..40) cleaned else null
    }

    fun generatePaymentId(): String {
        return "pay_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().take(6)
    }
}
