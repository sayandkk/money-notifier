package com.upimonitor.app.notification.providers

import com.upimonitor.app.notification.*
import java.util.regex.Pattern

class GenericUpiParser : PaymentSourceParser {

    companion object {
        private val SENDER_PATTERNS = listOf(
            Pattern.compile("(?i)(?:received from|from|by|sent by)\\s+([a-zA-Z0-9\\s.'-]+?)(?:\\s+(?:credited|in|to|via|on|ref|using|\\()|$)"),
            Pattern.compile("(?i)payment of\\s+(?:₹|\u20B9|INR|Rs\\.?)\\s*[0-9,.]+\\s+(?:received )?from\\s+([a-zA-Z0-9\\s.'-]+)"),
            Pattern.compile("(?i)you have received\\s+(?:a payment of\\s+)?(?:₹|\u20B9|INR|Rs\\.?)\\s*[0-9,.]+\\s+from\\s+([a-zA-Z0-9\\s.'-]+)"),
            Pattern.compile("(?i)^([a-zA-Z0-9\\s.'-]+?)\\s+(?:has\\s+)?(?:sent|paid)\\s+(?:you\\s+)?(?:₹|\u20B9|INR|Rs\\.?)")
        )
    }

    override fun canParse(packageName: String, notification: NotificationData): Boolean {
        val combined = notification.getCombinedText().lowercase()
        val pkg = packageName.lowercase()

        // Match known UPI/Bank packages or any notification that contains incoming payment keywords
        val isUpiPackage = pkg.contains("bhim") ||
                pkg.contains("npci") ||
                pkg.contains("cred") ||
                pkg.contains("amazon") ||
                pkg.contains("navi") ||
                pkg.contains("bank") ||
                pkg.contains("messaging") ||
                pkg.contains("mms") ||
                pkg.contains("sms") ||
                pkg.contains("whatsapp")

        val hasUpiIndicators = combined.contains("upi") ||
                combined.contains("vpa") ||
                combined.contains("credited") ||
                combined.contains("received") ||
                combined.contains("inr") ||
                combined.contains("rs.") ||
                combined.contains("₹")

        return (isUpiPackage || hasUpiIndicators) && ParserUtils.isIncomingPayment(combined)
    }

    override fun parse(notification: NotificationData): ParsedPayment? {
        val combined = notification.getCombinedText()
        if (!ParserUtils.isIncomingPayment(combined)) return null

        val amount = ParserUtils.extractAmount(combined) ?: return null
        val (source, sourceApp) = identifySource(notification.packageName, combined)
        val sender = extractSender(notification.text, notification.title, combined)
        val targetAccount = TargetAccountExtractor.extractAccount(combined)
        val utr = ParserUtils.extractReference(combined)

        return ParsedPayment(
            id = ParserUtils.generatePaymentId(),
            amount = amount,
            currency = "INR",
            senderName = sender ?: "UPI Sender",
            targetAccount = targetAccount ?: "Bank Account",
            source = source,
            sourceApp = sourceApp,
            transactionType = TransactionType.CREDIT,
            transactionReference = utr,
            receivedAt = notification.timestamp,
            rawTitle = notification.title,
            rawText = notification.text,
            confidence = 0.9f
        )
    }

    private fun identifySource(packageName: String, combined: String): Pair<PaymentSource, String> {
        val pkg = packageName.lowercase()
        val text = combined.lowercase()

        return when {
            pkg.contains("bhim") || pkg.contains("npci") || text.contains("bhim") ->
                Pair(PaymentSource.BHIM, "BHIM UPI")
            pkg.contains("cred") || text.contains("cred") ->
                Pair(PaymentSource.CRED, "CRED")
            pkg.contains("amazon") || text.contains("amazon pay") ->
                Pair(PaymentSource.AMAZON_PAY, "Amazon Pay")
            pkg.contains("navi") || text.contains("navi") ->
                Pair(PaymentSource.NAVI, "Navi")
            pkg.contains("bank") || text.contains("bank") || text.contains("a/c") || text.contains("account") ->
                Pair(PaymentSource.BANK_UPI, "Bank Alert")
            else ->
                Pair(PaymentSource.OTHER, "UPI Payment")
        }
    }

    private fun extractSender(text: String, title: String, combined: String): String? {
        for (pattern in SENDER_PATTERNS) {
            val matcher = pattern.matcher(text)
            if (matcher.find()) {
                val candidate = ParserUtils.cleanSenderName(matcher.group(1))
                if (candidate != null) return candidate
            }
        }

        if (title.isNotBlank() &&
            !title.contains("Payment", ignoreCase = true) &&
            !title.contains("Alert", ignoreCase = true) &&
            !title.contains("Received", ignoreCase = true) &&
            !title.contains("Bank", ignoreCase = true) &&
            !title.contains("UPI", ignoreCase = true)
        ) {
            val fromTitle = ParserUtils.cleanSenderName(title)
            if (fromTitle != null) return fromTitle
        }

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
