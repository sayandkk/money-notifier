// State
let allPayments = [];
let soundboxEnabled = true;
let currentPlatformFilter = 'ALL';
let currentAccountFilter = 'ALL';
let currentSearchQuery = '';
let serverInfo = null;

// DOM Elements
const todayAmountEl = document.getElementById('todayAmount');
const todayCountBadgeEl = document.getElementById('todayCountBadge');
const lastPaymentTimeEl = document.getElementById('lastPaymentTime');
const weekAmountEl = document.getElementById('weekAmount');
const weekCountBadgeEl = document.getElementById('weekCountBadge');
const monthAmountEl = document.getElementById('monthAmount');
const monthCountBadgeEl = document.getElementById('monthCountBadge');
const accountsCountEl = document.getElementById('accountsCount');
const activeAccountsSummaryEl = document.getElementById('activeAccountsSummary');

const paymentTableBody = document.getElementById('paymentTableBody');
const emptyStateEl = document.getElementById('emptyState');
const accountFilterSelect = document.getElementById('accountFilterSelect');
const searchInput = document.getElementById('searchInput');

const soundboxToggleBtn = document.getElementById('soundboxToggleBtn');
const soundboxStatusText = document.getElementById('soundboxStatusText');
const syncStatusPill = document.getElementById('syncStatusPill');
const syncStatusText = document.getElementById('syncStatusText');

// Modals
const pairingModal = document.getElementById('pairingModal');
const openPairingBtn = document.getElementById('openPairingBtn');
const closePairingModalBtn = document.getElementById('closePairingModalBtn');
const pairingDoneBtn = document.getElementById('pairingDoneBtn');
const pairingQrImg = document.getElementById('pairingQrImg');
const desktopIpDisplay = document.getElementById('desktopIpDisplay');
const copyIpBtn = document.getElementById('copyIpBtn');

const simulatorModal = document.getElementById('simulatorModal');
const openSimulatorBtn = document.getElementById('openSimulatorBtn');
const closeSimulatorModalBtn = document.getElementById('closeSimulatorModalBtn');
const simCancelBtn = document.getElementById('simCancelBtn');
const simulatorForm = document.getElementById('simulatorForm');

const detailsModal = document.getElementById('detailsModal');
const closeDetailsModalBtn = document.getElementById('closeDetailsModalBtn');
const closeDetailsBtn = document.getElementById('closeDetailsBtn');
const detailsModalBody = document.getElementById('detailsModalBody');

const exportCsvBtn = document.getElementById('exportCsvBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// Audio Chime Generator using Web Audio API
function playChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // First tone (high harmonic)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second bell tone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1174.66, now + 0.12); // D6
    gain2.gain.setValueAtTime(0.25, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.5);
  } catch (err) {
    console.error('Audio chime error:', err);
  }
}

// Soundbox Voice Announcement (Speech Synthesis)
function speakPayment(payment) {
  if (!soundboxEnabled) return;
  if (!('speechSynthesis' in window)) return;

  playChime();

  setTimeout(() => {
    try {
      window.speechSynthesis.cancel();
      const amountStr = Math.round(payment.amount).toString();
      const platformName = getPlatformFriendlyName(payment.source);
      const sender = payment.senderName && payment.senderName !== 'Unknown Sender' ? `from ${payment.senderName}` : '';
      const text = `${amountStr} rupees received on ${platformName} ${sender}`;
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
      utterance.volume = 1.0;
      
      // Prefer Indian English voice if present
      const voices = window.speechSynthesis.getVoices();
      const inVoice = voices.find(v => v.lang === 'en-IN' || v.lang.includes('IN'));
      if (inVoice) {
        utterance.voice = inVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Speech synthesis error:', err);
    }
  }, 350);
}

// Friendly Names & Badges
function getPlatformFriendlyName(source) {
  switch (source) {
    case 'GOOGLE_PAY': return 'Google Pay';
    case 'GOOGLE_PAY_BUSINESS': return 'Google Pay for Business';
    case 'PHONEPE': return 'PhonePe';
    case 'PAYTM': return 'Paytm';
    default: return 'UPI Payment';
  }
}

function getPlatformBadgeHtml(source) {
  const norm = (source || '').toUpperCase();
  if (norm.includes('GOOGLE_PAY_BUSINESS')) {
    return `<span class="platform-badge badge-google_pay_business">💼 GPay Business</span>`;
  }
  if (norm.includes('GOOGLE_PAY') || norm.includes('GPAY')) {
    return `<span class="platform-badge badge-google_pay">🔵 Google Pay</span>`;
  }
  if (norm.includes('PHONEPE')) {
    return `<span class="platform-badge badge-phonepe">🟣 PhonePe</span>`;
  }
  if (norm.includes('PAYTM')) {
    return `<span class="platform-badge badge-paytm">🔷 Paytm</span>`;
  }
  return `<span class="platform-badge">💳 ${source || 'UPI'}</span>`;
}

// Formatting helpers
function formatCurrency(amount) {
  return Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatTime(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function formatDate(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

// Filter and Metric Updates
function updateMetrics() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let todayTotal = 0;
  let todayCount = 0;
  let weekTotal = 0;
  let weekCount = 0;
  let monthTotal = 0;
  let monthCount = 0;

  const accountsSet = new Set();
  let countAll = 0;
  let countGpay = 0;
  let countGpayBiz = 0;
  let countPhonepe = 0;
  let countPaytm = 0;

  allPayments.forEach(p => {
    if (p.transactionType !== 'DEBIT') {
      if (p.receivedAt >= startOfToday) {
        todayTotal += p.amount;
        todayCount++;
      }
      if (p.receivedAt >= startOfWeek) {
        weekTotal += p.amount;
        weekCount++;
      }
      if (p.receivedAt >= startOfMonth) {
        monthTotal += p.amount;
        monthCount++;
      }
    }

    if (p.targetAccount) {
      accountsSet.add(p.targetAccount);
    }

    countAll++;
    const src = (p.source || '').toUpperCase();
    if (src === 'GOOGLE_PAY') countGpay++;
    else if (src === 'GOOGLE_PAY_BUSINESS') countGpayBiz++;
    else if (src === 'PHONEPE') countPhonepe++;
    else if (src === 'PAYTM') countPaytm++;
  });

  todayAmountEl.textContent = formatCurrency(todayTotal);
  todayCountBadgeEl.textContent = `${todayCount} ${todayCount === 1 ? 'Payment' : 'Payments'} Today`;
  
  if (allPayments.length > 0) {
    const lastP = allPayments[0];
    lastPaymentTimeEl.textContent = `Latest: ${formatTime(lastP.receivedAt)} (${formatCurrency(lastP.amount)})`;
  } else {
    lastPaymentTimeEl.textContent = 'Waiting for notifications...';
  }

  weekAmountEl.textContent = formatCurrency(weekTotal);
  weekCountBadgeEl.textContent = `${weekCount} payments past 7 days`;

  monthAmountEl.textContent = formatCurrency(monthTotal);
  monthCountBadgeEl.textContent = `${monthCount} payments this month`;

  accountsCountEl.textContent = accountsSet.size || '1';
  if (accountsSet.size > 0) {
    activeAccountsSummaryEl.textContent = Array.from(accountsSet).slice(0, 2).join(', ');
  } else {
    activeAccountsSummaryEl.textContent = 'Auto-detected from alerts';
  }

  // Update counts on filter pills
  document.getElementById('countAll').textContent = countAll;
  document.getElementById('countGpay').textContent = countGpay;
  document.getElementById('countGpayBiz').textContent = countGpayBiz;
  document.getElementById('countPhonepe').textContent = countPhonepe;
  document.getElementById('countPaytm').textContent = countPaytm;

  // Update Account select options
  updateAccountFilterDropdown(accountsSet);
}

function updateAccountFilterDropdown(accountsSet) {
  const currentVal = accountFilterSelect.value;
  accountFilterSelect.innerHTML = '<option value="ALL">All Receiving Accounts</option>';
  accountsSet.forEach(acc => {
    const opt = document.createElement('option');
    opt.value = acc;
    opt.textContent = `🏦 ${acc}`;
    if (acc === currentVal) opt.selected = true;
    accountFilterSelect.appendChild(opt);
  });
}

function getFilteredPayments() {
  return allPayments.filter(p => {
    // Platform filter
    if (currentPlatformFilter !== 'ALL' && p.source !== currentPlatformFilter) {
      return false;
    }

    // Account filter
    if (currentAccountFilter !== 'ALL' && p.targetAccount !== currentAccountFilter) {
      return false;
    }

    // Search query
    if (currentSearchQuery.trim() !== '') {
      const q = currentSearchQuery.toLowerCase();
      const sender = (p.senderName || '').toLowerCase();
      const ref = (p.transactionReference || '').toLowerCase();
      const amount = (p.amount || '').toString();
      const acc = (p.targetAccount || '').toLowerCase();
      if (!sender.includes(q) && !ref.includes(q) && !amount.includes(q) && !acc.includes(q)) {
        return false;
      }
    }

    return true;
  });
}

function renderTable(newPaymentId = null) {
  const filtered = getFilteredPayments();

  if (filtered.length === 0) {
    paymentTableBody.innerHTML = '';
    emptyStateEl.style.display = 'flex';
    return;
  }

  emptyStateEl.style.display = 'none';
  paymentTableBody.innerHTML = filtered.map(p => {
    const isNew = p.id === newPaymentId;
    const isDebit = p.transactionType === 'DEBIT';
    const amountPrefix = isDebit ? '- ₹' : '+ ₹';
    const amountClass = isDebit ? 'amount-cell amount-debit' : 'amount-cell';
    const statusBadge = isDebit ? '<span class="status-badge status-debit">DEBIT</span>' : '<span class="status-badge status-credit">RECEIVED</span>';

    return `
      <tr class="${isNew ? 'row-new' : ''}" data-id="${p.id}">
        <td class="time-cell">
          <div>${formatTime(p.receivedAt)}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${formatDate(p.receivedAt)}</div>
        </td>
        <td>${getPlatformBadgeHtml(p.source)}</td>
        <td class="person-cell">
          <span style="font-size: 1.1rem;">👤</span>
          <span>${escapeHtml(p.senderName || 'Unknown Sender')}</span>
        </td>
        <td>
          <span class="account-badge">
            <span>🏦</span>
            <span>${escapeHtml(p.targetAccount || 'Primary Account')}</span>
          </span>
        </td>
        <td style="text-align: right;" class="${amountClass}">
          ${amountPrefix}${formatCurrency(p.amount)}
        </td>
        <td style="text-align: center;">${statusBadge}</td>
        <td class="ref-cell">${escapeHtml(p.transactionReference || 'N/A')}</td>
        <td style="text-align: center;">
          <button class="btn-text view-details-btn" data-id="${p.id}" title="View Details">🔍</button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach view details listeners
  document.querySelectorAll('.view-details-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const item = allPayments.find(p => p.id === id);
      if (item) showDetailsModal(item);
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showDetailsModal(payment) {
  detailsModalBody.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div style="text-align: center; padding: 12px; background: rgba(16, 185, 129, 0.1); border-radius: 8px;">
        <div style="font-size: 0.8rem; color: var(--text-muted);">AMOUNT RECEIVED</div>
        <div style="font-family: var(--font-display); font-size: 2.2rem; font-weight: 800; color: #10b981;">
          ₹${formatCurrency(payment.amount)}
        </div>
        <div style="margin-top: 4px;">${getPlatformBadgeHtml(payment.source)}</div>
      </div>

      <div style="display: grid; grid-template-columns: 120px 1fr; gap: 10px; font-size: 0.85rem;">
        <span style="color: var(--text-muted);">Sender / Person:</span>
        <strong style="color: #fff;">${escapeHtml(payment.senderName || 'Unknown')}</strong>

        <span style="color: var(--text-muted);">Credited To:</span>
        <strong style="color: #38bdf8;">🏦 ${escapeHtml(payment.targetAccount || 'Primary Account')}</strong>

        <span style="color: var(--text-muted);">Date & Time:</span>
        <span>${formatDate(payment.receivedAt)} at ${formatTime(payment.receivedAt)}</span>

        <span style="color: var(--text-muted);">UPI Ref / UTR:</span>
        <code style="font-family: var(--font-mono); color: #cbd5e1;">${escapeHtml(payment.transactionReference || 'Not available')}</code>

        <span style="color: var(--text-muted);">Status:</span>
        <span style="color: #10b981; font-weight: 600;">✓ CREDIT (Incoming Payment)</span>

        <span style="color: var(--text-muted);">Detection:</span>
        <span>Android Notification Listener</span>
      </div>

      ${payment.rawText ? `
        <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; border: 1px solid var(--border-subtle); margin-top: 6px;">
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 4px;">RAW NOTIFICATION CAPTURE:</div>
          <div style="font-size: 0.78rem; font-family: var(--font-mono); color: #94a3b8; word-break: break-all;">
            ${escapeHtml(payment.rawText)}
          </div>
        </div>
      ` : ''}
    </div>
  `;
  detailsModal.classList.add('open');
}

// Initial Setup & Event Listeners
async function init() {
  // Load Server Info
  try {
    if (window.electronAPI) {
      serverInfo = await window.electronAPI.getServerInfo();
      if (serverInfo) {
        desktopIpDisplay.textContent = `http://${serverInfo.primaryIp}:${serverInfo.port}`;
        if (serverInfo.qrCodeDataUrl) {
          pairingQrImg.src = serverInfo.qrCodeDataUrl;
        }
        syncStatusText.textContent = `Sync Server: Listening on ${serverInfo.primaryIp}:${serverInfo.port}`;
      }

      // Load Stored Payments
      const saved = await window.electronAPI.getSavedPayments();
      if (Array.isArray(saved) && saved.length > 0) {
        allPayments = saved;
      }
    }
  } catch (err) {
    console.error('Error fetching server info or saved payments:', err);
  }

  // If no payments yet, preload a couple of realistic demo items so the dashboard is immediately interactive
  if (allPayments.length === 0) {
    allPayments = [
      {
        id: 'demo_1',
        amount: 2500,
        currency: 'INR',
        senderName: 'Business Customer',
        targetAccount: 'ICICI Bank Merchant A/c (**3392)',
        source: 'GOOGLE_PAY_BUSINESS',
        sourceApp: 'Google Pay for Business',
        transactionType: 'CREDIT',
        transactionReference: 'UPI4290182910',
        receivedAt: Date.now() - 25 * 60 * 1000,
        rawText: 'Payment received ₹2,500 from Business Customer to ICICI Bank A/c 3392'
      },
      {
        id: 'demo_2',
        amount: 1000,
        currency: 'INR',
        senderName: 'Anil Kumar',
        targetAccount: 'State Bank of India (**4589)',
        source: 'PHONEPE',
        sourceApp: 'PhonePe',
        transactionType: 'CREDIT',
        transactionReference: 'UTR9384729101',
        receivedAt: Date.now() - 42 * 60 * 1000,
        rawText: '₹1,000 received from Anil credited to your SBI A/c 4589'
      },
      {
        id: 'demo_3',
        amount: 750,
        currency: 'INR',
        senderName: 'Suresh Verma',
        targetAccount: 'HDFC Bank (**1234)',
        source: 'PAYTM',
        sourceApp: 'Paytm',
        transactionType: 'CREDIT',
        transactionReference: 'PAYTM8372910192',
        receivedAt: Date.now() - 72 * 60 * 1000,
        rawText: 'Payment received ₹750 from Suresh in Paytm Payments Bank'
      },
      {
        id: 'demo_4',
        amount: 500,
        currency: 'INR',
        senderName: 'Rahul',
        targetAccount: 'State Bank of India (**4589)',
        source: 'GOOGLE_PAY',
        sourceApp: 'Google Pay',
        transactionType: 'CREDIT',
        transactionReference: 'UPI2938471920',
        receivedAt: Date.now() - 95 * 60 * 1000,
        rawText: '₹500 received from Rahul credited to SBI A/c **4589'
      }
    ];
  }

  updateMetrics();
  renderTable();

  // Listen for live payments incoming from Android phone
  if (window.electronAPI) {
    window.electronAPI.onPaymentReceived((newPayment) => {
      // Check if already in list
      const exists = allPayments.some(p => p.id === newPayment.id);
      if (!exists) {
        allPayments.unshift(newPayment);
        updateMetrics();
        renderTable(newPayment.id);
        speakPayment(newPayment);
      }
    });
  }

  setupEventListeners();
}

function setupEventListeners() {
  // Soundbox Toggle
  soundboxToggleBtn.addEventListener('click', () => {
    soundboxEnabled = !soundboxEnabled;
    if (soundboxEnabled) {
      soundboxToggleBtn.classList.add('active');
      soundboxStatusText.textContent = 'ON';
      playChime();
    } else {
      soundboxToggleBtn.classList.remove('active');
      soundboxStatusText.textContent = 'OFF';
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }
  });

  // Platform Filter Chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentPlatformFilter = chip.getAttribute('data-platform');
      renderTable();
    });
  });

  // Account Filter
  accountFilterSelect.addEventListener('change', (e) => {
    currentAccountFilter = e.target.value;
    renderTable();
  });

  // Search Input
  searchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value;
    renderTable();
  });

  // Modals Open/Close
  openPairingBtn.addEventListener('click', () => pairingModal.classList.add('open'));
  closePairingModalBtn.addEventListener('click', () => pairingModal.classList.remove('open'));
  pairingDoneBtn.addEventListener('click', () => pairingModal.classList.remove('open'));

  openSimulatorBtn.addEventListener('click', () => simulatorModal.classList.add('open'));
  closeSimulatorModalBtn.addEventListener('click', () => simulatorModal.classList.remove('open'));
  simCancelBtn.addEventListener('click', () => simulatorModal.classList.remove('open'));

  closeDetailsModalBtn.addEventListener('click', () => detailsModal.classList.remove('open'));
  closeDetailsBtn.addEventListener('click', () => detailsModal.classList.remove('open'));

  // Copy IP Button
  copyIpBtn.addEventListener('click', () => {
    if (serverInfo) {
      navigator.clipboard.writeText(`http://${serverInfo.primaryIp}:${serverInfo.port}`);
      copyIpBtn.textContent = 'Copied!';
      setTimeout(() => copyIpBtn.textContent = 'Copy', 2000);
    }
  });

  // Simulator Presets
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      if (preset === 'gpay') {
        document.getElementById('simPlatform').value = 'GOOGLE_PAY';
        document.getElementById('simAmount').value = '500';
        document.getElementById('simSender').value = 'Rahul';
        document.getElementById('simAccount').value = 'State Bank of India (**4589)';
        document.getElementById('simUtr').value = 'UPI' + Math.floor(Math.random() * 900000000000 + 100000000000);
      } else if (preset === 'phonepe') {
        document.getElementById('simPlatform').value = 'PHONEPE';
        document.getElementById('simAmount').value = '1000';
        document.getElementById('simSender').value = 'Anil';
        document.getElementById('simAccount').value = 'HDFC Bank (**1234)';
        document.getElementById('simUtr').value = 'UTR' + Math.floor(Math.random() * 900000000000 + 100000000000);
      } else if (preset === 'paytm') {
        document.getElementById('simPlatform').value = 'PAYTM';
        document.getElementById('simAmount').value = '750';
        document.getElementById('simSender').value = 'Suresh';
        document.getElementById('simAccount').value = 'Paytm Payments Bank (**8921)';
        document.getElementById('simUtr').value = 'PAYTM' + Math.floor(Math.random() * 900000000000 + 100000000000);
      } else if (preset === 'gpay_biz') {
        document.getElementById('simPlatform').value = 'GOOGLE_PAY_BUSINESS';
        document.getElementById('simAmount').value = '2500';
        document.getElementById('simSender').value = 'Business Customer';
        document.getElementById('simAccount').value = 'ICICI Bank Merchant A/c (**3392)';
        document.getElementById('simUtr').value = 'UPI' + Math.floor(Math.random() * 900000000000 + 100000000000);
      }
    });
  });

  // Simulator Form Submit
  simulatorForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const platform = document.getElementById('simPlatform').value;
    const amount = parseFloat(document.getElementById('simAmount').value);
    const sender = document.getElementById('simSender').value;
    const account = document.getElementById('simAccount').value;
    const utr = document.getElementById('simUtr').value;
    const type = document.getElementById('simType').value;

    const newPayment = {
      id: 'sim_' + Date.now(),
      amount,
      currency: 'INR',
      senderName: sender,
      targetAccount: account,
      source: platform,
      sourceApp: getPlatformFriendlyName(platform),
      transactionType: type,
      transactionReference: utr || null,
      receivedAt: Date.now(),
      rawTitle: `${platform} Alert`,
      rawText: `₹${amount} received from ${sender} credited to ${account} Ref: ${utr}`,
      confidence: 1.0,
      createdAt: Date.now()
    };

    allPayments.unshift(newPayment);
    if (window.electronAPI) {
      window.electronAPI.savePayment(newPayment);
    }

    updateMetrics();
    renderTable(newPayment.id);
    speakPayment(newPayment);

    simulatorModal.classList.remove('open');
  });

  // Export CSV
  exportCsvBtn.addEventListener('click', async () => {
    if (window.electronAPI) {
      const filtered = getFilteredPayments();
      const res = await window.electronAPI.exportCsv(filtered);
      if (res && res.success) {
        alert(`Successfully exported payment history to:\n${res.filePath}`);
      }
    }
  });

  // Clear History
  clearHistoryBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear current payment monitor history?')) {
      allPayments = [];
      if (window.electronAPI) {
        await window.electronAPI.clearPayments();
      }
      updateMetrics();
      renderTable();
    }
  });
}

// Start application
window.addEventListener('DOMContentLoaded', init);
