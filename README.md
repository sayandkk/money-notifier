# 💳 Unified UPI Payment Notification Monitor & Desktop Dashboard

A privacy-focused, unified payment monitoring system for **Google Pay**, **Google Pay for Business**, **PhonePe**, and **Paytm**. 

Designed for personal, shop, and family use (e.g. for parents/fathers at cash counters or home desks) to monitor incoming payments across all payment apps in one unified real-time dashboard.

---

## 🌟 Key Capabilities

1. **Which Platform**:
   - Google Pay (🔵 Blue)
   - Google Pay for Business (💼 Emerald/Teal)
   - PhonePe (🟣 Purple)
   - Paytm (🔷 Cyan)

2. **Which Person**:
   - Accurately extracts customer/sender name (e.g. `Rahul`, `Anil Kumar`, `Business Customer`) without guessing.

3. **Which Account (Credited To)**:
   - Detects the destination bank account / UPI receiving account whenever present in the notification (e.g. `🏦 State Bank of India (**4589)`, `🏦 HDFC Bank (**1234)`, `🏦 ICICI Merchant A/c (**3392)`).

4. **Soundbox Voice Announcement (Smart Speaker Mode)**:
   - Built-in text-to-speech speaker on the Electron dashboard that speaks aloud:
     > *"₹500 received on Google Pay from Rahul to State Bank of India account ending 4589"*
   - Can be toggled ON/OFF with 1 click.

5. **Direct Local Network Synchronization**:
   - **100% Offline & Private**: No cloud servers or third-party AI APIs. Payment notifications stay strictly inside your local home/shop Wi-Fi network.
   - Built-in QR Code Pairing: Scan the QR code or enter the local IP address on the phone to connect instantly.

6. **Interactive Test Simulator**:
   - Allows instant testing on both the Electron desktop and the mobile app with realistic GPay, PhonePe, Paytm, and GPay Business presets.

---

## 🏗️ Repository Architecture

```text
money-notification/
├── .github/
│   └── workflows/
│       └── build-android.yml    # Automated GitHub Actions workflow to build APK
│
├── electron-dashboard/          # Electron Desktop App
│   ├── main.js                  # Main process, embedded HTTP/WebSocket sync server & QR generator
│   ├── preload.js               # IPC bridge
│   ├── package.json             # Electron, Express, WS, QRCode
│   └── renderer/
│       ├── index.html           # Modern glassmorphism dashboard UI
│       ├── styles.css           # Styling with branded badges & emerald green amounts
│       └── app.js               # State, Soundbox audio chime & voice synthesis, filters
│
└── mobile-app/                  # React Native Android Mobile App
    ├── package.json
    ├── App.tsx                  # Jetpack Compose / React Native UI with live stream & debug inspector
    └── android/
        ├── app/src/main/
        │   ├── AndroidManifest.xml   # Declares NotificationListenerService & permissions
        │   └── java/com/upimonitor/app/
        │       ├── notification/
        │       │   ├── PaymentNotificationListener.kt  # Android NotificationListenerService
        │       │   ├── PaymentSource.kt                # GPay, PhonePe, Paytm, GPay Business
        │       │   ├── ParsedPayment.kt                # Normalized model
        │       │   ├── DuplicateDetector.kt            # 3-minute sliding window deduplication
        │       │   ├── TargetAccountExtractor.kt       # Extracts bank name & account endings
        │       │   ├── SyncManager.kt                  # Local Wi-Fi HTTP sync to Electron
        │       │   └── providers/
        │       │       ├── GooglePayParser.kt          # Consumer Google Pay
        │       │       ├── GooglePayBusinessParser.kt  # Merchant Google Pay for Business
        │       │       ├── PhonePeParser.kt            # PhonePe
        │       │       └── PaytmParser.kt              # Paytm
        │       └── bridge/
        │           ├── NotificationModule.kt           # React Native native module
        │           └── NotificationPackage.kt
        └── build.gradle
```

---

## 🚀 Part 1: Running the Electron Desktop Dashboard

The Electron dashboard runs on any PC (Windows, Mac, or Linux):

```bash
cd electron-dashboard
npm install
npm start
```

### Dashboard Features:
1. **Live Synchronized Feed**: Shows real-time incoming payments with instant row highlight animation.
2. **Hero Amount**: Large display of **Today's Received Amount** (`₹`) and count.
3. **Weekly & Monthly Totals**: Quick summaries for accounting.
4. **Platform Filter Chips**: Switch between `All Sources`, `Google Pay`, `GPay Business`, `PhonePe`, and `Paytm`.
5. **Account Filter**: Filter by specific receiving bank accounts.
6. **Soundbox Audio**: Web Audio chime + Speech Synthesis voice alert.
7. **Pair Phone Button**: Displays a pairing QR Code and local IP (`http://192.168.x.x:8999`).
8. **Simulate Payment**: Test any transaction immediately with 1 click.
9. **Export to CSV**: Save payment history into an Excel-ready `.csv` file.

---

## 📱 Part 2: Building the Android APK via GitHub Actions

You do not need to install the Android SDK or Java locally. The repository includes an automated GitHub Actions CI/CD workflow:

### Steps to get the `.apk`:
1. Push this repository to GitHub:
   ```bash
   git add .
   git commit -m "Add Unified UPI Payment Monitor with Electron Dashboard & React Native Android App"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
2. In your GitHub repository, click the **Actions** tab.
3. The **"Build Android APK"** workflow will trigger automatically.
4. Once completed, scroll down to the **Artifacts** section and download:
   - `upi-notification-monitor-debug-apk`
5. Unzip the file and install `app-debug.apk` directly on your Android phone!

---

## 🔒 Security & Privacy Guarantees

* ❌ **Never asks for UPI PIN, bank passwords, or login credentials.**
* ❌ **Never accesses banking APIs or sends money.**
* ❌ **Never uploads notification data to external servers or AI cloud APIs.**
* 🔒 **All processing and parsing occurs strictly on your device and your local private Wi-Fi network.**
