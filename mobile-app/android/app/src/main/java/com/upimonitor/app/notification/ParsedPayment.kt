package com.upimonitor.app.notification

data class ParsedPayment(
    val id: String,
    val amount: Double,
    val currency: String = "INR",
    val senderName: String?,
    val targetAccount: String?,
    val source: PaymentSource,
    val sourceApp: String,
    val transactionType: TransactionType,
    val transactionReference: String?,
    val receivedAt: Long,
    val rawTitle: String,
    val rawText: String,
    val confidence: Float
)
