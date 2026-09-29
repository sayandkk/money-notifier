package com.upimonitor.app.notification

enum class PaymentSource {
    GOOGLE_PAY,
    GOOGLE_PAY_BUSINESS,
    PHONEPE,
    PAYTM,
    BHIM,
    CRED,
    AMAZON_PAY,
    NAVI,
    BANK_UPI,
    OTHER,
    UNKNOWN;

    fun getDisplayName(): String {
        return when (this) {
            GOOGLE_PAY -> "Google Pay"
            GOOGLE_PAY_BUSINESS -> "Google Pay for Business"
            PHONEPE -> "PhonePe"
            PAYTM -> "Paytm"
            BHIM -> "BHIM UPI"
            CRED -> "CRED UPI"
            AMAZON_PAY -> "Amazon Pay"
            NAVI -> "Navi UPI"
            BANK_UPI -> "Bank UPI Alert"
            OTHER -> "UPI Payment"
            UNKNOWN -> "Payment Application"
        }
    }
}

