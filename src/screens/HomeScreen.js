import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    SafeAreaView,
    Platform,
    ScrollView,
    Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFieldsApi } from '../api/fieldsApi';
import { getTournamentRequestsApi } from '../api/tournamentsApi';
import { MEDIA_URL } from '../config';
import { AuthContext } from '../context/AuthContext';

export default function HomeScreen({ navigation }) {
    const { user } = useContext(AuthContext);
    const [fields, setFields] = useState([]);
    const [tournaments, setTournaments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [favorites, setFavorites] = useState({});

    const fetchFields = async () => {
        try {
            const [fieldsRes, tourRes] = await Promise.allSettled([
                getFieldsApi(),
                getTournamentRequestsApi()
            ]);
            if (fieldsRes.status === 'fulfilled') {
                const res = fieldsRes.value;
                const list = res?.fields || res?.results || (Array.isArray(res) ? res : []);
                setFields(list);
            }
            if (tourRes.status === 'fulfilled') {
                const tList = tourRes.value?.requests || tourRes.value?.results || (Array.isArray(tourRes.value) ? tourRes.value : []);
                setTournaments(tList);
            }
        } catch (error) {
            console.warn('Lỗi lấy dữ liệu trang chủ:', error.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchFields();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchFields();
    };

    const toggleFavorite = (id) => {
        setFavorites(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Dynamic counts
    const count5 = fields.filter(f => (f.field_type_name || f.field_type?.name || String(f.field_type || '')).toLowerCase().includes('5')).length;
    const count7 = fields.filter(f => (f.field_type_name || f.field_type?.name || String(f.field_type || '')).toLowerCase().includes('7')).length;
    const count11 = fields.filter(f => (f.field_type_name || f.field_type?.name || String(f.field_type || '')).toLowerCase().includes('11')).length;

    const filteredFields = fields.filter(f => {
        const name = (f.name || f.field_name || '').toLowerCase();
        const addr = (f.address || f.location || '').toLowerCase();
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery = !q || name.includes(q) || addr.includes(q);

        if (!matchesQuery) return false;
        if (filterType === 'all') return true;

        const typeName = (f.field_type_name || f.field_type?.name || String(f.field_type || '')).toLowerCase();
        return typeName.includes(filterType);
    });

    const formatPrice = (price) => {
        return new Intl.NumberFormat('vi-VN').format(price);
    };

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            {/* 1. TOP APP BAR */}
            <View style={styles.topBar}>
                <View style={styles.brandRow}>
                    <View style={styles.brandIconBox}>
                        <Ionicons name="football" size={20} color="#ffffff" />
                    </View>
                    <View style={styles.brandTextGroup}>
                        <Text style={styles.brandSub}>SÂN BÓNG HẢI CHÂU</Text>
                        <Text style={styles.brandTitle}>Trang Chủ</Text>
                    </View>
                </View>

                <View style={styles.topRightActions}>
                    <TouchableOpacity
                        style={styles.notifBtn}
                        onPress={() => navigation.navigate('Contact')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="notifications-outline" size={22} color="#111827" />
                        <View style={styles.notifDot} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.avatarBtn}
                        onPress={() => navigation.navigate(user ? 'ProfileTab' : 'Login')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="person" size={18} color="#006b2c" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* 2. LOCATION & STATUS ROW */}
            <View style={styles.locationSection}>
                <TouchableOpacity
                    style={styles.locationSelector}
                    onPress={() => navigation.navigate('Fields')}
                    activeOpacity={0.7}
                >
                    <Ionicons name="location" size={18} color="#006b2c" />
                    <Text style={styles.locationCity}>Đà Nẵng</Text>
                    <Ionicons name="chevron-down" size={16} color="#6b7280" />
                </TouchableOpacity>

                <View style={styles.openStatusBadge}>
                    <View style={styles.pulsingDot} />
                    <Text style={styles.openStatusText}>{fields.length} sân đang mở</Text>
                </View>
            </View>

            {/* 3. QUICK SEARCH CARD */}
            <View style={styles.searchCard}>
                <View style={styles.searchInputRow}>
                    <Ionicons name="search" size={20} color="#006b2c" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Tìm tên sân, đường, khu vực..."
                        placeholderTextColor="#9ca3af"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery ? (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                            <Ionicons name="close-circle" size={18} color="#9ca3af" />
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                        style={styles.tuneBtn}
                        onPress={() => navigation.navigate('Fields')}
                    >
                        <Ionicons name="options-outline" size={16} color="#111827" />
                    </TouchableOpacity>
                </View>

                <View style={styles.subFilterGrid}>
                    <TouchableOpacity
                        style={styles.subFilterPill}
                        onPress={() => navigation.navigate('Fields')}
                        activeOpacity={0.8}
                    >
                        <View style={styles.subFilterContent}>
                            <Ionicons name="map-outline" size={15} color="#006b2c" />
                            <Text style={styles.subFilterText} numberOfLines={1}>Tất cả quận</Text>
                        </View>
                        <Ionicons name="chevron-down" size={14} color="#9ca3af" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.subFilterPill}
                        onPress={() => setFilterType(filterType === '7' ? 'all' : '7')}
                        activeOpacity={0.8}
                    >
                        <View style={styles.subFilterContent}>
                            <Ionicons name="people-outline" size={15} color="#006b2c" />
                            <Text style={styles.subFilterText} numberOfLines={1}>Sân 7 người</Text>
                        </View>
                        <Ionicons name="chevron-down" size={14} color="#9ca3af" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* 4. FILTER PILLS (HORIZONTAL SCROLL) */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScrollContent}
                style={styles.filterScrollView}
            >
                <TouchableOpacity
                    style={[styles.pillBtn, filterType === 'all' && styles.pillBtnActive]}
                    onPress={() => setFilterType('all')}
                >
                    <Text style={[styles.pillText, filterType === 'all' && styles.pillTextActive]}>Tất cả</Text>
                    <View style={[styles.pillCountBadge, filterType === 'all' && styles.pillCountBadgeActive]}>
                        <Text style={[styles.pillCountText, filterType === 'all' && styles.pillCountTextActive]}>
                            {fields.length}
                        </Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.pillBtn, filterType === '5' && styles.pillBtnActive]}
                    onPress={() => setFilterType('5')}
                >
                    <Text style={[styles.pillText, filterType === '5' && styles.pillTextActive]}>Sân 5 người</Text>
                    <Text style={[styles.pillSubCount, filterType === '5' && styles.pillTextActive]}>
                        ({count5})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.pillBtn,
                        filterType === '7' ? styles.pillBtnActive : styles.pillBtnEmerald
                    ]}
                    onPress={() => setFilterType('7')}
                >
                    <Text style={[
                        styles.pillText,
                        filterType === '7' ? styles.pillTextActive : styles.pillTextEmerald
                    ]}>
                        Sân 7 người
                    </Text>
                    <View style={styles.hotBadge}>
                        <Ionicons name="flame" size={11} color="#b45309" />
                        <Text style={styles.hotBadgeText}>HOT</Text>
                    </View>
                    <Text style={[
                        styles.pillSubCount,
                        filterType === '7' ? styles.pillTextActive : styles.pillTextEmerald
                    ]}>
                        ({count7})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.pillBtn, filterType === '11' && styles.pillBtnActive]}
                    onPress={() => setFilterType('11')}
                >
                    <Text style={[styles.pillText, filterType === '11' && styles.pillTextActive]}>Sân 11 người</Text>
                    <Text style={[styles.pillSubCount, filterType === '11' && styles.pillTextActive]}>
                        ({count11})
                    </Text>
                </TouchableOpacity>
            </ScrollView>

            {/* 5. VIETQR SUNSET GOLDEN HOUR BANNER */}
            <View style={styles.bannerCard}>
                <View style={styles.bannerTopRow}>
                    <View style={styles.bannerBadge}>
                        <Ionicons name="flash" size={13} color="#fde68a" />
                        <Text style={styles.bannerBadgeText}>GIỜ VÀNG HOÀNG HÔN</Text>
                    </View>
                    <View style={styles.bannerTimePill}>
                        <Ionicons name="time-outline" size={13} color="#ffffff" />
                        <Text style={styles.bannerTimeText}>16:30 - 18:00</Text>
                    </View>
                </View>

                <View style={styles.bannerContentRow}>
                    <View style={styles.bannerTextLeft}>
                        <Text style={styles.bannerTitle}>Giảm ngay 20%</Text>
                        <Text style={styles.bannerDesc}>
                            Quét mã VietQR liền tay - giữ sân đấu mượt mà hoàng hôn Đà Thành.
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.bannerBtn}
                        onPress={() => navigation.navigate('Fields')}
                        activeOpacity={0.9}
                    >
                        <Text style={styles.bannerBtnText}>Nhận mã</Text>
                        <Ionicons name="qr-code-outline" size={18} color="#006b2c" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* 6. MATCHMAKING & TOURNAMENT SECTION */}
            <View style={styles.matchmakingSection}>
                <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleGroup}>
                        <Ionicons name="trophy-outline" size={18} color="#006b2c" />
                        <Text style={styles.sectionTitle}>Giải đấu & Giao hữu</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.seeAllLink}
                        onPress={() => navigation.navigate('TournamentRequest')}
                    >
                        <Text style={styles.seeAllLinkText}>
                            {tournaments.length > 0 ? `Xem ${tournaments.length} giải` : 'Đăng ký ngay'}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color="#006b2c" />
                    </TouchableOpacity>
                </View>

                {tournaments.length > 0 ? (
                    (() => {
                        const t = tournaments[0];
                        return (
                            <View style={styles.matchmakingCard}>
                                <View style={styles.matchTopRow}>
                                    <View style={styles.matchTeamInfo}>
                                        <View style={styles.matchAvatar}>
                                            <Ionicons name="trophy" size={20} color="#006b2c" />
                                        </View>
                                        <View style={styles.matchNames}>
                                            <View style={styles.matchNameRow}>
                                                <Text style={styles.matchTeamTitle} numberOfLines={1}>
                                                    {t.tournament_name || 'Giải đấu giao lưu'}
                                                </Text>
                                                <View style={styles.pitchTypeBadge}>
                                                    <Text style={styles.pitchTypeBadgeText}>{t.status || 'Mở'}</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.matchSubtitle}>
                                                {t.organization || t.contact_name ? `Đơn vị: ${t.organization || t.contact_name}` : 'Cộng đồng bóng đá'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.matchTagsRow}>
                                    <View style={styles.matchTagItem}>
                                        <Ionicons name="calendar-outline" size={15} color="#6b7280" />
                                        <Text style={styles.matchTagTextBold}>
                                            {t.start_date || 'Sắp diễn ra'}
                                        </Text>
                                    </View>
                                    {t.expected_teams ? (
                                        <View style={styles.matchTagItem}>
                                            <Ionicons name="people-outline" size={15} color="#6b7280" />
                                            <Text style={styles.matchTagText}>{t.expected_teams} đội</Text>
                                        </View>
                                    ) : null}
                                    <View style={styles.matchTagSuccess}>
                                        <Ionicons name="checkmark-circle-outline" size={14} color="#15803d" />
                                        <Text style={styles.matchTagSuccessText}>Hỗ trợ trọng tài & nước</Text>
                                    </View>
                                </View>

                                <View style={styles.matchActionsRow}>
                                    <TouchableOpacity
                                        style={styles.batKeoBtn}
                                        onPress={() => navigation.navigate('TournamentRequest')}
                                        activeOpacity={0.9}
                                    >
                                        <Ionicons name="document-text-outline" size={18} color="#ffffff" />
                                        <Text style={styles.batKeoBtnText}>Đăng ký tham gia</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.chatIconBtn}
                                        onPress={() => navigation.navigate('Contact')}
                                    >
                                        <Ionicons name="call-outline" size={20} color="#111827" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })()
                ) : (
                    <View style={[styles.matchmakingCard, { alignItems: 'center', paddingVertical: 20 }]}>
                        <Ionicons name="football-outline" size={36} color="#006b2c" style={{ marginBottom: 8 }} />
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 }}>
                            Tổ chức giải đấu & Giao hữu
                        </Text>
                        <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', paddingHorizontal: 16, marginBottom: 14 }}>
                            Hỗ trợ trọn gói sân bãi, lịch thi đấu, trọng tài, nước uống và livestream.
                        </Text>
                        <TouchableOpacity
                            style={styles.batKeoBtn}
                            onPress={() => navigation.navigate('TournamentRequest')}
                            activeOpacity={0.9}
                        >
                            <Ionicons name="add-circle-outline" size={18} color="#ffffff" />
                            <Text style={styles.batKeoBtnText}>Gửi yêu cầu tổ chức giải</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* 7. FEATURED FIELDS HEADER */}
            <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleGroup}>
                    <Ionicons name="checkmark-circle" size={19} color="#006b2c" />
                    <Text style={styles.sectionTitle}>Sân bóng nổi bật</Text>
                </View>
                <TouchableOpacity
                    style={styles.seeAllLink}
                    onPress={() => navigation.navigate('Fields')}
                >
                    <Text style={styles.seeAllLinkText}>Xem tất cả</Text>
                    <Ionicons name="chevron-forward" size={16} color="#006b2c" />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderFieldItem = ({ item }) => {
        const imageUrl = item.image
            ? (item.image.startsWith('http') ? item.image : `${MEDIA_URL}${item.image}`)
            : 'https://images.unsplash.com/photo-1529900245534-5e69e5f5d50a?q=80&w=800';

        const name = item.name || item.field_name || 'Sân bóng';
        const address = item.address || item.location || '';
        const price = Number(item.price_per_hour || item.price || 0);
        const typeName = item.field_type_name || item.field_type?.name || '';
        const isFav = !!favorites[item.id];

        return (
            <View style={styles.fieldCard}>
                {/* Hero Photo with overlay badges */}
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => navigation.navigate('FieldDetail', { fieldId: item.id })}
                    style={styles.fieldImageWrapper}
                >
                    <Image source={{ uri: imageUrl }} style={styles.fieldImage} resizeMode="cover" />
                    <View style={styles.imageOverlay} />

                    {/* Top Badges */}
                    <View style={styles.imageTopRow}>
                        <View style={styles.fifaBadge}>
                            <Ionicons name="ribbon-outline" size={13} color="#7ffc97" />
                            <Text style={styles.fifaBadgeText}>FIFA Quality Pro</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.favBtn}
                            onPress={() => toggleFavorite(item.id)}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name={isFav ? "heart" : "heart-outline"}
                                size={18}
                                color={isFav ? "#ef4444" : "#ffffff"}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Bottom Image Overlay Text */}
                    <View style={styles.imageBottomRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.fieldNameOverlay} numberOfLines={1}>{name}</Text>
                            <View style={styles.fieldAddrRow}>
                                <Ionicons name="location-outline" size={13} color="#e2e8f0" />
                                <Text style={styles.fieldAddrOverlay} numberOfLines={1}>{address}</Text>
                            </View>
                        </View>
                        <View style={styles.ratingBadge}>
                            <Ionicons name="star" size={14} color="#f59e0b" />
                            <Text style={styles.ratingText}>{item.rating ? Number(item.rating).toFixed(1) : '5.0'}</Text>
                            {item.total_reviews ? (
                                <Text style={styles.ratingCount}>({item.total_reviews})</Text>
                            ) : null}
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Card Body */}
                <View style={styles.cardBody}>
                    {/* Amenities Chips */}
                    <View style={styles.amenitiesRow}>
                        <View style={styles.amenityChip}>
                            <Ionicons name="bulb-outline" size={13} color="#006b2c" />
                            <Text style={styles.amenityChipText}>Đèn LED</Text>
                        </View>
                        <View style={styles.amenityChip}>
                            <Ionicons name="football-outline" size={13} color="#006b2c" />
                            <Text style={styles.amenityChipText}>Cỏ chuẩn</Text>
                        </View>
                        <View style={styles.amenityChip}>
                            <Ionicons name="water-outline" size={13} color="#006b2c" />
                            <Text style={styles.amenityChipText}>Nước nóng</Text>
                        </View>
                        <View style={styles.amenityChip}>
                            <Ionicons name="car-outline" size={13} color="#006b2c" />
                            <Text style={styles.amenityChipText}>Bãi xe</Text>
                        </View>
                    </View>

                    {/* Perforated separator */}
                    <View style={styles.separatorRow}>
                        <View style={styles.separatorLine} />
                        <View style={styles.slotsAvailableBadge}>
                            <Ionicons name="time-outline" size={13} color="#b91c1c" />
                            <Text style={styles.slotsAvailableText}>Còn ca trống hôm nay</Text>
                        </View>
                        <View style={styles.separatorLine} />
                    </View>

                    {/* Price and CTA */}
                    <View style={styles.priceCtaRow}>
                        <View>
                            <Text style={styles.priceLabel}>Giá thuê từ</Text>
                            <View style={styles.priceRow}>
                                <Text style={styles.priceValue}>{formatPrice(price)}đ</Text>
                                <Text style={styles.priceUnit}> /giờ</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.bookNowBtn}
                            onPress={() => navigation.navigate('Booking', { field: item })}
                            activeOpacity={0.9}
                        >
                            <Text style={styles.bookNowBtnText}>Đặt ngay</Text>
                            <Ionicons name="arrow-forward" size={16} color="#ffffff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    const renderFooter = () => (
        <View style={styles.footerSection}>
            {/* 3-Step Visual Booking Flow */}
            <View style={styles.flowCard}>
                <View style={styles.flowHeader}>
                    <Ionicons name="sync" size={19} color="#006b2c" />
                    <Text style={styles.flowTitle}>Đặt sân siêu tốc 3 bước</Text>
                </View>

                <View style={styles.flowStepsContainer}>
                    <View style={styles.stepItem}>
                        <View style={styles.stepCircle}>
                            <Text style={styles.stepNumber}>1</Text>
                        </View>
                        <Text style={styles.stepText}>Chọn sân & ca đấu</Text>
                    </View>
                    <View style={styles.stepArrow}>
                        <Ionicons name="arrow-forward" size={16} color="#94a3b8" />
                    </View>
                    <View style={styles.stepItem}>
                        <View style={styles.stepCircle}>
                            <Text style={styles.stepNumber}>2</Text>
                        </View>
                        <Text style={styles.stepText}>Quét VietQR cọc 50%</Text>
                    </View>
                    <View style={styles.stepArrow}>
                        <Ionicons name="arrow-forward" size={16} color="#94a3b8" />
                    </View>
                    <View style={styles.stepItem}>
                        <View style={styles.stepCircle}>
                            <Text style={styles.stepNumber}>3</Text>
                        </View>
                        <Text style={styles.stepText}>Nhận vé & Ra sân</Text>
                    </View>
                </View>
            </View>

            {/* 24/7 Hotline Support Callout */}
            <TouchableOpacity
                style={styles.hotlineCard}
                onPress={() => Linking.openURL('tel:1900889922').catch(() => {})}
                activeOpacity={0.9}
            >
                <View style={styles.hotlineLeft}>
                    <View style={styles.hotlineIcon}>
                        <Ionicons name="call" size={20} color="#b91c1c" />
                    </View>
                    <View style={{ marginLeft: 10 }}>
                        <Text style={styles.hotlineTitle}>Cứu hộ sân & Đổi lịch 24/7</Text>
                        <Text style={styles.hotlineSub}>Hotline khẩn cấp: 1900 88 99 22</Text>
                    </View>
                </View>
                <View style={styles.hotlineCallBtn}>
                    <Text style={styles.hotlineCallBtnText}>Gọi ngay</Text>
                </View>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#006b2c" />
                    <Text style={styles.loadingText}>Đang tải sân bóng đá Hải Châu...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredFields}
                    keyExtractor={(item, index) => String(item.id || index)}
                    renderItem={renderFieldItem}
                    ListHeaderComponent={renderHeader}
                    ListFooterComponent={renderFooter}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#006b2c']} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="search" size={42} color="#94a3b8" />
                            <Text style={styles.emptyTitle}>Không tìm thấy sân phù hợp</Text>
                            <Text style={styles.emptySub}>Thử tìm kiếm với từ khóa khác hoặc bỏ chọn bộ lọc</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f7f9fb',
    },
    listContent: {
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6b7280',
    },
    headerContainer: {
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
    brandIconBox: {
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
    brandTextGroup: {
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
    // Location & Status
    locationSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    locationSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    locationCity: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    openStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 9999,
        backgroundColor: '#dcfce7',
        gap: 6,
    },
    pulsingDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#006b2c',
    },
    openStatusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#15803d',
    },
    // Search Card
    searchCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 10,
        marginTop: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    searchInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f2f4f6',
        borderRadius: 12,
        paddingHorizontal: 10,
        height: 44,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
        color: '#111827',
    },
    tuneBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
    },
    subFilterGrid: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    subFilterPill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(242, 244, 246, 0.7)',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    subFilterContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    subFilterText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
    },
    // Filter Pills Scroll
    filterScrollView: {
        marginTop: 12,
        marginHorizontal: -16,
    },
    filterScrollContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    pillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 9999,
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
        gap: 6,
    },
    pillBtnActive: {
        backgroundColor: '#006b2c',
        shadowColor: '#006b2c',
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    pillBtnEmerald: {
        backgroundColor: '#f0fdf4',
    },
    pillText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    pillTextActive: {
        color: '#ffffff',
    },
    pillTextEmerald: {
        color: '#055b35',
    },
    pillSubCount: {
        fontSize: 12,
        color: '#6b7280',
    },
    pillCountBadge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 9999,
        backgroundColor: '#f1f5f9',
    },
    pillCountBadgeActive: {
        backgroundColor: '#00873a',
    },
    pillCountText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#374151',
    },
    pillCountTextActive: {
        color: '#f7fff3',
    },
    hotBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef3c7',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 9999,
        gap: 2,
    },
    hotBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#b45309',
    },
    // Banner Card
    bannerCard: {
        borderRadius: 16,
        backgroundColor: '#055b35',
        marginTop: 14,
        padding: 16,
        shadowColor: '#006b2c',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 4,
    },
    bannerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    bannerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.25)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
        gap: 4,
    },
    bannerBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fde68a',
        letterSpacing: 0.5,
    },
    bannerTimePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.18)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
        gap: 4,
    },
    bannerTimeText: {
        fontSize: 11,
        color: '#ffffff',
        fontWeight: '600',
    },
    bannerContentRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    bannerTextLeft: {
        flex: 1,
        paddingRight: 10,
    },
    bannerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#ffffff',
    },
    bannerDesc: {
        fontSize: 12,
        color: '#f0fdf4',
        marginTop: 3,
        lineHeight: 17,
        opacity: 0.95,
    },
    bannerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 4,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    bannerBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#006b2c',
    },
    // Matchmaking Section
    matchmakingSection: {
        marginTop: 18,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 18,
        marginBottom: 8,
    },
    sectionTitleGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    seeAllLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    seeAllLinkText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#006b2c',
    },
    matchmakingCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        gap: 10,
    },
    matchTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    matchTeamInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    matchAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f0fdf4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    matchNames: {
        flex: 1,
    },
    matchNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    matchTeamTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        flexShrink: 1,
    },
    pitchTypeBadge: {
        backgroundColor: '#dbeafe',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 9999,
    },
    pitchTypeBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#1d4ed8',
    },
    matchSubtitle: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 1,
    },
    matchLevelBadge: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
    },
    matchLevelText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#b45309',
    },
    matchTagsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
    },
    matchTagItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f2f4f6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    matchTagTextBold: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
    },
    matchTagText: {
        fontSize: 12,
        color: '#374151',
    },
    matchTagSuccess: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    matchTagSuccessText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#15803d',
    },
    matchActionsRow: {
        flexDirection: 'row',
        gap: 8,
        paddingTop: 4,
    },
    batKeoBtn: {
        flex: 1,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#006b2c',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        shadowColor: '#006b2c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    batKeoBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
    chatIconBtn: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#f2f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Stadium Field Card
    fieldCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        marginHorizontal: 16,
        marginTop: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 3,
    },
    fieldImageWrapper: {
        width: '100%',
        height: 180,
        position: 'relative',
    },
    fieldImage: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    imageTopRow: {
        position: 'absolute',
        top: 10,
        left: 10,
        right: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    fifaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(5, 91, 53, 0.92)',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 9999,
        gap: 4,
    },
    fifaBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#ffffff',
    },
    favBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    imageBottomRow: {
        position: 'absolute',
        bottom: 10,
        left: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    fieldNameOverlay: {
        fontSize: 17,
        fontWeight: '800',
        color: '#ffffff',
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    fieldAddrRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: 2,
    },
    fieldAddrOverlay: {
        fontSize: 12,
        color: '#f1f5f9',
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    ratingText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },
    ratingCount: {
        fontSize: 11,
        color: '#cbd5e1',
    },
    cardBody: {
        padding: 14,
        gap: 10,
    },
    amenitiesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    amenityChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f2f4f6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 4,
    },
    amenityChipText: {
        fontSize: 11,
        color: '#374151',
        fontWeight: '500',
    },
    separatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 2,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#eceef0',
    },
    slotsAvailableBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fee2e2',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
        marginHorizontal: 8,
        gap: 4,
    },
    slotsAvailableText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#b91c1c',
    },
    priceCtaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 2,
    },
    priceLabel: {
        fontSize: 11,
        color: '#6b7280',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    priceValue: {
        fontSize: 18,
        fontWeight: '800',
        color: '#006b2c',
    },
    priceUnit: {
        fontSize: 12,
        color: '#6b7280',
    },
    bookNowBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#006b2c',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 6,
        shadowColor: '#006b2c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 12,
        elevation: 3,
    },
    bookNowBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
    // Footer Section
    footerSection: {
        paddingHorizontal: 16,
        marginTop: 18,
        gap: 12,
    },
    flowCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    flowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    flowTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    flowStepsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    stepItem: {
        alignItems: 'center',
        flex: 1,
    },
    stepCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f0fdf4',
        borderWidth: 1.5,
        borderColor: '#86efac',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    stepNumber: {
        fontSize: 14,
        fontWeight: '800',
        color: '#006b2c',
    },
    stepText: {
        fontSize: 11,
        color: '#374151',
        fontWeight: '600',
        textAlign: 'center',
    },
    stepArrow: {
        marginBottom: 18,
    },
    hotlineCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#fee2e2',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    hotlineLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    hotlineIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fee2e2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    hotlineTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    hotlineSub: {
        fontSize: 12,
        color: '#b91c1c',
        fontWeight: '600',
        marginTop: 1,
    },
    hotlineCallBtn: {
        backgroundColor: '#fee2e2',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    hotlineCallBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#b91c1c',
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
});
