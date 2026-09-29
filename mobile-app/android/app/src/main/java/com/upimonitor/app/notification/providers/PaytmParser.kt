package com.upimonitor.app.notification.providers

import com.upimonitor.app.notification.*
import java.util.regex.Pattern

class PaytmParser : PaymentSourceParser {

    companion object {
        val SUPPORTED_PACKAGES = setOf(
            "net.one97.paytm",
            "com.paytm.business",
            "net.one97.paytm.business",
            "com.paytmmoney",
            "com.paytm.merchant"
        )

        private val SENDER_PATTERNS = listOf(
            Pattern.compile("(?i)(?:received from|from|by)\\s+([a-zA-Z0-9\\s.'-]+?)(?:\\s+(?:in|to|via|on|credited|ref|using|\\()|$)"),
            Pattern.compile("(?i)money received.*?(?:from\\s+)?([a-zA-Z0-9\\s.'-]+?)(?:\\s+(?:in|to|via|on|credited|ref|using|\\()|$)"),
            Pattern.compile("(?i)received payment of.*?(?:from\\s+)?([a-zA-Z0-9\\s.'-]+?)(?:\\s+(?:in|to|via|on|credited|ref|using|\\()|$)"),
            Pattern.compile("(?i)you have received\\s+(?:a payment of\\s+)?(?:₹|\u20B9|INR|Rs\\.?)\\s*[0-9,.]+\\s+from\\s+([a-zA-Z0-9\\s.'-]+)"),
            Pattern.compile("(?i)^([a-zA-Z0-9\\s.'-]+?)\\s+(?:has\\s+)?(?:sent|paid)\\s+(?:you\\s+)?(?:₹|\u20B9|INR|Rs\\.?)")
        )
    }

    override fun canParse(packageName: String, notification: NotificationData): Boolean {
        val pkg = packageName.lowercase().trim()
        if (SUPPORTED_PACKAGES.contains(pkg)) return true
        if (pkg.contains("paytm")) return true

        val combined = notification.getCombinedText().lowercase()
        return combined.contains("paytm") && ParserUtils.isIncomingPayment(combined)
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
            senderName = sender ?: "Paytm User",
            targetAccount = targetAccount ?: "Paytm Payments Bank / Linked A/c",
            source = PaymentSource.PAYTM,
            sourceApp = "Paytm",
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

        // 2. Check if notification title is sender name
        if (title.isNotBlank() &&
            !title.contains("Paytm", ignoreCase = true) &&
            !title.contains("Payment", ignoreCase = true) &&
            !title.contains("Received", ignoreCase = true) &&
            !title.contains("Money", ignoreCase = true) &&
            !title.contains("Alert", ignoreCase = true)
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
