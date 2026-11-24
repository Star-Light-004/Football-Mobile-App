import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    Platform,
    Switch,
    Image,
    RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getServicesApi, createServiceApi, updateServiceApi, deleteServiceApi, getServicesStatsApi } from '../api/servicesApi';
import { getFieldsApi } from '../api/fieldsApi';
import { MEDIA_URL } from '../config';

const DEFAULT_CATEGORIES = ['Nước uống', 'Giày', 'Tất', 'Khác'];

export default function AdminServicesScreen({ navigation }) {
    const [services, setServices] = useState([]);
    const [fields, setFields] = useState([]);
    const [statsData, setStatsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('Tất cả');
    const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'active' | 'inactive'

    const formatDateVN = (dStr) => {
        if (!dStr) return '';
        const clean = String(dStr).split('T')[0];
        const parts = clean.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dStr;
    };
    
    // Main Tab: 'inventory' (Kho & Dịch Vụ) | 'stats' (Thống Kê Dịch Vụ)
    const [activeMainTab, setActiveMainTab] = useState('inventory');
    // Stats Range: 'all' | 'month' | 'week' | 'today'
    const [statsPeriod, setStatsPeriod] = useState('all');

    // Modal Add / Edit
    const [modalVisible, setModalVisible] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [name, setName] = useState('');
    const [price, setPrice] = useState('20000');
    const [category, setCategory] = useState('Nước uống');
    const [stock, setStock] = useState('50');
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [selectedFields, setSelectedFields] = useState([]);
    const [saving, setSaving] = useState(false);

    // Quick Restock Modal
    const [restockModalVisible, setRestockModalVisible] = useState(false);
    const [restockTarget, setRestockTarget] = useState(null);
    const [restockQuantity, setRestockQuantity] = useState('24');

    // Helper: Broadcast sync event across tabs / web / app
    const broadcastAppSync = (type = 'services_updated') => {
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

    const loadServices = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        try {
            const [data, statsRes] = await Promise.all([
                getServicesApi(true),
                getServicesStatsApi()
            ]);
            setServices(Array.isArray(data) ? data : (data?.services || []));
            if (statsRes) setStatsData(statsRes);
        } catch (e) {
            console.warn('Lỗi lấy dịch vụ & thống kê:', e.message);
        } finally {
            setLoading(false);
            if (isManual) setRefreshing(false);
        }
    };

    const loadFields = async () => {
        try {
            const data = await getFieldsApi({ show_all: 'true' });
            const list = Array.isArray(data) ? data : (data?.fields || []);
            setFields(list);
        } catch (e) {
            console.warn('Lỗi lấy danh sách sân:', e.message);
        }
    };

    useEffect(() => {
        loadServices();
        loadFields();

        // 1. Cross-tab sync listener
        const handleSync = (e) => {
            const ev = e?.detail || e;
            const type = typeof ev === 'string' ? ev : ev?.type;
            if (type === 'services_updated' || type === 'booking_updated' || type === 'booking_created') {
                loadServices();
            }
        };

        const handleStorage = (e) => {
            if (e?.key === 'football_booking_sync_event' && e.newValue) {
                try {
                    const parsed = JSON.parse(e.newValue);
                    if (parsed?.type === 'services_updated') {
                        loadServices();
                    }
                } catch (err) {}
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('football_sync', handleSync);
            window.addEventListener('storage', handleStorage);
        }

        // 2. Auto Polling timer (3.5s) to guarantee instant parity with Web edits
        const pollTimer = setInterval(() => {
            loadServices();
        }, 3500);

        return () => {
            clearInterval(pollTimer);
            if (typeof window !== 'undefined') {
                window.removeEventListener('football_sync', handleSync);
                window.removeEventListener('storage', handleStorage);
            }
        };
    }, []);

    const openAddModal = () => {
        setEditingService(null);
        setName('');
        setPrice('20000');
        setCategory('Nước uống');
        setStock('50');
        setDescription('');
        setIsActive(true);
        setSelectedFields([]);
        setModalVisible(true);
    };

    const openEditModal = (srv) => {
        setEditingService(srv);
        setName(srv.name || '');
        setPrice(String(srv.price || '20000'));
        setCategory(srv.category || 'Nước uống');
        setStock(String(srv.stock || '50'));
        setDescription(srv.description || '');
        setIsActive(srv.is_active !== false);
        setSelectedFields(Array.isArray(srv.field_ids) ? srv.field_ids.map(String) : []);
        setModalVisible(true);
    };

    const toggleFieldSelect = (fieldId) => {
        const strId = String(fieldId);
        setSelectedFields(prev =>
            prev.includes(strId) ? prev.filter(id => id !== strId) : [...prev, strId]
        );
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên dịch vụ');
            return;
        }
        if (!price || isNaN(Number(price))) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập giá hợp lệ');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: name.trim(),
                price: parseFloat(price) || 0,
                category: category,
                stock: parseInt(stock, 10) || 0,
                description: description.trim(),
                is_active: isActive ? 'true' : 'false',
                field_ids: selectedFields
            };

            if (editingService) {
                await updateServiceApi(editingService.id, payload);
                broadcastAppSync('services_updated');
                Alert.alert('Thành công', 'Cập nhật dịch vụ thành công');
            } else {
                await createServiceApi(payload);
                broadcastAppSync('services_updated');
                Alert.alert('Thành công', 'Đã thêm dịch vụ mới vào danh mục');
            }
            setModalVisible(false);
            loadServices();
        } catch (e) {
            Alert.alert('Lỗi', 'Không thể lưu dịch vụ: ' + (e.message || ''));
        } finally {
            setSaving(false);
        }
    };

    const handleQuickRestockSubmit = async () => {
        if (!restockTarget) return;
        const addAmount = parseInt(restockQuantity, 10) || 0;
        if (addAmount <= 0) {
            Alert.alert('Lỗi', 'Số lượng nhập thêm phải lớn hơn 0');
            return;
        }

        const newStock = (parseInt(restockTarget.stock, 10) || 0) + addAmount;
        try {
            await updateServiceApi(restockTarget.id, {
                name: restockTarget.name,
                price: restockTarget.price,
                category: restockTarget.category,
                stock: newStock,
                is_active: restockTarget.is_active ? 'true' : 'false'
            });
            broadcastAppSync('services_updated');
            Alert.alert('Thành công', `Đã nhập thêm +${addAmount} cho ${restockTarget.name}`);
            setRestockModalVisible(false);
            loadServices();
        } catch (e) {
            Alert.alert('Lỗi', 'Không thể cập nhật số lượng tồn kho');
        }
    };

    const handleDelete = (srv) => {
        const doDelete = async () => {
            try {
                await deleteServiceApi(srv.id);
                broadcastAppSync('services_updated');
                loadServices();
            } catch (err) {
                Alert.alert('Lỗi', 'Không thể xóa mặt hàng');
            }
        };

        Alert.alert(
            'Xóa mặt hàng',
            `Bạn có chắc chắn muốn xóa "${srv.name}" khỏi danh mục?`,
            [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Xóa ngay', style: 'destructive', onPress: doDelete }
            ]
        );
    };

    // Calculate dynamic categories matching Web: ["Tất cả", ...categories]
    const categories = useMemo(() => {
        const set = new Set(services.map(s => s.category).filter(Boolean));
        DEFAULT_CATEGORIES.forEach(c => set.add(c));
        return ['Tất cả', ...Array.from(set)];
    }, [services]);

    const getCategoryCount = (cat) => {
        if (cat === 'Tất cả') return services.length;
        return services.filter(s => s.category === cat).length;
    };

    // 4 Bento Metric Cards matching Web logic
    const stats = useMemo(() => {
        const total = services.length;
        const active = services.filter(s => s.is_active).length;
        const inStock = services.reduce((acc, s) => acc + (parseInt(s.stock, 10) || 0), 0);
        const lowStock = services.filter(s => (parseInt(s.stock, 10) || 0) < 10).length;

        return { total, active, inStock, lowStock };
    }, [services]);

    // Filtered items
    const filtered = useMemo(() => {
        return services.filter(s => {
            const query = searchQuery.trim().toLowerCase();
            const matchesSearch = !query || `${s.name || ''} ${s.description || ''} ${s.category || ''}`.toLowerCase().includes(query);
            const matchesCat = filterCategory === 'Tất cả' || s.category === filterCategory;
            const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' ? s.is_active : !s.is_active);
            return matchesSearch && matchesCat && matchesStatus;
        });
    }, [services, searchQuery, filterCategory, filterStatus]);

    const getImageUrl = (img) => {
        if (!img) return null;
        if (img.startsWith('http://') || img.startsWith('https://')) return img;
        return `${MEDIA_URL}${img.startsWith('/') ? '' : '/'}${img}`;
    };

    // Filtered orders for Stats Tab
    const allOrders = statsData?.orders || [];
    const filteredOrders = useMemo(() => {
        if (!allOrders.length) return [];
        if (statsPeriod === 'all') return allOrders;

        const now = new Date();
        const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

        if (statsPeriod === 'today') {
            return allOrders.filter(o => o.created_at?.startsWith(todayStr));
        }
        if (statsPeriod === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(now.getDate() - 7);
            return allOrders.filter(o => {
                if (!o.created_at) return false;
                const parts = o.created_at.split(' ')[0].split('/');
                if (parts.length === 3) {
                    const oDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    return oDate >= weekAgo;
                }
                return true;
            });
        }
        if (statsPeriod === 'month') {
            const monthStr = `/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            return allOrders.filter(o => o.created_at?.includes(monthStr));
        }
        if (statsPeriod === 'year') {
            const yearStr = `/${now.getFullYear()}`;
            return allOrders.filter(o => o.created_at?.includes(yearStr) || o.created_at?.startsWith(String(now.getFullYear())));
        }
        return allOrders;
    }, [allOrders, statsPeriod]);

    // Stats breakdown per item
    const itemBreakdown = useMemo(() => {
        const map = {};
        filteredOrders.forEach(o => {
            const name = o.service_name || 'Khác';
            const isRental = o.action_type === 'rental' || /giày|giay|thuê|thue|trọng tài|áo bib|bóng/i.test(`${name} ${o.service_category || ''}`);
            if (!map[name]) {
                const matchedSrv = services.find(s => s.name === name);
                map[name] = {
                    name,
                    category: o.service_category || 'Khác',
                    action_type: isRental ? 'rental' : 'sale',
                    action_label: isRental ? 'Cho thuê' : 'Bán lẻ',
                    quantity: 0,
                    revenue: 0,
                    price: matchedSrv ? parseFloat(matchedSrv.price) : (o.quantity ? o.total_price / o.quantity : 0),
                    stock: matchedSrv ? matchedSrv.stock : 0
                };
            }
            map[name].quantity += (o.quantity || 1);
            map[name].revenue += parseFloat(o.total_price || 0);
        });
        return Object.values(map).sort((a, b) => b.quantity - a.quantity);
    }, [filteredOrders, services]);

    const totalPeriodRevenue = filteredOrders.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0);
    const totalPeriodQty = filteredOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
    const bestSeller = itemBreakdown[0] || null;

    const renderItem = ({ item }) => {
        const stockCount = parseInt(item.stock, 10) || 0;
        const isLow = stockCount < 10;
        const isOut = stockCount <= 0;
        const fullImg = getImageUrl(item.image);

        let appliedFieldsText = 'Áp dụng: Tất cả các sân';
        if (Array.isArray(item.field_ids) && item.field_ids.length > 0 && fields.length > 0) {
            const matched = fields.filter(f => item.field_ids.includes(String(f.id)) || item.field_ids.includes(Number(f.id)));
            if (matched.length > 0) {
                appliedFieldsText = `Áp dụng: ${matched.map(f => f.field_name || f.name).join(', ')}`;
            } else {
                appliedFieldsText = `Áp dụng: ${item.field_ids.length} sân`;
            }
        }

        return (
            <View style={styles.srvCard}>
                <View style={styles.srvTopRow}>
                    <View style={styles.srvThumbWrap}>
                        {fullImg ? (
                            <Image
                                source={{ uri: fullImg }}
                                style={styles.srvThumbImg}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={styles.srvIconWrap}>
                                <Ionicons
                                    name={item.category === 'Nước uống' ? 'water' : item.category === 'Giày' ? 'football' : item.category === 'Tất' ? 'shirt' : 'cube'}
                                    size={24}
                                    color="#006b2c"
                                />
                            </View>
                        )}
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={styles.srvNameRow}>
                            <Text style={styles.srvName} numberOfLines={1}>{item.name}</Text>
                            <View style={[styles.stockBadge, isOut ? styles.badgeOut : isLow ? styles.badgeLow : styles.badgeNormal]}>
                                <Text style={[styles.stockText, isOut ? styles.textOut : isLow ? styles.textLow : styles.textNormal]}>
                                    {isOut ? 'Hết hàng' : isLow ? `Sắp hết: ${stockCount}` : `Còn: ${stockCount}`}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.catStatusRow}>
                            <View style={styles.catBadge}>
                                <Text style={styles.catBadgeText}>{item.category || 'Khác'}</Text>
                            </View>
                            <View style={[styles.statusDot, { backgroundColor: item.is_active ? '#006b2c' : '#94a3b8' }]} />
                            <Text style={styles.statusText}>{item.is_active ? 'Đang kinh doanh' : 'Ngừng bán'}</Text>
                        </View>

                        {item.description ? (
                            <Text style={styles.srvDesc} numberOfLines={1}>{item.description}</Text>
                        ) : null}

                        <View style={styles.fieldAppWrap}>
                            <Ionicons name="location-outline" size={12} color="#64748b" />
                            <Text style={styles.fieldAppText} numberOfLines={1}>
                                {appliedFieldsText}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Price & Action Row */}
                <View style={styles.srvBottomRow}>
                    <View>
                        <Text style={styles.srvPriceLabel}>Đơn giá niêm yết</Text>
                        <Text style={styles.srvPrice}>
                            {Number(item.price || 0).toLocaleString('vi-VN')} đ
                        </Text>
                    </View>

                    <View style={styles.actionBtnGroup}>
                        <TouchableOpacity
                            style={styles.quickRestockBtn}
                            onPress={() => {
                                setRestockTarget(item);
                                setRestockQuantity('24');
                                setRestockModalVisible(true);
                            }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="add-circle" size={14} color="#006b2c" />
                            <Text style={styles.quickRestockText}>+ Nhập kho</Text>
                        </TouchableOpacity>

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

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Top Bar: Standardized Emerald Modernism matching other screens */}
            <View style={styles.topBar}>
                <View style={styles.topBarLeft}>
                    <TouchableOpacity
                        style={styles.iconCircleBtn}
                        onPress={() => {
                            if (navigation && navigation.canGoBack()) navigation.goBack();
                            else if (navigation) navigation.navigate('AdminDashboard');
                        }}
                    >
                        <Ionicons name="arrow-back" size={20} color="#111827" />
                    </TouchableOpacity>
                    <View style={{ marginLeft: 10 }}>
                        <Text style={styles.dashboardEyebrow}>VẬN HÀNH CƠ SỞ › DỊCH VỤ & TIỆN ÍCH</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.topBarTitle}>Quản Lý Dịch Vụ</Text>
                            <View style={styles.proPill}>
                                <Text style={styles.proPillText}>PRO</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.topBarRight}>
                    <TouchableOpacity
                        style={styles.addBtn}
                        onPress={openAddModal}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="add" size={16} color="#ffffff" />
                        <Text style={styles.addBtnText}>+ Thêm dịch vụ</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* TAB CHÍNH: KHO & DỊCH VỤ  vs  THỐNG KÊ DỊCH VỤ */}
            <View style={styles.mainTabBar}>
                <TouchableOpacity
                    style={[styles.mainTabBtn, activeMainTab === 'inventory' && styles.mainTabBtnActive]}
                    onPress={() => setActiveMainTab('inventory')}
                >
                    <Ionicons name="cube-outline" size={16} color={activeMainTab === 'inventory' ? '#006b2c' : '#64748b'} />
                    <Text style={[styles.mainTabText, activeMainTab === 'inventory' && styles.mainTabTextActive]}>
                        Kho & Dịch Vụ
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.mainTabBtn, activeMainTab === 'stats' && styles.mainTabBtnActive]}
                    onPress={() => setActiveMainTab('stats')}
                >
                    <Ionicons name="bar-chart-outline" size={16} color={activeMainTab === 'stats' ? '#006b2c' : '#64748b'} />
                    <Text style={[styles.mainTabText, activeMainTab === 'stats' && styles.mainTabTextActive]}>
                        Thống Kê Dịch Vụ
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadServices(true)} colors={['#006b2c']} />}
            >
                {/* 5 BENTO KPI METRICS: TỔNG, TỒN KHO, SẮP HẾT, ĐANG BÁN, ĐÃ BÁN TRONG NGÀY */}
                <View style={styles.bentoGrid}>
                    {/* Metric 1: Tổng dịch vụ */}
                    <View style={styles.bentoCard}>
                        <View style={styles.bentoCardHeader}>
                            <Text style={styles.bentoLabel}>Tổng dịch vụ</Text>
                            <View style={[styles.bentoIconBox, { backgroundColor: '#e0f2fe' }]}>
                                <Ionicons name="cube" size={15} color="#0284c7" />
                            </View>
                        </View>
                        <Text style={styles.bentoBigNum}>{stats.total} <Text style={styles.bentoUnit}>dịch vụ</Text></Text>
                        <Text style={styles.bentoSubText}>Danh mục mặt hàng</Text>
                    </View>

                    {/* Metric 2: Tổng tồn kho */}
                    <View style={styles.bentoCard}>
                        <View style={styles.bentoCardHeader}>
                            <Text style={styles.bentoLabel}>Tổng tồn kho</Text>
                            <View style={[styles.bentoIconBox, { backgroundColor: '#dcfce7' }]}>
                                <Ionicons name="layers" size={15} color="#16a34a" />
                            </View>
                        </View>
                        <Text style={styles.bentoBigNum}>{stats.inStock} <Text style={styles.bentoUnit}>món</Text></Text>
                        <Text style={styles.bentoSubText}>Sản phẩm trong kho</Text>
                    </View>

                    {/* Metric 3: Sắp hết hàng */}
                    <View style={styles.bentoCard}>
                        <View style={styles.bentoCardHeader}>
                            <Text style={[styles.bentoLabel, { color: '#b91c1c' }]}>Sắp hết hàng</Text>
                            <View style={[styles.bentoIconBox, { backgroundColor: '#fee2e2' }]}>
                                <Ionicons name="warning" size={15} color="#dc2626" />
                            </View>
                        </View>
                        <Text style={[styles.bentoBigNum, { color: '#b91c1c' }]}>{stats.lowStock} <Text style={styles.bentoUnit}>món</Text></Text>
                        <Text style={[styles.bentoSubText, { color: '#b91c1c' }]}>Tồn kho dưới 10</Text>
                    </View>

                    {/* Metric 4: Đang kinh doanh */}
                    <View style={styles.bentoCard}>
                        <View style={styles.bentoCardHeader}>
                            <Text style={[styles.bentoLabel, { color: '#0f766e' }]}>Đang kinh doanh</Text>
                            <View style={[styles.bentoIconBox, { backgroundColor: '#ccfbf1' }]}>
                                <Ionicons name="checkmark-circle" size={15} color="#0d9488" />
                            </View>
                        </View>
                        <Text style={styles.bentoBigNum}>{stats.active} <Text style={styles.bentoUnit}>món</Text></Text>
                        <Text style={styles.bentoSubText}>Mặt hàng mở bán</Text>
                    </View>

                    {/* Ô THỨ 5: DỊCH VỤ TRONG NGÀY (Bán lẻ & Cho thuê) */}
                    <View style={[styles.bentoCard, styles.bentoCardFull]}>
                        <View style={styles.bentoCardHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={[styles.bentoLabel, { color: '#4338ca', fontWeight: '700' }]}>DỊCH VỤ TRONG NGÀY</Text>
                                <View style={styles.todayDateBadge}>
                                    <Text style={styles.todayDateBadgeText}>{formatDateVN(statsData?.today?.date) || 'Hôm nay'}</Text>
                                </View>
                            </View>
                            <View style={[styles.bentoIconBox, { backgroundColor: '#e0e7ff' }]}>
                                <Ionicons name="cart" size={15} color="#4338ca" />
                            </View>
                        </View>
                        <Text style={[styles.bentoBigNum, { color: '#4338ca' }]}>
                            {statsData?.today?.total_quantity || 0} <Text style={styles.bentoUnit}>lượt phục vụ</Text>
                        </Text>
                        <View style={styles.breakdownWrap}>
                            <Text style={[styles.breakdownText, { color: statsData?.today?.total_quantity > 0 ? '#15803d' : '#64748b' }]}>
                                {statsData?.today?.summary_text || 'Chưa có phát sinh hôm nay'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* NỘI DUNG THEO TAB ĐƯỢC CHỌN */}
                {activeMainTab === 'inventory' ? (
                    <>
                        {/* Filter Row: Categories + Counts - Wrap for Mobile */}
                        <View style={styles.filterWrap}>
                            {categories.map(cat => {
                                const isSel = filterCategory === cat;
                                const count = getCategoryCount(cat);
                                return (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[styles.filterChip, isSel && styles.filterChipActive]}
                                        onPress={() => setFilterCategory(cat)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.filterChipText, isSel && styles.filterChipTextActive]}>
                                            {cat} ({count})
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Status Toggle & Search Bar */}
                        <View style={styles.searchFilterRow}>
                            <View style={styles.searchInner}>
                                <Ionicons name="search" size={17} color="#6b7280" />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Tìm tên dịch vụ, mô tả, phân loại..."
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

                            <View style={styles.statusChipsWrap}>
                                {[
                                    { key: 'all', label: 'Tất cả TT' },
                                    { key: 'active', label: 'Đang bán' },
                                    { key: 'inactive', label: 'Ngừng bán' }
                                ].map(st => (
                                    <TouchableOpacity
                                        key={st.key}
                                        style={[styles.statusChip, filterStatus === st.key && styles.statusChipActive]}
                                        onPress={() => setFilterStatus(st.key)}
                                    >
                                        <Text style={[styles.statusChipText, filterStatus === st.key && styles.statusChipTextActive]}>
                                            {st.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Section Title */}
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Danh sách mặt hàng & dịch vụ</Text>
                            <Text style={styles.sectionCount}>{filtered.length} dịch vụ</Text>
                        </View>

                        {/* Services List */}
                        {loading && !refreshing ? (
                            <View style={styles.centerBox}>
                                <ActivityIndicator size="large" color="#006b2c" />
                                <Text style={{ marginTop: 10, color: '#6b7280', fontSize: 13 }}>Đang tải danh mục kho...</Text>
                            </View>
                        ) : filtered.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="cube-outline" size={48} color="#94a3b8" />
                                <Text style={styles.emptyTitle}>Không tìm thấy dịch vụ nào</Text>
                                <Text style={styles.emptySub}>Thử đổi từ khóa hoặc bộ lọc</Text>
                            </View>
                        ) : (
                            <View style={styles.servicesGrid}>
                                {filtered.map(item => (
                                    <View key={item.id}>
                                        {renderItem({ item })}
                                    </View>
                                ))}
                            </View>
                        )}
                    </>
                ) : (
                    /* TAB 2: THỐNG KÊ BÁN HÀNG DỊCH VỤ */
                    <View style={styles.statsContainer}>
                        {/* Period Filter Pills */}
                        <View style={styles.statsPeriodRow}>
                            <Text style={styles.statsPeriodLabel}>Thời gian:</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 }}>
                                {[
                                    { key: 'all', label: 'Tất cả' },
                                    { key: 'today', label: 'Hôm nay' },
                                    { key: 'week', label: 'Tuần này' },
                                    { key: 'month', label: 'Tháng này' },
                                    { key: 'year', label: 'Năm nay' },
                                ].map(p => (
                                    <TouchableOpacity
                                        key={p.key}
                                        style={[styles.statsPeriodPill, statsPeriod === p.key && styles.statsPeriodPillActive]}
                                        onPress={() => setStatsPeriod(p.key)}
                                    >
                                        <Text style={[styles.statsPeriodPillText, statsPeriod === p.key && styles.statsPeriodPillTextActive]}>
                                            {p.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* 4 Summary Highlight Cards */}
                        <View style={styles.bentoGrid}>
                            <View style={styles.bentoCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={styles.bentoLabel}>Doanh thu dịch vụ</Text>
                                    <View style={[styles.bentoIconBox, { backgroundColor: '#dcfce7' }]}>
                                        <Ionicons name="cash" size={15} color="#15803d" />
                                    </View>
                                </View>
                                <Text style={[styles.bentoBigNum, { color: '#006b2c' }]}>
                                    {Number(totalPeriodRevenue).toLocaleString('vi-VN')} <Text style={styles.bentoUnit}>đ</Text>
                                </Text>
                                <Text style={styles.bentoSubText}>Tổng thu từ dịch vụ</Text>
                            </View>

                            <View style={styles.bentoCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={styles.bentoLabel}>Tổng lượt dùng</Text>
                                    <View style={[styles.bentoIconBox, { backgroundColor: '#e0f2fe' }]}>
                                        <Ionicons name="basket" size={15} color="#0284c7" />
                                    </View>
                                </View>
                                <Text style={styles.bentoBigNum}>
                                    {totalPeriodQty} <Text style={styles.bentoUnit}>lượt</Text>
                                </Text>
                                <Text style={styles.bentoSubText}>Dịch vụ tiêu thụ/thuê</Text>
                            </View>

                            <View style={styles.bentoCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={styles.bentoLabel}>Ca đá phục vụ</Text>
                                    <View style={[styles.bentoIconBox, { backgroundColor: '#faf5ff' }]}>
                                        <Ionicons name="receipt" size={15} color="#7c3aed" />
                                    </View>
                                </View>
                                <Text style={styles.bentoBigNum}>
                                    {filteredOrders.length} <Text style={styles.bentoUnit}>ca</Text>
                                </Text>
                                <Text style={styles.bentoSubText}>Ca đá dùng dịch vụ</Text>
                            </View>

                            <View style={styles.bentoCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={[styles.bentoLabel, { color: '#ea580c' }]}>Dùng nhiều nhất</Text>
                                    <View style={[styles.bentoIconBox, { backgroundColor: '#fff7ed' }]}>
                                        <Ionicons name="flame" size={15} color="#ea580c" />
                                    </View>
                                </View>
                                <Text style={[styles.bentoBigNum, { fontSize: 14 }]} numberOfLines={1}>
                                    {bestSeller ? bestSeller.name : 'Chưa có'}
                                </Text>
                                <Text style={styles.bentoSubText}>
                                    {bestSeller ? `Đã dùng ${bestSeller.quantity} lượt` : 'Chưa có giao dịch'}
                                </Text>
                            </View>
                        </View>

                        {/* SECTION 1: BẢNG PHÂN TÍCH THEO MẶT HÀNG */}
                        <View style={styles.statsSectionBox}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>Hiệu suất dịch vụ & tiện ích</Text>
                                <Text style={styles.sectionCount}>{itemBreakdown.length} sản phẩm</Text>
                            </View>

                            {itemBreakdown.length === 0 ? (
                                <Text style={styles.emptyStatsText}>Chưa có giao dịch nào trong khoảng thời gian này.</Text>
                            ) : (
                                itemBreakdown.map((item, idx) => {
                                    const percent = totalPeriodRevenue > 0 ? ((item.revenue / totalPeriodRevenue) * 100).toFixed(0) : 0;
                                    const isRental = item.action_type === 'rental';
                                    return (
                                        <View key={item.name} style={styles.itemStatCard}>
                                            <View style={styles.itemStatHeader}>
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <View style={[styles.actionBadgePill, isRental ? styles.actionBadgePillRental : styles.actionBadgePillSale]}>
                                                            <Text style={[styles.actionBadgePillText, isRental ? styles.actionBadgePillTextRental : styles.actionBadgePillTextSale]}>
                                                                {isRental ? 'Cho thuê' : 'Bán lẻ'}
                                                            </Text>
                                                        </View>
                                                        <Text style={styles.itemStatName}>{item.name}</Text>
                                                    </View>
                                                    <Text style={styles.itemStatCategory}>{item.category} • Đơn giá: {Number(item.price).toLocaleString('vi-VN')} đ</Text>
                                                </View>
                                                <View style={[styles.itemStatQtyBadge, isRental && { backgroundColor: '#f5f3ff' }]}>
                                                    <Text style={[styles.itemStatQtyText, isRental && { color: '#7c3aed' }]}>
                                                        {item.quantity} {isRental ? 'lượt thuê' : 'đã bán'}
                                                    </Text>
                                                </View>
                                            </View>

                                            {/* Progress Bar & Revenue */}
                                            <View style={styles.itemStatRevenueRow}>
                                                <Text style={styles.itemStatRevenue}>
                                                    Doanh thu: {Number(item.revenue).toLocaleString('vi-VN')} đ
                                                </Text>
                                                <Text style={styles.itemStatPercent}>{percent}% DT</Text>
                                            </View>
                                            <View style={styles.statProgressBarBg}>
                                                <View style={[styles.statProgressBarFill, { width: `${Math.min(100, Math.max(8, Number(percent)))}%` }]} />
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </View>

                        {/* SECTION 2: LỊCH SỬ CÁC CA ĐÁ / ĐƠN ĐẶT DÙNG DỊCH VỤ */}
                        <View style={[styles.statsSectionBox, { marginTop: 14 }]}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>Lịch sử ca đá dùng dịch vụ</Text>
                                <Text style={styles.sectionCount}>{filteredOrders.length} ca ghi nhận</Text>
                            </View>

                            {filteredOrders.length === 0 ? (
                                <Text style={styles.emptyStatsText}>Chưa có lịch sử dịch vụ trong thời gian này.</Text>
                            ) : (
                                filteredOrders.map(order => {
                                    const isRental = order.action_type === 'rental' || /giày|giay|thuê|thue|trọng tài|áo bib|bóng/i.test(`${order.service_name} ${order.service_category || ''}`);
                                    const isDone = order.status_code === 'completed' || order.status === 'deducted';
                                    const isCancel = order.status_code === 'cancelled';
                                    const statusText = order.status_label || (isDone ? 'Hoàn thành' : isRental ? 'Đang thuê' : 'Đang phục vụ');

                                    return (
                                        <View key={order.id} style={styles.orderHistoryCard}>
                                            <View style={styles.orderHistoryTop}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.orderHistoryPitch}>{order.field_name}</Text>
                                                    <Text style={styles.orderHistoryMeta}>
                                                        {order.created_at} • Khách: {order.customer_name}
                                                    </Text>
                                                </View>
                                                <View style={styles.orderBadge}>
                                                    <Text style={styles.orderBadgeText}>#{order.booking_code || 'ORD'}</Text>
                                                </View>
                                            </View>

                                            <View style={styles.orderHistoryBottom}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                                                    <View style={[styles.actionBadgePill, isRental ? styles.actionBadgePillRental : styles.actionBadgePillSale]}>
                                                        <Text style={[styles.actionBadgePillText, isRental ? styles.actionBadgePillTextRental : styles.actionBadgePillTextSale]}>
                                                            {isRental ? 'Cho thuê' : 'Bán lẻ'}
                                                        </Text>
                                                    </View>
                                                    <Text style={styles.orderServiceText}>
                                                        {order.service_name} <Text style={{ fontWeight: '800', color: '#15803d' }}>x{order.quantity}</Text>
                                                        {order.shoe_size ? ` (Sz ${order.shoe_size})` : ''}
                                                    </Text>
                                                </View>
                                                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                                    <Text style={styles.orderPriceText}>
                                                        {Number(order.total_price).toLocaleString('vi-VN')} đ
                                                    </Text>
                                                    <View style={[styles.historyStatusPill, isDone ? styles.statusPillDone : isCancel ? styles.statusPillCancel : isRental ? styles.statusPillRent : styles.statusPillServe]}>
                                                        <View style={[styles.historyStatusDot, isDone ? styles.dotDone : isCancel ? styles.dotCancel : isRental ? styles.dotRent : styles.dotServe]} />
                                                        <Text style={[styles.historyStatusText, isDone ? styles.textDone : isCancel ? styles.textCancel : isRental ? styles.textRent : styles.textServe]}>
                                                            {statusText}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* MODAL 1: ADD / EDIT SERVICE */}
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
                                    {editingService ? 'CHỈNH SỬA DỊCH VỤ' : 'THÊM MẶT HÀNG MỚI'}
                                </Text>
                                <Text style={styles.modalMainHeader}>
                                    {editingService ? editingService.name : 'Dịch Vụ & Tiện Ích'}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
                            <Text style={styles.formLabel}>Tên mặt hàng / dịch vụ *</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Ví dụ: Revive Chanh Muối 500ml"
                                placeholderTextColor="#94a3b8"
                                value={name}
                                onChangeText={setName}
                            />

                            <Text style={styles.formLabel}>Đơn giá niêm yết (VNĐ) *</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Ví dụ: 15000"
                                placeholderTextColor="#94a3b8"
                                keyboardType="numeric"
                                value={price}
                                onChangeText={setPrice}
                            />

                            <Text style={styles.formLabel}>Phân loại mặt hàng</Text>
                            <View style={styles.catSelectorRow}>
                                {DEFAULT_CATEGORIES.map(c => (
                                    <TouchableOpacity
                                        key={c}
                                        style={[styles.catPill, category === c && styles.catPillActive]}
                                        onPress={() => setCategory(c)}
                                    >
                                        <Text style={[styles.catPillText, category === c && styles.catPillTextActive]}>
                                            {c}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.formLabel}>Số lượng tồn kho ban đầu</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Ví dụ: 50"
                                placeholderTextColor="#94a3b8"
                                keyboardType="numeric"
                                value={stock}
                                onChangeText={setStock}
                            />

                            <Text style={styles.formLabel}>Mô tả chi tiết</Text>
                            <TextInput
                                style={[styles.formInput, { height: 60, textAlignVertical: 'top', paddingTop: 8 }]}
                                placeholder="Ví dụ: Nước uống bù khoáng, đóng chai..."
                                placeholderTextColor="#94a3b8"
                                multiline
                                numberOfLines={2}
                                value={description}
                                onChangeText={setDescription}
                            />

                            {/* Football Fields Multi-select */}
                            <Text style={styles.formLabel}>Áp dụng cho sân ({selectedFields.length} đã chọn)</Text>
                            <View style={styles.fieldSelectorBox}>
                                {fields.length === 0 ? (
                                    <Text style={styles.fieldSelectorEmpty}>Không có dữ liệu sân.</Text>
                                ) : (
                                    <View style={styles.fieldGrid}>
                                        {fields.map(f => {
                                            const fId = String(f.id);
                                            const isChecked = selectedFields.includes(fId);
                                            return (
                                                <TouchableOpacity
                                                    key={fId}
                                                    style={[styles.fieldCheckboxItem, isChecked && styles.fieldCheckboxItemActive]}
                                                    onPress={() => toggleFieldSelect(fId)}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons
                                                        name={isChecked ? "checkbox" : "square-outline"}
                                                        size={18}
                                                        color={isChecked ? "#006b2c" : "#94a3b8"}
                                                    />
                                                    <Text style={[styles.fieldNameText, isChecked && styles.fieldNameTextActive]} numberOfLines={1}>
                                                        {f.field_name || f.name}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>

                            <View style={styles.statusToggleRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.statusToggleTitle}>Trạng thái kinh doanh</Text>
                                    <Text style={styles.statusToggleSub}>
                                        {isActive ? 'Mặt hàng đang mở bán cho khách' : 'Tạm ngưng phục vụ'}
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
                                <Text style={styles.modalCancelBtnText}>Hủy bỏ</Text>
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
                                        {editingService ? 'Lưu thay đổi' : 'Thêm mặt hàng'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* MODAL 2: QUICK RESTOCK */}
            <Modal
                visible={restockModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setRestockModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCardWrapper}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalSubHeader}>NHẬP HÀNG VÀO KHO</Text>
                                <Text style={styles.modalMainHeader}>{restockTarget?.name}</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setRestockModalVisible(false)}>
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ paddingVertical: 12 }}>
                            <Text style={styles.restockSub}>
                                Hiện tại tồn: <Text style={{ fontWeight: '800', color: '#111827' }}>{restockTarget?.stock || 0}</Text> đơn vị
                            </Text>

                            <Text style={styles.formLabel}>Số lượng nhập thêm *</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Ví dụ: 24 (1 thùng)"
                                placeholderTextColor="#94a3b8"
                                keyboardType="numeric"
                                value={restockQuantity}
                                onChangeText={setRestockQuantity}
                            />

                            <View style={styles.quickAddPillsRow}>
                                {[12, 24, 48, 100].map(amt => (
                                    <TouchableOpacity
                                        key={amt}
                                        style={styles.quickAddPill}
                                        onPress={() => setRestockQuantity(String(amt))}
                                    >
                                        <Text style={styles.quickAddPillText}>+{amt}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.modalFooterRow}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setRestockModalVisible(false)}
                            >
                                <Text style={styles.modalCancelBtnText}>Hủy</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.modalSubmitBtn}
                                onPress={handleQuickRestockSubmit}
                            >
                                <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
                                <Text style={styles.modalSubmitBtnText}>Xác nhận nhập kho</Text>
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
        paddingTop: Platform.OS === 'android' ? 12 : 10,
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
        flex: 1
    },
    iconCircleBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f2f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dashboardEyebrow: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
        letterSpacing: 0.5,
    },
    topBarTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
        marginTop: 2,
    },
    proPill: {
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 9999,
        borderWidth: 1,
        borderColor: '#dcfce7',
        marginTop: 2,
    },
    proPillText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#15803d',
    },
    topBarRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    refreshBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#006b2c',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        gap: 4,
    },
    addBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    mainTabBar: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderColor: '#eceef0',
        gap: 8,
    },
    mainTabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 6,
    },
    mainTabBtnActive: {
        backgroundColor: '#f0fdf4',
        borderColor: '#86efac',
    },
    mainTabText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
    },
    mainTabTextActive: {
        color: '#006b2c',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    bentoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16,
    },
    bentoCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 4,
    },
    bentoCardFull: {
        minWidth: '100%',
        backgroundColor: '#fbfbfe',
        borderColor: '#e0e7ff',
    },
    todayDateBadge: {
        backgroundColor: '#e0e7ff',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
    },
    todayDateBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#4338ca',
    },
    breakdownWrap: {
        marginTop: 4,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#e0e7ff',
    },
    breakdownText: {
        fontSize: 11,
        color: '#4338ca',
        fontWeight: '600',
        lineHeight: 16,
    },
    bentoCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    bentoLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    bentoIconBox: {
        width: 26,
        height: 26,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bentoBigNum: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 2,
    },
    bentoUnit: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94a3b8',
    },
    bentoSubText: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500',
    },
    filterWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
    },
    filterSection: {
        marginBottom: 12,
    },
    filterChip: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    filterChipActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    filterChipTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    searchFilterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
        marginBottom: 16,
    },
    searchInner: {
        flex: 1,
        minWidth: 200,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 40,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
        padding: 0,
    },
    statusChipsWrap: {
        flexDirection: 'row',
        gap: 4,
    },
    statusChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    statusChipActive: {
        backgroundColor: '#dcfce7',
        borderColor: '#86efac',
    },
    statusChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    statusChipTextActive: {
        color: '#15803d',
        fontWeight: '700',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
    },
    sectionCount: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    servicesGrid: {
        gap: 12,
    },
    srvCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 4,
    },
    srvTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    srvThumbWrap: {
        width: 56,
        height: 56,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    srvThumbImg: {
        width: '100%',
        height: '100%',
    },
    srvIconWrap: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0fdf4',
    },
    srvNameRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    srvName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
        flex: 1,
        marginRight: 6,
    },
    stockBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    badgeNormal: {
        backgroundColor: '#f0fdf4',
    },
    badgeLow: {
        backgroundColor: '#fef3c7',
    },
    badgeOut: {
        backgroundColor: '#fee2e2',
    },
    stockText: {
        fontSize: 11,
        fontWeight: '700',
    },
    textNormal: {
        color: '#15803d',
    },
    textLow: {
        color: '#b45309',
    },
    textOut: {
        color: '#b91c1c',
    },
    catStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
    },
    catBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    catBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#475569',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    srvDesc: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
    },
    fieldAppWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 5,
    },
    fieldAppText: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500',
        flex: 1,
    },
    srvBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f8fafc',
    },
    srvPriceLabel: {
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: '600',
    },
    srvPrice: {
        fontSize: 15,
        fontWeight: '800',
        color: '#006b2c',
    },
    actionBtnGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    quickRestockBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        gap: 4,
    },
    quickRestockText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#006b2c',
    },
    editBtn: {
        width: 30,
        height: 30,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteBtn: {
        width: 30,
        height: 30,
        borderRadius: 6,
        backgroundColor: '#fee2e2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerBox: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#475569',
        marginTop: 12,
    },
    emptySub: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 4,
    },
    // STATS VIEW STYLES
    statsContainer: {
        gap: 12,
    },
    statsPeriodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#ffffff',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 8,
    },
    statsPeriodLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
    },
    statsPeriodPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    statsPeriodPillActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    statsPeriodPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    statsPeriodPillTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    statsSectionBox: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 4,
    },
    emptyStatsText: {
        fontSize: 13,
        color: '#94a3b8',
        fontStyle: 'italic',
        paddingVertical: 12,
        textAlign: 'center',
    },
    itemStatCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 8,
    },
    itemStatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    itemStatName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    itemStatCategory: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    itemStatQtyBadge: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    itemStatQtyText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#15803d',
    },
    itemStatRevenueRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    itemStatRevenue: {
        fontSize: 13,
        fontWeight: '700',
        color: '#006b2c',
    },
    itemStatPercent: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
    },
    statProgressBarBg: {
        height: 6,
        backgroundColor: '#e2e8f0',
        borderRadius: 3,
        overflow: 'hidden',
        marginTop: 6,
    },
    statProgressBarFill: {
        height: '100%',
        backgroundColor: '#006b2c',
        borderRadius: 3,
    },
    orderHistoryCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 8,
    },
    orderHistoryTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    orderHistoryPitch: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    orderHistoryMeta: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    orderBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    orderBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#475569',
    },
    orderHistoryBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    orderServiceText: {
        fontSize: 12,
        color: '#334155',
        fontWeight: '600',
    },
    orderPriceText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#006b2c',
    },
    actionBadgePill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
    },
    actionBadgePillSale: {
        backgroundColor: '#ecfdf5',
        borderColor: '#a7f3d0',
    },
    actionBadgePillRental: {
        backgroundColor: '#f5f3ff',
        borderColor: '#ddd6fe',
    },
    actionBadgePillText: {
        fontSize: 10,
        fontWeight: '700',
    },
    actionBadgePillTextSale: {
        color: '#059669',
    },
    actionBadgePillTextRental: {
        color: '#7c3aed',
    },
    historyStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 9999,
        borderWidth: 1,
    },
    historyStatusDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
    },
    historyStatusText: {
        fontSize: 10,
        fontWeight: '700',
    },
    statusPillDone: {
        backgroundColor: '#ecfdf5',
        borderColor: '#a7f3d0',
    },
    dotDone: {
        backgroundColor: '#059669',
    },
    textDone: {
        color: '#059669',
    },
    statusPillRent: {
        backgroundColor: '#f5f3ff',
        borderColor: '#ddd6fe',
    },
    dotRent: {
        backgroundColor: '#7c3aed',
    },
    textRent: {
        color: '#7c3aed',
    },
    statusPillServe: {
        backgroundColor: '#f0fdf4',
        borderColor: '#bbf7d0',
    },
    dotServe: {
        backgroundColor: '#15803d',
    },
    textServe: {
        color: '#15803d',
    },
    statusPillCancel: {
        backgroundColor: '#fef2f2',
        borderColor: '#fecaca',
    },
    dotCancel: {
        backgroundColor: '#dc2626',
    },
    textCancel: {
        color: '#dc2626',
    },
    // MODAL STYLES
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalCardWrapper: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 580,
        padding: 18,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 6,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 10,
        marginBottom: 12,
    },
    modalSubHeader: {
        fontSize: 10,
        fontWeight: '800',
        color: '#006b2c',
        letterSpacing: 0.5,
    },
    modalMainHeader: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0f172a',
        marginTop: 2,
    },
    modalCloseBtn: {
        padding: 4,
    },
    formLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 5,
        marginTop: 10,
    },
    formInput: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 42,
        fontSize: 13,
        color: '#0f172a',
        backgroundColor: '#ffffff',
    },
    catSelectorRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 4,
    },
    catPill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    catPillActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    catPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    catPillTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    fieldSelectorBox: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 10,
        backgroundColor: '#f8fafc',
    },
    fieldSelectorEmpty: {
        fontSize: 12,
        color: '#94a3b8',
    },
    fieldGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    fieldCheckboxItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
    },
    fieldCheckboxItemActive: {
        borderColor: '#86efac',
        backgroundColor: '#f0fdf4',
    },
    fieldNameText: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '500',
    },
    fieldNameTextActive: {
        color: '#15803d',
        fontWeight: '700',
    },
    statusToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    statusToggleTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
    },
    statusToggleSub: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    modalFooterRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 10,
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    modalCancelBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    modalCancelBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
    },
    modalSubmitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#006b2c',
    },
    modalSubmitBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },
    restockSub: {
        fontSize: 13,
        color: '#475569',
        marginBottom: 10,
    },
    quickAddPillsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    quickAddPill: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        borderRadius: 8,
    },
    quickAddPillText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#006b2c',
    },
});
