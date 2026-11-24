import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    SafeAreaView,
    Dimensions,
    Alert,
    Linking,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFieldDetailApi } from '../api/fieldsApi';
import { MEDIA_URL } from '../config';
import { AuthContext } from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function FieldDetailScreen({ route, navigation }) {
    const { fieldId } = route.params || {};
    const { user } = useContext(AuthContext);
    const [field, setField] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                if (fieldId) {
                    const data = await getFieldDetailApi(fieldId);
                    setField(data);
                }
            } catch (err) {
                console.warn('Lỗi tải chi tiết sân:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [fieldId]);

    if (loading) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#006b2c" />
                <Text style={styles.loadingText}>Đang tải thông tin sân bóng...</Text>
            </SafeAreaView>
        );
    }

    if (!field) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <Ionicons name="alert-circle-outline" size={48} color="#ba1a1a" />
                <Text style={styles.errorText}>Không tìm thấy thông tin sân bóng</Text>
                <TouchableOpacity style={styles.backBtnAction} onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate('Fields'); }}>
                    <Text style={styles.backBtnText}>Quay lại</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const mainImageUrl = field.image
        ? (field.image.startsWith('http') ? field.image : `${MEDIA_URL}${field.image}`)
        : 'https://images.unsplash.com/photo-1529900245534-5e69e5f5d50a?q=80&w=800';

    const subImages = Array.isArray(field.sub_images) && field.sub_images.length > 0
        ? [mainImageUrl, ...field.sub_images.map(img => img.startsWith('http') ? img : `${MEDIA_URL}${img}`)]
        : [mainImageUrl];

    const currentImg = subImages[selectedImageIndex] || mainImageUrl;
    const price = Number(field.price_per_hour || field.price || 0);
    const formatPrice = (p) => new Intl.NumberFormat('vi-VN').format(p);

    const openGoogleMaps = () => {
        const query = encodeURIComponent(field.address || field.location || '');
        if (!query) return;
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(() => {
            Alert.alert('Thông báo', 'Không thể mở ứng dụng bản đồ');
        });
    };

    const hotline = field.phone || field.manager_phone || '0905889922';
    const handleCallManager = () => {
        Linking.openURL(`tel:${hotline.replace(/[^0-9]/g, '')}`).catch(() => {
            Alert.alert('Thông báo', 'Không thể gọi số quản lý');
        });
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* 1. FIXED TOP APP BAR */}
            <View style={styles.topBar}>
                <TouchableOpacity
                    style={styles.circleBtn}
                    onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate('Fields'); }}
                    activeOpacity={0.8}
                >
                    <Ionicons name="chevron-back" size={22} color="#111827" />
                </TouchableOpacity>

                <Text style={styles.topBarTitle}>Chi Tiết Sân Bóng</Text>

                <TouchableOpacity
                    style={styles.circleBtn}
                    onPress={() => Alert.alert('Chia sẻ', `Đã sao chép liên kết ${field.name || 'sân bóng'}!`)}
                    activeOpacity={0.8}
                >
                    <Ionicons name="share-social-outline" size={20} color="#3e4a3d" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* 2. MULTI-ANGLE IMAGE GALLERY */}
                <View style={styles.galleryContainer}>
                    <View style={styles.heroImageWrapper}>
                        <Image source={{ uri: currentImg }} style={styles.heroImage} resizeMode="cover" />
                        <View style={styles.heroGradientOverlay} />

                        {/* Top Badges */}
                        <View style={styles.galleryTopBadges}>
                            <View style={styles.fifaBadge}>
                                <Ionicons name="checkmark-circle" size={14} color="#7ffc97" />
                                <Text style={styles.fifaBadgeText}>FIFA Quality Pro</Text>
                            </View>
                            <View style={styles.primeBadge}>
                                <Ionicons name="flame" size={13} color="#b45309" />
                                <Text style={styles.primeBadgeText}>VIP {field.field_type_name || field.field_type?.name || 'Sân 7'}</Text>
                            </View>
                        </View>

                        {/* Star Rating Badge */}
                        <View style={styles.ratingBadge}>
                            <Ionicons name="star" size={14} color="#f59e0b" />
                            <Text style={styles.ratingScore}>{field.rating ? Number(field.rating).toFixed(1) : '5.0'}</Text>
                            {field.total_reviews ? (
                                <Text style={styles.ratingCount}>({field.total_reviews} đánh giá)</Text>
                            ) : null}
                        </View>

                        {/* Live Turf Status Indicator */}
                        <View style={styles.turfStatusBadge}>
                            <View style={styles.pulsingDot} />
                            <Text style={styles.turfStatusText}>MẶT SÂN SẴN SÀNG</Text>
                        </View>
                    </View>

                    {/* Thumbnails with captions */}
                    {subImages.length > 1 && (
                        <View style={styles.thumbGrid}>
                            {subImages.map((uri, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={[
                                        styles.thumbBtn,
                                        selectedImageIndex === idx && styles.thumbBtnActive
                                    ]}
                                    onPress={() => setSelectedImageIndex(idx)}
                                    activeOpacity={0.8}
                                >
                                    <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
                                    <View style={styles.thumbCaptionBox}>
                                        <Text style={styles.thumbCaptionText} numberOfLines={1}>Ảnh #{idx + 1}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* 3. THÔNG TIN TỔNG QUAN & ĐỊA CHỈ */}
                <View style={styles.infoCard}>
                    <View style={styles.infoHeaderRow}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.brandSubcategory}>CỤM SÂN CHUẨN QUỐC TẾ</Text>
                            <Text style={styles.fieldNameText}>{field.name || field.field_name || 'Sân Bóng Đá'}</Text>
                        </View>
                        <View style={styles.fieldSoccerIcon}>
                            <Ionicons name="football" size={22} color="#15803d" />
                        </View>
                    </View>

                    {field.address || field.location ? (
                        <View style={styles.addressRow}>
                            <Ionicons name="location" size={18} color="#006b2c" />
                            <Text style={styles.addressText}>
                                {field.address || field.location}
                            </Text>
                        </View>
                    ) : null}

                    {/* Hotline trực sân 24/7 */}
                    <View style={styles.managerHotlineBox}>
                        <View style={styles.managerLeft}>
                            <View style={styles.managerIcon}>
                                <Ionicons name="headset-outline" size={18} color="#006b2c" />
                            </View>
                            <View style={{ marginLeft: 8 }}>
                                <Text style={styles.managerLabel}>Quản lý trực sân 24/7</Text>
                                <Text style={styles.managerPhone}>{hotline}</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.callNowBtn}
                            onPress={handleCallManager}
                            activeOpacity={0.9}
                        >
                            <Ionicons name="call" size={15} color="#ffffff" />
                            <Text style={styles.callNowBtnText}>Gọi ngay</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 4. CHIP TIỆN ÍCH NỔI BẬT */}
                <View style={styles.amenitiesCard}>
                    <View style={styles.cardHeaderRow}>
                        <Ionicons name="star" size={18} color="#006b2c" />
                        <Text style={styles.cardSectionTitle}>Tiện ích & Quy chuẩn mặt sân</Text>
                    </View>

                    <View style={styles.amenitiesGrid}>
                        <View style={styles.amenityItemBoxActive}>
                            <View style={styles.amenityIconWhite}>
                                <Ionicons name="flash-outline" size={18} color="#006b2c" />
                            </View>
                            <View style={styles.amenityItemTextGroup}>
                                <Text style={styles.amenityItemTitle}>LED chống chói</Text>
                                <Text style={styles.amenityItemSub}>4 cột cao áp 800W</Text>
                            </View>
                        </View>

                        <View style={styles.amenityItemBoxActive}>
                            <View style={styles.amenityIconWhite}>
                                <Ionicons name="football-outline" size={18} color="#006b2c" />
                            </View>
                            <View style={styles.amenityItemTextGroup}>
                                <Text style={styles.amenityItemTitle}>Cỏ kim cương 5cm</Text>
                                <Text style={styles.amenityItemSub}>Đệm cao su đúc êm</Text>
                            </View>
                        </View>

                        <View style={styles.amenityItemBox}>
                            <View style={styles.amenityIconWhite}>
                                <Ionicons name="car-outline" size={18} color="#374151" />
                            </View>
                            <View style={styles.amenityItemTextGroup}>
                                <Text style={styles.amenityItemTitle}>Bãi giữ xe Free</Text>
                                <Text style={styles.amenityItemSub}>Ô tô & 200 xe máy</Text>
                            </View>
                        </View>

                        <View style={styles.amenityItemBox}>
                            <View style={styles.amenityIconWhite}>
                                <Ionicons name="water-outline" size={18} color="#374151" />
                            </View>
                            <View style={styles.amenityItemTextGroup}>
                                <Text style={styles.amenityItemTitle}>Tắm nóng lạnh</Text>
                                <Text style={styles.amenityItemSub}>Căn tin giải khát</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 5. BẢN ĐỒ SỐ ĐỊNH VỊ SÂN (FIELD MAP & NAVIGATION) */}
                <View style={styles.mapCard}>
                    <View style={styles.mapHeaderRow}>
                        <View style={styles.mapHeaderTitleGroup}>
                            <View style={styles.mapCompassIcon}>
                                <Ionicons name="compass-outline" size={18} color="#1d4ed8" />
                            </View>
                            <Text style={styles.cardSectionTitle}>Vị trí & Chỉ đường</Text>
                        </View>
                        <View style={styles.distanceBadge}>
                            <Ionicons name="navigate" size={13} color="#15803d" />
                            <Text style={styles.distanceText}>Cách 1.2 km • 5 phút</Text>
                        </View>
                    </View>

                    {/* Interactive map box mockup */}
                    <View style={styles.mapBoxWrapper}>
                        <Image
                            source={{ uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800' }}
                            style={styles.mapStaticImg}
                            resizeMode="cover"
                        />
                        <View style={styles.mapPinContainer}>
                            <View style={styles.radarPulse}>
                                <View style={styles.radarDot} />
                            </View>
                            <View style={styles.mapPinBadge}>
                                <Ionicons name="football" size={18} color="#ffffff" />
                            </View>
                            <View style={styles.mapPinLabel}>
                                <View style={styles.greenMiniDot} />
                                <Text style={styles.mapPinLabelText}>{field.name || 'Sân bóng'}</Text>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.openMapBtn}
                        onPress={openGoogleMaps}
                        activeOpacity={0.9}
                    >
                        <Ionicons name="navigate-circle-outline" size={20} color="#006b2c" />
                        <Text style={styles.openMapBtnText}>Mở chỉ đường trên Google Maps</Text>
                    </TouchableOpacity>
                </View>

                {/* 6. BẢNG GIÁ NIÊM YẾT THEO CA */}
                <View style={styles.priceScheduleCard}>
                    <View style={styles.priceHeaderRow}>
                        <View style={styles.priceHeaderLeft}>
                            <View style={styles.priceIconWrap}>
                                <Ionicons name="cash-outline" size={18} color="#b45309" />
                            </View>
                            <Text style={styles.cardSectionTitle}>Bảng giá niêm yết theo ca</Text>
                        </View>
                        <Text style={styles.matchDurationText}>90 phút / trận</Text>
                    </View>

                    <View style={styles.shiftsList}>
                        {/* Ca Sáng */}
                        <View style={styles.shiftCard}>
                            <View style={styles.shiftLeft}>
                                <View style={styles.shiftIconBox}>
                                    <Ionicons name="sunny-outline" size={18} color="#f59e0b" />
                                </View>
                                <View style={{ marginLeft: 10 }}>
                                    <View style={styles.shiftTitleRow}>
                                        <Text style={styles.shiftName}>Ca Sáng</Text>
                                        <View style={styles.shiftTag}>
                                            <Text style={styles.shiftTagText}>Tiết kiệm</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.shiftHours}>06:00 - 16:00</Text>
                                </View>
                            </View>
                            <View style={styles.shiftRight}>
                                <Text style={styles.shiftPrice}>180K - 200K</Text>
                                <Text style={styles.shiftPriceSub}>/ 90 phút</Text>
                            </View>
                        </View>

                        {/* Ca Chiều Prime */}
                        <View style={styles.shiftCardPrime}>
                            <View style={styles.shiftLeft}>
                                <View style={styles.shiftIconBoxPrime}>
                                    <Ionicons name="flame" size={18} color="#b45309" />
                                </View>
                                <View style={{ marginLeft: 10 }}>
                                    <View style={styles.shiftTitleRow}>
                                        <Text style={styles.shiftName}>Ca Chiều Prime</Text>
                                        <View style={styles.shiftTagPrime}>
                                            <Text style={styles.shiftTagPrimeText}>Ưa chuộng</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.shiftHours}>16:00 - 18:30</Text>
                                </View>
                            </View>
                            <View style={styles.shiftRight}>
                                <Text style={styles.shiftPricePrime}>280K - 350K</Text>
                                <Text style={styles.shiftPriceSub}>/ 90 phút</Text>
                            </View>
                        </View>

                        {/* Ca Tối Đèn Cao Áp */}
                        <View style={styles.shiftCard}>
                            <View style={styles.shiftLeft}>
                                <View style={styles.shiftIconBox}>
                                    <Ionicons name="flash-outline" size={18} color="#006b2c" />
                                </View>
                                <View style={{ marginLeft: 10 }}>
                                    <View style={styles.shiftTitleRow}>
                                        <Text style={styles.shiftName}>Ca Tối Đèn LED</Text>
                                        <View style={styles.shiftTagGreen}>
                                            <Text style={styles.shiftTagGreenText}>Sôi động</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.shiftHours}>18:30 - 23:00</Text>
                                </View>
                            </View>
                            <View style={styles.shiftRight}>
                                <Text style={styles.shiftPrice}>320K - 380K</Text>
                                <Text style={styles.shiftPriceSub}>/ 90 phút</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 7. CHÍNH SÁCH CỌC & HỦY SÂN */}
                <View style={styles.policyCard}>
                    <View style={styles.policyHeader}>
                        <Ionicons name="shield-checkmark" size={20} color="#006b2c" />
                        <Text style={styles.policyTitle}>Quy định & Chính sách bảo vệ quyền lợi</Text>
                    </View>

                    <View style={styles.policyList}>
                        <View style={styles.policyItem}>
                            <Ionicons name="checkmark-circle" size={16} color="#006b2c" style={{ marginTop: 2 }} />
                            <Text style={styles.policyItemText}>
                                <Text style={{ fontWeight: '700' }}>Đặt cọc 50%: </Text>
                                Xác nhận giữ sân tức thì qua VietQR tự động, có mã xuất vé trận đấu.
                            </Text>
                        </View>

                        <View style={styles.policyItem}>
                            <Ionicons name="refresh-circle" size={16} color="#006b2c" style={{ marginTop: 2 }} />
                            <Text style={styles.policyItemText}>
                                <Text style={{ fontWeight: '700' }}>Miễn phí đổi hủy ca: </Text>
                                Hoàn cọc 100% hoặc đổi giờ linh hoạt nếu thông báo trước 12 tiếng.
                            </Text>
                        </View>

                        <View style={styles.policyItem}>
                            <Ionicons name="rainy" size={16} color="#006b2c" style={{ marginTop: 2 }} />
                            <Text style={styles.policyItemText}>
                                <Text style={{ fontWeight: '700' }}>Bảo hiểm thời tiết: </Text>
                                Hỗ trợ hoàn cọc hoặc bảo lưu phiên đấu khi trời mưa bão lớn bất khả kháng.
                            </Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* 8. STICKY BOTTOM ACTION BAR */}
            <View style={styles.bottomBar}>
                <View style={styles.bottomPriceGroup}>
                    <Text style={styles.bottomPriceLabel}>Giá thuê chỉ từ</Text>
                    <View style={styles.bottomPriceRow}>
                        <Text style={styles.bottomPriceValue}>{formatPrice(price)}đ</Text>
                        <Text style={styles.bottomPriceUnit}> /ca</Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.bookNowCtaBtn}
                    onPress={() => navigation.navigate('Booking', { field: field })}
                    activeOpacity={0.9}
                >
                    <Text style={styles.bookNowCtaText}>Chọn ca & Đặt ngay</Text>
                    <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                </TouchableOpacity>
            </View>
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
    errorText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ba1a1a',
        marginTop: 12,
    },
    backBtnAction: {
        marginTop: 16,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#006b2c',
    },
    backBtnText: {
        color: '#ffffff',
        fontWeight: '700',
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
    circleBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBarTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    scrollContent: {
        paddingBottom: 100,
    },
    // Gallery
    galleryContainer: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    heroImageWrapper: {
        width: '100%',
        height: 240,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3,
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    heroGradientOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.3)',
    },
    galleryTopBadges: {
        position: 'absolute',
        top: 12,
        left: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    fifaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 9999,
        gap: 4,
    },
    fifaBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#7ffc97',
    },
    primeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(254, 243, 199, 0.95)',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 9999,
        gap: 3,
    },
    primeBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#b45309',
    },
    ratingBadge: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 9999,
        gap: 4,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    ratingScore: {
        fontSize: 12,
        fontWeight: '800',
        color: '#111827',
    },
    ratingCount: {
        fontSize: 11,
        color: '#6b7280',
    },
    turfStatusBadge: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(5, 91, 53, 0.85)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 9999,
        gap: 6,
    },
    pulsingDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#7ffc97',
    },
    turfStatusText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: 0.6,
    },
    thumbGrid: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    thumbBtn: {
        flex: 1,
        height: 74,
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    thumbBtnActive: {
        borderColor: '#006b2c',
    },
    thumbImage: {
        width: '100%',
        height: '100%',
    },
    thumbCaptionBox: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        paddingVertical: 2,
        paddingHorizontal: 4,
        alignItems: 'center',
    },
    thumbCaptionText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#ffffff',
    },
    // Info Card
    infoCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 14,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        gap: 10,
    },
    infoHeaderRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    brandSubcategory: {
        fontSize: 11,
        fontWeight: '700',
        color: '#006b2c',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    fieldNameText: {
        fontSize: 20,
        fontWeight: '800',
        color: '#111827',
        marginTop: 2,
    },
    fieldSoccerIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#dcfce7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
    },
    addressText: {
        flex: 1,
        fontSize: 13,
        color: '#374151',
        lineHeight: 18,
    },
    managerHotlineBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        padding: 10,
        marginTop: 4,
    },
    managerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    managerIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#e0f2fe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    managerLabel: {
        fontSize: 11,
        color: '#6b7280',
    },
    managerPhone: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    callNowBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#006b2c',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 9999,
        gap: 4,
    },
    callNowBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
    // Amenities Card
    amenitiesCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 14,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        gap: 12,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    cardSectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    amenitiesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    amenityItemBoxActive: {
        flex: 1,
        minWidth: '45%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        borderRadius: 10,
        padding: 10,
        gap: 8,
    },
    amenityItemBox: {
        flex: 1,
        minWidth: '45%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        padding: 10,
        gap: 8,
    },
    amenityIconWhite: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    amenityItemTextGroup: {
        flex: 1,
    },
    amenityItemTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
    },
    amenityItemSub: {
        fontSize: 11,
        color: '#6b7280',
        marginTop: 1,
    },
    // Map Card
    mapCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 14,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        gap: 12,
    },
    mapHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    mapHeaderTitleGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    mapCompassIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#dbeafe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    distanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 9999,
        gap: 4,
    },
    distanceText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#15803d',
    },
    mapBoxWrapper: {
        width: '100%',
        height: 160,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mapStaticImg: {
        width: '100%',
        height: '100%',
    },
    mapPinContainer: {
        position: 'absolute',
        alignItems: 'center',
    },
    radarPulse: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 107, 44, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radarDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#006b2c',
    },
    mapPinBadge: {
        position: 'absolute',
        top: 2,
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#006b2c',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#ffffff',
    },
    mapPinLabel: {
        marginTop: 6,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 9999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    greenMiniDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#62df7d',
    },
    mapPinLabelText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#ffffff',
    },
    openMapBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 44,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        gap: 6,
    },
    openMapBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    // Price Schedule Card
    priceScheduleCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 14,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        gap: 12,
    },
    priceHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    priceHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    priceIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#fef3c7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    matchDurationText: {
        fontSize: 12,
        color: '#6b7280',
    },
    shiftsList: {
        gap: 8,
    },
    shiftCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        padding: 12,
    },
    shiftCardPrime: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fffbeb',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#fde68a',
    },
    shiftLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    shiftIconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shiftIconBoxPrime: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shiftTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    shiftName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    shiftTag: {
        backgroundColor: '#e6e8ea',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 9999,
    },
    shiftTagText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#6b7280',
    },
    shiftTagPrime: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 9999,
    },
    shiftTagPrimeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#b45309',
    },
    shiftTagGreen: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 9999,
    },
    shiftTagGreenText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#15803d',
    },
    shiftHours: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 2,
    },
    shiftRight: {
        alignItems: 'flex-end',
    },
    shiftPrice: {
        fontSize: 14,
        fontWeight: '800',
        color: '#111827',
    },
    shiftPricePrime: {
        fontSize: 14,
        fontWeight: '800',
        color: '#b45309',
    },
    shiftPriceSub: {
        fontSize: 10,
        color: '#6b7280',
    },
    // Policy Card
    policyCard: {
        backgroundColor: '#f0fdf4',
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#dcfce7',
        gap: 10,
    },
    policyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    policyTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#055b35',
    },
    policyList: {
        gap: 8,
    },
    policyItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
    },
    policyItemText: {
        flex: 1,
        fontSize: 12,
        color: '#374151',
        lineHeight: 18,
    },
    // Bottom Bar
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 72,
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 8,
    },
    bottomPriceGroup: {
        flexDirection: 'column',
    },
    bottomPriceLabel: {
        fontSize: 11,
        color: '#6b7280',
    },
    bottomPriceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    bottomPriceValue: {
        fontSize: 18,
        fontWeight: '800',
        color: '#006b2c',
    },
    bottomPriceUnit: {
        fontSize: 12,
        color: '#6b7280',
    },
    bookNowCtaBtn: {
        flex: 1,
        marginLeft: 18,
        height: 48,
        borderRadius: 9999,
        backgroundColor: '#006b2c',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#006b2c',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 4,
    },
    bookNowCtaText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
});
