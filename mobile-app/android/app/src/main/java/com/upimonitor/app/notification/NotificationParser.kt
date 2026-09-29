package com.upimonitor.app.notification

import java.util.UUID
import java.util.regex.Pattern

interface PaymentSourceParser {
    fun canParse(packageName: String, notification: NotificationData): Boolean
    fun parse(notification: NotificationData): ParsedPayment?
}

object ParserUtils {

    // Matches Indian currency formats: ₹500, ₹ 500, ₹1,000, ₹1,25,000.50, INR 500, Rs. 1,000, Rs 500, Rs.500, 500 INR, 500 Rs
    private val AMOUNT_PATTERNS = listOf(
        Pattern.compile("(?i)(?:₹|\u20B9|INR|Rs\\.?|re\\.?|rupees?)\\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\\.[0-9]{1,2})?|[0-9]+(?:\\.[0-9]{1,2})?)"),
        Pattern.compile("(?i)([0-9]{1,3}(?:,[0-9]{2,3})*(?:\\.[0-9]{1,2})?|[0-9]+(?:\\.[0-9]{1,2})?)\\s*(?:₹|\u20B9|INR|Rs\\.?|re\\.?|rupees?)"),
        Pattern.compile("(?i)(?:received|credited|deposited|sent you|paid you|transferred|added|payment of)\\s+([0-9]{1,3}(?:,[0-9]{2,3})*(?:\\.[0-9]{1,2})?|[0-9]+(?:\\.[0-9]{1,2})?)")
    )

    // Reference ID / UTR / Txn ID / UPI Ref / RRN
    private val UTR_PATTERNS = listOf(
        Pattern.compile("(?i)(?:upi(?:\\s*ref)?(?:\\s*(?:id|no|num|number))?|utr|ref(?:\\s*(?:no|num|number|id))?|txn(?:\\s*(?:id|no|num|number))?|rrn)\\s*[:#-]?\\s*([a-zA-Z0-9]{8,24})"),
        Pattern.compile("(?i)(?:ref(?:erence)?\\s*(?:no|id)?[:\\s]+)([a-zA-Z0-9]{8,24})")
    )

    // Outgoing / Debited / Spam patterns
    // Negative lookahead (?!you\b|your\b) ensures phrases like "sent to your account" or "paid to you" are NOT marked as outgoing!
    private val OUTGOING_PATTERNS = listOf(
        Pattern.compile("(?i)\\b(?:debited|debited from|paid to (?!you\\b|your\\b)|sent to (?!you\\b|your\\b)|transferred to (?!you\\b|your\\b)|you paid|you sent|you transferred|payment to (?!you\\b|your\\b)|spent on|purchase at|order placed|money debited|bill paid|recharge successful)\\b"),
        Pattern.compile("(?i)\\b(?:otp|one time password|verification code|login successful|cashback scratch card|unlock rewards|earn cash|spin to win|claim reward)\\b")
    )

    // Positive incoming keywords
    private val INCOMING_PATTERNS = listOf(
        Pattern.compile("(?i)\\b(?:received|received from|received payment|payment received|money received|upi credit|credited|credited to|credited with|deposited|deposited in|deposited into|sent you|has sent you|paid you|has paid you|transferred to your|transferred to you|sent to your|sent to you|paid to your|paid to you|added to your|added to wallet|received in|received on|money transfer|payment from|received a payment)\\b")
    )

    fun isIncomingPayment(text: String): Boolean {
        if (text.isBlank()) return false
        val normalized = text.replace("\n", " ").trim()

        // Check if explicitly outgoing or spam
        for (pattern in OUTGOING_PATTERNS) {
            if (pattern.matcher(normalized).find()) {
                return false
            }
        }

        // Check if contains positive incoming indicators
        for (pattern in INCOMING_PATTERNS) {
            if (pattern.matcher(normalized).find()) {
                return true
            }
        }

        return false
    }

    fun extractAmount(text: String): Double? {
        if (text.isBlank()) return null
        val normalized = text.replace("\n", " ").trim()
        for (pattern in AMOUNT_PATTERNS) {
            val matcher = pattern.matcher(normalized)
            if (matcher.find()) {
                val raw = matcher.group(1)?.replace(",", "")?.trim() ?: continue
                val parsed = raw.toDoubleOrNull()
                if (parsed != null && parsed > 0.0) {
                    return parsed
                }
            }
        }
        return null
    }

    fun extractReference(text: String): String? {
        if (text.isBlank()) return null
        val normalized = text.replace("\n", " ").trim()
        for (pattern in UTR_PATTERNS) {
            val matcher = pattern.matcher(normalized)
            if (matcher.find()) {
                val raw = matcher.group(1)?.trim()
                if (raw != null && raw.length in 8..24) {
                    return raw
                }
            }
        }
        return null
    }

    fun cleanSenderName(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        var cleaned = raw.trim()
            // Remove known app name prefixes
            .replace(Regex("(?i)^(google\\s*pay|gpay|phonepe|paytm|bhim|cred|amazon\\s*pay|navi|tez)\\s*[:|-]?\\s*"), "")
            // Remove conversational prefixes
            .replace(Regex("(?i)^(payment\\s*(?:received)?\\s*(?:of|from)?|received\\s*(?:from)?|from|by|to|mr\\.?|mrs\\.?|ms\\.?|customer)\\s+"), "")
            // Remove trailing references, IDs, or phrases
            .replace(Regex("(?i)\\s*\\(?(?:upi\\s*(?:id|ref)?|ref|utr|txn|rrn)[^)]*\\)?$"), "")
            .replace(Regex("(?i)\\s+(credited|received|deposited|on|via|through|using|in|to|for|with|ref).*$"), "")
            // Remove non-name special characters
            .replace(Regex("[^a-zA-Z0-9\\s.'-]"), "")
            .trim()

        // Ignore generic labels
        if (cleaned.equals("Google Pay", ignoreCase = true) ||
            cleaned.equals("PhonePe", ignoreCase = true) ||
            cleaned.equals("Paytm", ignoreCase = true) ||
            cleaned.equals("Payment", ignoreCase = true) ||
            cleaned.equals("Payment Received", ignoreCase = true) ||
            cleaned.equals("Money Received", ignoreCase = true) ||
            cleaned.equals("Money", ignoreCase = true) ||
            cleaned.equals("UPI", ignoreCase = true) ||
            cleaned.equals("Alert", ignoreCase = true) ||
            cleaned.equals("User", ignoreCase = true) ||
            cleaned.equals("Customer", ignoreCase = true)
        ) {
            return null
        }

        return if (cleaned.length in 2..50) cleaned else null
    }

    fun generatePaymentId(): String {
        return "pay_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().take(6)
    }
}
