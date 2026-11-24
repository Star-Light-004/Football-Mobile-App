import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Switch,
    Alert,
    SafeAreaView,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AdminSettingsScreen({ navigation }) {
    // Active Tab
    const [activeTab, setActiveTab] = useState('cluster'); // 'cluster' | 'policy' | 'sepay' | 'auto'

    // Brand & Cluster Info
    const [systemName, setSystemName] = useState('Sân Bóng Đá Hải Châu, Đà Nẵng');
    const [hotline, setHotline] = useState('1900 88 99 22');
    const [email, setEmail] = useState('contact@sanbonghaichau.vn');
    const [address, setAddress] = useState('Cụm Sân Chuyên Việt - Hải Châu, Đà Nẵng');

    // SePay Gateway Configuration (Thông tin tài khoản nhận cọc VietQR)
    const [sepayBank, setSepayBank] = useState('MBBank (Ngân Hàng Quân Đội)');
    const [sepayAccountNo, setSepayAccountNo] = useState('0905889922');
    const [sepayAccountName, setSepayAccountName] = useState('SAN BONG HAI CHAU DA NANG');
    const [webhookUrl, setWebhookUrl] = useState('https://api.sanbonghaichau.vn/v1/webhooks/sepay/napas247');
    const [apiKey, setApiKey] = useState('sp_live_99a8230b4ef710819c98f2');
    const [syntaxPrefix, setSyntaxPrefix] = useState('HC');

    // Policies
    const [depositRate, setDepositRate] = useState('50'); // 50%
    const [cancelHourLimit, setCancelHourLimit] = useState('12'); // Hủy trước 12h
    const [autoCancelUnpaidMinutes, setAutoCancelUnpaidMinutes] = useState('15'); // 15 phút
    const [emergencyPitchLock, setEmergencyPitchLock] = useState(false); // Khóa sân khẩn cấp khi thời tiết xấu

    // Switches
    const [autoCancelUnpaid, setAutoCancelUnpaid] = useState(true);
    const [autoLightOn, setAutoLightOn] = useState(true);
    const [zaloOANotice, setZaloOANotice] = useState(true);
    const [smsWebhook, setSmsWebhook] = useState(false);
    const [matchReminder, setMatchReminder] = useState(true);

    const [pinging, setPinging] = useState(false);

    const handlePingWebhook = () => {
        setPinging(true);
        setTimeout(() => {
            setPinging(false);
            Alert.alert(
                'Kiểm tra kết nối SePay',
                'Kết nối cổng SePay API v2.4 thành công (Ping: 18ms). Sẵn sàng nhận giao dịch VietQR Napas247.'
            );
        }, 600);
    };

    const handleSave = () => {
        Alert.alert('Thành công', 'Đã lưu toàn bộ cấu hình hệ thống & cổng thanh toán SePay VietQR.');
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Top Bar: Clean Emerald Modernism */}
            <View style={styles.topBar}>
                <View style={styles.topBarLeft}>
                    <TouchableOpacity
                        style={styles.iconCircleBtn}
                        onPress={() => {
                            if (navigation.canGoBack()) navigation.goBack();
                            else navigation.navigate('AdminDashboard');
                        }}
                    >
                        <Ionicons name="arrow-back" size={20} color="#111827" />
                    </TouchableOpacity>
                    <View style={{ marginLeft: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.topBarTitle}>Cài Đặt Hệ Thống & SePay</Text>
                        </View>
                        <View style={styles.liveRow}>
                            <View style={styles.livePulseDot} />
                            <Text style={styles.topBarSubtitle}>SEPAY V2.4 • REALTIME MBBANK</Text>
                        </View>
                    </View>
                </View>

                <TouchableOpacity style={styles.saveHeaderBtn} onPress={handleSave} activeOpacity={0.85}>
                    <Ionicons name="checkmark" size={16} color="#ffffff" />
                    <Text style={styles.saveHeaderText}>Lưu</Text>
                </TouchableOpacity>
            </View>

            {/* Navigation Tabs */}
            <View style={styles.tabsWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
                    {[
                        { key: 'cluster', label: 'Cụm sân & Hotline', icon: 'stadium-outline' },
                        { key: 'policy', label: 'Chính sách cọc & Khẩn cấp', icon: 'shield-half-outline' },
                        { key: 'sepay', label: 'Tài khoản VietQR SePay', icon: 'qr-code' },
                        { key: 'auto', label: 'Tự động hóa & Zalo', icon: 'flash-outline' },
                    ].map(t => {
                        const isSel = activeTab === t.key;
                        return (
                            <TouchableOpacity
                                key={t.key}
                                style={[styles.tabChip, isSel && styles.tabChipActive]}
                                onPress={() => setActiveTab(t.key)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name={t.icon} size={14} color={isSel ? '#ffffff' : '#006b2c'} />
                                <Text style={[styles.tabChipText, isSel && styles.tabChipTextActive]}>
                                    {t.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* TAB 1: SEPAY INTEGRATION */}
                {activeTab === 'sepay' && (
                    <View style={{ gap: 14 }}>
                        {/* SePay Dark Modern Hero Card */}
                        <View style={styles.sepayDarkCard}>
                            <View style={styles.sepayDarkHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="flash" size={18} color="#7ffc97" />
                                    <Text style={styles.sepayDarkTitle}>SEPAY API V2.4 ĐANG HOẠT ĐỘNG</Text>
                                </View>
                                <View style={styles.sepayLivePill}>
                                    <Text style={styles.sepayLivePillText}>Realtime MBBank</Text>
                                </View>
                            </View>
                            <Text style={styles.sepayDarkDesc}>
                                Tự động xác nhận giao dịch ngân hàng & gạch nợ đơn đặt sân tức thì trong 1-2 giây.
                            </Text>

                            <TouchableOpacity
                                style={styles.pingBtn}
                                onPress={handlePingWebhook}
                                disabled={pinging}
                                activeOpacity={0.85}
                            >
                                {pinging ? (
                                    <ActivityIndicator size="small" color="#006b2c" />
                                ) : (
                                    <>
                                        <Ionicons name="pulse" size={15} color="#006b2c" />
                                        <Text style={styles.pingBtnText}>Kiểm tra kết nối SePay (Ping 18ms)</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Bank Beneficiary Details Card */}
                        <View style={styles.sectionCard}>
                            <View style={styles.sectionHeader}>
                                <View style={[styles.sectionIcon, { backgroundColor: '#dbeafe' }]}>
                                    <Ionicons name="card" size={16} color="#1d4ed8" />
                                </View>
                                <Text style={styles.sectionTitle}>Tài Khoản Thụ Hưởng VietQR</Text>
                            </View>

                            <Text style={styles.inputLabel}>Ngân hàng thụ hưởng</Text>
                            <TextInput
                                style={styles.input}
                                value={sepayBank}
                                onChangeText={setSepayBank}
                            />

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1.5 }}>
                                    <Text style={styles.inputLabel}>Số tài khoản nhận cọc</Text>
                                    <TextInput
                                        style={[styles.input, { fontWeight: '800', color: '#006b2c' }]}
                                        value={sepayAccountNo}
                                        onChangeText={setSepayAccountNo}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Cú pháp tiền tố</Text>
                                    <TextInput
                                        style={[styles.input, { fontWeight: '800', textAlign: 'center' }]}
                                        value={syntaxPrefix}
                                        onChangeText={setSyntaxPrefix}
                                    />
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Tên chủ tài khoản thụ hưởng</Text>
                            <TextInput
                                style={[styles.input, { textTransform: 'uppercase', fontWeight: '800' }]}
                                value={sepayAccountName}
                                onChangeText={setSepayAccountName}
                            />

                            <Text style={styles.inputLabel}>Webhook URL lắng nghe Napas247</Text>
                            <TextInput
                                style={[styles.input, { fontSize: 11, color: '#006b2c' }]}
                                value={webhookUrl}
                                onChangeText={setWebhookUrl}
                            />

                            <Text style={styles.inputLabel}>SePay API Secret Token</Text>
                            <TextInput
                                style={[styles.input, { fontSize: 11 }]}
                                secureTextEntry
                                value={apiKey}
                                onChangeText={setApiKey}
                            />
                        </View>
                    </View>
                )}

                {/* TAB 2: STADIUM CLUSTER INFO */}
                {activeTab === 'cluster' && (
                    <View style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <View style={[styles.sectionIcon, { backgroundColor: '#f0fdf4' }]}>
                                <Ionicons name="business" size={16} color="#006b2c" />
                            </View>
                            <Text style={styles.sectionTitle}>Thông Tin Cụm Sân & Liên Hệ</Text>
                        </View>

                        <Text style={styles.inputLabel}>Tên hệ thống cụm sân</Text>
                        <TextInput
                            style={styles.input}
                            value={systemName}
                            onChangeText={setSystemName}
                        />

                        <Text style={styles.inputLabel}>Hotline hỗ trợ đặt sân 24/7</Text>
                        <TextInput
                            style={styles.input}
                            value={hotline}
                            onChangeText={setHotline}
                        />

                        <Text style={styles.inputLabel}>Email vận hành & hóa đơn</Text>
                        <TextInput
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                        />

                        <Text style={styles.inputLabel}>Địa chỉ cơ sở chính</Text>
                        <TextInput
                            style={styles.input}
                            value={address}
                            onChangeText={setAddress}
                        />
                    </View>
                )}

                {/* TAB 3: DEPOSIT POLICIES */}
                {activeTab === 'policy' && (
                    <View style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <View style={[styles.sectionIcon, { backgroundColor: '#fef3c7' }]}>
                                <Ionicons name="shield-half" size={16} color="#b45309" />
                            </View>
                            <Text style={styles.sectionTitle}>Quy Chuẩn Cọc & Giữ Chỗ</Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Tỷ lệ cọc bắt buộc (%)</Text>
                                <TextInput
                                    style={styles.input}
                                    keyboardType="numeric"
                                    value={depositRate}
                                    onChangeText={setDepositRate}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Hạn hủy trước ca (Giờ)</Text>
                                <TextInput
                                    style={styles.input}
                                    keyboardType="numeric"
                                    value={cancelHourLimit}
                                    onChangeText={setCancelHourLimit}
                                />
                            </View>
                        </View>

                        <View style={styles.switchRow}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.switchTitle}>Tự động hủy ca chưa cọc sau 15 phút</Text>
                                <Text style={styles.switchSub}>Giải phóng sân cho khách khác nếu quá hạn giữ chỗ</Text>
                            </View>
                            <Switch
                                value={autoCancelUnpaid}
                                onValueChange={setAutoCancelUnpaid}
                                trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                                thumbColor={autoCancelUnpaid ? '#006b2c' : '#f1f5f9'}
                            />
                        </View>

                        {/* Emergency Pitch Lock Switch */}
                        <View style={[styles.switchRow, { backgroundColor: emergencyPitchLock ? '#fee2e2' : '#f8fafc', padding: 12, borderRadius: 10, marginTop: 12, borderWidth: 1, borderColor: emergencyPitchLock ? '#ef4444' : '#e2e8f0' }]}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="warning" size={16} color={emergencyPitchLock ? "#b91c1c" : "#b45309"} />
                                    <Text style={[styles.switchTitle, { color: emergencyPitchLock ? '#b91c1c' : '#1e293b', fontWeight: '800' }]}>
                                        Tạm ngưng nhận khách khẩn cấp toàn cụm sân
                                    </Text>
                                </View>
                                <Text style={styles.switchSub}>
                                    Khóa toàn bộ các sân khi gặp bão lũ, ngập úng hoặc sự cố kỹ thuật lớn
                                </Text>
                            </View>
                            <Switch
                                value={emergencyPitchLock}
                                onValueChange={(val) => {
                                    setEmergencyPitchLock(val);
                                    if (val) {
                                        Alert.alert('Cảnh báo khẩn cấp', 'Toàn bộ cụm sân sẽ tạm ngừng nhận khách mới cho đến khi mở lại.');
                                    }
                                }}
                                trackColor={{ false: '#cbd5e1', true: '#fca5a5' }}
                                thumbColor={emergencyPitchLock ? '#b91c1c' : '#f1f5f9'}
                            />
                        </View>
                    </View>
                )}

                {/* TAB 4: AUTOMATIONS */}
                {activeTab === 'auto' && (
                    <View style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <View style={[styles.sectionIcon, { backgroundColor: '#dcfce7' }]}>
                                <Ionicons name="flash" size={16} color="#006b2c" />
                            </View>
                            <Text style={styles.sectionTitle}>Tự Động Hóa & Thông Báo</Text>
                        </View>

                        <View style={styles.switchRow}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.switchTitle}>Tự động bật dàn đèn Philips LED lúc 17:45</Text>
                                <Text style={styles.switchSub}>Đóng relay chiếu sáng sân tự động cho ca giờ vàng</Text>
                            </View>
                            <Switch
                                value={autoLightOn}
                                onValueChange={setAutoLightOn}
                                trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                                thumbColor={autoLightOn ? '#006b2c' : '#f1f5f9'}
                            />
                        </View>

                        <View style={styles.switchRow}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.switchTitle}>Gửi thông báo Zalo OA xác nhận cọc</Text>
                                <Text style={styles.switchSub}>Tự động gửi tin nhắn mẫu ZNS kèm mã QR vào sân</Text>
                            </View>
                            <Switch
                                value={zaloOANotice}
                                onValueChange={setZaloOANotice}
                                trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                                thumbColor={zaloOANotice ? '#006b2c' : '#f1f5f9'}
                            />
                        </View>

                        <View style={styles.switchRow}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.switchTitle}>Nhắc lịch thi đấu trước 2 tiếng</Text>
                                <Text style={styles.switchSub}>Nhắn tin nhắc nhở đội trưởng gom quân đúng giờ</Text>
                            </View>
                            <Switch
                                value={matchReminder}
                                onValueChange={setMatchReminder}
                                trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                                thumbColor={matchReminder ? '#006b2c' : '#f1f5f9'}
                            />
                        </View>
                    </View>
                )}

                {/* Save Button */}
                <TouchableOpacity style={styles.bottomSaveBtn} onPress={handleSave} activeOpacity={0.85}>
                    <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                    <Text style={styles.bottomSaveBtnText}>Lưu Thay Đổi Cấu Hình</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f7f9fb',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 12,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderColor: '#eceef0',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 6,
    },
    topBarLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconCircleBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f2f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBarTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
    },
    liveRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 1,
    },
    livePulseDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#006b2c',
    },
    topBarSubtitle: {
        fontSize: 10,
        fontWeight: '700',
        color: '#6b7280',
        letterSpacing: 0.5,
    },
    saveHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#006b2c',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 9999,
        elevation: 2,
        shadowColor: '#006b2c',
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    saveHeaderText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },
    tabsWrapper: {
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderColor: '#eceef0',
        paddingVertical: 8,
    },
    tabsScroll: {
        paddingHorizontal: 16,
        gap: 8,
    },
    tabChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 9999,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#eceef0',
    },
    tabChipActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    tabChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
    },
    tabChipTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32,
    },
    sepayDarkCard: {
        backgroundColor: '#0f172a',
        borderRadius: 16,
        padding: 16,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 10,
    },
    sepayDarkHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    sepayDarkTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#7ffc97',
        letterSpacing: 0.5,
    },
    sepayLivePill: {
        backgroundColor: '#1e293b',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
        borderWidth: 1,
        borderColor: '#334155',
    },
    sepayLivePillText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#7ffc97',
    },
    sepayDarkDesc: {
        fontSize: 12,
        color: '#cbd5e1',
        lineHeight: 18,
        marginBottom: 14,
    },
    pingBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#ffffff',
        paddingVertical: 10,
        borderRadius: 10,
    },
    pingBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#006b2c',
    },
    sectionCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#eceef0',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 4,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sectionIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#111827',
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#374151',
        marginTop: 10,
        marginBottom: 4,
    },
    input: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#eceef0',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
        fontSize: 13,
        color: '#111827',
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#f8fafc',
        marginTop: 8,
    },
    switchTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    switchSub: {
        fontSize: 11,
        color: '#6b7280',
        marginTop: 2,
    },
    bottomSaveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#006b2c',
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 16,
        elevation: 3,
        shadowColor: '#006b2c',
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    bottomSaveBtnText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '800',
    },
});
