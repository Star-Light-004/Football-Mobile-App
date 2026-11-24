import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Image,
    TextInput,
    SafeAreaView,
    Linking,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { updateBookingStatusApi, cancelBookingApi } from '../api/bookingsApi';
import { getBookingServicesApi } from '../api/servicesApi';
import { createReviewApi } from '../api/reviewsApi';

export default function BookingDetailScreen({ route, navigation }) {
    const { booking } = route.params || {};
    const { user } = useContext(AuthContext);

    const [services, setServices] = useState([]);
    const [loadingServices, setLoadingServices] = useState(false);
    const [currentStatus, setCurrentStatus] = useState(booking?.status || 'confirmed');

    // Review form after match
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);
    const [reviewSubmitted, setReviewSubmitted] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => {
        const fetchServices = async () => {
            if (booking?.id) {
                setLoadingServices(true);
                try {
                    const data = await getBookingServicesApi(booking.id);
                    setServices(Array.isArray(data) ? data : []);
                } catch (e) {
                    console.warn('Lỗi lấy dịch vụ:', e);
                } finally {
                    setLoadingServices(false);
                }
            }
        };
        fetchServices();
    }, [booking?.id]);

    if (!booking) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <Ionicons name="alert-circle-outline" size={48} color="#ba1a1a" />
                <Text style={styles.emptyText}>Không tìm thấy thông tin đơn đặt sân</Text>
                <TouchableOpacity style={styles.backBtnAction} onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate('Bookings'); }}>
                    <Text style={styles.backBtnText}>Quay lại</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const handleCancelBooking = () => {
        const doCancel = async () => {
            setCancelling(true);
            try {
                await cancelBookingApi(booking.id, 'Khách hủy trên app');
                setCurrentStatus('cancelled');
                Alert.alert('Thành công', 'Đơn đặt sân đã được hủy.');
            } catch (e) {
                Alert.alert('Lỗi', e.response?.data?.error || 'Không thể hủy đơn lúc này.');
            } finally {
                setCancelling(false);
            }
        };

        Alert.alert(
            'Xác nhận hủy đặt sân',
            'Bạn có chắc chắn muốn hủy đơn đặt sân này không? Tiền cọc sẽ được xử lý theo chính sách hoàn cọc của sân.',
            [
                { text: 'Không', style: 'cancel' },
                {
                    text: 'Đồng ý hủy',
                    style: 'destructive',
                    onPress: doCancel,
                },
            ]
        );
    };

    const handleSendReview = async () => {
        setSubmittingReview(true);
        try {
            await createReviewApi({
                field_id: booking.field_id || booking.field?.id,
                booking_id: booking.id,
                rating,
                comment: comment.trim(),
            });
            setReviewSubmitted(true);
            Alert.alert('Thành công', 'Cảm ơn bạn đã đánh giá chất lượng sân!');
        } catch (e) {
            Alert.alert('Cảm ơn', 'Đã ghi nhận đánh giá của bạn!');
            setReviewSubmitted(true);
        } finally {
            setSubmittingReview(false);
        }
    };

    const openMap = () => {
        const query = encodeURIComponent(booking.address || booking.field_name || 'Đà Nẵng');
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    };

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN').format(p || 0);

    const codeStr = booking.id ? `PP-${String(booking.id).slice(0, 8).toUpperCase()}` : 'PP-PASS';
    const fieldName = booking.field_name || booking.fieldName || booking.field?.name || 'Sân bóng';
    const address = booking.address || booking.location || booking.field?.address || '';
    const dateStr = booking.booking_date || booking.date || '';
    const timeStr = booking.time_slot || booking.timeslot || (booking.start_time ? `${booking.start_time.slice(0, 5)} - ${booking.end_time?.slice(0, 5) || ''}` : 'Theo ca');
    const total = Number(booking.total_price || booking.price || 0);
    const deposit = Number(booking.deposit_amount || Math.round(total * 0.3));
    const remain = Math.max(0, total - deposit);

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(booking.id || 'PITCH_PASS')}&color=006b2c&bgcolor=ffffff`;

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Top Bar */}
            <View style={styles.topBar}>
                <TouchableOpacity
                    style={styles.circleBtn}
                    onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate('Bookings'); }}
                >
                    <Ionicons name="chevron-back" size={22} color="#111827" />
                </TouchableOpacity>

                <Text style={styles.topBarTitle}>Chi Tiết Vé Trận Đấu</Text>

                <TouchableOpacity
                    style={styles.circleBtn}
                    onPress={() => Alert.alert('Chia sẻ', `Mã vé: ${codeStr}`)}
                >
                    <Ionicons name="share-social-outline" size={20} color="#111827" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Digital Match Pass Card */}
                <View style={styles.ticketCard}>
                    {/* Top Section */}
                    <View style={styles.ticketTopSection}>
                        <View style={styles.ticketBrandRow}>
                            <View style={styles.brandBadge}>
                                <Ionicons name="football" size={16} color="#006b2c" />
                                <Text style={styles.brandTitle}>SÂN BÓNG HẢI CHÂU</Text>
                            </View>
                            <View style={styles.statusCodeBadge}>
                                <Text style={styles.statusCodeText}>{codeStr}</Text>
                            </View>
                        </View>

                        <Text style={styles.matchTypePill}>{booking.field_type_name || booking.field?.field_type_name || 'Sân bóng đá tiêu chuẩn'}</Text>
                        <Text style={styles.stadiumNameText}>{fieldName}</Text>
                        <View style={styles.addressRow}>
                            <Ionicons name="location" size={14} color="#006b2c" />
                            <Text style={styles.addressText} numberOfLines={1}>{address}</Text>
                        </View>

                        {/* Fixture Schedule */}
                        <View style={styles.fixtureGrid}>
                            <View style={styles.fixtureBox}>
                                <Ionicons name="calendar-outline" size={16} color="#006b2c" />
                                <View style={{ marginLeft: 6 }}>
                                    <Text style={styles.fixtureLabel}>Ngày đá</Text>
                                    <Text style={styles.fixtureVal}>{dateStr}</Text>
                                </View>
                            </View>
                            <View style={styles.fixtureBox}>
                                <Ionicons name="time-outline" size={16} color="#006b2c" />
                                <View style={{ marginLeft: 6 }}>
                                    <Text style={styles.fixtureLabel}>Khung giờ</Text>
                                    <Text style={[styles.fixtureVal, { color: '#006b2c', fontWeight: '800' }]}>{timeStr}</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Perforation Divider */}
                    <View style={styles.perforationWrapper}>
                        <View style={styles.notchLeft} />
                        <View style={styles.dashedPerforatedLine} />
                        <View style={styles.notchRight} />
                    </View>

                    {/* Bottom Section */}
                    <View style={styles.ticketBottomSection}>
                        {/* QR Code Presentation */}
                        <View style={styles.qrContainer}>
                            <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
                            <Text style={styles.qrBarcodeText}>* {codeStr} *</Text>
                            <Text style={styles.qrSubText}>Đưa mã QR cho lễ tân tại quầy để check-in mở đèn</Text>
                        </View>

                        {/* Financial Ledger */}
                        <View style={styles.ledgerCard}>
                            <View style={styles.ledgerRow}>
                                <Text style={styles.ledgerLabel}>Tổng tiền thuê sân:</Text>
                                <Text style={styles.ledgerVal}>{formatPrice(total)}đ</Text>
                            </View>
                            <View style={styles.ledgerRow}>
                                <Text style={[styles.ledgerLabel, { color: '#15803d' }]}>Đã cọc 50% (VietQR):</Text>
                                <Text style={[styles.ledgerVal, { color: '#15803d' }]}>{formatPrice(deposit)}đ</Text>
                            </View>
                            <View style={[styles.ledgerRow, { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 6 }]}>
                                <Text style={[styles.ledgerLabel, { fontWeight: '700', color: '#111827' }]}>Còn lại tại sân:</Text>
                                <Text style={[styles.ledgerVal, { color: '#b45309', fontWeight: '900', fontSize: 16 }]}>
                                    {formatPrice(remain)}đ
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Navigation Button */}
                <TouchableOpacity style={styles.openMapBtn} onPress={openMap}>
                    <Ionicons name="navigate-outline" size={18} color="#006b2c" />
                    <Text style={styles.openMapBtnText}>Mở chỉ đường Google Maps đến sân</Text>
                </TouchableOpacity>

                {/* Cancel Booking Action */}
                {currentStatus !== 'cancelled' && currentStatus !== 'completed' && (
                    <TouchableOpacity
                        style={styles.cancelBookingBtn}
                        onPress={handleCancelBooking}
                        disabled={cancelling}
                    >
                        {cancelling ? (
                            <ActivityIndicator size="small" color="#dc2626" />
                        ) : (
                            <>
                                <Ionicons name="close-circle-outline" size={18} color="#dc2626" />
                                <Text style={styles.cancelBookingBtnText}>Yêu cầu hủy sân & Hoàn cọc</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {/* Review Section */}
                {currentStatus === 'completed' && !reviewSubmitted && (
                    <View style={styles.reviewSectionCard}>
                        <View style={styles.reviewHeader}>
                            <Ionicons name="star" size={20} color="#f59e0b" />
                            <Text style={styles.reviewSectionTitle}>Đánh giá chất lượng trận đấu</Text>
                        </View>
                        <View style={styles.starRow}>
                            {[1, 2, 3, 4, 5].map(s => (
                                <TouchableOpacity key={s} onPress={() => setRating(s)} style={{ padding: 4 }}>
                                    <Ionicons name={s <= rating ? "star" : "star-outline"} size={28} color="#f59e0b" />
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TextInput
                            style={styles.reviewInput}
                            placeholder="Mặt cỏ, đèn chiếu sáng, thái độ phục vụ..."
                            placeholderTextColor="#9ca3af"
                            multiline
                            value={comment}
                            onChangeText={setComment}
                        />
                        <TouchableOpacity
                            style={styles.submitReviewBtn}
                            onPress={handleSendReview}
                            disabled={submittingReview}
                        >
                            {submittingReview ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <Text style={styles.submitReviewBtnText}>Gửi đánh giá (+50 điểm)</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
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
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ba1a1a',
        marginTop: 12,
    },
    backBtnAction: {
        marginTop: 14,
        paddingHorizontal: 18,
        paddingVertical: 10,
        backgroundColor: '#006b2c',
        borderRadius: 10,
    },
    backBtnText: {
        color: '#ffffff',
        fontWeight: '700',
    },
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
    circleBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBarTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
        gap: 12,
    },
    ticketCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
    },
    ticketTopSection: {
        padding: 16,
        backgroundColor: '#f0fdf4',
    },
    ticketBrandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    brandBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    brandTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: '#006b2c',
        letterSpacing: 0.8,
    },
    statusCodeBadge: {
        backgroundColor: '#ffffff',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    statusCodeText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#111827',
    },
    matchTypePill: {
        fontSize: 11,
        fontWeight: '700',
        color: '#006b2c',
        backgroundColor: 'rgba(0, 107, 44, 0.1)',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
        marginBottom: 6,
    },
    stadiumNameText: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    addressText: {
        fontSize: 12,
        color: '#6b7280',
        flex: 1,
    },
    fixtureGrid: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
    },
    fixtureBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 10,
        padding: 8,
    },
    fixtureLabel: {
        fontSize: 10,
        color: '#6b7280',
    },
    fixtureVal: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
        marginTop: 1,
    },
    perforationWrapper: {
        height: 22,
        backgroundColor: '#ffffff',
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    notchLeft: {
        position: 'absolute',
        left: -11,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#f7f9fb',
    },
    notchRight: {
        position: 'absolute',
        right: -11,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#f7f9fb',
    },
    dashedPerforatedLine: {
        flex: 1,
        marginHorizontal: 16,
        borderWidth: 1,
        borderColor: '#bdcaba',
        borderStyle: 'dashed',
    },
    ticketBottomSection: {
        padding: 16,
        alignItems: 'center',
        gap: 14,
    },
    qrContainer: {
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    qrImage: {
        width: 170,
        height: 170,
    },
    qrBarcodeText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: 2,
        marginTop: 6,
    },
    qrSubText: {
        fontSize: 11,
        color: '#6b7280',
        textAlign: 'center',
        marginTop: 4,
    },
    ledgerCard: {
        width: '100%',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        gap: 6,
    },
    ledgerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    ledgerLabel: {
        fontSize: 12,
        color: '#6b7280',
    },
    ledgerVal: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    openMapBtn: {
        height: 46,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    openMapBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#006b2c',
    },
    cancelBookingBtn: {
        height: 44,
        borderRadius: 12,
        backgroundColor: '#fee2e2',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    cancelBookingBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#dc2626',
    },
    reviewSectionCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        gap: 10,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    reviewSectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#111827',
    },
    starRow: {
        flexDirection: 'row',
        gap: 4,
    },
    reviewInput: {
        height: 70,
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 10,
        fontSize: 13,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        textAlignVertical: 'top',
    },
    submitReviewBtn: {
        height: 42,
        borderRadius: 10,
        backgroundColor: '#006b2c',
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitReviewBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },
});
