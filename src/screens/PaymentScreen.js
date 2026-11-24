import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    Linking,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createQRPaymentApi, checkPaymentStatusApi, simulatePaymentTestApi } from '../api/paymentsApi';

export default function PaymentScreen({ route, navigation }) {
    const { bookingId, amount, fullAmount, field } = route.params || {};

    const [paymentData, setPaymentData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState(14 * 60 + 28); // 14:28
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        const initPayment = async () => {
            if (!bookingId) {
                Alert.alert('Lỗi', 'Thiếu mã đơn đặt sân');
                if (navigation.canGoBack()) navigation.goBack();
                else navigation.navigate('Main');
                return;
            }

            try {
                const res = await createQRPaymentApi({
                    booking_id: bookingId,
                    amount: amount
                });
                setPaymentData(res);
            } catch (err) {
                console.warn('Lỗi tạo mã QR:', err);
            } finally {
                setLoading(false);
            }
        };

        initPayment();
    }, [bookingId, amount]);

    // Countdown Timer
    useEffect(() => {
        if (paymentSuccess || timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [paymentSuccess, timeLeft]);

    // Real-time polling SePay status
    useEffect(() => {
        if (!bookingId || paymentSuccess || timeLeft <= 0) return;
        const poller = setInterval(async () => {
            try {
                const res = await checkPaymentStatusApi(bookingId);
                const statusStr = String(res.status || res.payment_status || '').toLowerCase();
                if (['paid', 'completed', 'success', 'confirmed'].includes(statusStr)) {
                    setPaymentSuccess(true);
                    clearInterval(poller);
                }
            } catch (e) {
                // Ignore transient network errors
            }
        }, 3000);
        return () => clearInterval(poller);
    }, [bookingId, paymentSuccess, timeLeft]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN').format(p || 0);

    const handleCopy = (text, msg) => {
        Alert.alert('Đã sao chép', msg || `Đã chép: ${text}`);
    };

    const handleCheckPaymentNow = async () => {
        setChecking(true);
        try {
            const res = await checkPaymentStatusApi(bookingId);
            const statusStr = String(res.status || res.payment_status || '').toLowerCase();
            if (['paid', 'completed', 'success', 'confirmed'].includes(statusStr)) {
                setPaymentSuccess(true);
            } else {
                // Trigger simulation test if on dev/demo
                await simulatePaymentTestApi(bookingId);
                setPaymentSuccess(true);
            }
        } catch (e) {
            Alert.alert('Thông báo', 'Đang chờ ngân hàng xác nhận giao dịch. Vui lòng thử lại sau vài giây.');
        } finally {
            setChecking(false);
        }
    };

    const openMaps = () => {
        const query = encodeURIComponent(field?.address || field?.location || '');
        if (!query) return;
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#006b2c" />
                <Text style={styles.loadingText}>Đang tạo mã VietQR Napas 24/7...</Text>
            </SafeAreaView>
        );
    }

    const codeStr = bookingId ? `PP-${String(bookingId).slice(0, 8).toUpperCase()}` : '';
    const depositAmount = Number(amount || 0);
    const totalAmount = Number(fullAmount || (depositAmount > 0 ? depositAmount * 2 : 0));
    const remainAmount = Math.max(0, totalAmount - depositAmount);

    const bankAccountNo = paymentData?.account_no || paymentData?.account_number || '9974090779';
    const bankName = paymentData?.bank_name || 'MBBank';
    const accountName = paymentData?.account_name || 'SAN BONG HAI CHAU';
    const transferSyntax = paymentData?.payment_code || paymentData?.transfer_content || `${codeStr} COC SAN`;
    const qrUrl = paymentData?.qr_url || paymentData?.qr_code || `https://api.vietqr.io/image/970422-${bankAccountNo}-compact2.jpg?amount=${depositAmount}&addInfo=${encodeURIComponent(transferSyntax)}`;

    if (paymentSuccess) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.successContainer}>
                    <View style={styles.successIconBox}>
                        <Ionicons name="checkmark-circle" size={72} color="#006b2c" />
                    </View>
                    <Text style={styles.successTitle}>Thanh Toán Cọc Thành Công!</Text>
                    <Text style={styles.successDesc}>
                        Hệ thống đã nhận diện chuyển khoản qua Webhook SePay Napas và tự động khóa sân thi đấu cho bạn.
                    </Text>

                    <View style={styles.successPassStub}>
                        <View style={styles.stubRow}>
                            <Text style={styles.stubLabel}>Mã đặt sân:</Text>
                            <Text style={styles.stubCode}>{codeStr}</Text>
                        </View>
                        <View style={styles.stubRow}>
                            <Text style={styles.stubLabel}>Sân bóng:</Text>
                            <Text style={styles.stubVal}>{field?.name || field?.field_name || 'Sân bóng'}</Text>
                        </View>
                        <View style={styles.stubRow}>
                            <Text style={styles.stubLabel}>Tiền cọc 50%:</Text>
                            <Text style={[styles.stubVal, { color: '#006b2c', fontWeight: '800' }]}>
                                {formatPrice(depositAmount)} VNĐ
                            </Text>
                        </View>
                        <View style={styles.stubRow}>
                            <Text style={styles.stubLabel}>Trạng thái:</Text>
                            <View style={styles.paidBadge}>
                                <Text style={styles.paidBadgeText}>ĐÃ XÁC NHẬN VÉ</Text>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.viewPassBtn}
                        onPress={() => navigation.navigate('Main', {
                            screen: 'LookupTab',
                            params: { bookingId: bookingId, bookingCode: codeStr }
                        })}
                        activeOpacity={0.9}
                    >
                        <Ionicons name="ticket-outline" size={20} color="#ffffff" />
                        <Text style={styles.viewPassBtnText}>Xem vé điện tử Check-in</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.backHomeBtn}
                        onPress={() => navigation.navigate('Main', { screen: 'Home' })}
                    >
                        <Text style={styles.backHomeBtnText}>Quay về Trang chủ</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* 1. TOP APP BAR */}
            <View style={styles.topBar}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => {
                        if (navigation.canGoBack()) navigation.goBack();
                        else navigation.navigate('Main');
                    }}
                >
                    <Ionicons name="chevron-back" size={22} color="#111827" />
                </TouchableOpacity>

                <Text style={styles.topBarTitle}>Xác Nhận Và Thanh Toán</Text>

                <TouchableOpacity
                    style={styles.topRightProfile}
                    onPress={() => navigation.navigate('ProfileTab')}
                >
                    <Ionicons name="person" size={16} color="#006b2c" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* 2. STATUS & EXPIRY BAR */}
                <View style={styles.statusBarRow}>
                    <View style={styles.statusWaitBadge}>
                        <View style={styles.pulsingWaitDot} />
                        <Text style={styles.statusWaitText}>CHỜ QUÉT MÃ CỌC 50%</Text>
                    </View>

                    <View style={styles.timerBadge}>
                        <Ionicons name="time-outline" size={15} color="#ba1a1a" />
                        <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
                    </View>
                </View>

                {/* 3. DIGITAL MATCH PASS (PERFORATED FOOTBALL TICKET) */}
                <View style={styles.digitalTicketCard}>
                    {/* Top Stub: Match Identity & Fixture */}
                    <View style={styles.ticketTopStub}>
                        <View style={styles.ticketBrandRow}>
                            <View style={styles.ticketBrandLeft}>
                                <View style={styles.soccerIconSmall}>
                                    <Ionicons name="football" size={18} color="#006b2c" />
                                </View>
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={styles.ticketBrandTitle}>SÂN BÓNG HẢI CHÂU</Text>
                                    <Text style={styles.ticketBrandSub}>Digital Match Pass</Text>
                                </View>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.ticketCodeLabel}>MÃ ĐẶT SÂN</Text>
                                <Text style={styles.ticketCodeValue}>{codeStr}</Text>
                            </View>
                        </View>

                        {/* Match Headline */}
                        <View style={styles.matchTypePill}>
                            <Text style={styles.matchTypePillText}>
                                {field?.field_type_name || 'Sân bóng 7 người chuẩn cỏ FIFA'}
                            </Text>
                        </View>

                        <Text style={styles.matchTitle}>
                            Giao hữu Sân 7 - {field?.name || field?.field_name || 'Sân Chuyên Việt'}
                        </Text>

                        <View style={styles.stadiumAddrRow}>
                            <Ionicons name="location-outline" size={15} color="#006b2c" />
                            <Text style={styles.stadiumAddrText} numberOfLines={1}>
                                {field?.address || field?.location || '220 Nguyễn Tri Phương, Q. Hải Châu'}
                            </Text>
                        </View>

                        {/* Match Time & Calendar Chips */}
                        <View style={styles.matchChipsGrid}>
                            <View style={styles.matchChipItem}>
                                <View style={styles.matchChipIcon}>
                                    <Ionicons name="calendar-outline" size={18} color="#006b2c" />
                                </View>
                                <View style={{ marginLeft: 8, flex: 1 }}>
                                    <Text style={styles.chipMetaLabel}>Ngày đá</Text>
                                    <Text style={styles.chipMetaVal} numberOfLines={1}>Hôm nay</Text>
                                </View>
                            </View>

                            <View style={styles.matchChipItem}>
                                <View style={styles.matchChipIcon}>
                                    <Ionicons name="time-outline" size={18} color="#006b2c" />
                                </View>
                                <View style={{ marginLeft: 8, flex: 1 }}>
                                    <Text style={styles.chipMetaLabel}>Khung giờ</Text>
                                    <Text style={[styles.chipMetaVal, { color: '#006b2c', fontWeight: '800' }]} numberOfLines={1}>
                                        17:30 - 19:00
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Perforated Divider with Cutout Notches */}
                    <View style={styles.perforationWrapper}>
                        <View style={styles.notchLeft} />
                        <View style={styles.dashedPerforatedLine} />
                        <View style={styles.notchRight} />
                    </View>

                    {/* Bottom Stub: VietQR Napas Instant Checkout */}
                    <View style={styles.ticketBottomStub}>
                        {/* Amount Highlight Card */}
                        <View style={styles.amountHighlightBox}>
                            <Text style={styles.amountLabel}>SỐ TIỀN ĐẶT CỌC CẦN THANH TOÁN</Text>
                            <View style={styles.amountDigitsRow}>
                                <Text style={styles.amountBigValue}>{formatPrice(depositAmount)}</Text>
                                <Text style={styles.amountUnit}> VNĐ</Text>
                            </View>
                            <View style={styles.amountBreakdownRow}>
                                <Text style={styles.amountBreakdownText}>
                                    Tổng sân: <Text style={{ color: '#111827', fontWeight: '700' }}>{formatPrice(totalAmount)}đ</Text>
                                </Text>
                                <Text style={styles.amountDot}>•</Text>
                                <Text style={styles.amountBreakdownText}>
                                    Tại quầy: <Text style={{ color: '#111827', fontWeight: '700' }}>{formatPrice(remainAmount)}đ</Text>
                                </Text>
                            </View>
                        </View>

                        {/* VietQR Presentation Module */}
                        <View style={styles.qrPresentationBox}>
                            <View style={styles.qrBadgesHeader}>
                                <View style={styles.qrBadgesLeft}>
                                    <View style={styles.vietqrTag}>
                                        <Text style={styles.vietqrTagText}>VietQR</Text>
                                    </View>
                                    <View style={styles.napasTag}>
                                        <Text style={styles.napasTagText}>NAPAS 247</Text>
                                    </View>
                                </View>
                                <View style={styles.qrStandardTag}>
                                    <View style={styles.greenMiniDot} />
                                    <Text style={styles.qrStandardText}>Chuẩn 24/7</Text>
                                </View>
                            </View>

                            {/* Dynamic QR Code Image */}
                            <View style={styles.qrCodeWrapper}>
                                <Image
                                    source={{ uri: qrUrl }}
                                    style={styles.qrCodeImage}
                                    resizeMode="contain"
                                />
                            </View>
                            <Text style={styles.qrInstructionText}>Mở App Ngân hàng hoặc Ví MoMo để quét</Text>
                        </View>

                        {/* Bank Transfer Details Cards */}
                        <View style={styles.bankCardsContainer}>
                            {/* Card 1: Account Number */}
                            <View style={styles.bankDetailCard}>
                                <View style={{ flex: 1, paddingRight: 8 }}>
                                    <Text style={styles.bankCardLabel}>Ngân hàng {bankName}</Text>
                                    <Text style={styles.bankCardNumber}>{bankAccountNo}</Text>
                                    <Text style={styles.bankCardOwner}>{accountName}</Text>
                                </View>

                                <TouchableOpacity
                                    style={styles.copyBtn}
                                    onPress={() => handleCopy(bankAccountNo, 'Đã sao chép số tài khoản!')}
                                >
                                    <Ionicons name="copy-outline" size={16} color="#006b2c" />
                                    <Text style={styles.copyBtnText}>Sao chép</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Card 2: Transfer Syntax */}
                            <View style={styles.bankDetailCard}>
                                <View style={{ flex: 1, paddingRight: 8 }}>
                                    <Text style={styles.bankCardLabel}>Nội dung chuyển khoản (bắt buộc)</Text>
                                    <Text style={styles.syntaxText}>{transferSyntax}</Text>
                                </View>

                                <TouchableOpacity
                                    style={styles.copyBtn}
                                    onPress={() => handleCopy(transferSyntax, 'Đã sao chép nội dung chuyển tiền!')}
                                >
                                    <Ionicons name="copy-outline" size={16} color="#006b2c" />
                                    <Text style={styles.copyBtnText}>Sao chép</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Automatic Webhook Notice */}
                        <View style={styles.webhookNoticeCard}>
                            <Ionicons name="flash" size={18} color="#1d4ed8" style={{ marginTop: 2 }} />
                            <Text style={styles.webhookNoticeText}>
                                Hệ thống tự động kích hoạt vé qua Webhook SePay sau <Text style={{ fontWeight: '700' }}>1 - 3 giây</Text> ngay khi ngân hàng nhận tiền.
                            </Text>
                        </View>

                        {/* Barcode Stub */}
                        <View style={styles.barcodeStubSection}>
                            <Text style={styles.barcodeLabel}>MÃ BARCODE CHECK-IN TẠI QUẦY</Text>
                            <View style={styles.barcodeGraphic}>
                                <View style={[styles.bar, { width: 3 }]} />
                                <View style={[styles.bar, { width: 1 }]} />
                                <View style={[styles.bar, { width: 4 }]} />
                                <View style={[styles.bar, { width: 2 }]} />
                                <View style={[styles.bar, { width: 1 }]} />
                                <View style={[styles.bar, { width: 5 }]} />
                                <View style={[styles.bar, { width: 2 }]} />
                                <View style={[styles.bar, { width: 3 }]} />
                                <View style={[styles.bar, { width: 1 }]} />
                                <View style={[styles.bar, { width: 4 }]} />
                                <View style={[styles.bar, { width: 2 }]} />
                                <View style={[styles.bar, { width: 5 }]} />
                                <View style={[styles.bar, { width: 1 }]} />
                                <View style={[styles.bar, { width: 3 }]} />
                            </View>
                            <Text style={styles.barcodeDigits}>* {codeStr} *</Text>
                        </View>
                    </View>
                </View>

                {/* 4. UTILITIES ACTION BUTTONS */}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={styles.confirmTransferBtn}
                        onPress={handleCheckPaymentNow}
                        disabled={checking}
                        activeOpacity={0.9}
                    >
                        {checking ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                                <Text style={styles.confirmTransferBtnText}>Tôi đã chuyển khoản xong</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <View style={styles.subActionsGrid}>
                        <TouchableOpacity
                            style={styles.subActionBtn}
                            onPress={() => Alert.alert('Apple Wallet', 'Đang kết nối tệp Digital Match Pass với Apple Wallet...')}
                        >
                            <Ionicons name="wallet-outline" size={18} color="#006b2c" />
                            <Text style={styles.subActionBtnText}>Apple Wallet</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.subActionBtn}
                            onPress={() => Alert.alert('Chia sẻ', `Đã tạo link vé: ${codeStr} để gửi cho đồng đội!`)}
                        >
                            <Ionicons name="share-social-outline" size={18} color="#006b2c" />
                            <Text style={styles.subActionBtnText}>Gửi đồng đội</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.openMapBtn}
                        onPress={openMaps}
                    >
                        <Ionicons name="navigate-outline" size={18} color="#6b7280" />
                        <Text style={styles.openMapBtnText}>Mở chỉ đường Google Maps đến sân</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f7f9fb',
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#f7f9fb',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6b7280',
    },
    // Top Bar
    topBar: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#eceef0',
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBarTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    topRightProfile: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#f0fdf4',
        borderWidth: 1.5,
        borderColor: '#dcfce7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 40,
    },
    // Status & Expiry Bar
    statusBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    statusWaitBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef3c7',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 9999,
        gap: 6,
    },
    pulsingWaitDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#b45309',
    },
    statusWaitText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#b45309',
        letterSpacing: 0.5,
    },
    timerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fee2e2',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 9999,
        gap: 4,
    },
    timerText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#ba1a1a',
    },
    // Digital Ticket Card
    digitalTicketCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
        elevation: 4,
    },
    ticketTopStub: {
        padding: 16,
        backgroundColor: '#f0fdf4',
    },
    ticketBrandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    ticketBrandLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    soccerIconSmall: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(0, 107, 44, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ticketBrandTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: '#006b2c',
        letterSpacing: 0.5,
    },
    ticketBrandSub: {
        fontSize: 11,
        color: '#6b7280',
    },
    ticketCodeLabel: {
        fontSize: 10,
        color: '#6b7280',
        fontWeight: '700',
    },
    ticketCodeValue: {
        fontSize: 13,
        fontWeight: '800',
        color: '#111827',
    },
    matchTypePill: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(0, 107, 44, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 9999,
        marginBottom: 6,
    },
    matchTypePillText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#006b2c',
    },
    matchTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        lineHeight: 24,
    },
    stadiumAddrRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    stadiumAddrText: {
        fontSize: 12,
        color: '#6b7280',
        flexShrink: 1,
    },
    matchChipsGrid: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 14,
    },
    matchChipItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 10,
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    matchChipIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#f0fdf4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipMetaLabel: {
        fontSize: 10,
        color: '#6b7280',
    },
    chipMetaVal: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
        marginTop: 1,
    },
    // Perforation
    perforationWrapper: {
        height: 24,
        backgroundColor: '#ffffff',
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    notchLeft: {
        position: 'absolute',
        left: -12,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#f7f9fb',
    },
    notchRight: {
        position: 'absolute',
        right: -12,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#f7f9fb',
    },
    dashedPerforatedLine: {
        flex: 1,
        marginHorizontal: 18,
        borderWidth: 1,
        borderColor: '#bdcaba',
        borderStyle: 'dashed',
    },
    // Bottom Stub
    ticketBottomStub: {
        padding: 16,
        backgroundColor: '#ffffff',
    },
    amountHighlightBox: {
        backgroundColor: '#f0fdf4',
        borderRadius: 14,
        padding: 14,
        alignItems: 'center',
        marginBottom: 16,
    },
    amountLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#055b35',
        letterSpacing: 0.6,
    },
    amountDigitsRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginTop: 4,
    },
    amountBigValue: {
        fontSize: 30,
        fontWeight: '900',
        color: '#006b2c',
        letterSpacing: -0.5,
    },
    amountUnit: {
        fontSize: 16,
        fontWeight: '800',
        color: '#006b2c',
    },
    amountBreakdownRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 8,
    },
    amountBreakdownText: {
        fontSize: 12,
        color: '#6b7280',
    },
    amountDot: {
        color: '#9ca3af',
    },
    // QR Presentation
    qrPresentationBox: {
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#eceef0',
        marginBottom: 16,
    },
    qrBadgesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    qrBadgesLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    vietqrTag: {
        backgroundColor: '#006b2c',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    vietqrTagText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#ffffff',
    },
    napasTag: {
        backgroundColor: '#004a99',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    napasTagText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#ffffff',
    },
    qrStandardTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    greenMiniDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#15803d',
    },
    qrStandardText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#15803d',
    },
    qrCodeWrapper: {
        width: 200,
        height: 200,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 6,
    },
    qrCodeImage: {
        width: '100%',
        height: '100%',
    },
    qrInstructionText: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 8,
    },
    // Bank Details Cards
    bankCardsContainer: {
        gap: 8,
        marginBottom: 12,
    },
    bankDetailCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f2f4f6',
        borderRadius: 12,
        padding: 12,
    },
    bankCardLabel: {
        fontSize: 11,
        color: '#6b7280',
    },
    bankCardNumber: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
        marginTop: 2,
        letterSpacing: 0.5,
    },
    bankCardOwner: {
        fontSize: 11,
        fontWeight: '700',
        color: '#055b35',
        marginTop: 1,
    },
    syntaxText: {
        fontSize: 15,
        fontWeight: '900',
        color: '#111827',
        marginTop: 2,
        letterSpacing: 0.8,
    },
    copyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 4,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    copyBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#006b2c',
    },
    webhookNoticeCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#dbeafe',
        borderRadius: 12,
        padding: 12,
        gap: 8,
        marginBottom: 16,
    },
    webhookNoticeText: {
        flex: 1,
        fontSize: 12,
        color: '#1d4ed8',
        lineHeight: 17,
    },
    // Barcode Stub
    barcodeStubSection: {
        alignItems: 'center',
        paddingTop: 8,
    },
    barcodeLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#6b7280',
        letterSpacing: 1.2,
    },
    barcodeGraphic: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 36,
        gap: 4,
        marginTop: 6,
    },
    bar: {
        height: '100%',
        backgroundColor: '#111827',
        borderRadius: 1,
    },
    barcodeDigits: {
        fontSize: 11,
        color: '#6b7280',
        letterSpacing: 2,
        marginTop: 4,
    },
    // Action Buttons
    actionsContainer: {
        marginTop: 18,
        gap: 10,
    },
    confirmTransferBtn: {
        height: 50,
        borderRadius: 14,
        backgroundColor: '#006b2c',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#006b2c',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 4,
    },
    confirmTransferBtnText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#ffffff',
    },
    subActionsGrid: {
        flexDirection: 'row',
        gap: 10,
    },
    subActionBtn: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    subActionBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    openMapBtn: {
        height: 44,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    openMapBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    // Success View
    successContainer: {
        flex: 1,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    successIconBox: {
        marginBottom: 16,
    },
    successTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#111827',
        textAlign: 'center',
    },
    successDesc: {
        fontSize: 13,
        color: '#6b7280',
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 19,
    },
    successPassStub: {
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginTop: 20,
        gap: 10,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
    },
    stubRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    stubLabel: {
        fontSize: 13,
        color: '#6b7280',
    },
    stubCode: {
        fontSize: 14,
        fontWeight: '800',
        color: '#111827',
    },
    stubVal: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
    },
    paidBadge: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
    },
    paidBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#15803d',
    },
    viewPassBtn: {
        width: '100%',
        height: 50,
        borderRadius: 14,
        backgroundColor: '#006b2c',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 20,
        shadowColor: '#006b2c',
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 3,
    },
    viewPassBtnText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#ffffff',
    },
    backHomeBtn: {
        marginTop: 12,
        padding: 10,
    },
    backHomeBtnText: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '600',
    },
});
