package com.upimonitor.app.notification.providers

import com.upimonitor.app.notification.*
import java.util.regex.Pattern

class GooglePayBusinessParser : PaymentSourceParser {

    companion object {
        val SUPPORTED_PACKAGES = mutableSetOf(
            "com.google.android.apps.nbu.paisa.merchant",
            "com.google.android.apps.business.payment"
        )

        private val CUSTOMER_PATTERNS = listOf(
            Pattern.compile("(?i)(?:from|by|customer)\\s+([a-zA-Z0-9\\s.'-]+?)(?:\\s+to|\\s+via|\\s+on|\\s+ref|$)"),
            Pattern.compile("(?i)received from\\s+([a-zA-Z0-9\\s.'-]+)")
        )
    }

    fun registerCustomPackage(packageName: String) {
        SUPPORTED_PACKAGES.add(packageName.lowercase().trim())
    }

    override fun canParse(packageName: String, notification: NotificationData): Boolean {
        if (SUPPORTED_PACKAGES.contains(packageName.lowercase())) return true
        val combined = notification.getCombinedText().lowercase()
        return (packageName.contains("paisa.merchant") || packageName.contains("business")) &&
                ParserUtils.isIncomingPayment(combined)
    }

    override fun parse(notification: NotificationData): ParsedPayment? {
        val combined = notification.getCombinedText()
        if (!ParserUtils.isIncomingPayment(combined)) return null

        val amount = ParserUtils.extractAmount(combined) ?: return null
        val customerName = extractCustomerName(combined)
        val targetAccount = TargetAccountExtractor.extractAccount(combined)
        val utr = ParserUtils.extractReference(combined)

        return ParsedPayment(
            id = ParserUtils.generatePaymentId(),
            amount = amount,
            currency = "INR",
            senderName = customerName ?: "Business Customer",
            targetAccount = targetAccount ?: "Merchant Business Account",
            source = PaymentSource.GOOGLE_PAY_BUSINESS,
            sourceApp = "Google Pay for Business",
            transactionType = TransactionType.CREDIT,
            transactionReference = utr,
            receivedAt = notification.timestamp,
            rawTitle = notification.title,
            rawText = notification.text,
            confidence = 1.0f
        )
    }

    private fun extractCustomerName(combined: String): String? {
        for (pattern in CUSTOMER_PATTERNS) {
            val matcher = pattern.matcher(combined)
            if (matcher.find()) {
                val candidate = ParserUtils.cleanSenderName(matcher.group(1))
                if (candidate != null) return candidate
            }
        }
        return null
    }
}
