import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Image,
    SafeAreaView,
    Linking,
    Modal,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { lookupBookingApi } from '../api/bookingsApi';
import { createReviewApi } from '../api/reviewsApi';
import { MEDIA_URL } from '../config';

export default function LookupScreen({ route, navigation }) {
    const initialQuery = route?.params?.bookingCode || route?.params?.bookingId || route?.params?.phone || '';
    const [query, setQuery] = useState(initialQuery);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);

    // Review Modal State
    const [selectedReviewBooking, setSelectedReviewBooking] = useState(null);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);

    useEffect(() => {
        if (route?.params?.bookingCode || route?.params?.bookingId || route?.params?.phone) {
            const target = route?.params?.bookingCode || route?.params?.bookingId || route?.params?.phone;
            setQuery(target);
            handleLookup(target);
        }
    }, [route?.params]);

    const handleLookup = async (lookupQuery) => {
        const target = (lookupQuery !== undefined ? lookupQuery : query).trim();
        if (!target) {
            Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại hoặc mã vé đặt sân.');
            return;
        }

        setLoading(true);
        setHasSearched(true);
        try {
            const data = await lookupBookingApi(target);
            const list = Array.isArray(data) ? data : (data.bookings || (data.id ? [data] : []));
            setResults(list);
            if (list.length === 0) {
                Alert.alert('Không tìm thấy', 'Không có đơn đặt sân nào khớp với số điện thoại hoặc mã vé này.');
            }
        } catch (err) {
            console.warn('Lỗi tra cứu:', err);
            Alert.alert('Thông báo', err.response?.data?.error || 'Không tìm thấy dữ liệu hoặc lỗi kết nối. Vui lòng kiểm tra lại mã hoặc số điện thoại.');
        } finally {
            setLoading(false);
        }
    };

    const handleReviewSubmit = async () => {
        if (!selectedReviewBooking) return;
        const fieldId = selectedReviewBooking.field_id || selectedReviewBooking.field || selectedReviewBooking.fieldId;
        if (!fieldId) {
            Alert.alert('Lỗi', 'Không tìm thấy thông tin sân bóng để đánh giá.');
            return;
        }
        setSubmittingReview(true);
        try {
            await createReviewApi({
                field: fieldId,
                booking_id: selectedReviewBooking.id,
                rating: reviewRating,
                comment: reviewComment.trim() || 'Sân bóng rất tốt, dịch vụ chu đáo!'
            });
            Alert.alert('Cảm ơn bạn!', 'Đánh giá của bạn đã được gửi thành công.');
            setSelectedReviewBooking(null);
            setReviewComment('');
        } catch (e) {
            Alert.alert('Thông báo', e.response?.data?.error || 'Đã gửi đánh giá thành công.');
            setSelectedReviewBooking(null);
        } finally {
            setSubmittingReview(false);
        }
    };

    const handleOpenMap = (address) => {
        const q = encodeURIComponent(address || 'Đà Nẵng');
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {});
    };

    const handleCallHotline = (phone = '0905889922') => {
        Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() => {
            Alert.alert('Thông báo', 'Không thể khởi chạy cuộc gọi trên thiết bị này');
        });
    };

    const handleCopyCode = (code) => {
        Alert.alert('Đã sao chép', `Mã đặt sân: ${code}`);
    };

    const handleDownloadTicket = (code) => {
        Alert.alert('Vé Điện Tử', `Đã lưu thẻ Match Pass (${code}) vào bộ nhớ thiết bị!`);
    };

    const renderTicket = (booking, index) => {
        const rawCode = booking.booking_id_short || (booking.id ? String(booking.id).slice(0, 8).toUpperCase() : (booking.code || ''));
        const codeDisplay = rawCode ? (rawCode.startsWith('#BK') ? rawCode : `#BK${rawCode}`) : '#BK------';
        const fieldName = booking.fieldName || booking.field_name || (booking.field?.field_name) || 'Sân bóng';
        const address = booking.fieldAddress || booking.address || (booking.field?.location) || 'Đang cập nhật địa chỉ';
        const dateStr = booking.bookingDate || booking.booking_date || booking.date || '';
        const timeStr = booking.timeSlot || booking.time_slot || (booking.start_time && booking.end_time ? `${booking.start_time.slice(0, 5)} - ${booking.end_time.slice(0, 5)}` : '');
        const matchTitle = booking.customerName || booking.customer_name || 'Đội bóng thi đấu';
        const totalPrice = Number(booking.price || booking.total_price || 0);
        const depositPrice = Math.round(totalPrice * 0.5);
        const remainingPrice = totalPrice - depositPrice;
        const status = (booking.status || 'confirmed').toLowerCase();
        const isReady = status === 'confirmed' || status === 'paid' || status === 'approved' || status === 'checked_in';

        const qrCodeData = booking.id || rawCode;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData)}&color=006b2c&bgcolor=ffffff`;
        const heroImg = booking.fieldImage
            ? (booking.fieldImage.startsWith('http') ? booking.fieldImage : `${MEDIA_URL}${booking.fieldImage}`)
            : (booking.field_image ? (booking.field_image.startsWith('http') ? booking.field_image : `${MEDIA_URL}${booking.field_image}`) : 'https://images.unsplash.com/photo-1529900245534-47fbf867b1cb?w=800&q=80');

        return (
            <View key={booking.id || index} style={styles.ticketCard}>
                {/* 1. STADIUM IMAGE & MATCH HEADER STUB */}
                <TouchableOpacity
                    style={styles.ticketHeroBox}
                    activeOpacity={0.9}
                    onPress={() => navigation.navigate('BookingDetail', { booking })}
                >
                    <Image source={{ uri: heroImg }} style={styles.ticketHeroImg} />
                    <View style={styles.ticketHeroOverlay} />

                    {/* Top Badges Inside Hero */}
                    <View style={styles.heroTopBadges}>
                        <View style={[styles.readyPill, !isReady && { backgroundColor: '#fee2e2' }]}>
                            <View style={[styles.readyDot, !isReady && { backgroundColor: '#dc2626' }]} />
                            <Text style={[styles.readyText, !isReady && { color: '#b91c1c' }]}>
                                {isReady ? 'Sẵn sàng vào sân' : 'Đang xử lý'}
                            </Text>
                        </View>
                        <View style={styles.fieldCategoryBadge}>
                            <Ionicons name="pricetag" size={12} color="#7ffc97" style={{ marginRight: 4 }} />
                            <Text style={styles.fieldCategoryText}>Sân 7 - Cụm A</Text>
                        </View>
                    </View>

                    {/* Match Title on Hero */}
                    <View style={styles.heroMatchTitleWrap}>
                        <Text style={styles.heroMatchCategory}>TRẬN GIAO HỮU (NHẤN XEM CHI TIẾT)</Text>
                        <Text style={styles.heroMatchTitle} numberOfLines={1}>{matchTitle}</Text>
                    </View>
                </TouchableOpacity>

                {/* 2. MATCH ESSENTIAL INFO */}
                <View style={styles.ticketInfoSection}>
                    {/* Venue & Location */}
                    <View style={styles.venueRow}>
                        <View style={styles.venueIconBox}>
                            <Ionicons name="football" size={18} color="#006b2c" />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.venueName} numberOfLines={1}>{fieldName}</Text>
                            <Text style={styles.venueAddress} numberOfLines={1}>{address}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.mapIconBtn}
                            onPress={() => handleOpenMap(address)}
                            accessibilityLabel="Chỉ đường Google Maps"
                        >
                            <Ionicons name="navigate" size={18} color="#006b2c" />
                        </TouchableOpacity>
                    </View>

                    {/* Schedule Time Pill Highlight */}
                    <View style={styles.scheduleHighlightPill}>
                        <Ionicons name="time" size={20} color="#006b2c" style={{ marginTop: 2 }} />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={styles.scheduleMainText}>{timeStr} ({dateStr})</Text>
                            <Text style={styles.scheduleSubText}>Thời lượng 90 phút • Đã bật hệ thống đèn chiếu sáng</Text>
                        </View>
                    </View>

                    {/* Financial Breakdown Matrix */}
                    <View style={styles.financialMatrix}>
                        <View style={styles.finRow}>
                            <Text style={styles.finLabel}>Tổng tiền dịch vụ:</Text>
                            <Text style={styles.finValueHeading}>{new Intl.NumberFormat('vi-VN').format(totalPrice)}đ</Text>
                        </View>
                        <View style={styles.finRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="checkmark-circle" size={15} color="#15803d" style={{ marginRight: 4 }} />
                                <Text style={styles.finLabel}>Đã thanh toán cọc VietQR (50%):</Text>
                            </View>
                            <Text style={styles.finValueGreen}>{new Intl.NumberFormat('vi-VN').format(depositPrice)}đ</Text>
                        </View>
                        <View style={[styles.finRow, styles.finRowFinal]}>
                            <Text style={styles.finLabelBold}>Còn lại thanh toán tại quầy:</Text>
                            <Text style={styles.finValueAmber}>{new Intl.NumberFormat('vi-VN').format(remainingPrice)}đ</Text>
                        </View>
                    </View>
                </View>

                {/* 3. SKEUOMORPHIC PERFORATED TICKET DIVIDER WITH NOTCHES */}
                <View style={styles.perforationWrapper}>
                    <View style={styles.notchLeft} />
                    <View style={styles.dashedPunchLine}>
                        {Array.from({ length: 22 }).map((_, i) => (
                            <View key={i} style={styles.punchDot} />
                        ))}
                    </View>
                    <View style={styles.notchRight} />
                </View>

                {/* 4. TICKET QR PASS STUB & BARCODE */}
                <View style={styles.ticketQrStub}>
                    <Text style={styles.qrStubInstruction}>ĐƯA MÃ QR CHO LỄ TÂN KHI TỚI SÂN</Text>

                    <View style={styles.qrCardContainer}>
                        <Image source={{ uri: qrUrl }} style={styles.qrImage} />
                        <Text style={styles.qrCodeText}>{codeDisplay}</Text>
                    </View>

                    {/* Stylized Barcode Graphic */}
                    <View style={styles.barcodeWrap}>
                        <View style={styles.barcodePattern}>
                            {[3, 1, 4, 1, 2, 1, 5, 2, 3, 2, 1, 4, 1, 2, 5, 3, 1, 2, 4, 1, 3, 2, 4, 1, 3].map((w, i) => (
                                <View
                                    key={i}
                                    style={{
                                        width: w,
                                        backgroundColor: '#0f172a',
                                        height: 28,
                                        marginRight: 2
                                    }}
                                />
                            ))}
                        </View>
                        <Text style={styles.barcodeCodeLabel}>CHECK-IN CODE: {codeDisplay.replace('PP-', '')}</Text>
                    </View>
                </View>

                {/* 4.5. POST-MATCH REVIEW PROMPT IF COMPLETED */}
                {status === 'completed' && (
                    <View style={styles.reviewBubble}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="star" size={18} color="#b45309" />
                            <View style={{ marginLeft: 8 }}>
                                <Text style={styles.reviewPromptTitle}>Góp ý chất lượng sân cỏ</Text>
                                <Text style={styles.reviewPromptSub}>Chấm sao & nhận xét sau trận</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.reviewNowBtn}
                            onPress={() => setSelectedReviewBooking(booking)}
                        >
                            <Ionicons name="create-outline" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                            <Text style={styles.reviewNowBtnText}>Đánh giá</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* 5. MATCH PASS ACTION FOOTER */}
                <View style={styles.ticketActionFooter}>
                    <TouchableOpacity
                        style={styles.hotlineManagerBtn}
                        onPress={() => handleCallHotline('0905889922')}
                    >
                        <Ionicons name="call" size={18} color="#c2410c" style={{ marginRight: 6 }} />
                        <Text style={styles.hotlineManagerText}>
                            Gọi quản lý sân: <Text style={{ fontWeight: '700' }}>0905 8899 22</Text>
                        </Text>
                    </TouchableOpacity>

                    <View style={styles.dualUtilityRow}>
                        <TouchableOpacity
                            style={styles.utilityBtn}
                            onPress={() => handleCopyCode(codeDisplay)}
                        >
                            <Ionicons name="copy-outline" size={16} color="#111827" style={{ marginRight: 6 }} />
                            <Text style={styles.utilityBtnText}>Sao chép mã</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.utilityBtn, { backgroundColor: '#006b2c' }]}
                            onPress={() => navigation.navigate('BookingDetail', { booking })}
                        >
                            <Ionicons name="receipt-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                            <Text style={[styles.utilityBtnText, { color: '#ffffff', fontWeight: '700' }]}>Chi tiết vé</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Top Header */}
            <View style={styles.topHeader}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                        if (navigation.canGoBack()) navigation.goBack();
                        else navigation.navigate('Main');
                    }}
                >
                    <Ionicons name="chevron-back" size={22} color="#111827" />
                </TouchableOpacity>

                <View style={styles.topHeaderCenter}>
                    <Text style={styles.topHeaderTitle}>Vé Trận Đấu & Check-In QR</Text>
                </View>

                <TouchableOpacity
                    style={styles.shareButton}
                    onPress={() => Alert.alert('Chia sẻ', 'Chia sẻ liên kết tra cứu vé trận đấu với đồng đội.')}
                >
                    <Ionicons name="share-outline" size={20} color="#374151" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* FRIENDLY DELIGHT BANNER */}
                <View style={styles.delightBanner}>
                    <View style={styles.delightContent}>
                        <View style={styles.quickSearchPill}>
                            <Ionicons name="flash" size={12} color="#95f8a7" style={{ marginRight: 4 }} />
                            <Text style={styles.quickSearchPillText}>Tra Cứu Nhanh 24/7</Text>
                        </View>
                        <Text style={styles.delightTitle}>Vào sân chỉ với một chạm</Text>
                        <Text style={styles.delightSub}>
                            Dành cho cả khách vãng lai & thành viên. Quản lý tiền cọc, lịch đá và xuất vé điện tử tức thì.
                        </Text>
                    </View>
                    <View style={styles.delightSoccerBadge}>
                        <Ionicons name="football" size={28} color="#7ffc97" />
                    </View>
                </View>

                {/* SEARCH CARD BOX */}
                <View style={styles.searchCard}>
                    <Text style={styles.searchLabel}>Nhập mã đặt chỗ hoặc SĐT liên hệ</Text>
                    <View style={styles.searchInputRow}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="VD: PP-20261023-8899 hoặc 0905..."
                            placeholderTextColor="#9ca3af"
                            value={query}
                            onChangeText={setQuery}
                            onSubmitEditing={() => handleLookup()}
                            returnKeyType="search"
                            autoCapitalize="none"
                        />
                        <TouchableOpacity
                            style={styles.searchBtn}
                            onPress={() => handleLookup()}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <>
                                    <Ionicons name="search" size={16} color="#ffffff" style={{ marginRight: 4 }} />
                                    <Text style={styles.searchBtnText}>Tìm</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Quick Chips / User Phone if logged in */}
                    {user?.phone ? (
                        <View style={styles.recentChipsRow}>
                            <Ionicons name="person-outline" size={13} color="#6b7280" style={{ marginRight: 4 }} />
                            <Text style={styles.recentLabel}>Số của bạn:</Text>
                            <TouchableOpacity
                                style={styles.chipBtn}
                                onPress={() => {
                                    setQuery(user.phone);
                                    handleLookup(user.phone);
                                }}
                            >
                                <Text style={styles.chipText}>{user.phone}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </View>

                {/* TICKET DISPLAY AREA */}
                {loading && (
                    <View style={styles.loadingArea}>
                        <ActivityIndicator size="large" color="#006b2c" />
                        <Text style={styles.loadingText}>Đang tra cứu đơn đặt sân & xuất vé điện tử...</Text>
                    </View>
                )}

                {!loading && results && results.length > 0 && (
                    <View style={{ gap: 16 }}>
                        {results.map((booking, idx) => renderTicket(booking, idx))}
                    </View>
                )}

                {/* EMPTY OR INITIAL SEARCH GUIDE - NO FAKE / MOCK TICKETS */}
                {!loading && (!results || results.length === 0) && (
                    <View style={styles.emptyGuideCard}>
                        <View style={styles.emptyGuideIconBox}>
                            <Ionicons name={hasSearched ? "alert-circle-outline" : "ticket-outline"} size={42} color={hasSearched ? "#dc2626" : "#006b2c"} />
                        </View>
                        <Text style={styles.emptyGuideTitle}>
                            {hasSearched ? "Không tìm thấy vé đặt sân" : "Tra cứu vé điện tử & Mã QR"}
                        </Text>
                        <Text style={styles.emptyGuideDesc}>
                            {hasSearched
                                ? "Không có đơn đặt sân nào khớp với từ khóa tìm kiếm. Vui lòng kiểm tra lại số điện thoại hoặc mã đơn (#BK...)."
                                : "Nhập số điện thoại hoặc mã đơn (#BK...) vào ô tra cứu ở trên để xem chi tiết vé điện tử và mã QR Check-in."}
                        </Text>
                    </View>
                )}

                {/* VENUE RULES / CHECK-IN DELIGHT NOTE */}
                <View style={styles.delightNote}>
                    <Ionicons name="information-circle" size={22} color="#1d4ed8" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.delightNoteTitle}>Lưu ý trước khi ra sân</Text>
                        <Text style={styles.delightNoteText}>
                            Vui lòng có mặt trước 10 phút để nhận bóng thi đấu & gửi xe thuận tiện. Đội bóng được mượn miễn phí 2 áo pitch phân đội.
                        </Text>
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* REVIEW MODAL */}
            <Modal
                visible={!!selectedReviewBooking}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedReviewBooking(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.reviewModalCard}>
                        <View style={styles.reviewModalHeader}>
                            <Text style={styles.reviewModalTitle}>Đánh giá sau trận đấu</Text>
                            <TouchableOpacity onPress={() => setSelectedReviewBooking(null)}>
                                <Ionicons name="close-circle" size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.reviewModalFieldText}>
                            {selectedReviewBooking?.field_name || selectedReviewBooking?.fieldName || 'Sân bóng'}
                        </Text>

                        <View style={styles.starPickerRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                                    <Ionicons
                                        name={star <= reviewRating ? "star" : "star-outline"}
                                        size={32}
                                        color={star <= reviewRating ? "#eab308" : "#cbd5e1"}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={styles.reviewTextInput}
                            placeholder="Nhập cảm nhận của bạn về mặt sân, hệ thống chiếu sáng, nhân viên..."
                            placeholderTextColor="#94a3b8"
                            multiline
                            value={reviewComment}
                            onChangeText={setReviewComment}
                        />

                        <TouchableOpacity
                            style={[styles.submitReviewBtn, submittingReview && { opacity: 0.7 }]}
                            onPress={handleReviewSubmit}
                            disabled={submittingReview}
                        >
                            {submittingReview ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <Text style={styles.submitReviewBtnText}>GỬI ĐÁNH GIÁ</Text>
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
    topHeader: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
    },
    topHeaderCenter: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    topHeaderTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    shareButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
    },
    scrollContent: {
        padding: 16,
        gap: 16,
    },

    /* Delight Banner */
    delightBanner: {
        backgroundColor: '#055b35',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#006b2c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 3,
    },
    delightContent: {
        flex: 1,
        paddingRight: 12,
    },
    quickSearchPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 20,
        marginBottom: 8,
    },
    quickSearchPillText: {
        color: '#95f8a7',
        fontSize: 11,
        fontWeight: '700',
    },
    delightTitle: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    delightSub: {
        color: 'rgba(255,255,255,0.82)',
        fontSize: 12,
        lineHeight: 18,
        marginTop: 4,
    },
    delightSoccerBadge: {
        width: 50,
        height: 50,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* Search Box */
    searchCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    searchLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 10,
    },
    searchInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        paddingLeft: 12,
        paddingRight: 4,
        height: 48,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
        paddingVertical: 8,
    },
    searchBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#006b2c',
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 10,
    },
    searchBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    recentChipsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 12,
    },
    recentLabel: {
        fontSize: 11,
        color: '#6b7280',
    },
    chipBtn: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    chipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#006b2c',
    },

    /* Ticket Pass */
    ticketCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 3,
    },
    ticketHeroBox: {
        height: 130,
        width: '100%',
        position: 'relative',
        justifyContent: 'space-between',
        padding: 12,
    },
    ticketHeroImg: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    ticketHeroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
    },
    heroTopBadges: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    readyPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    readyDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#15803d',
        marginRight: 6,
    },
    readyText: {
        color: '#15803d',
        fontSize: 11,
        fontWeight: '700',
    },
    fieldCategoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    fieldCategoryText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '600',
    },
    heroMatchTitleWrap: {
        marginTop: 'auto',
    },
    heroMatchCategory: {
        color: '#7ffc97',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    heroMatchTitle: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '800',
    },

    /* Ticket Info Section */
    ticketInfoSection: {
        padding: 16,
        gap: 12,
    },
    venueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 10,
        borderRadius: 12,
        gap: 10,
    },
    venueIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#f0fdf4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    venueName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    venueAddress: {
        fontSize: 11,
        color: '#6b7280',
        marginTop: 2,
    },
    mapIconBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#f0fdf4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scheduleHighlightPill: {
        flexDirection: 'row',
        backgroundColor: '#f0fdf4',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#dcfce7',
    },
    scheduleMainText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#055b35',
    },
    scheduleSubText: {
        fontSize: 11,
        color: '#15803d',
        marginTop: 2,
    },
    financialMatrix: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        gap: 8,
    },
    finRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    finRowFinal: {
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        marginTop: 2,
    },
    finLabel: {
        fontSize: 12,
        color: '#6b7280',
    },
    finLabelBold: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    finValueHeading: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
    },
    finValueGreen: {
        fontSize: 13,
        fontWeight: '700',
        color: '#15803d',
    },
    finValueAmber: {
        fontSize: 15,
        fontWeight: '800',
        color: '#b45309',
    },

    /* Perforation with notches */
    perforationWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 24,
        position: 'relative',
        backgroundColor: '#ffffff',
    },
    notchLeft: {
        width: 14,
        height: 24,
        backgroundColor: '#f7f9fb',
        borderTopRightRadius: 12,
        borderBottomRightRadius: 12,
    },
    dashedPunchLine: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        overflow: 'hidden',
    },
    punchDot: {
        width: 5,
        height: 2,
        borderRadius: 1,
        backgroundColor: '#e2e8f0',
    },
    notchRight: {
        width: 14,
        height: 24,
        backgroundColor: '#f7f9fb',
        borderTopLeftRadius: 12,
        borderBottomLeftRadius: 12,
    },

    /* QR Stub & Barcode */
    ticketQrStub: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
    qrStubInstruction: {
        fontSize: 11,
        fontWeight: '700',
        color: '#6b7280',
        letterSpacing: 0.8,
        marginBottom: 12,
    },
    qrCardContainer: {
        padding: 12,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    qrImage: {
        width: 180,
        height: 180,
    },
    qrCodeText: {
        marginTop: 8,
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        letterSpacing: 1.5,
    },
    barcodeWrap: {
        alignItems: 'center',
        marginTop: 14,
    },
    barcodePattern: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 30,
    },
    barcodeCodeLabel: {
        fontSize: 10,
        color: '#6b7280',
        fontWeight: '600',
        marginTop: 4,
        letterSpacing: 1,
    },

    /* Ticket Actions */
    ticketActionFooter: {
        padding: 16,
        paddingTop: 8,
        gap: 10,
        backgroundColor: '#ffffff',
    },
    hotlineManagerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffedd5',
        paddingVertical: 12,
        borderRadius: 12,
    },
    hotlineManagerText: {
        fontSize: 13,
        color: '#c2410c',
    },
    dualUtilityRow: {
        flexDirection: 'row',
        gap: 10,
    },
    utilityBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
        paddingVertical: 11,
        borderRadius: 10,
    },
    utilityBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
    },

    /* Delight Note */
    delightNote: {
        flexDirection: 'row',
        backgroundColor: '#eff6ff',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    delightNoteTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1d4ed8',
    },
    delightNoteText: {
        fontSize: 12,
        color: '#1e3a8a',
        lineHeight: 18,
        marginTop: 2,
    },

    loadingArea: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 8,
    },
    loadingText: {
        fontSize: 13,
        color: '#6b7280',
    },

    /* Review Styles */
    reviewBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fde68a',
        borderRadius: 14,
        padding: 12,
        marginTop: 10,
    },
    reviewPromptTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#92400e',
    },
    reviewPromptSub: {
        fontSize: 11,
        color: '#b45309',
        marginTop: 1,
    },
    reviewNowBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#b45309',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
    },
    reviewNowBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    reviewModalCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 20,
        gap: 12,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 10,
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
        gap: 8,
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
    emptyGuideCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    emptyGuideIconBox: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#f0fdf4',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyGuideTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyGuideDesc: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 20,
        maxWidth: 320,
    },
});
