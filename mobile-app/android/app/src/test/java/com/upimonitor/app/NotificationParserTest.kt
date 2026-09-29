package com.upimonitor.app

import com.upimonitor.app.notification.*
import com.upimonitor.app.notification.providers.*
import org.junit.Assert.*
import org.junit.Test

class NotificationParserTest {

    private val gpayBusinessParser = GooglePayBusinessParser()
    private val gpayParser = GooglePayParser()
    private val phonePeParser = PhonePeParser()
    private val paytmParser = PaytmParser()
    private val genericParser = GenericUpiParser()

    @Test
    fun testGooglePayPersonalNotifications() {
        // Case 1: "Rahul Sharma sent you ₹500"
        val notif1 = NotificationData(
            packageName = "com.google.android.apps.nbu.paisa.user",
            title = "Google Pay",
            text = "Rahul Sharma sent you ₹500.00"
        )
        assertTrue(gpayParser.canParse(notif1.packageName, notif1))
        val res1 = gpayParser.parse(notif1)
        assertNotNull(res1)
        assertEquals(500.0, res1!!.amount, 0.01)
        assertEquals("Rahul Sharma", res1.senderName)
        assertEquals(PaymentSource.GOOGLE_PAY, res1.source)

        // Case 2: Title is sender name
        val notif2 = NotificationData(
            packageName = "com.google.android.apps.nbu.paisa.user",
            title = "Priya Patel",
            text = "Sent you ₹1,250"
        )
        assertTrue(gpayParser.canParse(notif2.packageName, notif2))
        val res2 = gpayParser.parse(notif2)
        assertNotNull(res2)
        assertEquals(1250.0, res2!!.amount, 0.01)
        assertEquals("Priya Patel", res2.senderName)

        // Case 3: "₹500 received using UPI"
        val notif3 = NotificationData(
            packageName = "com.google.android.apps.nbu.paisa.user",
            title = "Google Pay",
            text = "₹500.00 received from Anil Kumar via UPI"
        )
        val res3 = gpayParser.parse(notif3)
        assertNotNull(res3)
        assertEquals(500.0, res3!!.amount, 0.01)
        assertEquals("Anil Kumar", res3.senderName)
    }

    @Test
    fun testPhonePeNotifications() {
        // Case 1: Standard PhonePe received
        val notif1 = NotificationData(
            packageName = "com.phonepe.app",
            title = "PhonePe",
            text = "₹500 received from Rahul Sharma"
        )
        assertTrue(phonePeParser.canParse(notif1.packageName, notif1))
        val res1 = phonePeParser.parse(notif1)
        assertNotNull(res1)
        assertEquals(500.0, res1!!.amount, 0.01)
        assertEquals("Rahul Sharma", res1.senderName)
        assertEquals(PaymentSource.PHONEPE, res1.source)

        // Case 2: Payment Received title with UTR
        val notif2 = NotificationData(
            packageName = "com.phonepe.app",
            title = "Payment Received",
            text = "You have received ₹1,000 from Suresh Kumar (UPI Ref: 4291028491)"
        )
        assertTrue(phonePeParser.canParse(notif2.packageName, notif2))
        val res2 = phonePeParser.parse(notif2)
        assertNotNull(res2)
        assertEquals(1000.0, res2!!.amount, 0.01)
        assertEquals("Suresh Kumar", res2.senderName)
        assertEquals("4291028491", res2.transactionReference)

        // Case 3: Account credit notification
        val notif3 = NotificationData(
            packageName = "com.phonepe.app",
            title = "PhonePe",
            text = "₹750.00 credited to your A/C ending in 4589 from Neha Singh"
        )
        val res3 = phonePeParser.parse(notif3)
        assertNotNull(res3)
        assertEquals(750.0, res3!!.amount, 0.01)
        assertEquals("Neha Singh", res3.senderName)
    }

    @Test
    fun testPaytmNotifications() {
        // Case 1: Standard Paytm received
        val notif1 = NotificationData(
            packageName = "net.one97.paytm",
            title = "Paytm",
            text = "Received ₹500 from Rahul Sharma"
        )
        assertTrue(paytmParser.canParse(notif1.packageName, notif1))
        val res1 = paytmParser.parse(notif1)
        assertNotNull(res1)
        assertEquals(500.0, res1!!.amount, 0.01)
        assertEquals("Rahul Sharma", res1.senderName)
        assertEquals(PaymentSource.PAYTM, res1.source)

        // Case 2: Paytm Payments Bank credit with Rs.
        val notif2 = NotificationData(
            packageName = "net.one97.paytm",
            title = "Paytm Payments Bank",
            text = "Money Transfer: Rs. 1,500 credited to your A/c XX1234 from Vikram Singh UPI Ref 9384729101"
        )
        assertTrue(paytmParser.canParse(notif2.packageName, notif2))
        val res2 = paytmParser.parse(notif2)
        assertNotNull(res2)
        assertEquals(1500.0, res2!!.amount, 0.01)
        assertEquals("Vikram Singh", res2.senderName)
        assertEquals("9384729101", res2.transactionReference)

        // Case 3: Paytm Wallet received
        val notif3 = NotificationData(
            packageName = "net.one97.paytm",
            title = "Payment Received",
            text = "Received payment of ₹350 from Amit via Paytm"
        )
        val res3 = paytmParser.parse(notif3)
        assertNotNull(res3)
        assertEquals(350.0, res3!!.amount, 0.01)
        assertEquals("Amit", res3.senderName)
    }

    @Test
    fun testGooglePayBusinessNotifications() {
        val notif = NotificationData(
            packageName = "com.google.android.apps.nbu.paisa.merchant",
            title = "Google Pay for Business",
            text = "₹500.00 received from Rajesh Kumar on GPay"
        )
        assertTrue(gpayBusinessParser.canParse(notif.packageName, notif))
        val res = gpayBusinessParser.parse(notif)
        assertNotNull(res)
        assertEquals(500.0, res!!.amount, 0.01)
        assertEquals("Rajesh Kumar", res.senderName)
        assertEquals(PaymentSource.GOOGLE_PAY_BUSINESS, res.source)
    }

    @Test
    fun testOutgoingTransactionsIgnored() {
        // Outgoing GPay
        val outGPay = NotificationData(
            packageName = "com.google.android.apps.nbu.paisa.user",
            title = "Google Pay",
            text = "You paid ₹200 to Starbucks"
        )
        assertNull(gpayParser.parse(outGPay))

        // Outgoing PhonePe
        val outPhonePe = NotificationData(
            packageName = "com.phonepe.app",
            title = "PhonePe",
            text = "₹500 paid successfully to Big Bazaar"
        )
        assertNull(phonePeParser.parse(outPhonePe))

        // Outgoing Paytm
        val outPaytm = NotificationData(
            packageName = "net.one97.paytm",
            title = "Paytm",
            text = "₹250 paid to Uber"
        )
        assertNull(paytmParser.parse(outPaytm))
    }
}
