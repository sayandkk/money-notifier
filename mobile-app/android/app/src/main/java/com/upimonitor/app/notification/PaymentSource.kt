package com.upimonitor.app.notification

enum class PaymentSource {
    GOOGLE_PAY,
    GOOGLE_PAY_BUSINESS,
    PHONEPE,
    PAYTM,
    UNKNOWN;

    fun getDisplayName(): String {
        return when (this) {
            GOOGLE_PAY -> "Google Pay"
            GOOGLE_PAY_BUSINESS -> "Google Pay for Business"
            PHONEPE -> "PhonePe"
            PAYTM -> "Paytm"
            UNKNOWN -> "Payment Application"
        }
    }
}
