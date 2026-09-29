import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  NativeModules,
  NativeEventEmitter,
  TextInput,
  Modal,
  Alert,
  Platform,
} from 'react-native';

const { NotificationModule } = NativeModules;
const eventEmitter = NotificationModule ? new NativeEventEmitter(NotificationModule) : null;

interface Payment {
  id: string;
  amount: number;
  currency: string;
  senderName: string | null;
  targetAccount: string | null;
  source: string;
  sourceApp: string;
  transactionType: string;
  transactionReference: string | null;
  receivedAt: number;
  rawText?: string;
}

interface DebugNotif {
  packageName: string;
  title: string;
  text: string;
  timestamp: number;
}

export default function App(): React.JSX.Element {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [serverUrl, setServerUrl] = useState<string>('http://192.168.1.100:8999/api/payment');
  const [syncStatus, setSyncStatus] = useState<string>('Ready');
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);

  // Modals
  const [syncModalVisible, setSyncModalVisible] = useState<boolean>(false);
  const [debugModalVisible, setDebugModalVisible] = useState<boolean>(false);
  const [debugList, setDebugList] = useState<DebugNotif[]>([]);

  // Selected Transaction for Details Modal
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState<boolean>(false);

  useEffect(() => {
    checkPermission();
    loadStoredPayments();
    loadServerUrl();
    checkVoiceStatus();

    // Listen to live payments from Android NotificationListenerService
    let subscription: any = null;
    if (eventEmitter) {
      subscription = eventEmitter.addListener('onPaymentReceived', (jsonStr: string) => {
        try {
          const newPayment: Payment = JSON.parse(jsonStr);
          setPayments(prev => [newPayment, ...prev.filter(p => p.id !== newPayment.id)]);
        } catch (err) {
          console.error('Error parsing payment event:', err);
        }
      });
    }

    return () => {
      if (subscription) subscription.remove();
    };
  }, []);

  const checkVoiceStatus = async () => {
    if (NotificationModule?.isVoiceEnabled) {
      try {
        const enabled = await NotificationModule.isVoiceEnabled();
        setVoiceEnabled(enabled);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const toggleVoice = async () => {
    if (NotificationModule?.setVoiceEnabled) {
      const next = !voiceEnabled;
      await NotificationModule.setVoiceEnabled(next);
      setVoiceEnabled(next);
      if (next) {
        NotificationModule.speakPaymentAnnouncement('Soundbox voice announcement enabled');
      }
    }
  };

  const checkPermission = async () => {
    if (NotificationModule?.isNotificationAccessGranted) {
      try {
        const granted = await NotificationModule.isNotificationAccessGranted();
        setHasPermission(granted);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const openSettings = async () => {
    if (NotificationModule?.openNotificationSettings) {
      await NotificationModule.openNotificationSettings();
    }
  };

  const loadStoredPayments = async () => {
    if (NotificationModule?.getStoredPayments) {
      try {
        const json = await NotificationModule.getStoredPayments();
        const list: Payment[] = JSON.parse(json || '[]');
        if (list.length > 0) {
          setPayments(list);
        } else {
          // Default initial examples
          setPayments([
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
              receivedAt: Date.now() - 25 * 60 * 1000
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
              receivedAt: Date.now() - 42 * 60 * 1000
            }
          ]);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const loadServerUrl = async () => {
    if (NotificationModule?.getServerUrl) {
      const url = await NotificationModule.getServerUrl();
      if (url) setServerUrl(url);
    }
  };

  const saveAndTestSync = async () => {
    if (NotificationModule?.setServerUrl && NotificationModule?.testServerConnection) {
      await NotificationModule.setServerUrl(serverUrl);
      setSyncStatus('Testing connection...');
      try {
        const res = await NotificationModule.testServerConnection(serverUrl);
        if (res.success) {
          setSyncStatus('Connected to Desktop Dashboard!');
          Alert.alert('Success', 'Connected to Electron Desktop Monitor successfully!');
        } else {
          setSyncStatus('Connection failed: ' + res.message);
          Alert.alert('Connection Failed', res.message);
        }
      } catch (e: any) {
        setSyncStatus('Error: ' + e.message);
      }
    }
  };

  const openDebugInspector = async () => {
    if (NotificationModule?.getDebugNotifications) {
      try {
        const json = await NotificationModule.getDebugNotifications();
        const list: DebugNotif[] = JSON.parse(json || '[]');
        setDebugList(list);
        setDebugModalVisible(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const triggerTestSimulation = async (platform: string, amt: number, sender: string, acc: string) => {
    if (NotificationModule?.simulatePayment) {
      await NotificationModule.simulatePayment(platform, amt, sender, acc);
      Alert.alert('Payment Triggered', `Simulated ₹${amt} on ${platform}`);
    }
  };

  // Calculations
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const todayPayments = payments.filter(p => p.receivedAt >= startOfToday && p.transactionType !== 'DEBIT');
  const todayTotal = todayPayments.reduce((acc, curr) => acc + curr.amount, 0);

  const filteredPayments = payments.filter(p => {
    if (selectedFilter === 'ALL') return true;
    return p.source === selectedFilter;
  });

  const formatAmount = (num: number) => {
    return Number(num).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatFullDateTime = (ts: number) => {
    const d = new Date(ts);
    const dateStr = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    return `${dateStr} at ${timeStr}`;
  };

  const playVoiceForPayment = (p: Payment) => {
    if (NotificationModule?.speakPaymentAnnouncement) {
      const amt = Math.round(p.amount);
      const appName = p.sourceApp || p.source;
      const sender = p.senderName && p.senderName !== 'Unknown Sender' ? `by ${p.senderName}` : '';
      const text = `Rupees ${amt} received on ${appName} ${sender}`.trim();
      NotificationModule.speakPaymentAnnouncement(text);
    }
  };

  const openPaymentDetails = (p: Payment) => {
    setSelectedPayment(p);
    setDetailsModalVisible(true);
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'GOOGLE_PAY': return '#3b82f6';
      case 'GOOGLE_PAY_BUSINESS': return '#10b981';
      case 'PHONEPE': return '#9333ea';
      case 'PAYTM': return '#06b6d4';
      case 'BHIM': return '#f97316';
      case 'CRED': return '#ec4899';
      case 'AMAZON_PAY': return '#eab308';
      case 'NAVI': return '#14b8a6';
      case 'BANK_UPI': return '#8b5cf6';
      default: return '#64748b';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0f19" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>UPI Payment Monitor</Text>
          <Text style={styles.headerSubtitle}>Unified Notification Listener</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerBtn, voiceEnabled ? { backgroundColor: '#10b981' } : { backgroundColor: '#374151' }]}
            onPress={toggleVoice}>
            <Text style={styles.headerBtnText}>{voiceEnabled ? '🔊 Voice: ON' : '🔇 Voice: OFF'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setSyncModalVisible(true)}>
            <Text style={styles.headerBtnText}>💻 Sync</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={openDebugInspector}>
            <Text style={styles.headerBtnText}>🔍 Debug</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Permission Status Banner */}
        <View style={[styles.permissionCard, hasPermission ? styles.permActive : styles.permInactive]}>
          <View style={styles.permTextGroup}>
            <Text style={styles.permTitle}>
              {hasPermission ? '● Monitoring Active' : '○ Notification Access Disabled'}
            </Text>
            <Text style={styles.permDesc}>
              {hasPermission
                ? 'Listening to GPay, PhonePe, Paytm, and GPay Business notifications with Voice Soundbox'
                : 'Grant permission to automatically detect incoming payments and speak alerts'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.permButton, hasPermission ? styles.permBtnActive : styles.permBtnInactive]}
            onPress={hasPermission ? checkPermission : openSettings}>
            <Text style={styles.permBtnLabel}>{hasPermission ? 'Refresh' : 'Enable'}</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Card: Today's Received */}
        <View style={styles.heroCard}>
          <Text style={styles.heroTag}>TODAY'S RECEIVED AMOUNT</Text>
          <Text style={styles.heroAmount}>₹{formatAmount(todayTotal)}</Text>
          <Text style={styles.heroFooter}>
            {todayPayments.length} {todayPayments.length === 1 ? 'payment' : 'payments'} received today
          </Text>
        </View>

        {/* Platform Filters */}
        <View style={styles.filterRow}>
          {['ALL', 'GOOGLE_PAY', 'GOOGLE_PAY_BUSINESS', 'PHONEPE', 'PAYTM', 'OTHER'].map(filterKey => {
            const isSelected = selectedFilter === filterKey;
            const label = filterKey === 'ALL'
              ? 'All'
              : filterKey === 'GOOGLE_PAY'
              ? 'GPay'
              : filterKey === 'GOOGLE_PAY_BUSINESS'
              ? 'GPay Biz'
              : filterKey === 'PHONEPE'
              ? 'PhonePe'
              : filterKey === 'PAYTM'
              ? 'Paytm'
              : 'Other UPI';

            return (
              <TouchableOpacity
                key={filterKey}
                style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                onPress={() => setSelectedFilter(filterKey)}>
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Quick Test Bar */}
        <View style={styles.quickTestBar}>
          <Text style={styles.quickTestLabel}>Quick Voice Test:</Text>
          <TouchableOpacity
            style={[styles.testBtn, { backgroundColor: '#9333ea' }]}
            onPress={() => triggerTestSimulation('PHONEPE', 500, 'Rahul', 'Primary Bank A/c')}>
            <Text style={styles.testBtnText}>🔊 ₹500 PhonePe (Rahul)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.testBtn}
            onPress={() => triggerTestSimulation('GOOGLE_PAY', 500, 'Rahul', 'SBI A/c 4589')}>
            <Text style={styles.testBtnText}>+ ₹500 GPay</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.testBtn}
            onPress={() => triggerTestSimulation('PAYTM', 750, 'Suresh', 'Paytm Bank')}>
            <Text style={styles.testBtnText}>+ ₹750 Paytm</Text>
          </TouchableOpacity>
        </View>

        {/* Payment List */}
        <View style={styles.listSection}>
          <Text style={styles.sectionHeading}>Recent Payments</Text>

          {filteredPayments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No payments detected yet</Text>
              <Text style={styles.emptySubtitle}>
                Incoming payments from Google Pay, PhonePe, Paytm, or GPay Business will appear here automatically.
              </Text>
            </View>
          ) : (
            filteredPayments.map(item => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.75}
                style={styles.paymentCard}
                onPress={() => openPaymentDetails(item)}>
                <View style={styles.cardTopRow}>
                  <View style={[styles.platformBadge, { backgroundColor: getSourceBadgeColor(item.source) + '22', borderColor: getSourceBadgeColor(item.source) + '55' }]}>
                    <Text style={[styles.platformBadgeText, { color: getSourceBadgeColor(item.source) }]}>
                      {item.sourceApp || item.source}
                    </Text>
                  </View>
                  <View style={styles.cardTimeRow}>
                    <Text style={styles.cardTime}>{formatTime(item.receivedAt)}</Text>
                    <Text style={styles.cardTapHint}>ℹ️ Details</Text>
                  </View>
                </View>

                <View style={styles.cardMainRow}>
                  <View style={styles.cardSenderGroup}>
                    <Text style={styles.senderName}>{item.senderName || 'Unknown Sender'}</Text>
                    {item.targetAccount ? (
                      <View style={styles.accountBadge}>
                        <Text style={styles.accountText}>🏦 {item.targetAccount}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.cardAmount}>+ ₹{formatAmount(item.amount)}</Text>
                </View>

                {item.transactionReference ? (
                  <View style={styles.cardFooter}>
                    <Text style={styles.refText}>Ref / UTR: {item.transactionReference}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Payment Details Modal */}
      <Modal visible={detailsModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.detailsModalBox]}>
            {selectedPayment && (
              <>
                <View style={styles.detailsHeader}>
                  <View style={[styles.platformBadge, { backgroundColor: getSourceBadgeColor(selectedPayment.source) + '22', borderColor: getSourceBadgeColor(selectedPayment.source) + '66' }]}>
                    <Text style={[styles.platformBadgeText, { color: getSourceBadgeColor(selectedPayment.source) }]}>
                      {selectedPayment.sourceApp || selectedPayment.source}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.detailsCloseX} onPress={() => setDetailsModalVisible(false)}>
                    <Text style={styles.detailsCloseXText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Amount Header Banner */}
                <View style={styles.detailsAmountBanner}>
                  <Text style={styles.detailsAmountLabel}>PAYMENT RECEIVED</Text>
                  <Text style={styles.detailsAmountText}>+ ₹{formatAmount(selectedPayment.amount)}</Text>
                  <View style={styles.detailsStatusBadge}>
                    <Text style={styles.detailsStatusText}>● CREDITED (SUCCESS)</Text>
                  </View>
                </View>

                {/* Detail Information Rows */}
                <ScrollView style={styles.detailsListScroll}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>👤 Sender / Person</Text>
                    <Text style={styles.detailValuePrimary}>{selectedPayment.senderName || 'Unknown Sender'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>📱 Payment Platform</Text>
                    <Text style={styles.detailValue}>{selectedPayment.sourceApp || selectedPayment.source}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>🏦 Credited Account / Bank</Text>
                    <Text style={styles.detailValueBank}>{selectedPayment.targetAccount || 'Primary Bank Account'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>🕒 Received Date & Time</Text>
                    <Text style={styles.detailValue}>{formatFullDateTime(selectedPayment.receivedAt)}</Text>
                  </View>

                  {selectedPayment.transactionReference ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>🔖 UPI Ref / UTR Number</Text>
                      <Text style={styles.detailValueMono}>{selectedPayment.transactionReference}</Text>
                    </View>
                  ) : null}

                  {selectedPayment.rawText ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>💬 Original Alert Notification</Text>
                      <Text style={styles.detailRawText}>{selectedPayment.rawText}</Text>
                    </View>
                  ) : null}
                </ScrollView>

                {/* Modal Action Buttons */}
                <View style={styles.detailsActionRow}>
                  <TouchableOpacity
                    style={styles.detailsVoiceBtn}
                    onPress={() => playVoiceForPayment(selectedPayment)}>
                    <Text style={styles.detailsVoiceBtnText}>🔊 Speak Voice Alert</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.detailsCloseBtn}
                    onPress={() => setDetailsModalVisible(false)}>
                    <Text style={styles.detailsCloseBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Sync Settings Modal */}
      <Modal visible={syncModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Desktop Wi-Fi Synchronization</Text>
            <Text style={styles.modalDesc}>
              Enter the Desktop Server URL displayed on your Electron dashboard to stream notifications in real time.
            </Text>

            <TextInput
              style={styles.textInput}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="http://192.168.1.x:8999/api/payment"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.syncStatusText}>Status: {syncStatus}</Text>

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSyncModalVisible(false)}>
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveAndTestSync}>
                <Text style={styles.modalSaveBtnText}>Test & Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Debug Inspector Modal */}
      <Modal visible={debugModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalHeader}>Notification Inspector</Text>
            <Text style={styles.modalDesc}>
              Raw notifications captured on this device. Useful for verifying package names and formats.
            </Text>

            <ScrollView style={{ marginTop: 12 }}>
              {debugList.length === 0 ? (
                <Text style={{ color: '#94a3b8', textAlign: 'center', marginVertical: 20 }}>
                  No raw notifications captured yet.
                </Text>
              ) : (
                debugList.map((notif, index) => (
                  <View key={index} style={styles.debugItem}>
                    <Text style={styles.debugPkg}>Package: {notif.packageName}</Text>
                    <Text style={styles.debugTitle}>Title: {notif.title}</Text>
                    <Text style={styles.debugText}>Text: {notif.text}</Text>
                    <Text style={styles.debugTime}>{new Date(notif.timestamp).toLocaleTimeString()}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalCloseBtn, { marginTop: 16 }]}
              onPress={() => setDebugModalVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#111726',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerBtnText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  permissionCard: {
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  permActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  permInactive: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  permTextGroup: {
    flex: 1,
    marginRight: 10,
  },
  permTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  permDesc: {
    fontSize: 11,
    color: '#94a3b8',
  },
  permButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  permBtnActive: {
    backgroundColor: '#1e293b',
  },
  permBtnInactive: {
    backgroundColor: '#ef4444',
  },
  permBtnLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: '#131d31',
    padding: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
  },
  heroTag: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#34d399',
    marginBottom: 6,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: '#ffffff',
  },
  heroFooter: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 6,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  filterChipSelected: {
    backgroundColor: '#10b981',
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextSelected: {
    color: '#ffffff',
  },
  quickTestBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickTestLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  testBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  testBtnText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '600',
  },
  listSection: {
    gap: 10,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  paymentCard: {
    backgroundColor: '#111726',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  platformBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  platformBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardTime: {
    fontSize: 11,
    color: '#64748b',
  },
  cardMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardSenderGroup: {
    flex: 1,
  },
  senderName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  accountBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  accountText: {
    fontSize: 11,
    color: '#38bdf8',
  },
  cardAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: '#10b981',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
    paddingTop: 6,
  },
  refText: {
    fontSize: 10,
    color: '#64748b',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#0b0f19',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 10,
    color: '#ffffff',
    fontSize: 13,
  },
  syncStatusText: {
    fontSize: 11,
    color: '#34d399',
    marginTop: 8,
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalCloseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#1e293b',
  },
  modalCloseBtnText: {
    color: '#cbd5e1',
    fontWeight: '600',
    fontSize: 13,
  },
  modalSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#10b981',
  },
  modalSaveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  debugItem: {
    backgroundColor: '#0b0f19',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  debugPkg: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '600',
  },
  debugTitle: {
    fontSize: 12,
    color: '#ffffff',
    marginTop: 2,
  },
  debugText: {
    fontSize: 11,
    color: '#cbd5e1',
    marginTop: 2,
  },
  debugTime: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 4,
  },
  cardTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTapHint: {
    fontSize: 10,
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '600',
  },
  detailsModalBox: {
    maxHeight: '85%',
    backgroundColor: '#0f172a',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailsCloseX: {
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsCloseXText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  detailsAmountBanner: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  detailsAmountLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34d399',
    letterSpacing: 1,
    marginBottom: 4,
  },
  detailsAmountText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
  },
  detailsStatusBadge: {
    marginTop: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  detailsStatusText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
  },
  detailsListScroll: {
    maxHeight: 250,
  },
  detailRow: {
    backgroundColor: '#111827',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  detailLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 2,
  },
  detailValuePrimary: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  detailValueBank: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38bdf8',
  },
  detailValueMono: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a78bfa',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  detailRawText: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
  },
  detailsActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  detailsVoiceBtn: {
    flex: 1,
    backgroundColor: '#9333ea',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsVoiceBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  detailsCloseBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsCloseBtnText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
});
