package com.upimonitor.app.notification

import java.util.regex.Pattern

object TargetAccountExtractor {

    // Common Indian banks
    private val KNOWN_BANKS = listOf(
        "State Bank of India", "SBI",
        "HDFC Bank", "HDFC",
        "ICICI Bank", "ICICI",
        "Axis Bank", "Axis",
        "Kotak Mahindra Bank", "Kotak",
        "Punjab National Bank", "PNB",
        "Bank of Baroda", "BOB",
        "Canara Bank", "Union Bank",
        "IndusInd Bank", "Yes Bank",
        "IDFC FIRST Bank", "IDFC",
        "Federal Bank", "Bank of India",
        "Paytm Payments Bank", "Airtel Payments Bank", "Jio Payments Bank",
        "Indian Bank", "Central Bank"
    )

    // Regex patterns for account detection
    private val ACCOUNT_PATTERNS = listOf(
        // "credited to your SBI A/c XX4589" or "credited to SBI A/c 4589"
        Pattern.compile("(?i)(?:credited to|to|in|deposited in)\\s+([a-zA-Z\\s]+(?:bank|sbi|hdfc|icici|axis|kotak|pnb)?)\\s*(?:a/c|account|acct|acc)\\s*(?:no\\.?|ending|ending with|in)?\\s*([*xX\\d]{2,10})"),
        
        // "credited to A/c ending with XX1234"
        Pattern.compile("(?i)(?:credited to|deposited in|in)\\s+(?:your)?\\s*(?:bank)?\\s*(?:a/c|account|acct)\\s*(?:ending with|ending in|ending)?\\s*([*xX\\d]{2,10})"),

        // "to account ending in 1234"
        Pattern.compile("(?i)(?:to|into)\\s+(?:account|a/c)\\s*(?:ending|ending with|ending in)?\\s*([*xX\\d]{2,10})"),

        // "A/c **1234 credited"
        Pattern.compile("(?i)(?:a/c|account)\\s*([*xX\\d]{2,10})\\s*(?:has been)?\\s*credited"),

        // "in Paytm Payments Bank"
        Pattern.compile("(?i)in\\s+(paytm payments bank|airtel payments bank)")
    )

    fun extractAccount(text: String): String? {
        val normalized = text.replace("\n", " ").trim()

        // 1. Try regex pattern matching
        for (pattern in ACCOUNT_PATTERNS) {
            val matcher = pattern.matcher(normalized)
            if (matcher.find()) {
                val groupCount = matcher.groupCount()
                if (groupCount >= 2) {
                    val bankPart = matcher.group(1)?.trim() ?: ""
                    val accPart = matcher.group(2)?.trim() ?: ""
                    val cleanedBank = resolveBankName(bankPart)
                    val maskedAcc = formatMaskedAccount(accPart)
                    if (cleanedBank.isNotEmpty() && maskedAcc.isNotEmpty()) {
                        return "$cleanedBank ($maskedAcc)"
                    } else if (maskedAcc.isNotEmpty()) {
                        return "Bank A/c ($maskedAcc)"
                    }
                } else if (groupCount == 1) {
                    val captured = matcher.group(1)?.trim() ?: ""
                    if (captured.matches(Regex(".*[0-9].*"))) {
                        val masked = formatMaskedAccount(captured)
                        val bank = findBankInText(normalized)
                        return if (bank != null) "$bank ($masked)" else "Bank A/c ($masked)"
                    } else {
                        val bank = resolveBankName(captured)
                        if (bank.isNotEmpty()) return bank
                    }
                }
            }
        }

        // 2. Fallback: Search for known bank in text
        val bankInText = findBankInText(normalized)
        if (bankInText != null) {
            // Check if there is an account number nearby
            val numMatcher = Pattern.compile("(?i)(?:a/c|account|ending)\\s*([*xX\\d]{3,8})").matcher(normalized)
            if (numMatcher.find()) {
                val accNum = formatMaskedAccount(numMatcher.group(1)?.trim() ?: "")
                return "$bankInText ($accNum)"
            }
            return bankInText
        }

        return null
    }

    private fun findBankInText(text: String): String? {
        val lower = text.lowercase()
        for (bank in KNOWN_BANKS) {
            if (lower.contains(bank.lowercase())) {
                return if (bank.equals("SBI", ignoreCase = true)) "State Bank of India" else bank
            }
        }
        return null
    }

    private fun resolveBankName(raw: String): String {
        val trimmed = raw.trim()
        val bank = findBankInText(trimmed)
        if (bank != null) return bank
        if (trimmed.length in 3..25 && !trimmed.matches(Regex(".*\\d.*"))) {
            return trimmed.split(" ")
                .filter { it.isNotBlank() }
                .joinToString(" ") { it.replaceFirstChar { char -> char.uppercase() } }
        }
        return ""
    }

    private fun formatMaskedAccount(raw: String): String {
        val digitsOnly = raw.filter { it.isDigit() }
        return if (digitsOnly.length >= 3) {
            val lastFour = digitsOnly.takeLast(4)
            "**$lastFour"
        } else if (raw.isNotBlank()) {
            "**${raw.replace(Regex("[^a-zA-Z0-9]"), "")}"
        } else {
            ""
        }
    }
}
