import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    Platform,
    Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
    adminGetVouchersApi,
    adminCreateVoucherApi,
    adminUpdateVoucherApi,
    adminDeleteVoucherApi,
    adminGetCustomerVouchersHistoryApi
} from '../api/vouchersApi';

export default function AdminVouchersScreen({ navigation }) {
    // Main Tab: 'vouchers' (Chính sách voucher) | 'history' (Lịch sử phát cho khách)
    const [mainTab, setMainTab] = useState('vouchers');

    const [vouchers, setVouchers] = useState([]);
    const [stats, setStats] = useState({ total: 0, active: 0, system_rewards: 0, total_used: 0 });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    // State Lịch sử phát voucher cho khách
    const [issuedVouchers, setIssuedVouchers] = useState([]);
    const [loadingIssued, setLoadingIssued] = useState(false);
    const [issuedSearch, setIssuedSearch] = useState('');
    const [issuedFilter, setIssuedFilter] = useState('all');


    // Modal Create / Edit
    const [modalVisible, setModalVisible] = useState(false);
    const [editingVoucher, setEditingVoucher] = useState(null);
    const [code, setCode] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [discountType, setDiscountType] = useState('percent');
    const [discountValue, setDiscountValue] = useState('10');
    const [maxDiscount, setMaxDiscount] = useState('50000');
    const [minBookingPrice, setMinBookingPrice] = useState('100000');
    const [expiryDays, setExpiryDays] = useState('30');
    const [usageLimit, setUsageLimit] = useState('100');
    const [applicableTo, setApplicableTo] = useState('all');
    const [isActive, setIsActive] = useState(true);
    const [saving, setSaving] = useState(false);

    // Broadcast sync event cho Web và các thiết bị khác
    const broadcastAppSync = (type = 'voucher_updated') => {
        try {
            const data = { type, timestamp: Date.now() };
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('football_booking_sync_event', JSON.stringify(data));
                window.dispatchEvent(new CustomEvent('football_sync', { detail: data }));
            }
        } catch (e) {
            console.warn('Sync broadcast err:', e);
        }
    };

    const loadVouchers = async (isManual = false) => {
        if (isManual) setLoading(true);
        try {
            const data = await adminGetVouchersApi();
            const list = data?.vouchers || (Array.isArray(data) ? data : (data?.results || []));
            setVouchers(list);
            if (data?.stats) {
                setStats(data.stats);
            }
        } catch (e) {
            console.warn('Lỗi lấy vouchers:', e.message);
        } finally {
            if (isManual || loading) setLoading(false);
        }
    };

    const loadIssuedHistory = async (isManual = false) => {
        if (isManual) setLoadingIssued(true);
        try {
            const data = await adminGetCustomerVouchersHistoryApi();
            const list = data?.issued_vouchers || data?.customer_vouchers || (Array.isArray(data) ? data : []);
            setIssuedVouchers(list);
        } catch (e) {
            console.warn('Lỗi lấy lịch sử phát voucher:', e.message);
        } finally {
            if (isManual || loadingIssued) setLoadingIssued(false);
        }
    };

    useEffect(() => {
        loadVouchers(true);

        // Smart polling định kỳ mỗi 3.5s để cập nhật voucher tự động
        const timer = setInterval(() => {
            if (mainTab === 'vouchers') {
                loadVouchers(false);
            } else {
                loadIssuedHistory(false);
            }
        }, 3500);

        // Lắng nghe sự kiện storage / football_sync khi Web hoặc app khác thay đổi voucher
        const handleSync = (e) => {
            try {
                const eventData = e?.detail || (e?.newValue ? JSON.parse(e.newValue) : null);
                if (eventData?.type?.startsWith('voucher_')) {
                    if (mainTab === 'vouchers') {
                        loadVouchers(false);
                    } else {
                        loadIssuedHistory(false);
                    }
                }
            } catch {}
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('football_sync', handleSync);
            window.addEventListener('storage', handleSync);
        }

        return () => {
            clearInterval(timer);
            if (typeof window !== 'undefined') {
                window.removeEventListener('football_sync', handleSync);
                window.removeEventListener('storage', handleSync);
            }
        };
    }, [mainTab]);

    useEffect(() => {
        if (mainTab === 'history') {
            loadIssuedHistory(true);
        }
    }, [mainTab]);


    const openAddModal = () => {
        setEditingVoucher(null);
        setCode('');
        setTitle('');
        setDescription('');
        setDiscountType('percent');
        setDiscountValue('10');
        setMaxDiscount('50000');
        setMinBookingPrice('100000');
        setExpiryDays('30');
        setUsageLimit('100');
        setApplicableTo('all');
        setIsActive(true);
        setModalVisible(true);
    };

    const openEditModal = (v) => {
        setEditingVoucher(v);
        setCode(v.code || '');
        setTitle(v.title || '');
        setDescription(v.description || '');
        setDiscountType(v.discount_type || 'percent');
        setDiscountValue(String(v.discount_value || '10'));
        setMaxDiscount(v.max_discount ? String(v.max_discount) : '');
        setMinBookingPrice(v.min_booking_price ? String(v.min_booking_price) : '0');
        setExpiryDays(String(v.expiry_days || '30'));
        setUsageLimit(v.usage_limit ? String(v.usage_limit) : '');
        setApplicableTo(v.applicable_to || 'all');
        setIsActive(v.is_active !== false);
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!code.trim() || !title.trim()) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập mã voucher và tiêu đề');
            return;
        }
        if (!discountValue || isNaN(Number(discountValue)) || Number(discountValue) <= 0) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập giá trị giảm hợp lệ (> 0)');
            return;
        }
        if (discountType === 'percent' && Number(discountValue) > 100) {
            Alert.alert('Lỗi', 'Phần trăm giảm giá không thể vượt quá 100%');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                code: code.trim().toUpperCase(),
                title: title.trim(),
                description: description.trim(),
                discount_type: discountType,
                discount_value: parseFloat(discountValue) || 0,
                max_discount: maxDiscount ? (parseFloat(maxDiscount) || null) : null,
                min_booking_price: minBookingPrice ? (parseFloat(minBookingPrice) || 0) : 0,
                expiry_days: parseInt(expiryDays, 10) || 30,
                usage_limit: usageLimit ? (parseInt(usageLimit, 10) || null) : null,
                applicable_to: applicableTo,
                is_active: isActive
            };

            if (editingVoucher) {
                await adminUpdateVoucherApi(editingVoucher.id, payload);
                broadcastAppSync('voucher_updated');
                Alert.alert('Thành công', 'Đã cập nhật thông tin voucher');
            } else {
                await adminCreateVoucherApi(payload);
                broadcastAppSync('voucher_updated');
                Alert.alert('Thành công', 'Tạo voucher mới thành công');
            }
            setModalVisible(false);
            loadVouchers();
        } catch (e) {
            Alert.alert('Lỗi', e.response?.data?.error || e.message || 'Không thể lưu voucher');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (v) => {
        const doDelete = async () => {
            try {
                await adminDeleteVoucherApi(v.id);
                broadcastAppSync('voucher_updated');
                loadVouchers();
            } catch (err) {
                Alert.alert('Lỗi', 'Không thể xóa Voucher');
            }
        };

        Alert.alert(
            'Xóa Voucher',
            `Bạn có chắc chắn muốn xóa mã "${v.code}"?`,
            [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Xóa ngay', style: 'destructive', onPress: doDelete }
            ]
        );
    };

    // Filter list
    const filtered = useMemo(() => {
        return vouchers.filter(v => {
            const query = searchQuery.trim().toLowerCase();
            const matchesSearch = !query || `${v.code || ''} ${v.title || ''} ${v.description || ''}`.toLowerCase().includes(query);
            if (!matchesSearch) return false;

            if (filterStatus === 'all') return true;
            if (filterStatus === 'active') return v.is_active;
            if (filterStatus === 'inactive') return !v.is_active;
            return true;
        });
    }, [vouchers, searchQuery, filterStatus]);

    // Filtered Issued Vouchers (Lịch sử phát cho khách)
    const filteredIssued = useMemo(() => {
        return issuedVouchers.filter((iv) => {
            const query = issuedSearch.trim().toLowerCase();
            const matchesSearch =
                !query ||
                (iv.code && iv.code.toLowerCase().includes(query)) ||
                (iv.customer_name && iv.customer_name.toLowerCase().includes(query)) ||
                (iv.customer_phone && iv.customer_phone.toLowerCase().includes(query)) ||
                (iv.customer_email && iv.customer_email.toLowerCase().includes(query)) ||
                (iv.voucher_code && iv.voucher_code.toLowerCase().includes(query)) ||
                (iv.voucher_title && iv.voucher_title.toLowerCase().includes(query));

            if (!matchesSearch) return false;

            if (issuedFilter === 'active') return !iv.is_used && !iv.is_expired;
            if (issuedFilter === 'used') return iv.is_used;
            if (issuedFilter === 'expired') return !iv.is_used && iv.is_expired;
            return true;
        });
    }, [issuedVouchers, issuedSearch, issuedFilter]);

    const issuedStats = useMemo(() => {
        const total = issuedVouchers.length;
        const active = issuedVouchers.filter((iv) => !iv.is_used && !iv.is_expired).length;
        const used = issuedVouchers.filter((iv) => iv.is_used).length;
        const expired = issuedVouchers.filter((iv) => !iv.is_used && iv.is_expired).length;
        return { total, active, used, expired };
    }, [issuedVouchers]);


    const activeCount = vouchers.filter(v => v.is_active).length;
    const totalCount = vouchers.length;

    const renderItem = ({ item }) => {
        const isPercent = item.discount_type === 'percent';
        const valStr = isPercent ? `${item.discount_value}%` : `${Number(item.discount_value || 0).toLocaleString('vi-VN')}đ`;

        return (
            <View style={styles.vCard}>
                <View style={styles.vHeaderRow}>
                    <View style={styles.codeBadge}>
                        <Ionicons name="pricetag" size={13} color="#006b2c" />
                        <Text style={styles.codeText}>{item.code}</Text>
                    </View>
                    <View style={[styles.statusBadge, item.is_active ? styles.statusActive : styles.statusInactive]}>
                        <View style={[styles.statusDot, item.is_active ? styles.dotActive : styles.dotInactive]} />
                        <Text style={[styles.statusText, item.is_active ? styles.textActive : styles.textInactive]}>
                            {item.is_active ? 'Đang hoạt động' : 'Tạm ngưng'}
                        </Text>
                    </View>
                </View>

                <Text style={styles.vTitle}>{item.title}</Text>
                {item.description ? (
                    <Text style={styles.vDesc} numberOfLines={2}>{item.description}</Text>
                ) : null}

                <View style={styles.vDiscountBox}>
                    <Text style={styles.vDiscountMain}>
                        Giảm <Text style={styles.vDiscountHighlight}>{valStr}</Text>
                        {isPercent && item.max_discount ? ` (Tối đa ${Number(item.max_discount).toLocaleString('vi-VN')}đ)` : ''}
                    </Text>
                    {item.min_booking_price ? (
                        <Text style={styles.vDiscountCondition}>
                            Áp dụng cho đơn từ {Number(item.min_booking_price).toLocaleString('vi-VN')}đ
                        </Text>
                    ) : null}
                </View>

                <View style={styles.vFooterRow}>
                    <View style={styles.vUsageInfo}>
                        <Ionicons name="time-outline" size={13} color="#6b7280" />
                        <Text style={styles.vUsageText}>
                            Hạn {item.expiry_days || 30} ngày • {item.usage_limit ? `Giới hạn: ${item.usage_limit} lượt` : 'Không giới hạn'}
                        </Text>
                    </View>

                    <View style={styles.actionGroup}>
                        <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(item)} activeOpacity={0.8}>
                            <Ionicons name="create-outline" size={15} color="#111827" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)} activeOpacity={0.8}>
                            <Ionicons name="trash-outline" size={15} color="#b91c1c" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    const renderIssuedItem = ({ item }) => {
        const isUsed = Boolean(item.is_used);
        const isExpired = Boolean(item.is_expired);
        const statusLabel = isUsed ? 'Đã sử dụng' : (isExpired ? 'Đã hết hạn' : 'Còn hiệu lực');
        const statusBg = isUsed ? '#dcfce7' : (isExpired ? '#f1f5f9' : '#e0f2fe');
        const statusColor = isUsed ? '#15803d' : (isExpired ? '#64748b' : '#0284c7');

        return (
            <View style={styles.vCard}>
                <View style={styles.vHeaderRow}>
                    <View style={styles.codeBadge}>
                        <Ionicons name="gift-outline" size={13} color="#006b2c" />
                        <Text style={styles.codeText}>{item.code || item.voucher_code || 'VOUCHER'}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: 'transparent' }]}>
                        <Text style={[styles.statusText, { color: statusColor, fontWeight: '700' }]}>
                            {statusLabel}
                        </Text>
                    </View>
                </View>

                <Text style={styles.vTitle}>{item.voucher_title || item.title || 'Mã ưu đãi thành viên'}</Text>

                <View style={{ marginTop: 6, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="person-outline" size={13} color="#475569" />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b' }}>
                            {item.customer_name || 'Khách hàng'}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748b' }}>
                            ({item.customer_phone || 'Không có SĐT'})
                        </Text>
                    </View>

                    {item.customer_email ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="mail-outline" size={12} color="#64748b" />
                            <Text style={{ fontSize: 11, color: '#64748b' }}>{item.customer_email}</Text>
                        </View>
                    ) : null}

                    {item.source_booking_code ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <Ionicons name="calendar-outline" size={12} color="#006b2c" />
                            <Text style={{ fontSize: 11, color: '#006b2c', fontWeight: '600' }}>
                                Nhận từ đơn: {item.source_booking_code}
                            </Text>
                        </View>
                    ) : null}

                    {isUsed && item.used_booking_code ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="checkmark-done-circle-outline" size={12} color="#15803d" />
                            <Text style={{ fontSize: 11, color: '#15803d', fontWeight: '600' }}>
                                Đã áp dụng đơn: {item.used_booking_code}
                            </Text>
                        </View>
                    ) : null}
                </View>

                <View style={[styles.vFooterRow, { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' }]}>
                    <View style={styles.vUsageInfo}>
                        <Ionicons name="time-outline" size={12} color="#64748b" />
                        <Text style={styles.vUsageText}>
                            Hết hạn: {item.expires_at ? new Date(item.expires_at).toLocaleDateString('vi-VN') : 'Không thời hạn'}
                        </Text>
                    </View>
                    {item.discount_display ? (
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#006b2c' }}>
                            {item.discount_display}
                        </Text>
                    ) : null}
                </View>
            </View>
        );
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
                            <Text style={styles.topBarTitle}>Voucher & Khuyến Mãi</Text>
                            <View style={styles.proPill}>
                                <Text style={styles.proPillText}>PRO</Text>
                            </View>
                        </View>
                        <Text style={styles.topBarSubtitle}>QUẢN LÝ MÃ GIẢM GIÁ & LỊCH SỬ PHÁT</Text>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {mainTab === 'vouchers' && (
                        <TouchableOpacity style={styles.addBtn} onPress={openAddModal} activeOpacity={0.85}>
                            <Ionicons name="add" size={16} color="#ffffff" />
                            <Text style={styles.addBtnText}>+ Thêm mã</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Sub-menu Tabs: Chính sách voucher | Lịch sử phát voucher */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 8 }}>
                <TouchableOpacity
                    style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: 'center',
                        borderRadius: 8,
                        backgroundColor: mainTab === 'vouchers' ? '#006b2c' : '#f8fafc',
                        borderWidth: 1,
                        borderColor: mainTab === 'vouchers' ? '#006b2c' : '#e2e8f0'
                    }}
                    onPress={() => setMainTab('vouchers')}
                >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: mainTab === 'vouchers' ? '#ffffff' : '#64748b' }}>
                        Chính sách voucher
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: 'center',
                        borderRadius: 8,
                        backgroundColor: mainTab === 'history' ? '#006b2c' : '#f8fafc',
                        borderWidth: 1,
                        borderColor: mainTab === 'history' ? '#006b2c' : '#e2e8f0'
                    }}
                    onPress={() => setMainTab('history')}
                >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: mainTab === 'history' ? '#ffffff' : '#64748b' }}>
                        Lịch sử phát ({issuedStats.total})
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {mainTab === 'vouchers' ? (
                    <>
                        {/* 2x2 Bento KPI Matrix */}
                        <View style={styles.bentoGrid}>
                            {/* Metric 1 */}
                            <View style={styles.bentoCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={styles.bentoLabel}>Tổng chiến dịch</Text>
                                    <View style={[styles.bentoIconBox, { backgroundColor: '#f0fdf4' }]}>
                                        <Ionicons name="pricetags" size={15} color="#006b2c" />
                                    </View>
                                </View>
                                <Text style={styles.bentoBigNum}>{totalCount} <Text style={styles.bentoUnit}>mã</Text></Text>
                                <Text style={styles.bentoSubText}>{activeCount} mã đang mở áp dụng</Text>
                            </View>

                            {/* Metric 2 */}
                            <View style={styles.bentoCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={styles.bentoLabel}>Lượt dùng</Text>
                                    <View style={[styles.bentoIconBox, { backgroundColor: '#dbeafe' }]}>
                                        <Ionicons name="ticket" size={15} color="#1d4ed8" />
                                    </View>
                                </View>
                                <Text style={styles.bentoBigNum}>{stats.total_used || 0} <Text style={styles.bentoUnit}>lượt</Text></Text>
                                <Text style={[styles.bentoSubText, { color: '#15803d', fontWeight: '700' }]}>Tự động gạch cọc VietQR</Text>
                            </View>

                            {/* Metric 3 */}
                            <View style={styles.bentoCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={styles.bentoLabel}>Đang kích hoạt</Text>
                                    <View style={[styles.bentoIconBox, { backgroundColor: '#dcfce7' }]}>
                                        <Ionicons name="radio" size={15} color="#15803d" />
                                    </View>
                                </View>
                                <Text style={styles.bentoBigNum}>{activeCount} <Text style={styles.bentoUnit}>/{totalCount}</Text></Text>
                                <Text style={styles.bentoSubText}>Khách quét QR áp mã tức thì</Text>
                            </View>

                            {/* Metric 4 */}
                            <View style={styles.bentoCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={styles.bentoLabel}>Tạm ngưng</Text>
                                    <View style={[styles.bentoIconBox, { backgroundColor: '#f2f4f6' }]}>
                                        <Ionicons name="pause" size={15} color="#6b7280" />
                                    </View>
                                </View>
                                <Text style={styles.bentoBigNum}>{totalCount - activeCount} <Text style={styles.bentoUnit}>mã</Text></Text>
                                <Text style={styles.bentoSubText}>Chờ kích hoạt chiến dịch</Text>
                            </View>
                        </View>

                        {/* Filter Pills: Wrap for Mobile */}
                        <View style={styles.filterWrap}>
                            {[
                                { key: 'all', label: `Tất cả (${totalCount})` },
                                { key: 'active', label: `Đang chạy (${activeCount})` },
                                { key: 'inactive', label: `Tạm ngưng (${totalCount - activeCount})` },
                            ].map(tab => {
                                const isSel = filterStatus === tab.key;
                                return (
                                    <TouchableOpacity
                                        key={tab.key}
                                        style={[styles.filterChip, isSel && styles.filterChipActive]}
                                        onPress={() => setFilterStatus(tab.key)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.filterChipText, isSel && styles.filterChipTextActive]}>
                                            {tab.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Search Bar */}
                        <View style={styles.searchWrapper}>
                            <View style={styles.searchInner}>
                                <Ionicons name="search" size={18} color="#6b7280" />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Tìm kiếm mã code, tên chiến dịch..."
                                    placeholderTextColor="#94a3b8"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={16} color="#94a3b8" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Vouchers List */}
                        {loading ? (
                            <View style={styles.centerBox}>
                                <ActivityIndicator size="large" color="#006b2c" />
                                <Text style={{ marginTop: 10, color: '#6b7280', fontSize: 13 }}>Đang tải danh sách voucher...</Text>
                            </View>
                        ) : filtered.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="pricetags-outline" size={48} color="#94a3b8" />
                                <Text style={styles.emptyTitle}>Chưa có mã khuyến mãi nào</Text>
                                <Text style={styles.emptySub}>Thử tạo mới voucher để kích cầu ca giờ vàng</Text>
                            </View>
                        ) : (
                            <View style={styles.vouchersGrid}>
                                {filtered.map(item => (
                                    <View key={item.id}>
                                        {renderItem({ item })}
                                    </View>
                                ))}
                            </View>
                        )}
                    </>
                ) : (
                    /* HISTORY TAB: LỊCH SỬ PHÁT VOUCHER CHO KHÁCH */
                    <>
                        {/* 4 Bento KPI Cards for Issued History */}
                        <View style={styles.bentoGrid}>
                            <View style={styles.bentoCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={styles.bentoLabel}>Tổng phát hành</Text>
                                    <View style={[styles.bentoIconBox, { backgroundColor: '#f0fdf4' }]}>
                                        <Ionicons name="gift" size={15} color="#006b2c" />
                                    </View>
                                </View>
                                <Text style={styles.bentoBigNum}>{issuedStats.total} <Text style={styles.bentoUnit}>mã</Text></Text>
                                <Text style={styles.bentoSubText}>Voucher trong ví khách</Text>
                            </View>

                            <View style={styles.bentoCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={styles.bentoLabel}>Còn hiệu lực</Text>
                                    <View style={[styles.bentoIconBox, { backgroundColor: '#dbeafe' }]}>
                                        <Ionicons name="checkmark-circle" size={15} color="#1d4ed8" />
                                    </View>
                                </View>
                                <Text style={styles.bentoBigNum}>{issuedStats.active} <Text style={styles.bentoUnit}>mã</Text></Text>
                                <Text style={[styles.bentoSubText, { color: '#15803d', fontWeight: '700' }]}>Chờ khách sử dụng</Text>
                            </View>

                            <View style={styles.bentoCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={styles.bentoLabel}>Đã sử dụng</Text>
                                    <View style={[styles.bentoIconBox, { backgroundColor: '#dcfce7' }]}>
                                        <Ionicons name="checkmark-done" size={15} color="#15803d" />
                                    </View>
                                </View>
                                <Text style={styles.bentoBigNum}>{issuedStats.used} <Text style={styles.bentoUnit}>mã</Text></Text>
                                <Text style={styles.bentoSubText}>Đã gạch đơn đặt sân</Text>
                            </View>

                            <View style={styles.bentoCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={styles.bentoLabel}>Hết hạn</Text>
                                    <View style={[styles.bentoIconBox, { backgroundColor: '#f2f4f6' }]}>
                                        <Ionicons name="time" size={15} color="#6b7280" />
                                    </View>
                                </View>
                                <Text style={styles.bentoBigNum}>{issuedStats.expired} <Text style={styles.bentoUnit}>mã</Text></Text>
                                <Text style={styles.bentoSubText}>Đã quá thời gian hiệu lực</Text>
                            </View>
                        </View>

                        {/* Issued Filter Pills: Wrap for Mobile */}
                        <View style={styles.filterWrap}>
                            {[
                                { key: 'all', label: `Tất cả (${issuedStats.total})` },
                                { key: 'active', label: `Còn hiệu lực (${issuedStats.active})` },
                                { key: 'used', label: `Đã sử dụng (${issuedStats.used})` },
                                { key: 'expired', label: `Hết hạn (${issuedStats.expired})` },
                            ].map(tab => {
                                const isSel = issuedFilter === tab.key;
                                return (
                                    <TouchableOpacity
                                        key={tab.key}
                                        style={[styles.filterChip, isSel && styles.filterChipActive]}
                                        onPress={() => setIssuedFilter(tab.key)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.filterChipText, isSel && styles.filterChipTextActive]}>
                                            {tab.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Issued Search Bar */}
                        <View style={styles.searchWrapper}>
                            <View style={styles.searchInner}>
                                <Ionicons name="search" size={18} color="#6b7280" />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Tìm mã voucher, tên khách, SĐT..."
                                    placeholderTextColor="#94a3b8"
                                    value={issuedSearch}
                                    onChangeText={setIssuedSearch}
                                />
                                {issuedSearch.length > 0 && (
                                    <TouchableOpacity onPress={() => setIssuedSearch('')}>
                                        <Ionicons name="close-circle" size={16} color="#94a3b8" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Issued List */}
                        {loadingIssued ? (
                            <View style={styles.centerBox}>
                                <ActivityIndicator size="large" color="#006b2c" />
                                <Text style={{ marginTop: 10, color: '#6b7280', fontSize: 13 }}>Đang tải lịch sử phát voucher...</Text>
                            </View>
                        ) : filteredIssued.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="file-tray-outline" size={48} color="#94a3b8" />
                                <Text style={styles.emptyTitle}>Chưa có lịch sử phát voucher</Text>
                                <Text style={styles.emptySub}>Khi khách hàng nhận voucher phần thưởng sẽ hiển thị tại đây</Text>
                            </View>
                        ) : (
                            <View style={styles.vouchersGrid}>
                                {filteredIssued.map((item, idx) => (
                                    <View key={item.id || item.code || idx}>
                                        {renderIssuedItem({ item })}
                                    </View>
                                ))}
                            </View>
                        )}
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>


            {/* MODAL: CREATE / EDIT VOUCHER */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCardWrapper}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalSubHeader}>
                                    {editingVoucher ? 'CẬP NHẬT MÃ KHUYẾN MÃI' : 'TẠO MÃ KHUYẾN MÃI MỚI'}
                                </Text>
                                <Text style={styles.modalMainHeader}>
                                    {editingVoucher ? editingVoucher.code : 'Thiết Lập Chiến Dịch'}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                            <Text style={styles.formLabel}>Mã Voucher (Code) *</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Ví dụ: GIOVANG20"
                                placeholderTextColor="#94a3b8"
                                autoCapitalize="characters"
                                value={code}
                                onChangeText={setCode}
                            />

                            <Text style={styles.formLabel}>Tiêu đề chương trình *</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Ví dụ: Giờ Vàng Hoàng Hôn SePay"
                                placeholderTextColor="#94a3b8"
                                value={title}
                                onChangeText={setTitle}
                            />

                            <Text style={styles.formLabel}>Hình thức chiết khấu</Text>
                            <View style={styles.typeSelectorRow}>
                                {[
                                    { key: 'percent', label: 'Theo Phần Trăm (%)' },
                                    { key: 'fixed', label: 'Số Tiền Cố Định (VNĐ)' },
                                ].map(t => (
                                    <TouchableOpacity
                                        key={t.key}
                                        style={[styles.typePill, discountType === t.key && styles.typePillActive]}
                                        onPress={() => setDiscountType(t.key)}
                                    >
                                        <Text style={[styles.typePillText, discountType === t.key && styles.typePillTextActive]}>
                                            {t.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.formLabel}>Giá trị giảm ({discountType === 'percent' ? '%' : 'VNĐ'}) *</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder={discountType === 'percent' ? 'Ví dụ: 15 (tức 15%)' : 'Ví dụ: 50000'}
                                placeholderTextColor="#94a3b8"
                                keyboardType="numeric"
                                value={discountValue}
                                onChangeText={setDiscountValue}
                            />

                            {discountType === 'percent' ? (
                                <>
                                    <Text style={styles.formLabel}>Giảm tối đa (VNĐ)</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="Ví dụ: 50000 (để trống nếu không giới hạn)"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="numeric"
                                        value={maxDiscount}
                                        onChangeText={setMaxDiscount}
                                    />
                                </>
                            ) : null}

                            <Text style={styles.formLabel}>Giá trị đơn đặt tối thiểu (VNĐ)</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Ví dụ: 150000"
                                placeholderTextColor="#94a3b8"
                                keyboardType="numeric"
                                value={minBookingPrice}
                                onChangeText={setMinBookingPrice}
                            />

                            <Text style={styles.formLabel}>Thời hạn hiệu lực (Ngày)</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Ví dụ: 30"
                                placeholderTextColor="#94a3b8"
                                keyboardType="numeric"
                                value={expiryDays}
                                onChangeText={setExpiryDays}
                            />

                            <Text style={styles.formLabel}>Giới hạn số lượt dùng</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Ví dụ: 100 (để trống nếu không giới hạn)"
                                placeholderTextColor="#94a3b8"
                                keyboardType="numeric"
                                value={usageLimit}
                                onChangeText={setUsageLimit}
                            />

                            <Text style={styles.formLabel}>Mô tả chi tiết</Text>
                            <TextInput
                                style={[styles.formInput, { height: 60, textAlignVertical: 'top', paddingTop: 8 }]}
                                placeholder="Mô tả điều kiện áp dụng cho khách hàng..."
                                placeholderTextColor="#94a3b8"
                                multiline
                                numberOfLines={2}
                                value={description}
                                onChangeText={setDescription}
                            />

                            <View style={styles.statusToggleRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.statusToggleTitle}>Trạng thái kích hoạt</Text>
                                    <Text style={styles.statusToggleSub}>
                                        {isActive ? 'Mã đang chạy, khách có thể nhập' : 'Tạm dừng áp dụng'}
                                    </Text>
                                </View>
                                <Switch
                                    value={isActive}
                                    onValueChange={setIsActive}
                                    trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                                    thumbColor={isActive ? '#006b2c' : '#f1f5f9'}
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooterRow}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.modalCancelBtnText}>Hủy</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalSubmitBtn, saving && { opacity: 0.7 }]}
                                onPress={handleSave}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#ffffff" size="small" />
                                ) : (
                                    <Text style={styles.modalSubmitBtnText}>
                                        {editingVoucher ? 'Lưu thay đổi' : 'Tạo mã voucher'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
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
    proPill: {
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 9999,
        borderWidth: 1,
        borderColor: '#dcfce7',
    },
    proPillText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#15803d',
    },
    topBarSubtitle: {
        fontSize: 10,
        fontWeight: '700',
        color: '#6b7280',
        letterSpacing: 0.5,
        marginTop: 1,
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#006b2c',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 9999,
        elevation: 2,
        shadowColor: '#006b2c',
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    addBtnText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    bentoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    bentoCard: {
        width: '48.5%',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#eceef0',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 4,
    },
    bentoCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    bentoLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6b7280',
    },
    bentoIconBox: {
        width: 26,
        height: 26,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bentoBigNum: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
        marginTop: 2,
    },
    bentoUnit: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6b7280',
    },
    bentoSubText: {
        fontSize: 10,
        color: '#6b7280',
        marginTop: 2,
    },
    filterWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
    },
    filterRow: {
        marginBottom: 10,
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 9999,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#eceef0',
    },
    filterChipActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
    },
    filterChipTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    searchWrapper: {
        marginBottom: 12,
    },
    searchInner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 40,
        borderWidth: 1,
        borderColor: '#eceef0',
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: '#111827',
    },
    centerBox: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#374151',
        marginTop: 10,
    },
    emptySub: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 4,
    },
    vouchersGrid: {
        gap: 10,
    },
    vCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#eceef0',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 4,
    },
    vHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    codeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#dcfce7',
    },
    codeText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#006b2c',
        letterSpacing: 0.5,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 9999,
    },
    statusActive: {
        backgroundColor: '#dcfce7',
    },
    statusInactive: {
        backgroundColor: '#f2f4f6',
    },
    statusDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    dotActive: {
        backgroundColor: '#15803d',
    },
    dotInactive: {
        backgroundColor: '#94a3b8',
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
    },
    textActive: {
        color: '#15803d',
    },
    textInactive: {
        color: '#6b7280',
    },
    vTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
        marginTop: 2,
    },
    vDesc: {
        fontSize: 11,
        color: '#6b7280',
        marginTop: 2,
    },
    vDiscountBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 8,
        marginTop: 8,
    },
    vDiscountMain: {
        fontSize: 12,
        color: '#374151',
    },
    vDiscountHighlight: {
        fontWeight: '800',
        color: '#006b2c',
        fontSize: 13,
    },
    vDiscountCondition: {
        fontSize: 10,
        color: '#6b7280',
        marginTop: 2,
    },
    vFooterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f8fafc',
    },
    vUsageInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flex: 1,
    },
    vUsageText: {
        fontSize: 10,
        color: '#6b7280',
    },
    actionGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    editBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#f2f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#fee2e2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Modals
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    modalCardWrapper: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 18,
        width: '100%',
        maxWidth: 500,
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f2f4f6',
    },
    modalSubHeader: {
        fontSize: 10,
        fontWeight: '800',
        color: '#006b2c',
        letterSpacing: 0.5,
    },
    modalMainHeader: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
        marginTop: 2,
    },
    modalCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f2f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    formLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 4,
        marginTop: 8,
    },
    formInput: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#eceef0',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
        fontSize: 13,
        color: '#111827',
    },
    typeSelectorRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 4,
    },
    typePill: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#eceef0',
        alignItems: 'center',
    },
    typePillActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    typePillText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#374151',
    },
    typePillTextActive: {
        color: '#ffffff',
        fontWeight: '800',
    },
    statusToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8fafc',
        padding: 10,
        borderRadius: 10,
        marginTop: 10,
    },
    statusToggleTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
    },
    statusToggleSub: {
        fontSize: 10,
        color: '#6b7280',
        marginTop: 1,
    },
    modalFooterRow: {
        flexDirection: 'row',
        gap: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f2f4f6',
        marginTop: 8,
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#f2f4f6',
        alignItems: 'center',
    },
    modalCancelBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6b7280',
    },
    modalSubmitBtn: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#006b2c',
        paddingVertical: 10,
        borderRadius: 10,
    },
    modalSubmitBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
});
