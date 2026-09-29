import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  useColorScheme,
  LayoutAnimation,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { NotificationModule } = NativeModules;
const eventEmitter = NotificationModule ? new NativeEventEmitter(NotificationModule) : null;

// Design Tokens (Light Theme & Dark Theme)
const TOKENS = {
  light: {
    bg: '#F3F5FA',
    surface: '#FFFFFF',
    surface2: '#EAEEF7',
    line: '#E1E6F0',
    text: '#121829',
    muted: '#69728A',
    accent: '#4F5BFF',
    accentSoft: '#E6E8FF',
    money: '#0E9F6E',
    moneySoft: '#DDF5EA',
    hero1: '#1B2340',
    hero2: '#2B3670',
    cardShadow: {
      shadowColor: '#1E285A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 2,
    },
  },
  dark: {
    bg: '#0B0F1C',
    surface: '#141A2C',
    surface2: '#1C2440',
    line: '#242D4A',
    text: '#EEF1FA',
    muted: '#8F99B8',
    accent: '#7B86FF',
    accentSoft: '#232B57',
    money: '#3DDC9B',
    moneySoft: '#123A30',
    hero1: '#1E2A66',
    hero2: '#3A2F8F',
    cardShadow: {
      elevation: 0,
    },
  },
};

const APP_META: Record<string, { color: string; heroColor: string; avatar: string; label: string }> = {
  GOOGLE_PAY: { color: '#3B82F6', heroColor: '#7FB0FF', avatar: 'G', label: 'GPay' },
  GOOGLE_PAY_BUSINESS: { color: '#3B82F6', heroColor: '#7FB0FF', avatar: 'G', label: 'GPay Biz' },
  PHONEPE: { color: '#7C3AED', heroColor: '#B79CFF', avatar: 'P', label: 'PhonePe' },
  PAYTM: { color: '#0EA5E9', heroColor: '#67D3FF', avatar: 'T', label: 'Paytm' },
  BHIM: { color: '#F59E0B', heroColor: '#FFC966', avatar: 'U', label: 'BHIM' },
  CRED: { color: '#F59E0B', heroColor: '#FFC966', avatar: 'U', label: 'CRED' },
  AMAZON_PAY: { color: '#F59E0B', heroColor: '#FFC966', avatar: 'U', label: 'Amazon Pay' },
  NAVI: { color: '#F59E0B', heroColor: '#FFC966', avatar: 'U', label: 'Navi' },
  BANK_UPI: { color: '#F59E0B', heroColor: '#FFC966', avatar: 'U', label: 'Bank UPI' },
  OTHER: { color: '#F59E0B', heroColor: '#FFC966', avatar: 'U', label: 'Other UPI' },
};

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
  isNew?: boolean;
}

interface DebugNotif {
  packageName: string;
  title: string;
  text: string;
  timestamp: number;
}

type TimeRangeFilter = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';

export default function App(): React.JSX.Element {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('dark');
  const activeTheme = themeMode;
  const theme = TOKENS[activeTheme];

  const [payments, setPayments] = useState<Payment[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [serverUrl, setServerUrl] = useState<string>('http://192.168.1.100:8999/api/payment');
  const [syncStatus, setSyncStatus] = useState<string>('Ready');
  
  // Filters
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('TODAY'); // Default: Today
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);

  // Modals
  const [syncModalVisible, setSyncModalVisible] = useState<boolean>(false);
  const [debugModalVisible, setDebugModalVisible] = useState<boolean>(false);
  const [debugList, setDebugList] = useState<DebugNotif[]>([]);

  // Selected Transaction for Full Details Modal
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState<boolean>(false);

  // Pulse animation for green listening dot
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.8,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.7,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulseLoop.start();

    return () => pulseLoop.stop();
  }, [pulseAnim, pulseOpacity]);

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
          newPayment.isNew = true;
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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

  const toggleTheme = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setThemeMode(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

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
        NotificationModule.speakPaymentAnnouncement('Voice on');
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
              amount: 1,
              currency: 'INR',
              senderName: 'Payment received',
              targetAccount: 'Merchant business account',
              source: 'GOOGLE_PAY_BUSINESS',
              sourceApp: 'Google Pay for Business',
              transactionType: 'CREDIT',
              transactionReference: null,
              receivedAt: Date.now() - 15 * 60 * 1000,
            },
            {
              id: 'demo_2',
              amount: 2500,
              currency: 'INR',
              senderName: 'Business customer',
              targetAccount: 'ICICI Bank ••3392',
              source: 'GOOGLE_PAY_BUSINESS',
              sourceApp: 'Google Pay for Business',
              transactionType: 'CREDIT',
              transactionReference: 'UPI4290182910',
              receivedAt: Date.now() - 41 * 60 * 1000,
            },
            {
              id: 'demo_3',
              amount: 1000,
              currency: 'INR',
              senderName: 'Anil Kumar',
              targetAccount: 'State Bank of India ••4589',
              source: 'PHONEPE',
              sourceApp: 'PhonePe',
              transactionType: 'CREDIT',
              transactionReference: null,
              receivedAt: Date.now() - 58 * 60 * 1000,
            },
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
          Alert.alert('Success', 'Connected to Desktop Dashboard successfully!');
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
    }
  };

  // Time Range Calculations
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  // Start of current week (Monday)
  const dayOfWeek = now.getDay();
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday).getTime();
  
  // Start of current month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const isWithinTimeRange = (ts: number, range: TimeRangeFilter) => {
    if (range === 'TODAY') return ts >= startOfToday;
    if (range === 'WEEK') return ts >= startOfWeek;
    if (range === 'MONTH') return ts >= startOfMonth;
    return true; // 'ALL'
  };

  const periodPayments = payments.filter(p => isWithinTimeRange(p.receivedAt, timeRange) && p.transactionType !== 'DEBIT');
  const periodTotal = periodPayments.reduce((acc, curr) => acc + curr.amount, 0);

  // Group by app for split bar
  const appTotals: Record<string, number> = {};
  periodPayments.forEach(p => {
    const key = p.source === 'GOOGLE_PAY_BUSINESS' || p.source === 'GOOGLE_PAY'
      ? (p.source === 'GOOGLE_PAY_BUSINESS' ? 'GOOGLE_PAY_BUSINESS' : 'GOOGLE_PAY')
      : p.source === 'PHONEPE'
      ? 'PHONEPE'
      : p.source === 'PAYTM'
      ? 'PAYTM'
      : 'OTHER';
    appTotals[key] = (appTotals[key] || 0) + p.amount;
  });

  const filteredPayments = payments.filter(p => {
    const timeMatch = isWithinTimeRange(p.receivedAt, timeRange);
    if (!timeMatch) return false;

    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'GOOGLE_PAY') return p.source === 'GOOGLE_PAY';
    if (selectedFilter === 'GOOGLE_PAY_BUSINESS') return p.source === 'GOOGLE_PAY_BUSINESS';
    if (selectedFilter === 'PHONEPE') return p.source === 'PHONEPE';
    if (selectedFilter === 'PAYTM') return p.source === 'PAYTM';
    if (selectedFilter === 'OTHER') {
      return !['GOOGLE_PAY', 'GOOGLE_PAY_BUSINESS', 'PHONEPE', 'PAYTM'].includes(p.source);
    }
    return true;
  });

  const getPeriodLabel = () => {
    switch (timeRange) {
      case 'TODAY': return 'Received today';
      case 'WEEK': return 'Received this week';
      case 'MONTH': return 'Received this month';
      case 'ALL': return 'Received all time';
    }
  };

  const getPeriodCountText = () => {
    const count = periodPayments.length;
    const singular = count === 1 ? 'payment' : 'payments';
    switch (timeRange) {
      case 'TODAY': return `${count} ${singular} today`;
      case 'WEEK': return `${count} ${singular} this week`;
      case 'MONTH': return `${count} ${singular} this month`;
      case 'ALL': return `${count} ${singular} all time`;
    }
  };

  const formatAmount = (num: number) => {
    return Number(num).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatFullDateTime = (ts: number) => {
    const d = new Date(ts);
    const dateStr = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return `${dateStr} at ${timeStr}`;
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
  };

  const getMeta = (source: string) => {
    return APP_META[source] || APP_META.OTHER;
  };

  const playVoiceForPayment = (p: Payment) => {
    if (NotificationModule?.speakPaymentAnnouncement) {
      const amt = Math.round(p.amount);
      const meta = getMeta(p.source);
      const name = p.senderName && p.senderName !== 'Unknown Sender' ? p.senderName : 'Customer';
      const text = `${meta.label} received ${amt} rupees from ${name}`;
      NotificationModule.speakPaymentAnnouncement(text);
    }
  };

  const toggleCardExpansion = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCardId(expandedCardId === id ? null : id);
  };

  const openPaymentDetails = (p: Payment) => {
    setSelectedPayment(p);
    setDetailsModalVisible(true);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />

      {/* Screen Header */}
      <View style={[styles.header, { backgroundColor: theme.bg }]}>
        <View style={styles.headerLeftRow}>
          {/* New App Logo Badge */}
          <View style={[styles.brandLogoBox, { backgroundColor: activeTheme === 'dark' ? '#1e293b' : '#E6E8FF' }]}>
            <Text style={styles.brandLogoIcon}>⚡</Text>
          </View>
          <View style={styles.headerTitleGroup}>
            <Text style={[styles.screenTitle, { color: theme.text }]}>UPI Payment Monitor</Text>
            <Text style={[styles.screenSubtitle, { color: theme.muted }]}>Unified Notification Listener</Text>
          </View>
        </View>
        
        <View style={styles.headerActions}>
          {/* Theme Switcher Toggle (Light ☀️ / Dark 🌙) */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.iconButton,
              {
                backgroundColor: activeTheme === 'dark' ? theme.surface2 : '#ffffff',
                borderColor: theme.line,
              },
            ]}
            onPress={toggleTheme}>
            <Text style={styles.iconGlyph}>
              {activeTheme === 'dark' ? '☀️' : '🌙'}
            </Text>
          </TouchableOpacity>

          {/* Voice Toggle Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.iconButton,
              { backgroundColor: voiceEnabled ? theme.accentSoft : theme.surface, borderColor: theme.line },
            ]}
            onPress={toggleVoice}>
            <Text style={[styles.iconGlyph, { color: voiceEnabled ? theme.accent : theme.muted }]}>
              {voiceEnabled ? '🔊' : '🔇'}
            </Text>
          </TouchableOpacity>

          {/* Sync / Settings Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.iconButton, { backgroundColor: theme.surface, borderColor: theme.line }]}
            onPress={() => setSyncModalVisible(true)}>
            <Text style={[styles.iconGlyph, { color: theme.text }]}>⟳</Text>
          </TouchableOpacity>

          {/* Debug Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.iconButton, { backgroundColor: theme.surface, borderColor: theme.line }]}
            onPress={openDebugInspector}>
            <Text style={[styles.iconGlyph, { color: theme.text }]}>🔍</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Time Period Filter Selector (Default: Today) */}
        <View style={[styles.timeSegmentContainer, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          {[
            { id: 'TODAY', label: 'Today' },
            { id: 'WEEK', label: 'This Week' },
            { id: 'MONTH', label: 'This Month' },
            { id: 'ALL', label: 'All Time' },
          ].map(item => {
            const isActive = timeRange === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.8}
                style={[
                  styles.timeSegmentBtn,
                  isActive && [styles.timeSegmentBtnActive, { backgroundColor: theme.accent }],
                ]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setTimeRange(item.id as TimeRangeFilter);
                }}>
                <Text
                  style={[
                    styles.timeSegmentText,
                    { color: isActive ? '#ffffff' : theme.muted },
                    isActive && { fontWeight: '700' },
                  ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Hero Card with Dynamic Period Gradient & Split Bar */}
        <View style={[styles.heroCard, { backgroundColor: theme.hero1 }]}>
          {/* Top Status & Refresh Row */}
          <View style={styles.heroTopRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.listeningPill}
              onPress={hasPermission ? checkPermission : openSettings}>
              <View style={styles.pulseContainer}>
                {hasPermission && (
                  <Animated.View
                    style={[
                      styles.pulseCircle,
                      {
                        transform: [{ scale: pulseAnim }],
                        opacity: pulseOpacity,
                      },
                    ]}
                  />
                )}
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: hasPermission ? '#48F0A8' : '#EF4444' },
                  ]}
                />
              </View>
              <Text style={styles.listeningText}>
                {hasPermission ? 'Listening for payments' : 'Tap to enable permission'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.refreshPill}
              onPress={() => {
                checkPermission();
                loadStoredPayments();
              }}>
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {/* Hero Amount Section */}
          <View style={styles.heroMain}>
            <Text style={styles.heroLabel}>{getPeriodLabel()}</Text>
            <View style={styles.heroAmountRow}>
              <Text style={styles.heroRupee}>₹</Text>
              <Text style={styles.heroAmount}>{formatAmount(periodTotal)}</Text>
            </View>
            <Text style={styles.heroCount}>{getPeriodCountText()}</Text>
          </View>

          {/* Split Bar */}
          {periodTotal > 0 && (
            <View style={styles.splitBarContainer}>
              <View style={styles.splitBar}>
                {Object.keys(appTotals).map((appKey, index) => {
                  const amt = appTotals[appKey];
                  const widthPct = Math.max(3, (amt / periodTotal) * 100);
                  const meta = APP_META[appKey] || APP_META.OTHER;
                  return (
                    <View
                      key={index}
                      style={[
                        styles.splitSegment,
                        {
                          width: `${widthPct}%`,
                          backgroundColor: meta.heroColor,
                          marginRight: index < Object.keys(appTotals).length - 1 ? 2 : 0,
                        },
                      ]}
                    />
                  );
                })}
              </View>

              {/* Legend */}
              <View style={styles.legendRow}>
                {Object.keys(appTotals).map((appKey, index) => {
                  const amt = appTotals[appKey];
                  const meta = APP_META[appKey] || APP_META.OTHER;
                  return (
                    <View key={index} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: meta.heroColor }]} />
                      <Text style={styles.legendText}>
                        {meta.label} ₹{Math.round(amt).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Platform Filter Chips - Horizontal Scroll */}
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}>
            {[
              { id: 'ALL', label: 'All Apps' },
              { id: 'GOOGLE_PAY', label: 'GPay' },
              { id: 'GOOGLE_PAY_BUSINESS', label: 'GPay Biz' },
              { id: 'PHONEPE', label: 'PhonePe' },
              { id: 'PAYTM', label: 'Paytm' },
              { id: 'OTHER', label: 'Other UPI' },
            ].map(item => {
              const isActive = selectedFilter === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.8}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isActive ? theme.text : theme.surface,
                      borderColor: isActive ? theme.text : theme.line,
                    },
                  ]}
                  onPress={() => setSelectedFilter(item.id)}>
                  <Text
                    style={[
                      styles.chipText,
                      { color: isActive ? theme.bg : theme.muted },
                    ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Voice Test Card */}
        <View style={[styles.testCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[styles.testLabel, { color: theme.muted }]}>Test voice</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.testButtonsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.testPill, { backgroundColor: theme.accentSoft }]}
              onPress={() => triggerTestSimulation('PHONEPE', 500, 'Rahul', 'Primary Bank A/c')}>
              <Text style={[styles.testPillText, { color: theme.accent }]}>₹500 PhonePe</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.testPill, { backgroundColor: theme.accentSoft }]}
              onPress={() => triggerTestSimulation('GOOGLE_PAY', 500, 'Rahul', 'SBI A/c ••4589')}>
              <Text style={[styles.testPillText, { color: theme.accent }]}>₹500 GPay</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.testPill, { backgroundColor: theme.accentSoft }]}
              onPress={() => triggerTestSimulation('PAYTM', 750, 'Suresh', 'Paytm Bank')}>
              <Text style={[styles.testPillText, { color: theme.accent }]}>₹750 Paytm</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.testPill, { backgroundColor: theme.accentSoft }]}
              onPress={() => triggerTestSimulation('GOOGLE_PAY_BUSINESS', 2500, 'Business customer', 'ICICI Bank ••3392')}>
              <Text style={[styles.testPillText, { color: theme.accent }]}>₹2,500 GPay Biz</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Recent Payments Section */}
        <View style={styles.listContainer}>
          <View style={styles.listHeadingRow}>
            <Text style={[styles.sectionHeading, { color: theme.text }]}>Recent payments</Text>
            <Text style={[styles.shownCount, { color: theme.muted }]}>
              {filteredPayments.length} shown
            </Text>
          </View>

          {filteredPayments.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Text style={[styles.emptyText, { color: theme.muted }]}>
                No payments for this period or filter yet. New ones appear here as they arrive.
              </Text>
            </View>
          ) : (
            filteredPayments.map(item => {
              const meta = getMeta(item.source);
              const isExpanded = expandedCardId === item.id;

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.85}
                  style={[
                    styles.paymentCard,
                    {
                      backgroundColor: item.isNew ? theme.moneySoft : theme.surface,
                      borderColor: theme.line,
                      ...theme.cardShadow,
                    },
                  ]}
                  onPress={() => toggleCardExpansion(item.id)}>
                  <View style={styles.cardHeaderRow}>
                    {/* Brand Avatar */}
                    <View style={[styles.avatar, { backgroundColor: meta.color }]}>
                      <Text style={styles.avatarLetter}>{meta.avatar}</Text>
                    </View>

                    {/* Middle Info */}
                    <View style={styles.cardMiddle}>
                      <Text style={[styles.payerName, { color: theme.text }]} numberOfLines={1}>
                        {item.senderName || 'Payment received'}
                      </Text>
                      <Text style={[styles.metaText, { color: theme.muted }]} numberOfLines={1}>
                        {meta.label} · {item.targetAccount || 'Bank account'}
                      </Text>
                    </View>

                    {/* Right Amount & Time */}
                    <View style={styles.cardRight}>
                      <Text style={[styles.amountText, { color: theme.money }]}>
                        +₹{formatAmount(item.amount)}
                      </Text>
                      <Text style={[styles.timeText, { color: theme.muted }]}>
                        {formatTime(item.receivedAt)}
                      </Text>
                    </View>
                  </View>

                  {/* Expandable Detail Section */}
                  {isExpanded && (
                    <View style={[styles.expandedContent, { borderTopColor: theme.line }]}>
                      <View style={styles.expandedRow}>
                        <Text style={[styles.expandedLabel, { color: theme.muted }]}>Received via</Text>
                        <Text style={[styles.expandedValue, { color: theme.text }]}>
                          {item.sourceApp || meta.label}
                        </Text>
                      </View>

                      <View style={styles.expandedRow}>
                        <Text style={[styles.expandedLabel, { color: theme.muted }]}>Account</Text>
                        <Text style={[styles.expandedValue, { color: theme.text }]}>
                          {item.targetAccount || 'Primary Account'}
                        </Text>
                      </View>

                      <View style={styles.expandedRow}>
                        <Text style={[styles.expandedLabel, { color: theme.muted }]}>Date & Time</Text>
                        <Text style={[styles.expandedValue, { color: theme.text }]}>
                          {formatFullDateTime(item.receivedAt)}
                        </Text>
                      </View>

                      <View style={styles.expandedRow}>
                        <Text style={[styles.expandedLabel, { color: theme.muted }]}>UTR / Ref</Text>
                        <Text style={[styles.expandedValue, { color: theme.accent }]}>
                          {item.transactionReference || 'Not shown in notification'}
                        </Text>
                      </View>

                      {item.rawText ? (
                        <View style={styles.rawAlertBox}>
                          <Text style={[styles.rawAlertText, { color: theme.muted }]}>
                            💬 {item.rawText}
                          </Text>
                        </View>
                      ) : null}

                      {/* Action Row */}
                      <View style={styles.cardActionRow}>
                        <TouchableOpacity
                          style={[styles.voiceActionBtn, { backgroundColor: theme.accentSoft }]}
                          onPress={() => playVoiceForPayment(item)}>
                          <Text style={[styles.voiceActionBtnText, { color: theme.accent }]}>
                            🔊 Replay Voice Alert
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.fullDetailsBtn, { backgroundColor: theme.surface2 }]}
                          onPress={() => openPaymentDetails(item)}>
                          <Text style={[styles.fullDetailsBtnText, { color: theme.text }]}>
                            View Full Details
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Full Transaction Details Modal */}
      <Modal visible={detailsModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            {selectedPayment && (
              <>
                <View style={styles.detailsModalHeader}>
                  <View style={[styles.avatarSmall, { backgroundColor: getMeta(selectedPayment.source).color }]}>
                    <Text style={styles.avatarLetterSmall}>{getMeta(selectedPayment.source).avatar}</Text>
                  </View>
                  <Text style={[styles.detailsModalTitle, { color: theme.text }]}>
                    {getMeta(selectedPayment.source).label} Payment
                  </Text>
                  <TouchableOpacity
                    style={styles.closeCircle}
                    onPress={() => setDetailsModalVisible(false)}>
                    <Text style={[styles.closeCircleText, { color: theme.muted }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.detailsAmountCard, { backgroundColor: theme.surface2 }]}>
                  <Text style={[styles.detailsAmountLabel, { color: theme.muted }]}>TOTAL RECEIVED</Text>
                  <Text style={[styles.detailsAmountVal, { color: theme.money }]}>
                    + ₹{formatAmount(selectedPayment.amount)}
                  </Text>
                </View>

                <ScrollView style={{ maxHeight: 240, marginVertical: 10 }}>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailItemLabel, { color: theme.muted }]}>Payer / Sender</Text>
                    <Text style={[styles.detailItemVal, { color: theme.text }]}>
                      {selectedPayment.senderName || 'Unknown Customer'}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={[styles.detailItemLabel, { color: theme.muted }]}>Credited Bank / Account</Text>
                    <Text style={[styles.detailItemVal, { color: theme.text }]}>
                      {selectedPayment.targetAccount || 'Primary Bank Account'}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={[styles.detailItemLabel, { color: theme.muted }]}>Timestamp</Text>
                    <Text style={[styles.detailItemVal, { color: theme.text }]}>
                      {formatFullDateTime(selectedPayment.receivedAt)}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={[styles.detailItemLabel, { color: theme.muted }]}>UPI Ref / UTR</Text>
                    <Text style={[styles.detailItemVal, { color: theme.accent }]}>
                      {selectedPayment.transactionReference || 'Not provided'}
                    </Text>
                  </View>

                  {selectedPayment.rawText && (
                    <View style={styles.detailItem}>
                      <Text style={[styles.detailItemLabel, { color: theme.muted }]}>Raw Notification</Text>
                      <Text style={[styles.detailItemVal, { color: theme.muted, fontSize: 11 }]}>
                        {selectedPayment.rawText}
                      </Text>
                    </View>
                  )}
                </ScrollView>

                <View style={styles.detailsModalActions}>
                  <TouchableOpacity
                    style={[styles.detailsSpeakBtn, { backgroundColor: theme.accent }]}
                    onPress={() => playVoiceForPayment(selectedPayment)}>
                    <Text style={styles.detailsSpeakBtnText}>🔊 Speak Voice</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.detailsCloseBtn, { backgroundColor: theme.surface2 }]}
                    onPress={() => setDetailsModalVisible(false)}>
                    <Text style={[styles.detailsCloseBtnText, { color: theme.text }]}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Desktop Wi-Fi Sync Modal */}
      <Modal visible={syncModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Desktop Wi-Fi Sync</Text>
            <Text style={[styles.modalSubtitle, { color: theme.muted }]}>
              Enter the Desktop Server URL shown on your Electron dashboard to stream notifications in real time.
            </Text>

            <TextInput
              style={[styles.textInput, { backgroundColor: theme.surface2, borderColor: theme.line, color: theme.text }]}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="http://192.168.1.x:8999/api/payment"
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[styles.syncStatusMsg, { color: theme.accent }]}>Status: {syncStatus}</Text>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalBtnCancel, { backgroundColor: theme.surface2 }]}
                onPress={() => setSyncModalVisible(false)}>
                <Text style={[styles.modalBtnCancelText, { color: theme.text }]}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnSave, { backgroundColor: theme.accent }]}
                onPress={saveAndTestSync}>
                <Text style={styles.modalBtnSaveText}>Test & Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Debug Inspector Modal */}
      <Modal visible={debugModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%', backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Notification Inspector</Text>
            <Text style={[styles.modalSubtitle, { color: theme.muted }]}>
              Raw captured notifications on this device.
            </Text>

            <ScrollView style={{ marginTop: 12 }}>
              {debugList.length === 0 ? (
                <Text style={{ color: theme.muted, textAlign: 'center', marginVertical: 20 }}>
                  No raw notifications captured yet.
                </Text>
              ) : (
                debugList.map((notif, index) => (
                  <View
                    key={index}
                    style={[styles.debugItem, { backgroundColor: theme.surface2, borderColor: theme.line }]}>
                    <Text style={[styles.debugPkg, { color: theme.accent }]}>Package: {notif.packageName}</Text>
                    <Text style={[styles.debugTitle, { color: theme.text }]}>Title: {notif.title}</Text>
                    <Text style={[styles.debugText, { color: theme.muted }]}>Text: {notif.text}</Text>
                    <Text style={[styles.debugTime, { color: theme.muted }]}>
                      {new Date(notif.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalBtnCancel, { marginTop: 16, backgroundColor: theme.surface2 }]}
              onPress={() => setDebugModalVisible(false)}>
              <Text style={[styles.modalBtnCancelText, { color: theme.text }]}>Close</Text>
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
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  brandLogoBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(79, 91, 255, 0.25)',
  },
  brandLogoIcon: {
    fontSize: 20,
  },
  headerTitleGroup: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 11.5,
    fontWeight: '400',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 15,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  timeSegmentContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  timeSegmentBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSegmentBtnActive: {
    elevation: 2,
    shadowColor: '#4F5BFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  timeSegmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroCard: {
    borderRadius: 26,
    padding: 20,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  listeningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
  },
  pulseContainer: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCircle: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#48F0A8',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  listeningText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  refreshPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  refreshText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  heroMain: {
    marginBottom: 16,
  },
  heroLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroRupee: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 26,
    fontWeight: '600',
    marginRight: 4,
  },
  heroAmount: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroCount: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 4,
  },
  splitBarContainer: {
    marginTop: 4,
  },
  splitBar: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  splitSegment: {
    height: '100%',
    borderRadius: 4,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11.5,
    fontWeight: '500',
  },
  filterSection: {
    marginHorizontal: -16,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  testCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 12,
    gap: 8,
  },
  testLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  testButtonsRow: {
    gap: 8,
    flexDirection: 'row',
  },
  testPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  testPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContainer: {
    gap: 10,
    marginTop: 2,
  },
  listHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
  },
  shownCount: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  paymentCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  cardMiddle: {
    flex: 1,
  },
  payerName: {
    fontSize: 15.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  metaText: {
    fontSize: 12.5,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  timeText: {
    fontSize: 12,
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 6,
  },
  expandedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandedLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  expandedValue: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  rawAlertBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },
  rawAlertText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  voiceActionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  voiceActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fullDetailsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  fullDetailsBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 14,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
  },
  syncStatusMsg: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 8,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalBtnCancel: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalBtnCancelText: {
    fontWeight: '600',
    fontSize: 13,
  },
  modalBtnSave: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalBtnSaveText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  debugItem: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  debugPkg: {
    fontSize: 11,
    fontWeight: '700',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  debugText: {
    fontSize: 11,
    marginTop: 2,
  },
  debugTime: {
    fontSize: 10,
    marginTop: 4,
  },
  detailsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetterSmall: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  detailsModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  closeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeCircleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  detailsAmountCard: {
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  detailsAmountLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  detailsAmountVal: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  detailItem: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  detailItemLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  detailItemVal: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  detailsModalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  detailsSpeakBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  detailsSpeakBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  detailsCloseBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  detailsCloseBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
