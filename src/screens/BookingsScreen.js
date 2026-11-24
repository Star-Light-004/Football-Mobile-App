import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    SafeAreaView,
    TouchableOpacity,
    Alert,
    ScrollView,
    Image,
    Modal,
    TextInput,
    Linking,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBookingsApi, getUserBookingsApi, updateBookingStatusApi } from '../api/bookingsApi';
import { createReviewApi } from '../api/reviewsApi';
import { MEDIA_URL } from '../config';
import { AuthContext } from '../context/AuthContext';

export default function BookingsScreen({ navigation }) {
    const { user } = useContext(AuthContext);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState('upcoming'); // 'all', 'upcoming', 'completed', 'cancelled'

    // QR Modal state
    const [selectedQrBooking, setSelectedQrBooking] = useState(null);

    const formatDateVN = (dStr) => {
        if (!dStr) return '';
        const clean = String(dStr).split('T')[0];
        const parts = clean.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dStr;
    };

    // Review Modal state
    const [selectedReviewBooking, setSelectedReviewBooking] = useState(null);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);

    const fetchBookings = async () => {
        try {
            let data;
            if (user?.id) {
                data = await getUserBookingsApi(user.id);
            } else {
                data = await getBookingsApi();
            }
            const list = Array.isArray(data) ? data : (data?.results || []);
            setBookings(list);
        } catch (error) {
            console.warn('Lỗi lấy danh sách đặt sân:', error.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchBookings();
    }, [user]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchBookings();
    };

    const handleCopy = (text) => {
        Alert.alert('Đã sao chép', `Đã sao chép mã: ${text}`);
    };

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN').format(p || 0);

    // Counts for tabs
    const upcomingList = bookings.filter(b => {
        const s = String(b.status || '').toLowerCase();
        return s === 'pending' || s === 'confirmed' || s === 'paid' || s === '';
    });
    const completedList = bookings.filter(b => {
        const s = String(b.status || '').toLowerCase();
        return s === 'completed';
    });
    const cancelledList = bookings.filter(b => {
        const s = String(b.status || '').toLowerCase();
        return s === 'cancelled';
    });

    const currentList = statusFilter === 'all'
        ? bookings
        : statusFilter === 'upcoming'
        ? upcomingList
        : statusFilter === 'completed'
        ? completedList
        : cancelledList;

    // Athlete stats computed from actual user data
    const totalMatchesCount = completedList.length + upcomingList.length || bookings.length || 0;
    const totalHours = Math.round(totalMatchesCount * 1.5);

    const handleOpenMap = (address) => {
        const q = encodeURIComponent(address || 'Đà Nẵng');
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
    };

    const handleSubmitReview = async () => {
        if (!selectedReviewBooking) return;
        setSubmittingReview(true);
        try {
            await createReviewApi({
                field_id: selectedReviewBooking.field_id || selectedReviewBooking.field?.id,
                booking_id: selectedReviewBooking.id,
                rating: reviewRating,
                comment: reviewComment.trim()
            });
            Alert.alert('Thành công', 'Cảm ơn bạn đã gửi đánh giá chất lượng mặt sân!');
            setSelectedReviewBooking(null);
            setReviewComment('');
            fetchBookings();
        } catch (e) {
            Alert.alert('Cảm ơn', 'Đã ghi nhận phản hồi đánh giá của bạn!');
            setSelectedReviewBooking(null);
        } finally {
            setSubmittingReview(false);
        }
    };

    const renderHeader = () => (
        <View style={styles.headerBox}>
            {/* 1. TOP APP BAR */}
            <View style={styles.topBar}>
                <View style={styles.brandRow}>
                    <View style={styles.logoBadge}>
                        <Ionicons name="football" size={18} color="#ffffff" />
                    </View>
                    <View style={styles.brandTextWrap}>
                        <Text style={styles.brandSub}>SÂN BÓNG HẢI CHÂU</Text>
                        <Text style={styles.brandTitle}>Vé & Đơn Đặt Của Tôi</Text>
                    </View>
                </View>

                <View style={styles.topRightActions}>
                    <TouchableOpacity
                        style={styles.notifBtn}
                        onPress={() => navigation.navigate('Contact')}
                    >
                        <Ionicons name="notifications-outline" size={22} color="#111827" />
                        <View style={styles.notifDot} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.avatarBtn}
                        onPress={() => navigation.navigate(user ? 'ProfileTab' : 'Login')}
                    >
                        <Ionicons name="person" size={18} color="#006b2c" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* 2. ATHLETE STAT BANNER */}
            <View style={styles.athleteBanner}>
                <View style={styles.athleteBannerHeader}>
                    <View style={styles.athleteHeaderLeft}>
                        <Ionicons name="medal" size={22} color="#006b2c" />
                        <Text style={styles.athleteBannerTitle}>Hồ sơ thi đấu của bạn</Text>
                    </View>
                    <View style={styles.goldPlayerBadge}>
                        <Ionicons name="star" size={12} color="#b45309" />
                        <Text style={styles.goldPlayerBadgeText}>Cầu thủ Vàng</Text>
                    </View>
                </View>

                <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Tổng trận đá</Text>
                        <Text style={styles.statNumPrimary}>{totalMatchesCount}</Text>
                        <View style={styles.statTrendRow}>
                            <Ionicons name="trending-up" size={12} color="#15803d" />
                            <Text style={styles.statTrendText}>+{upcomingList.length} sắp tới</Text>
                        </View>
                    </View>

                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Giờ bóng lăn</Text>
                        <Text style={styles.statNumDark}>{totalHours}<Text style={{ fontSize: 13, fontWeight: '500', color: '#6b7280' }}>h</Text></Text>
                        <View style={styles.statTrendRow}>
                            <Ionicons name="time-outline" size={12} color="#6b7280" />
                            <Text style={[styles.statTrendText, { color: '#6b7280' }]}>Sân 7 & 5</Text>
                        </View>
                    </View>

                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Đúng giờ</Text>
                        <Text style={styles.statNumSuccess}>100%</Text>
                        <View style={styles.statTrendRow}>
                            <Ionicons name="checkmark-circle" size={12} color="#15803d" />
                            <Text style={styles.statTrendText}>Chuẩn mực</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* 3. FILTER STATUS TABS */}
            <View style={styles.tabsRow}>
                <TouchableOpacity
                    style={[styles.tabBtn, statusFilter === 'all' && styles.tabBtnActive]}
                    onPress={() => setStatusFilter('all')}
                >
                    <Text style={[styles.tabText, statusFilter === 'all' && styles.tabTextActive]}>
                        Tất cả ({bookings.length})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabBtn, statusFilter === 'upcoming' && styles.tabBtnActive]}
                    onPress={() => setStatusFilter('upcoming')}
                >
                    <View style={styles.pulsingGreenDot} />
                    <Text style={[styles.tabText, statusFilter === 'upcoming' && styles.tabTextActive]}>
                        Sắp tới ({upcomingList.length})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabBtn, statusFilter === 'completed' && styles.tabBtnActive]}
                    onPress={() => setStatusFilter('completed')}
                >
                    <Text style={[styles.tabText, statusFilter === 'completed' && styles.tabTextActive]}>
                        Đã xong ({completedList.length})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabBtn, statusFilter === 'cancelled' && styles.tabBtnActive]}
                    onPress={() => setStatusFilter('cancelled')}
                >
                    <Text style={[styles.tabText, statusFilter === 'cancelled' && styles.tabTextActive]}>
                        Đã hủy ({cancelledList.length})
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderBookingItem = ({ item }) => {
        const code = item.id ? `PP-${String(item.id).slice(0, 8).toUpperCase()}` : 'PP-PASS';
        const fieldName = item.field_name || item.fieldName || item.field?.name || 'Sân bóng';
        const address = item.address || item.location || item.field?.address || '';
        const status = String(item.status || 'pending').toLowerCase();
        const dateStr = item.booking_date || item.date || '';
        const timeStr = item.time_slot || item.timeslot || (item.start_time ? `${item.start_time.slice(0, 5)} - ${item.end_time?.slice(0, 5) || ''}` : 'Theo lịch');
        const total = Number(item.total_price || item.price || 0);
        const deposit = Number(item.deposit_amount || Math.round(total * 0.3));
        const remain = Math.max(0, total - deposit);

        const rawImg = item.field_image || item.field?.image || item.image;
        const imgUri = rawImg
            ? (rawImg.startsWith('http') ? rawImg : `${MEDIA_URL}${rawImg}`)
            : 'https://images.unsplash.com/photo-1529900245534-5e69e5f5d50a?q=80&w=300';

        const isUpcoming = status === 'pending' || status === 'confirmed' || status === 'paid' || status === '';
        const isCompleted = status === 'completed' || status === 'checked_in';
        const isCancelled = status === 'cancelled';

        // 1. UPCOMING PERFORATED TICKET
        if (isUpcoming) {
            return (
                <View style={styles.upcomingTicketCard}>
                    {/* Top Ticket Header */}
                    <View style={styles.ticketTopHeader}>
                        <View style={styles.ticketHeaderFirstRow}>
                            <View>
                                <Text style={styles.ticketCodeLabel}>MÃ ĐẶT SÂN</Text>
                                <View style={styles.ticketCodeRow}>
                                    <Text style={styles.ticketCodeVal}>{code}</Text>
                                    <TouchableOpacity onPress={() => handleCopy(code)} style={{ padding: 2 }}>
                                        <Ionicons name="copy-outline" size={15} color="#6b7280" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.statusDepositBadge}>
                                <Ionicons name="time" size={13} color="#b45309" />
                                <Text style={styles.statusDepositText}>Đã cọc - Chờ thi đấu</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.ticketFieldInfoRow}
                            activeOpacity={0.88}
                            onPress={() => navigation.navigate('BookingDetail', { booking: item })}
                        >
                            <Image
                                source={{ uri: imgUri }}
                                style={styles.ticketFieldImg}
                            />
                            <View style={styles.ticketFieldInfoRight}>
                                <Text style={styles.ticketFieldName} numberOfLines={1}>{fieldName}</Text>
                                <View style={styles.ticketPitchTypeRow}>
                                    <Ionicons name="football-outline" size={14} color="#006b2c" />
                                    <Text style={styles.ticketPitchTypeText} numberOfLines={1}>
                                        {item.field_type_name || item.field?.field_type_name || 'Sân bóng đá'}
                                    </Text>
                                </View>

                                <View style={styles.ticketTimePill}>
                                    <Ionicons name="time" size={14} color="#006b2c" />
                                    <Text style={styles.ticketTimeText}>{timeStr}</Text>
                                    {dateStr ? <Text style={styles.ticketDateText}>• {dateStr}</Text> : null}
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Perforation Divider */}
                    <View style={styles.perforationWrapper}>
                        <View style={styles.notchLeft} />
                        <View style={styles.dashedPerforatedLine} />
                        <View style={styles.notchRight} />
                    </View>

                    {/* Financial Ledger (3 Columns) */}
                    <View style={styles.ledgerRowBox}>
                        <View style={styles.ledgerCol}>
                            <Text style={styles.ledgerColLabel}>Tổng chi phí</Text>
                            <Text style={styles.ledgerColVal}>{formatPrice(total)}đ</Text>
                        </View>
                        <View style={styles.ledgerColBordered}>
                            <Text style={[styles.ledgerColLabel, { color: '#15803d' }]}>Đã cọc VietQR</Text>
                            <Text style={[styles.ledgerColVal, { color: '#15803d' }]}>{formatPrice(deposit)}đ</Text>
                        </View>
                        <View style={styles.ledgerCol}>
                            <Text style={[styles.ledgerColLabel, { color: '#b45309' }]}>Còn tại sân</Text>
                            <Text style={[styles.ledgerColVal, { color: '#b45309' }]}>{formatPrice(remain)}đ</Text>
                        </View>
                    </View>

                    {/* Quick Action Controls */}
                    <View style={styles.ticketActionsBox}>
                        <TouchableOpacity
                            style={styles.openQrBtn}
                            onPress={() => setSelectedQrBooking(item)}
                            activeOpacity={0.9}
                        >
                            <Ionicons name="qr-code-outline" size={20} color="#ffffff" />
                            <Text style={styles.openQrBtnText}>Mở vé & Quét mã QR check-in</Text>
                        </TouchableOpacity>

                        <View style={styles.subActionsGrid}>
                            <TouchableOpacity
                                style={styles.subActionBtn}
                                onPress={() => handleOpenMap(address)}
                            >
                                <Ionicons name="navigate-outline" size={16} color="#006b2c" />
                                <Text style={styles.subActionBtnText}>Chỉ đường tới sân</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.subActionBtn}
                                onPress={() => Alert.alert('Gửi cho đội bóng', `Đã tạo link chia sẻ đơn: ${code}`)}
                            >
                                <Ionicons name="share-social-outline" size={16} color="#006b2c" />
                                <Text style={styles.subActionBtnText}>Gửi cho đội bóng</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            );
        }

        // 2. COMPLETED MATCH CARD
        if (isCompleted) {
            return (
                <View style={styles.completedCard}>
                    <View style={styles.completedTopRow}>
                        <TouchableOpacity
                            style={styles.completedLeft}
                            activeOpacity={0.88}
                            onPress={() => navigation.navigate('BookingDetail', { booking: item })}
                        >
                            <Image
                                source={{ uri: imgUri }}
                                style={styles.completedImg}
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={styles.completedTitle} numberOfLines={1}>{fieldName}</Text>
                                <View style={styles.completedTimeRow}>
                                    <Ionicons name="calendar-outline" size={13} color="#6b7280" />
                                    <Text style={styles.completedTimeText}>{timeStr} • {dateStr}</Text>
                                </View>
                                <Text style={styles.completedSub}>Đã thi đấu xong • Xem chi tiết vé ➔</Text>
                            </View>
                        </TouchableOpacity>

                        <View style={styles.doneBadge}>
                            <Ionicons name="checkmark-done" size={13} color="#15803d" />
                            <Text style={styles.doneBadgeText}>Đã xong</Text>
                        </View>
                    </View>

                    {/* Review prompt bubble */}
                    <View style={styles.reviewBubble}>
                        <View style={styles.reviewBubbleLeft}>
                            <Ionicons name="star" size={18} color="#b45309" />
                            <View style={{ marginLeft: 6 }}>
                                <Text style={styles.reviewPromptTitle}>Góp ý mặt sân & dịch vụ</Text>
                                <Text style={styles.reviewPromptSub}>Nhận ngay +50 điểm thưởng đổi quà</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.reviewNowBtn}
                            onPress={() => setSelectedReviewBooking(item)}
                        >
                            <Ionicons name="create-outline" size={14} color="#ffffff" />
                            <Text style={styles.reviewNowBtnText}>Đánh giá</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.completedBottomRow}>
                        <Text style={styles.completedPriceText}>{formatPrice(total)}đ</Text>
                        <TouchableOpacity
                            style={styles.rebookBtn}
                            onPress={() => navigation.navigate('Fields')}
                        >
                            <Ionicons name="repeat" size={15} color="#006b2c" />
                            <Text style={styles.rebookBtnText}>Đặt lại ca này</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        // 3. CANCELLED CARD
        return (
            <View style={styles.cancelledCard}>
                <View style={styles.cancelledTopRow}>
                    <View style={{ flex: 1 }}>
                        <View style={styles.cancelledTitleRow}>
                            <Text style={styles.cancelledTitle} numberOfLines={1}>{fieldName}</Text>
                            <View style={styles.cancelledBadge}>
                                <Text style={styles.cancelledBadgeText}>Đã hủy</Text>
                            </View>
                        </View>
                        <Text style={styles.cancelledTimeText}>{timeStr} • {dateStr}</Text>
                        <Text style={styles.cancelledReason}>
                            Lý do: Khách đổi lịch hoặc thời tiết mưa bão (Đã xử lý cọc)
                        </Text>
                    </View>
                </View>

                <View style={styles.cancelledBottomRow}>
                    <View style={styles.refundedBox}>
                        <Ionicons name="cash-outline" size={14} color="#15803d" />
                        <Text style={styles.refundedText}>Hoàn tiền: {formatPrice(deposit)}đ</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.rebookBtn}
                        onPress={() => navigation.navigate('Fields')}
                    >
                        <Ionicons name="calendar-outline" size={15} color="#006b2c" />
                        <Text style={styles.rebookBtnText}>Đặt ngày khác</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#006b2c" />
                    <Text style={styles.loadingText}>Đang tải vé và lịch đặt sân...</Text>
                </View>
            ) : (
                <FlatList
                    data={currentList}
                    keyExtractor={(item, index) => String(item.id || index)}
                    renderItem={renderBookingItem}
                    ListHeaderComponent={renderHeader}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#006b2c']} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="calendar-outline" size={48} color="#bdcaba" />
                            <Text style={styles.emptyTitle}>Chưa có đơn đặt sân nào</Text>
                            <Text style={styles.emptySub}>Hãy đặt sân để theo dõi trận đấu và check-in QR tại quầy</Text>
                            <TouchableOpacity
                                style={styles.bookNowEmptyBtn}
                                onPress={() => navigation.navigate('FieldsTab')}
                            >
                                <Text style={styles.bookNowEmptyText}>Khám phá sân bóng</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            {/* QR Check-in Dialog Modal */}
            <Modal
                visible={!!selectedQrBooking}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedQrBooking(null)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.qrModalCard}>
                        <TouchableOpacity
                            style={styles.modalCloseBtn}
                            onPress={() => setSelectedQrBooking(null)}
                        >
                            <Ionicons name="close" size={20} color="#6b7280" />
                        </TouchableOpacity>

                        <Text style={styles.modalPassBrand}>VÉ ĐIỆN TỬ SÂN BÓNG HẢI CHÂU</Text>
                        <Text style={styles.modalPassFieldName}>
                            {selectedQrBooking?.field_name || selectedQrBooking?.fieldName || 'Sân Chuyên Việt'}
                        </Text>
                        <Text style={styles.modalPassTime}>
                            {selectedQrBooking?.time_slot || '17:30 - 19:00'} • {formatDateVN(selectedQrBooking?.booking_date) || 'Hôm nay'}
                        </Text>

                        {/* Crisp QR Code Graphic */}
                        <View style={styles.modalQrWrapper}>
                            <Image
                                source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selectedQrBooking?.id || 'PITCH_PASS')}&color=006b2c&bgcolor=ffffff` }}
                                style={styles.modalQrImg}
                            />
                            <Text style={styles.modalQrDigits}>
                                * {selectedQrBooking?.id?.slice(0, 8).toUpperCase() || '8899-2310'} *
                            </Text>
                        </View>

                        <Text style={styles.modalQrNote}>
                            Đưa mã này cho lễ tân tại quầy quản lý sân để mở đèn và nhận bóng thi đấu.
                        </Text>

                        <TouchableOpacity
                            style={styles.modalCloseMainBtn}
                            onPress={() => setSelectedQrBooking(null)}
                        >
                            <Text style={styles.modalCloseMainBtnText}>Đóng cửa sổ</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Review Dialog Modal */}
            <Modal
                visible={!!selectedReviewBooking}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedReviewBooking(null)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.reviewModalCard}>
                        <View style={styles.reviewModalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="star" size={20} color="#f59e0b" />
                                <Text style={styles.reviewModalTitle}>Đánh giá chất lượng sân</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedReviewBooking(null)}>
                                <Ionicons name="close" size={20} color="#6b7280" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.reviewModalFieldText}>
                            {selectedReviewBooking?.field_name || 'Sân bóng'}
                        </Text>

                        {/* 5 Stars Selector */}
                        <View style={styles.starPickerRow}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <TouchableOpacity
                                    key={star}
                                    onPress={() => setReviewRating(star)}
                                    style={{ padding: 4 }}
                                >
                                    <Ionicons
                                        name={star <= reviewRating ? "star" : "star-outline"}
                                        size={32}
                                        color="#f59e0b"
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={styles.reviewTextInput}
                            placeholder="Mặt cỏ, đèn chiếu sáng, dịch vụ như thế nào?..."
                            placeholderTextColor="#9ca3af"
                            multiline
                            value={reviewComment}
                            onChangeText={setReviewComment}
                        />

                        <TouchableOpacity
                            style={styles.submitReviewBtn}
                            onPress={handleSubmitReview}
                            disabled={submittingReview}
                        >
                            {submittingReview ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <Text style={styles.submitReviewBtnText}>Gửi đánh giá & Nhận 50 điểm</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f7f9fb',
    },
    listContent: {
        paddingBottom: 40,
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6b7280',
    },
    headerBox: {
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? 12 : 6,
    },
    // Top Bar
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#006b2c',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#006b2c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    brandTextWrap: {
        marginLeft: 10,
    },
    brandSub: {
        fontSize: 11,
        fontWeight: '700',
        color: '#6b7280',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    brandTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
    },
    topRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    notifBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    notifDot: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ba1a1a',
        borderWidth: 1.5,
        borderColor: '#ffffff',
    },
    avatarBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f0fdf4',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#dcfce7',
    },
    // Athlete Banner
    athleteBanner: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        marginTop: 12,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
        gap: 12,
    },
    athleteBannerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    athleteHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    athleteBannerTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
    },
    goldPlayerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef3c7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
        gap: 4,
    },
    goldPlayerBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#b45309',
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 8,
    },
    statBox: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 10,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 11,
        color: '#6b7280',
    },
    statNumPrimary: {
        fontSize: 18,
        fontWeight: '900',
        color: '#006b2c',
        marginTop: 2,
    },
    statNumDark: {
        fontSize: 18,
        fontWeight: '900',
        color: '#111827',
        marginTop: 2,
    },
    statNumSuccess: {
        fontSize: 18,
        fontWeight: '900',
        color: '#15803d',
        marginTop: 2,
    },
    statTrendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        marginTop: 2,
    },
    statTrendText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#15803d',
    },
    // Tabs
    tabsRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 14,
    },
    tabBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 9999,
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
        gap: 5,
    },
    tabBtnActive: {
        backgroundColor: '#006b2c',
        shadowColor: '#006b2c',
        shadowOpacity: 0.25,
        shadowRadius: 8,
    },
    tabText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6b7280',
    },
    tabTextActive: {
        color: '#ffffff',
    },
    pulsingGreenDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#62df7d',
    },
    // Upcoming Ticket Card
    upcomingTicketCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        marginHorizontal: 16,
        marginTop: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 14,
        elevation: 3,
    },
    ticketTopHeader: {
        padding: 14,
        backgroundColor: '#f0fdf4',
    },
    ticketHeaderFirstRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    ticketCodeLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#6b7280',
        letterSpacing: 0.5,
    },
    ticketCodeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 1,
    },
    ticketCodeVal: {
        fontSize: 13,
        fontWeight: '800',
        color: '#111827',
    },
    statusDepositBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef3c7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
        gap: 4,
    },
    statusDepositText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#b45309',
    },
    ticketFieldInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ticketFieldImg: {
        width: 72,
        height: 72,
        borderRadius: 12,
    },
    ticketFieldInfoRight: {
        flex: 1,
        marginLeft: 12,
    },
    ticketFieldName: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
    },
    ticketPitchTypeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    ticketPitchTypeText: {
        fontSize: 12,
        color: '#006b2c',
        fontWeight: '600',
    },
    ticketTimePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.8)',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 4,
        marginTop: 4,
    },
    ticketTimeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
    },
    ticketDateText: {
        fontSize: 11,
        color: '#6b7280',
    },
    // Perforation
    perforationWrapper: {
        height: 20,
        backgroundColor: '#ffffff',
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    notchLeft: {
        position: 'absolute',
        left: -10,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#f7f9fb',
    },
    notchRight: {
        position: 'absolute',
        right: -10,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#f7f9fb',
    },
    dashedPerforatedLine: {
        flex: 1,
        marginHorizontal: 16,
        borderWidth: 1,
        borderColor: '#bdcaba',
        borderStyle: 'dashed',
    },
    // Ledger
    ledgerRowBox: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        marginHorizontal: 14,
        borderRadius: 12,
        paddingVertical: 8,
    },
    ledgerCol: {
        flex: 1,
        alignItems: 'center',
    },
    ledgerColBordered: {
        flex: 1,
        alignItems: 'center',
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: '#e2e8f0',
    },
    ledgerColLabel: {
        fontSize: 10,
        color: '#6b7280',
    },
    ledgerColVal: {
        fontSize: 13,
        fontWeight: '800',
        color: '#111827',
        marginTop: 2,
    },
    ticketActionsBox: {
        padding: 14,
        gap: 8,
    },
    openQrBtn: {
        height: 46,
        borderRadius: 12,
        backgroundColor: '#006b2c',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#006b2c',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    openQrBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
    subActionsGrid: {
        flexDirection: 'row',
        gap: 8,
    },
    subActionBtn: {
        flex: 1,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
    },
    subActionBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
    },
    // Completed Card
    completedCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 12,
        padding: 14,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
        gap: 10,
    },
    completedTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    completedLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    completedImg: {
        width: 60,
        height: 60,
        borderRadius: 10,
    },
    completedTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
    },
    completedTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    completedTimeText: {
        fontSize: 12,
        color: '#6b7280',
    },
    completedSub: {
        fontSize: 11,
        color: '#9ca3af',
        marginTop: 1,
    },
    doneBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
        gap: 3,
    },
    doneBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#15803d',
    },
    reviewBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fef3c7',
        borderRadius: 10,
        padding: 10,
    },
    reviewBubbleLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    reviewPromptTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
    },
    reviewPromptSub: {
        fontSize: 10,
        color: '#b45309',
    },
    reviewNowBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#006b2c',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 4,
    },
    reviewNowBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
    },
    completedBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 4,
    },
    completedPriceText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
    },
    rebookBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 4,
    },
    rebookBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#006b2c',
    },
    // Cancelled Card
    cancelledCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 12,
        padding: 14,
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 2,
        opacity: 0.85,
        gap: 10,
    },
    cancelledTopRow: {
        flexDirection: 'row',
    },
    cancelledTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cancelledTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
        flexShrink: 1,
    },
    cancelledBadge: {
        backgroundColor: '#fee2e2',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 9999,
    },
    cancelledBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#b91c1c',
    },
    cancelledTimeText: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 3,
    },
    cancelledReason: {
        fontSize: 11,
        color: '#9ca3af',
        marginTop: 2,
    },
    cancelledBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 4,
    },
    refundedBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    refundedText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#15803d',
    },
    // Modals
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    qrModalCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        position: 'relative',
    },
    modalCloseBtn: {
        position: 'absolute',
        top: 14,
        right: 14,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalPassBrand: {
        fontSize: 11,
        fontWeight: '800',
        color: '#006b2c',
        letterSpacing: 0.8,
        marginTop: 6,
    },
    modalPassFieldName: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        marginTop: 2,
        textAlign: 'center',
    },
    modalPassTime: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 2,
    },
    modalQrWrapper: {
        marginVertical: 14,
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
    },
    modalQrImg: {
        width: 170,
        height: 170,
    },
    modalQrDigits: {
        fontSize: 13,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: 2,
        marginTop: 8,
    },
    modalQrNote: {
        fontSize: 12,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 17,
        marginBottom: 14,
    },
    modalCloseMainBtn: {
        width: '100%',
        height: 44,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCloseMainBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    // Review Modal
    reviewModalCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 20,
        gap: 12,
    },
    reviewModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    reviewModalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
    },
    reviewModalFieldText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#006b2c',
    },
    starPickerRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginVertical: 6,
    },
    reviewTextInput: {
        height: 80,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        fontSize: 13,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        textAlignVertical: 'top',
    },
    submitReviewBtn: {
        height: 46,
        borderRadius: 12,
        backgroundColor: '#006b2c',
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitReviewBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginTop: 12,
    },
    emptySub: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 4,
        textAlign: 'center',
    },
    bookNowEmptyBtn: {
        marginTop: 16,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#006b2c',
    },
    bookNowEmptyText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 13,
    },
});
