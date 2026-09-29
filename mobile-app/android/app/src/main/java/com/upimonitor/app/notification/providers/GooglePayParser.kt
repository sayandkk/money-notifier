package com.upimonitor.app.notification.providers

import com.upimonitor.app.notification.*
import java.util.regex.Pattern

class GooglePayParser : PaymentSourceParser {

    companion object {
        val SUPPORTED_PACKAGES = setOf(
            "com.google.android.apps.nbu.paisa.user",
            "com.google.android.apps.walletnfcrel",
            "com.google.android.apps.gpay",
            "com.google.android.apps.nbu.paisa"
        )

        private val SENDER_PATTERNS = listOf(
            Pattern.compile("(?i)^([a-zA-Z0-9\\s.'-]+?)\\s+(?:has\\s+)?sent\\s+(?:you\\s+)?(?:₹|\u20B9|INR|Rs\\.?)"),
            Pattern.compile("(?i)^([a-zA-Z0-9\\s.'-]+?)\\s+(?:has\\s+)?paid\\s+(?:you\\s+)?(?:₹|\u20B9|INR|Rs\\.?)"),
            Pattern.compile("(?i)(?:received from|payment from|from|sent by)\\s+([a-zA-Z0-9\\s.'-]+?)(?:\\s+(?:credited|to|via|on|ref|using|\\()|$)"),
            Pattern.compile("(?i)you received\\s+(?:₹|\u20B9|INR|Rs\\.?)\\s*[0-9,.]+\\s+from\\s+([a-zA-Z0-9\\s.'-]+)")
        )
    }

    override fun canParse(packageName: String, notification: NotificationData): Boolean {
        val pkg = packageName.lowercase().trim()
        if (SUPPORTED_PACKAGES.contains(pkg)) return true
        if (pkg.contains("paisa.user") || pkg.contains("walletnfcrel") || pkg.contains("gpay")) return true

        val combined = notification.getCombinedText().lowercase()
        return (combined.contains("google pay") || combined.contains("gpay") || combined.contains("tez")) &&
                ParserUtils.isIncomingPayment(combined)
    }

    override fun parse(notification: NotificationData): ParsedPayment? {
        val combined = notification.getCombinedText()
        if (!ParserUtils.isIncomingPayment(combined)) return null

        val amount = ParserUtils.extractAmount(combined) ?: return null
        val sender = extractSender(notification.text, notification.title, combined)
        val targetAccount = TargetAccountExtractor.extractAccount(combined)
        val utr = ParserUtils.extractReference(combined)

        return ParsedPayment(
            id = ParserUtils.generatePaymentId(),
            amount = amount,
            currency = "INR",
            senderName = sender ?: "Google Pay User",
            targetAccount = targetAccount ?: "Primary Bank Account",
            source = PaymentSource.GOOGLE_PAY,
            sourceApp = "Google Pay",
            transactionType = TransactionType.CREDIT,
            transactionReference = utr,
            receivedAt = notification.timestamp,
            rawTitle = notification.title,
            rawText = notification.text,
            confidence = 1.0f
        )
    }

    private fun extractSender(text: String, title: String, combined: String): String? {
        // 1. Try patterns on notification text first
        for (pattern in SENDER_PATTERNS) {
            val matcher = pattern.matcher(text)
            if (matcher.find()) {
                val candidate = ParserUtils.cleanSenderName(matcher.group(1))
                if (candidate != null) return candidate
            }
        }

        // 2. Check if notification title is the contact/sender name (e.g. "Rahul Sharma")
        if (title.isNotBlank() &&
            !title.contains("Google Pay", ignoreCase = true) &&
            !title.contains("GPay", ignoreCase = true) &&
            !title.contains("Tez", ignoreCase = true) &&
            !title.contains("Payment", ignoreCase = true) &&
            !title.contains("Received", ignoreCase = true)
        ) {
            val fromTitle = ParserUtils.cleanSenderName(title)
            if (fromTitle != null) return fromTitle
        }

        // 3. Try patterns on combined text
        for (pattern in SENDER_PATTERNS) {
            val matcher = pattern.matcher(combined)
            if (matcher.find()) {
                val candidate = ParserUtils.cleanSenderName(matcher.group(1))
                if (candidate != null) return candidate
            }
        }

        return null
    }
}
