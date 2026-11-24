import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFieldsApi } from '../api/fieldsApi';
import { MEDIA_URL } from '../config';
import { AuthContext } from '../context/AuthContext';

export default function FieldsScreen({ navigation }) {
    const { user } = useContext(AuthContext);
    const [fields, setFields] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState('all');
    const [priceRange, setPriceRange] = useState('all');
    const [selectedDistrict, setSelectedDistrict] = useState('all');
    const [selectedAmenity, setSelectedAmenity] = useState('all');
    const [sortAsc, setSortAsc] = useState(false);
    const [favorites, setFavorites] = useState({});

    const fetchFields = async () => {
        try {
            const res = await getFieldsApi();
            const list = res?.fields || res?.results || (Array.isArray(res) ? res : []);
            setFields(list);
        } catch (e) {
            console.warn('Lỗi tải danh sách sân:', e.message);
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

    const filtered = fields.filter(f => {
        const name = (f.name || f.field_name || '').toLowerCase();
        const addr = (f.address || f.location || '').toLowerCase();
        const q = searchQuery.toLowerCase().trim();
        if (q && !name.includes(q) && !addr.includes(q)) return false;

        if (selectedType !== 'all') {
            const t = (f.field_type_name || f.field_type?.name || String(f.field_type || '')).toLowerCase();
            if (!t.includes(selectedType)) return false;
        }

        if (selectedDistrict !== 'all') {
            if (!addr.includes(selectedDistrict.toLowerCase())) return false;
        }

        const price = Number(f.price_per_hour || f.price || 0);
        if (priceRange === 'under250' && price > 250000) return false;
        if (priceRange === 'above250' && price <= 250000) return false;

        return true;
    }).sort((a, b) => {
        const pA = Number(a.price_per_hour || a.price || 0);
        const pB = Number(b.price_per_hour || b.price || 0);
        return sortAsc ? pA - pB : pB - pA;
    });

    const formatPrice = (price) => {
        return new Intl.NumberFormat('vi-VN').format(price);
    };

    const renderHeader = () => (
        <View style={styles.headerBox}>
            {/* 1. TOP APP BAR */}
            <View style={styles.topBar}>
                <View style={styles.brandGroup}>
                    <View style={styles.logoBadge}>
                        <Ionicons name="football" size={18} color="#ffffff" />
                    </View>
                    <View style={styles.brandTextWrap}>
                        <Text style={styles.brandSub}>SÂN BÓNG HẢI CHÂU</Text>
                        <Text style={styles.brandTitle}>Sân Bóng</Text>
                    </View>
                </View>

                <View style={styles.topRightGroup}>
                    <TouchableOpacity
                        style={styles.notifBtn}
                        onPress={() => navigation.navigate('Contact')}
                    >
                        <Ionicons name="notifications-outline" size={22} color="#111827" />
                        <View style={styles.notifDot} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.avatarCircle}
                        onPress={() => navigation.navigate(user ? 'ProfileTab' : 'Login')}
                    >
                        <Ionicons name="person" size={18} color="#006b2c" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* 2. SEARCH & QUICK FILTER BAR */}
            <View style={styles.searchRow}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#6e7b6c" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Tìm tên sân, đường, quận tại Đà Nẵng..."
                        placeholderTextColor="#9ca3af"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery ? (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                            <Ionicons name="close-circle" size={18} color="#9ca3af" />
                        </TouchableOpacity>
                    ) : null}
                </View>

                <TouchableOpacity
                    style={styles.filterTuneBtn}
                    onPress={() => {
                        setSelectedType('all');
                        setPriceRange('all');
                        setSelectedDistrict('all');
                    }}
                >
                    <Ionicons name="options-outline" size={22} color="#111827" />
                    {(selectedType !== 'all' || priceRange !== 'all' || selectedDistrict !== 'all') && (
                        <View style={styles.tuneActiveDot} />
                    )}
                </TouchableOpacity>
            </View>

            {/* 3. HORIZONTAL SCROLLABLE FILTER CHIPS */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChipsContainer}
                style={styles.filterChipsScroll}
            >
                {/* District Filter Chip */}
                <TouchableOpacity
                    style={[styles.chip, selectedDistrict === 'hải châu' && styles.chipActive]}
                    onPress={() => setSelectedDistrict(selectedDistrict === 'hải châu' ? 'all' : 'hải châu')}
                >
                    <Ionicons
                        name="location-sharp"
                        size={16}
                        color={selectedDistrict === 'hải châu' ? '#ffffff' : '#006b2c'}
                    />
                    <Text style={[styles.chipText, selectedDistrict === 'hải châu' && styles.chipTextActive]}>
                        Hải Châu & Cẩm Lệ
                    </Text>
                    <Ionicons
                        name="chevron-down"
                        size={14}
                        color={selectedDistrict === 'hải châu' ? '#ffffff' : '#6b7280'}
                    />
                </TouchableOpacity>

                {/* Pitch Type 7 */}
                <TouchableOpacity
                    style={[styles.chip, selectedType === '7' && styles.chipActive]}
                    onPress={() => setSelectedType(selectedType === '7' ? 'all' : '7')}
                >
                    <Ionicons
                        name="football"
                        size={16}
                        color={selectedType === '7' ? '#ffffff' : '#006b2c'}
                    />
                    <Text style={[styles.chipText, selectedType === '7' && styles.chipTextActive]}>
                        Sân 7 người
                    </Text>
                </TouchableOpacity>

                {/* Pitch Type 5 */}
                <TouchableOpacity
                    style={[styles.chip, selectedType === '5' && styles.chipActive]}
                    onPress={() => setSelectedType(selectedType === '5' ? 'all' : '5')}
                >
                    <Ionicons
                        name="football-outline"
                        size={16}
                        color={selectedType === '5' ? '#ffffff' : '#006b2c'}
                    />
                    <Text style={[styles.chipText, selectedType === '5' && styles.chipTextActive]}>
                        Sân 5 người
                    </Text>
                </TouchableOpacity>

                {/* Price Range */}
                <TouchableOpacity
                    style={[styles.chip, priceRange !== 'all' && styles.chipActive]}
                    onPress={() => setPriceRange(priceRange === 'all' ? 'under250' : 'all')}
                >
                    <Ionicons
                        name="cash-outline"
                        size={16}
                        color={priceRange !== 'all' ? '#ffffff' : '#b45309'}
                    />
                    <Text style={[styles.chipText, priceRange !== 'all' && styles.chipTextActive]}>
                        {priceRange === 'all' ? '100k - 600k' : '< 250k/h'}
                    </Text>
                </TouchableOpacity>

                {/* Amenity: LED */}
                <TouchableOpacity
                    style={[styles.chip, selectedAmenity === 'led' && styles.chipActive]}
                    onPress={() => setSelectedAmenity(selectedAmenity === 'led' ? 'all' : 'led')}
                >
                    <Ionicons
                        name="flash-outline"
                        size={16}
                        color={selectedAmenity === 'led' ? '#ffffff' : '#f59e0b'}
                    />
                    <Text style={[styles.chipText, selectedAmenity === 'led' && styles.chipTextActive]}>
                        Đèn LED cao áp
                    </Text>
                </TouchableOpacity>

                {/* Amenity: Free Parking */}
                <TouchableOpacity
                    style={[styles.chip, selectedAmenity === 'parking' && styles.chipActive]}
                    onPress={() => setSelectedAmenity(selectedAmenity === 'parking' ? 'all' : 'parking')}
                >
                    <Ionicons
                        name="car-outline"
                        size={16}
                        color={selectedAmenity === 'parking' ? '#ffffff' : '#006b2c'}
                    />
                    <Text style={[styles.chipText, selectedAmenity === 'parking' && styles.chipTextActive]}>
                        Free gửi xe
                    </Text>
                </TouchableOpacity>

                {/* Amenity: Shower */}
                <TouchableOpacity
                    style={[styles.chip, selectedAmenity === 'shower' && styles.chipActive]}
                    onPress={() => setSelectedAmenity(selectedAmenity === 'shower' ? 'all' : 'shower')}
                >
                    <Ionicons
                        name="water-outline"
                        size={16}
                        color={selectedAmenity === 'shower' ? '#ffffff' : '#0284c7'}
                    />
                    <Text style={[styles.chipText, selectedAmenity === 'shower' && styles.chipTextActive]}>
                        Tắm nóng lạnh
                    </Text>
                </TouchableOpacity>
            </ScrollView>

            {/* 4. LIVE AVAILABILITY STATUS BANNER */}
            <View style={styles.liveBanner}>
                <View style={styles.liveBannerLeft}>
                    <View style={styles.pulsingPingBox}>
                        <View style={styles.pulsingDot} />
                    </View>
                    <Text style={styles.liveBannerText}>
                        Tìm thấy <Text style={styles.liveBannerHighlight}>{filtered.length} sân bóng</Text> sẵn sàng đón khách
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.sortBtn}
                    onPress={() => setSortAsc(!sortAsc)}
                >
                    <Ionicons name="swap-vertical" size={18} color="#006b2c" />
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
        const typeName = item.field_type_name || item.field_type?.name || 'Sân bóng';
        const isFav = !!favorites[item.id];

        return (
            <View style={styles.cardContainer}>
                {/* 1. Hero Image with Top & Bottom Overlays */}
                <View style={styles.imageBox}>
                    <Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="cover" />
                    <View style={styles.imageGradientOverlay} />

                    {/* Top Tags */}
                    <View style={styles.cardTopRow}>
                        <View style={styles.tagsGroup}>
                            <View style={styles.fifaTag}>
                                <Ionicons name="checkmark-circle" size={14} color="#15803d" />
                                <Text style={styles.fifaTagText}>FIFA Quality Pro</Text>
                            </View>
                            <View style={styles.typeTag}>
                                <Text style={styles.typeTagText}>{typeName}</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.wishlistBtn}
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

                    {/* Availability & Price pill on bottom edge */}
                    <View style={styles.cardBottomOverlay}>
                        <View style={styles.slotAvailablePill}>
                            <View style={styles.greenMiniDot} />
                            <Text style={styles.slotAvailableText}>Còn khung giờ trống</Text>
                        </View>

                        <View style={styles.pricePill}>
                            <Text style={styles.pricePillText}>
                                {Math.round(price / 1000)}k<Text style={styles.pricePillUnit}>/h</Text>
                            </Text>
                        </View>
                    </View>
                </View>

                {/* 2. Card Body */}
                <View style={styles.cardContent}>
                    <View style={styles.cardInfoRow}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.fieldName} numberOfLines={1}>{name}</Text>
                            <View style={styles.locationRow}>
                                <Ionicons name="location-outline" size={15} color="#6e7b6c" />
                                <Text style={styles.locationText} numberOfLines={1}>{address}</Text>
                            </View>
                        </View>

                        <View style={styles.ratingBadge}>
                            <Ionicons name="star" size={15} color="#b45309" />
                            <Text style={styles.ratingScore}>4.9</Text>
                            <Text style={styles.ratingCount}>(120)</Text>
                        </View>
                    </View>

                    {/* Tactical Amenities Chips */}
                    <View style={styles.amenitiesGrid}>
                        <View style={styles.amenityBadge}>
                            <Ionicons name="football-outline" size={13} color="#006b2c" />
                            <Text style={styles.amenityText}>Cỏ sợi kim cương</Text>
                        </View>
                        <View style={styles.amenityBadge}>
                            <Ionicons name="bulb-outline" size={13} color="#f59e0b" />
                            <Text style={styles.amenityText}>Đèn LED 4 cột</Text>
                        </View>
                        <View style={styles.amenityBadge}>
                            <Ionicons name="snow-outline" size={13} color="#0284c7" />
                            <Text style={styles.amenityText}>Căn tin lạnh</Text>
                        </View>
                        <View style={styles.amenityBadge}>
                            <Ionicons name="car-outline" size={13} color="#006b2c" />
                            <Text style={styles.amenityText}>Bãi xe rộng</Text>
                        </View>
                    </View>

                    {/* Action CTAs: 2 Columns */}
                    <View style={styles.ctaGrid}>
                        <TouchableOpacity
                            style={styles.detailBtn}
                            onPress={() => navigation.navigate('FieldDetail', { fieldId: item.id })}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.detailBtnText}>Xem chi tiết</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.bookingBtn}
                            onPress={() => navigation.navigate('Booking', { field: item })}
                            activeOpacity={0.9}
                        >
                            <Text style={styles.bookingBtnText}>Đặt nhanh</Text>
                            <Ionicons name="arrow-forward" size={16} color="#ffffff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#006b2c" />
                    <Text style={styles.loadingText}>Đang tải danh sách sân bóng...</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item, index) => String(item.id || index)}
                    renderItem={renderFieldItem}
                    ListHeaderComponent={renderHeader}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#006b2c']} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="football-outline" size={48} color="#bdcaba" />
                            <Text style={styles.emptyTitle}>Không có sân bóng nào</Text>
                            <Text style={styles.emptySub}>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</Text>
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
    brandGroup: {
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
    topRightGroup: {
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
    avatarCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f0fdf4',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#dcfce7',
    },
    // Search & Filter
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 48,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
        color: '#111827',
    },
    filterTuneBtn: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    tuneActiveDot: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#006b2c',
        borderWidth: 1.5,
        borderColor: '#ffffff',
    },
    // Chips
    filterChipsScroll: {
        marginTop: 12,
        marginHorizontal: -16,
    },
    filterChipsContainer: {
        paddingHorizontal: 16,
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingHorizontal: 13,
        paddingVertical: 8,
        borderRadius: 9999,
        gap: 5,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    chipActive: {
        backgroundColor: '#006b2c',
        shadowColor: '#006b2c',
        shadowOpacity: 0.25,
        shadowRadius: 8,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    chipTextActive: {
        color: '#ffffff',
    },
    // Live Banner
    liveBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f2f4f6',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginTop: 14,
    },
    liveBannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    pulsingPingBox: {
        width: 10,
        height: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pulsingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#006b2c',
    },
    liveBannerText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#111827',
    },
    liveBannerHighlight: {
        color: '#006b2c',
        fontWeight: '700',
    },
    sortBtn: {
        padding: 4,
    },
    // Card
    cardContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        marginHorizontal: 16,
        marginTop: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 3,
    },
    imageBox: {
        width: '100%',
        height: 190,
        position: 'relative',
    },
    cardImage: {
        width: '100%',
        height: '100%',
    },
    imageGradientOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
    },
    cardTopRow: {
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    tagsGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    fifaTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 9999,
        gap: 4,
    },
    fifaTagText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#15803d',
    },
    typeTag: {
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 9999,
    },
    typeTagText: {
        fontSize: 11,
        color: '#ffffff',
        fontWeight: '600',
    },
    wishlistBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardBottomOverlay: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    slotAvailablePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        gap: 6,
    },
    greenMiniDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#62df7d',
    },
    slotAvailableText: {
        fontSize: 11,
        color: '#ffffff',
        fontWeight: '600',
    },
    pricePill: {
        backgroundColor: 'rgba(0, 107, 44, 0.95)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    pricePillText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#ffffff',
    },
    pricePillUnit: {
        fontSize: 11,
        fontWeight: '400',
        opacity: 0.9,
    },
    cardContent: {
        padding: 16,
        gap: 12,
    },
    cardInfoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    fieldName: {
        fontSize: 17,
        fontWeight: '800',
        color: '#111827',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 3,
    },
    locationText: {
        fontSize: 12,
        color: '#6b7280',
        flexShrink: 1,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef3c7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 3,
    },
    ratingScore: {
        fontSize: 12,
        fontWeight: '800',
        color: '#b45309',
    },
    ratingCount: {
        fontSize: 11,
        color: '#6b7280',
    },
    amenitiesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    amenityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        gap: 4,
    },
    amenityText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#3e4a3d',
    },
    ctaGrid: {
        flexDirection: 'row',
        gap: 10,
        paddingTop: 4,
    },
    detailBtn: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    bookingBtn: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#006b2c',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        shadowColor: '#006b2c',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 3,
    },
    bookingBtnText: {
        fontSize: 13,
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
});
