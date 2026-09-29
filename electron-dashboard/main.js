const { app, BrowserWindow, ipcMain, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const os = require('os');
const QRCode = require('qrcode');

let mainWindow = null;
let server = null;
let wss = null;
const PORT = 8999;
const DATA_FILE = path.join(app.getPath('userData') || __dirname, 'payments_history.json');

// In-memory / persistent storage helper
function getStoredPayments() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read payments storage:', err);
  }
  return [];
}

function savePaymentsToDisk(payments) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(payments, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write payments storage:', err);
  }
}

// Get all non-internal IPv4 addresses for local network syncing
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ name, address: iface.address });
      }
    }
  }
  return addresses;
}

// Start embedded HTTP & WebSocket Sync Server
async function startSyncServer() {
  const expressApp = express();
  expressApp.use(cors());
  expressApp.use(express.json());

  // Ping / health check for mobile app
  expressApp.get('/api/status', (req, res) => {
    res.json({
      status: 'online',
      appName: 'Unified UPI Payment Monitor',
      version: '1.0.0',
      timestamp: Date.now()
    });
  });

  // Endpoint where Android app pushes parsed payment notification
  expressApp.post('/api/payment', (req, res) => {
    const payment = req.body;
    if (!payment || typeof payment.amount !== 'number') {
      return res.status(400).json({ error: 'Invalid payment data' });
    }

    const normalizedPayment = {
      id: payment.id || 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      amount: payment.amount,
      currency: payment.currency || 'INR',
      senderName: payment.senderName || 'Unknown Sender',
      targetAccount: payment.targetAccount || 'Primary Account',
      source: payment.source || 'UNKNOWN',
      sourceApp: payment.sourceApp || payment.source || 'Payment App',
      transactionType: payment.transactionType || 'CREDIT',
      transactionReference: payment.transactionReference || null,
      receivedAt: payment.receivedAt || Date.now(),
      rawTitle: payment.rawTitle || '',
      rawText: payment.rawText || '',
      confidence: payment.confidence || 1.0,
      createdAt: Date.now()
    };

    // Save to storage
    const list = getStoredPayments();
    // Allow repeating payments from the same person (check only for exact duplicate ID or same ref within 2s)
    const isDup = list.some(item => {
      if (item.id === normalizedPayment.id) return true;
      if (normalizedPayment.transactionReference &&
          item.transactionReference === normalizedPayment.transactionReference &&
          Math.abs(item.receivedAt - normalizedPayment.receivedAt) < 2000) {
        return true;
      }
      return false;
    });

    if (!isDup) {
      list.unshift(normalizedPayment);
      savePaymentsToDisk(list);

      // Broadcast to Electron UI via IPC
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('payment-received', normalizedPayment);
      }

      // Broadcast to WebSocket clients
      if (wss) {
        const payload = JSON.stringify({ type: 'NEW_PAYMENT', payment: normalizedPayment });
        wss.clients.forEach(client => {
          if (client.readyState === 1) client.send(payload);
        });
      }

      // Native Windows Notification
      if (Notification.isSupported()) {
        new Notification({
          title: `₹${normalizedPayment.amount} Received on ${normalizedPayment.sourceApp}`,
          body: `From: ${normalizedPayment.senderName} • To: ${normalizedPayment.targetAccount}`,
          silent: false
        }).show();
      }
    }

    res.json({ success: true, duplicate: isDup, id: normalizedPayment.id });
  });

  server = http.createServer(expressApp);
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Connected to UPI Monitor Sync Hub' }));
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Sync Server listening on all interfaces at port ${PORT}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1000,
    minHeight: 650,
    title: 'UPI Payment Notification Monitor',
    backgroundColor: '#0b0f19',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await startSyncServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Communication with renderer
ipcMain.handle('get-server-info', async () => {
  const ips = getLocalIpAddresses();
  const primaryIp = ips.length > 0 ? ips[0].address : 'localhost';
  const syncUrl = `http://${primaryIp}:${PORT}/api/payment`;
  
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify({
      serverUrl: `http://${primaryIp}:${PORT}`,
      apiEndpoint: `/api/payment`,
      ip: primaryIp,
      port: PORT,
      timestamp: Date.now()
    }), { width: 220, margin: 1 });
  } catch (err) {
    console.error('QR code generation error:', err);
  }

  return {
    port: PORT,
    ips,
    primaryIp,
    syncUrl,
    qrCodeDataUrl
  };
});

ipcMain.handle('get-saved-payments', async () => {
  return getStoredPayments();
});

ipcMain.handle('save-payment', async (event, payment) => {
  const list = getStoredPayments();
  list.unshift(payment);
  savePaymentsToDisk(list);
  return true;
});

ipcMain.handle('clear-payments', async () => {
  savePaymentsToDisk([]);
  return true;
});

ipcMain.handle('export-csv', async (event, payments) => {
  if (!mainWindow) return { success: false };
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export UPI Payment History',
    defaultPath: `upi_payments_${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });

  if (!filePath) return { cancelled: true };

  const headers = ['Date', 'Time', 'Amount (INR)', 'Sender / Person', 'Target Account', 'Platform / Source', 'Transaction Type', 'Reference / UTR'];
  const rows = payments.map(p => {
    const d = new Date(p.receivedAt);
    const dateStr = d.toISOString().slice(0, 10);
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return [
      `"${dateStr}"`,
      `"${timeStr}"`,
      p.amount,
      `"${(p.senderName || 'Unknown').replace(/"/g, '""')}"`,
      `"${(p.targetAccount || 'Primary Account').replace(/"/g, '""')}"`,
      `"${(p.sourceApp || p.source || '').replace(/"/g, '""')}"`,
      `"${p.transactionType || 'CREDIT'}"`,
      `"${(p.transactionReference || 'N/A').replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  fs.writeFileSync(filePath, csvContent, 'utf8');
  return { success: true, filePath };
});
