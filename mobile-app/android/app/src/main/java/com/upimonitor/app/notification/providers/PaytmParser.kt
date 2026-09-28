package com.upimonitor.app.notification.providers

import com.upimonitor.app.notification.*
import java.util.regex.Pattern

class PaytmParser : PaymentSourceParser {

    companion object {
        val SUPPORTED_PACKAGES = setOf(
            "net.one97.paytm",
            "com.paytm.business"
        )

        private val SENDER_PATTERNS = listOf(
            Pattern.compile("(?i)(?:received from|from|by)\\s+([a-zA-Z0-9\\s.'-]+?)(?:\\s+in|\\s+to|\\s+via|\\s+on|$)"),
            Pattern.compile("(?i)money received.*?from\\s+([a-zA-Z0-9\\s.'-]+)")
        )
    }

    override fun canParse(packageName: String, notification: NotificationData): Boolean {
        if (SUPPORTED_PACKAGES.contains(packageName.lowercase())) return true
        val combined = notification.getCombinedText().lowercase()
        return packageName.contains("paytm") && ParserUtils.isIncomingPayment(combined)
    }

    override fun parse(notification: NotificationData): ParsedPayment? {
        val combined = notification.getCombinedText()
        if (!ParserUtils.isIncomingPayment(combined)) return null

        val amount = ParserUtils.extractAmount(combined) ?: return null
        val sender = extractSender(combined, notification.title)
        val targetAccount = TargetAccountExtractor.extractAccount(combined)
        val utr = ParserUtils.extractReference(combined)

        return ParsedPayment(
            id = ParserUtils.generatePaymentId(),
            amount = amount,
            currency = "INR",
            senderName = sender ?: "Unknown Sender",
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

    private fun extractSender(combined: String, title: String): String? {
        for (pattern in SENDER_PATTERNS) {
            val matcher = pattern.matcher(combined)
            if (matcher.find()) {
                val candidate = ParserUtils.cleanSenderName(matcher.group(1))
                if (candidate != null) return candidate
            }
        }

        if (title.isNotBlank() && !title.contains("Paytm", ignoreCase = true) && !title.contains("Payment", ignoreCase = true)) {
            val fromTitle = ParserUtils.cleanSenderName(title)
            if (fromTitle != null) return fromTitle
        }

        return null
    }
}
