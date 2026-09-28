const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),
  getSavedPayments: () => ipcRenderer.invoke('get-saved-payments'),
  savePayment: (payment) => ipcRenderer.invoke('save-payment', payment),
  clearPayments: () => ipcRenderer.invoke('clear-payments'),
  exportCsv: (payments) => ipcRenderer.invoke('export-csv', payments),
  onPaymentReceived: (callback) => {
    const handler = (event, payment) => callback(payment);
    ipcRenderer.on('payment-received', handler);
    return () => ipcRenderer.removeListener('payment-received', handler);
  }
});
