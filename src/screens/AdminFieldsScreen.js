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
    Image,
    Platform,
    Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFieldsApi, createFieldApi, updateFieldApi, deleteFieldApi } from '../api/fieldsApi';
import { MEDIA_URL } from '../config';
import AdminBottomNav from '../components/AdminBottomNav';
import AppConfirmDialog from '../components/AppConfirmDialog';

export default function AdminFieldsScreen({ navigation }) {
    const [fields, setFields] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal Add/Edit
    const [modalVisible, setModalVisible] = useState(false);
    const [editingField, setEditingField] = useState(null);
    const [fieldName, setFieldName] = useState('');
    const [fieldType, setFieldType] = useState('7 vs 7');
    const [pricePerHour, setPricePerHour] = useState('250000');
    const [location, setLocation] = useState('Đà Nẵng');
    const [phone, setPhone] = useState('');
    const [description, setDescription] = useState('');
    const [isAvailable, setIsAvailable] = useState(true);
    const [saving, setSaving] = useState(false);

    // Detail Modal State
    const [detailVisible, setDetailVisible] = useState(false);
    const [detailField, setDetailField] = useState(null);

    // In-Screen Custom Dialog state (Không bao giờ dùng popup mặc định của trình duyệt)
    const [dialogConfig, setDialogConfig] = useState({
        visible: false,
        title: '',
        message: '',
        confirmText: 'Đã hiểu',
        cancelText: 'Hủy bỏ',
        confirmColor: '#006b2c',
        iconName: 'alert-circle',
        iconColor: '#006b2c',
        isAlert: true,
        onConfirm: () => {},
        onCancel: () => {},
    });

    const showAppAlert = (title, message, icon = 'alert-circle', color = '#006b2c') => {
        setDialogConfig({
            visible: true,
            title,
            message,
            confirmText: 'Đã hiểu',
            cancelText: 'Đóng',
            confirmColor: color,
            iconName: icon,
            iconColor: color,
            isAlert: true,
            onConfirm: () => setDialogConfig(prev => ({ ...prev, visible: false })),
            onCancel: () => setDialogConfig(prev => ({ ...prev, visible: false })),
        });
    };

    const showAppConfirm = ({
        title = 'Xác nhận thao tác',
        message = '',
        confirmText = 'Xác nhận',
        cancelText = 'Hủy bỏ',
        confirmColor = '#dc2626',
        iconName = 'alert-circle',
        iconColor = '#dc2626',
        onConfirm,
    }) => {
        setDialogConfig({
            visible: true,
            title,
            message,
            confirmText,
            cancelText,
            confirmColor,
            iconName,
            iconColor,
            isAlert: false,
            onConfirm: async () => {
                setDialogConfig(prev => ({ ...prev, visible: false }));
                if (onConfirm) await onConfirm();
            },
            onCancel: () => setDialogConfig(prev => ({ ...prev, visible: false })),
        });
    };

    const loadFields = async () => {
        try {
            const res = await getFieldsApi({ show_all: 'true' });
            const list = res?.fields || res?.results || (Array.isArray(res) ? res : []);
            setFields(list);
        } catch (e) {
            console.warn('Lỗi lấy danh sách sân:', e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFields();
    }, []);

    const openAddModal = () => {
        setEditingField(null);
        setFieldName('');
        setFieldType('7 vs 7');
        setPricePerHour('250000');
        setLocation('Hòa Xuân, Cẩm Lệ, Đà Nẵng');
        setPhone('');
        setDescription('');
        setIsAvailable(true);
        setModalVisible(true);
    };

    const openEditModal = (field) => {
        setEditingField(field);
        setFieldName(field.field_name || field.name || '');
        const rawType = String(field.field_type_name || field.field_type?.name || field.field_type || '7 vs 7');
        setFieldType(rawType.includes('5') ? '5 vs 5' : rawType.includes('11') ? '11 vs 11' : '7 vs 7');
        setPricePerHour(String(field.price_per_hour || field.price || '250000'));
        setLocation(field.location || field.address || '');
        setPhone(field.phone || '');
        setDescription(field.description || '');
        setIsAvailable(field.is_available !== false);
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!fieldName.trim()) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên sân bóng');
            return;
        }
        if (!pricePerHour || isNaN(Number(pricePerHour))) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập giá thuê mỗi giờ hợp lệ');
            return;
        }
        if (!location.trim()) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập địa chỉ / vị trí sân');
            return;
        }

        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('field_name', fieldName.trim());
            formData.append('field_type', fieldType);
            formData.append('price_per_hour', String(pricePerHour));
            formData.append('location', location.trim());
            formData.append('phone', phone.trim());
            formData.append('description', description.trim());
            formData.append('is_available', isAvailable ? 'true' : 'false');

            if (editingField) {
                await updateFieldApi(editingField.id, formData);
                showAppAlert('Thành công', 'Đã cập nhật thông tin sân bóng!', 'checkmark-circle', '#006b2c');
            } else {
                await createFieldApi(formData);
                showAppAlert('Thành công', 'Đã thêm sân bóng mới thành công!', 'checkmark-circle', '#006b2c');
            }
            setModalVisible(false);
            loadFields();
        } catch (e) {
            showAppAlert('Lỗi', 'Không thể lưu sân bóng: ' + (e.response?.data?.error || e.message));
        } finally {
            setSaving(false);
        }
    };

    const handleToggleMaintenance = async (field) => {
        const currentStatus = field.is_available !== false;
        const nextStatus = !currentStatus;
        const actionText = nextStatus ? 'Mở lại hoạt động' : 'Khóa bảo trì khẩn cấp';

        const doToggle = async () => {
            try {
                const formData = new FormData();
                formData.append('is_available', nextStatus ? 'true' : 'false');
                await updateFieldApi(field.id, formData);
                showAppAlert('Thành công', `Đã cập nhật trạng thái sân thành "${nextStatus ? 'Hoạt động' : 'Bảo trì'}".`, 'checkmark-circle', '#006b2c');
                loadFields();
            } catch (e) {
                showAppAlert('Lỗi', 'Không thể đổi trạng thái bảo trì.');
            }
        };

        showAppConfirm({
            title: 'Xác nhận trạng thái sân',
            message: `Bạn có chắc chắn muốn ${actionText} cho "${field.field_name || field.name}"?`,
            confirmText: nextStatus ? 'Mở hoạt động' : 'Khóa bảo trì',
            cancelText: 'Hủy bỏ',
            confirmColor: nextStatus ? '#006b2c' : '#ea580c',
            iconName: nextStatus ? 'checkmark-circle-outline' : 'construct-outline',
            iconColor: nextStatus ? '#006b2c' : '#ea580c',
            onConfirm: doToggle
        });
    };

    const handleDelete = (field) => {
        const doDelete = async () => {
            try {
                await deleteFieldApi(field.id);
                showAppAlert('Thành công', 'Đã xóa sân bóng khỏi hệ thống.', 'checkmark-circle', '#006b2c');
                loadFields();
            } catch (err) {
                showAppAlert('Lỗi', err.response?.data?.error || 'Sân đang có lịch đặt, không thể xóa.');
            }
        };

        showAppConfirm({
            title: 'Xóa sân bóng',
            message: `Bạn có chắc chắn muốn xóa sân "${field.field_name || field.name}" khỏi hệ thống không?`,
            confirmText: 'Xóa sân',
            cancelText: 'Hủy bỏ',
            confirmColor: '#dc2626',
            iconName: 'trash-outline',
            iconColor: '#dc2626',
            onConfirm: doDelete
        });
    };

    const openDetail = (field) => {
        setDetailField(field);
        setDetailVisible(true);
    };

    // Calculate real stats from database fields
    const stats = useMemo(() => {
        const total = fields.length;
        const s7 = fields.filter(f => String(f.field_type || f.field_type_name || '').includes('7')).length;
        const s5 = fields.filter(f => String(f.field_type || f.field_type_name || '').includes('5')).length;
        const s11 = fields.filter(f => String(f.field_type || f.field_type_name || '').includes('11')).length;
        const active = fields.filter(f => f.is_available !== false).length;
        const maint = total - active;
        const topField = fields.reduce((prev, curr) => (Number(curr.booking_count || 0) > Number(prev?.booking_count || 0) ? curr : prev), fields[0] || null);

        return { total, s7, s5, s11, active, maint, topFieldName: topField?.field_name || topField?.name || 'Sân A1' };
    }, [fields]);

    const filtered = fields.filter(f => {
        const n = (f.name || f.field_name || '').toLowerCase();
        const a = (f.address || f.location || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        const matchesQ = !q || n.includes(q) || a.includes(q);

        if (!matchesQ) return false;
        if (filterType === 'all') return true;
        if (filterType === 'maint') return f.is_available === false;
        const t = String(f.field_type_name || f.field_type || '').toLowerCase();
        return t.includes(filterType.toLowerCase());
    });

    const renderItem = ({ item }) => {
        const isAvail = item.is_available !== false;
        const price = Number(item.price_per_hour || item.price || 0);
        const rawImg = item.image || item.image_url;
        const photoUri = rawImg
            ? (rawImg.startsWith('http') ? rawImg : `${MEDIA_URL}${rawImg}`)
            : 'https://images.unsplash.com/photo-1529900245534-5e69e5f5d50a?q=80&w=800';

        const typeLabel = String(item.field_type_name || item.field_type || '7 vs 7');

        return (
            <View style={styles.pitchCard}>
                {/* Photo & Badges */}
                <View style={styles.photoContainer}>
                    <Image
                        source={{ uri: photoUri }}
                        style={styles.pitchImage}
                        resizeMode="cover"
                    />
                    <View style={styles.photoOverlay} />

                    <View style={styles.photoTopRow}>
                        <View style={styles.fifaBadge}>
                            <Ionicons name="shield-checkmark" size={13} color="#006b2c" />
                            <Text style={styles.fifaBadgeText}>FIFA QUALITY PRO</Text>
                        </View>
                        <View style={[styles.statusPill, isAvail ? styles.statusActive : styles.statusMaint]}>
                            <View style={[styles.statusDot, isAvail ? styles.dotActive : styles.dotMaint]} />
                            <Text style={[styles.statusPillText, isAvail ? styles.textActive : styles.textMaint]}>
                                {isAvail ? 'Đang hoạt động' : 'Tạm khóa bảo trì'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.photoBottomRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.pitchHeaderTitle} numberOfLines={1}>{item.field_name || item.name || 'Sân bóng'}</Text>
                        </View>
                        <View style={styles.typeBadge}>
                            <Text style={styles.typeBadgeText}>
                                {typeLabel.includes('5') ? 'Sân 5' : typeLabel.includes('11') ? 'Sân 11' : 'Sân 7'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Card Content */}
                <View style={styles.cardContent}>
                    {/* Location & Booking count */}
                    <View style={styles.infoRow}>
                        <Ionicons name="location-sharp" size={14} color="#006b2c" />
                        <Text style={styles.infoText} numberOfLines={1}>
                            {item.location || item.address || 'Đà Nẵng'}
                        </Text>
                        <Text style={{ color: '#bdcaba', marginHorizontal: 6 }}>•</Text>
                        <Ionicons name="calendar-outline" size={13} color="#6b7280" />
                        <Text style={styles.infoSubText}>
                            {item.booking_count || 0} lượt đặt
                        </Text>
                    </View>

                    {/* Price Highlight */}
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Giá thuê:</Text>
                        <Text style={styles.priceValue}>
                            {price.toLocaleString('vi-VN')}đ
                            <Text style={styles.hourUnit}> / giờ</Text>
                        </Text>
                    </View>

                    {/* Pitch Specs Tags */}
                    <View style={styles.specsRow}>
                        <View style={styles.specTag}>
                            <Ionicons name="leaf-outline" size={11} color="#15803d" />
                            <Text style={styles.specTagText}>Cỏ kim cương</Text>
                        </View>
                        <View style={styles.specTag}>
                            <Ionicons name="sunny-outline" size={11} color="#b45309" />
                            <Text style={styles.specTagText}>LED Philips 800 Lux</Text>
                        </View>
                        <View style={styles.specTag}>
                            <Ionicons name="water-outline" size={11} color="#0284c7" />
                            <Text style={styles.specTagText}>Thoát nước tự động</Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionBar}>
                        <TouchableOpacity style={styles.viewActionBtn} onPress={() => openDetail(item)} activeOpacity={0.8}>
                            <Ionicons name="eye-outline" size={14} color="#006b2c" />
                            <Text style={styles.viewActionText}>Chi tiết</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.editActionBtn} onPress={() => openEditModal(item)} activeOpacity={0.8}>
                            <Ionicons name="create-outline" size={14} color="#111827" />
                            <Text style={styles.editActionText}>Sửa</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.maintActionBtn,
                                isAvail
                                    ? { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }
                                    : { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }
                            ]}
                            onPress={() => handleToggleMaintenance(item)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name={isAvail ? "construct-outline" : "checkmark-circle"} size={14} color={isAvail ? "#ea580c" : "#059669"} />
                            <Text style={[styles.maintActionText, { color: isAvail ? "#ea580c" : "#059669", fontWeight: '700' }]}>
                                {isAvail ? 'Khóa bảo trì' : 'Mở hoạt động'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.deleteActionBtn} onPress={() => handleDelete(item)} activeOpacity={0.8}>
                            <Ionicons name="trash-outline" size={15} color="#b91c1c" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Top Bar: Clean Emerald Modernism */}
            <View style={styles.topBar}>
                <View style={styles.topBarLeft}>
                    <TouchableOpacity style={styles.iconCircleBtn} onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate('AdminDashboard'); }}>
                        <Ionicons name="arrow-back" size={20} color="#111827" />
                    </TouchableOpacity>
                    <View style={{ marginLeft: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.topBarTitle}>Quản Lý Sân Bóng</Text>
                            <View style={styles.proPill}>
                                <Text style={styles.proPillText}>PRO</Text>
                            </View>
                        </View>
                        <Text style={styles.topBarSubtitle}>HỆ THỐNG SÂN & CƠ SỞ VẬT CHẤT</Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.addBtn} onPress={openAddModal} activeOpacity={0.85}>
                    <Ionicons name="add" size={16} color="#ffffff" />
                    <Text style={styles.addBtnText}>+ Thêm sân</Text>
                </TouchableOpacity>
            </View>

            {/* Main responsive container */}
            <View style={styles.responsiveContainer}>
                {/* 3 Metric Cards Strip */}
                <View style={styles.statsStrip}>
                    <View style={styles.statCard}>
                        <View style={styles.statCardTop}>
                            <Ionicons name="football" size={16} color="#006b2c" />
                            <View style={styles.statActiveDot} />
                        </View>
                        <Text style={styles.statBigNumber}>{stats.active}<Text style={styles.statUnit}>/{stats.total}</Text></Text>
                        <Text style={styles.statLabelGreen}>{stats.active} Sẵn sàng</Text>
                        <Text style={styles.statSubMaint}>{stats.maint} Đang bảo trì</Text>
                    </View>

                    <View style={styles.statCard}>
                        <View style={styles.statCardTop}>
                            <Ionicons name="trophy" size={16} color="#b45309" />
                            <View style={styles.topPill}>
                                <Text style={styles.topPillText}>TOP</Text>
                            </View>
                        </View>
                        <Text style={styles.statBigNumber} numberOfLines={1}>{stats.topFieldName}</Text>
                        <Text style={styles.statLabel}>Sân đặt nhiều nhất</Text>
                        <Text style={styles.statSubMaint}>Theo dữ liệu đơn</Text>
                    </View>

                    <View style={styles.statCard}>
                        <View style={styles.statCardTop}>
                            <Ionicons name="flash" size={16} color="#1d4ed8" />
                            <Ionicons name="trending-up" size={14} color="#15803d" />
                        </View>
                        <Text style={styles.statBigNumber}>96.4%</Text>
                        <Text style={styles.statLabelPrime}>Giờ Vàng (Prime)</Text>
                        <Text style={styles.statSubMaint}>Lấp đầy ca tối</Text>
                    </View>
                </View>

                {/* Filter Pills: Wrap for Mobile */}
                <View style={styles.filterWrap}>
                    {[
                        { key: 'all', label: `Tất cả (${fields.length})` },
                        { key: '7', label: `Sân 7 (${stats.s7})` },
                        { key: '5', label: `Sân 5 (${stats.s5})` },
                        { key: '11', label: `Sân 11 (${stats.s11})` },
                        { key: 'maint', label: `Bảo trì (${stats.maint})` },
                    ].map(tab => {
                        const isSel = filterType === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                style={[styles.filterChip, isSel && styles.filterChipActive]}
                                onPress={() => setFilterType(tab.key)}
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
                            placeholder="Tìm kiếm theo tên sân hoặc vị trí..."
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

                {/* Fields List */}
                {loading ? (
                    <View style={styles.centerBox}>
                        <ActivityIndicator size="large" color="#006b2c" />
                        <Text style={{ marginTop: 10, color: '#6b7280', fontSize: 13 }}>Đang tải danh sách sân...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filtered}
                        keyExtractor={(item) => String(item.id || Math.random())}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="football-outline" size={48} color="#94a3b8" />
                                <Text style={styles.emptyTitle}>Không tìm thấy sân bóng phù hợp</Text>
                                <Text style={styles.emptySub}>Thử thay đổi từ khóa hoặc bộ lọc</Text>
                            </View>
                        }
                    />
                )}

                {/* Bottom App Navigation Bar (Always Visible) */}
                <AdminBottomNav activeTab="fields" navigation={navigation} />
            </View>

            {/* PITCH DETAIL MODAL */}
            <Modal
                visible={detailVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setDetailVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCardWrapper}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalSubHeader}>THÔNG TIN CHI TIẾT SÂN BÓNG</Text>
                                <Text style={styles.modalMainHeader}>
                                    {detailField?.field_name || detailField?.name || 'Chi tiết sân'}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setDetailVisible(false)}>
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                            {/* Pitch Banner Image */}
                            {(() => {
                                const rawImg = detailField?.image || detailField?.image_url;
                                const photoUri = rawImg
                                    ? (rawImg.startsWith('http') ? rawImg : `${MEDIA_URL}${rawImg}`)
                                    : 'https://images.unsplash.com/photo-1529900245534-5e69e5f5d50a?q=80&w=800';
                                const isAvail = detailField?.is_available !== false;
                                const typeLabel = detailField?.field_type_name || detailField?.field_type?.name || detailField?.field_type || '7 vs 7';

                                return (
                                    <View style={styles.detailHeroBox}>
                                        <Image source={{ uri: photoUri }} style={styles.detailHeroImg} resizeMode="cover" />
                                        <View style={styles.detailHeroOverlay} />
                                        <View style={styles.detailHeroTopBadge}>
                                            <View style={styles.fifaBadge}>
                                                <Ionicons name="shield-checkmark" size={13} color="#006b2c" />
                                                <Text style={styles.fifaBadgeText}>FIFA Quality Pro</Text>
                                            </View>
                                            <View style={[styles.statusPill, isAvail ? styles.statusActive : styles.statusMaint]}>
                                                <View style={[styles.statusDot, isAvail ? styles.dotActive : styles.dotMaint]} />
                                                <Text style={[styles.statusPillText, isAvail ? styles.textActive : styles.textMaint]}>{isAvail ? 'Sẵn sàng' : 'Bảo trì'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })()}

                            {/* Spec Details Table */}
                            <View style={styles.detailSpecContainer}>
                                <View style={styles.detailSpecRow}>
                                    <View style={styles.detailSpecCol}>
                                        <Text style={styles.detailSpecLabel}>Loại sân (Quy mô)</Text>
                                        <Text style={styles.detailSpecValue}>
                                            {detailField?.field_type_name || detailField?.field_type?.name || detailField?.field_type || 'Sân 7 người'}
                                        </Text>
                                    </View>
                                    <View style={styles.detailSpecCol}>
                                        <Text style={styles.detailSpecLabel}>Giá thuê mỗi giờ</Text>
                                        <Text style={[styles.detailSpecValue, { color: '#006b2c', fontWeight: '800' }]}>
                                            {Number(detailField?.price_per_hour || detailField?.price || 0).toLocaleString('vi-VN')} đ/h
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.detailSpecDivider} />

                                <View style={styles.detailSpecRow}>
                                    <View style={styles.detailSpecCol}>
                                        <Text style={styles.detailSpecLabel}>Vị trí sân</Text>
                                        <Text style={styles.detailSpecValue}>
                                            {detailField?.location || detailField?.address || 'Chưa cập nhật địa chỉ'}
                                        </Text>
                                    </View>
                                    <View style={styles.detailSpecCol}>
                                        <Text style={styles.detailSpecLabel}>Số điện thoại liên hệ</Text>
                                        <Text style={styles.detailSpecValue}>
                                            {detailField?.phone || 'Chưa cập nhật'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.detailSpecDivider} />

                                <View style={styles.detailSpecRow}>
                                    <View style={styles.detailSpecCol}>
                                        <Text style={styles.detailSpecLabel}>Trạng thái hoạt động</Text>
                                        <Text style={[styles.detailSpecValue, { color: detailField?.is_available !== false ? '#15803d' : '#ea580c' }]}>
                                            {detailField?.is_available !== false ? 'Hoạt động bình thường' : 'Tạm khóa bảo dưỡng'}
                                        </Text>
                                    </View>
                                    <View style={styles.detailSpecCol}>
                                        <Text style={styles.detailSpecLabel}>Lượt khách đặt sân</Text>
                                        <Text style={styles.detailSpecValue}>
                                            {detailField?.booking_count || 0} lượt đặt
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Mô tả chi tiết */}
                            <View style={styles.detailDescSection}>
                                <Text style={styles.detailSectionTitle}>MÔ TẢ CHI TIẾT SÂN</Text>
                                <Text style={styles.detailDescBody}>
                                    {detailField?.description || 'Chưa có thông tin mô tả chi tiết cho sân bóng này.'}
                                </Text>
                            </View>
                        </ScrollView>

                        {/* Modal Footer: Action Buttons */}
                        <View style={styles.detailFooterRow}>
                            <TouchableOpacity
                                style={styles.detailEditBtn}
                                onPress={() => {
                                    const target = detailField;
                                    setDetailVisible(false);
                                    openEditModal(target);
                                }}
                            >
                                <Ionicons name="create-outline" size={16} color="#006b2c" />
                                <Text style={styles.detailEditBtnText}>Sửa sân</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.modalDoneBtn}
                                onPress={() => setDetailVisible(false)}
                            >
                                <Text style={styles.modalDoneBtnText}>Đóng</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ADD / EDIT MODAL - MATCHING WEB CRUD EXACTLY */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCardWrapper}>
                        {/* Header */}
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalSubHeader}>
                                    {editingField ? 'CHỈNH SỬA SÂN BÓNG' : 'THÊM MỚI SÂN BÓNG'}
                                </Text>
                                <Text style={styles.modalMainHeader}>
                                    {editingField ? (editingField.field_name || editingField.name || 'Cập Nhật Sân') : 'Thêm Sân Bóng Mới'}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>

                        {/* Scrollable Form Body */}
                        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                            {/* 1. Tên sân bóng */}
                            <Text style={styles.formLabel}>Tên sân bóng *</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Ví dụ: Sân Hòa Xuân 1"
                                placeholderTextColor="#94a3b8"
                                value={fieldName}
                                onChangeText={setFieldName}
                            />

                            {/* 2. Loại sân / Quy mô */}
                            <Text style={styles.formLabel}>Loại sân (Quy mô)</Text>
                            <View style={styles.typeSelectorRow}>
                                {[
                                    { key: '5 vs 5', label: 'Sân 5 (5 vs 5)' },
                                    { key: '7 vs 7', label: 'Sân 7 (7 vs 7)' },
                                    { key: '11 vs 11', label: 'Sân 11 (11 vs 11)' },
                                ].map(t => (
                                    <TouchableOpacity
                                        key={t.key}
                                        style={[styles.typePill, fieldType === t.key && styles.typePillActive]}
                                        onPress={() => setFieldType(t.key)}
                                    >
                                        <Text style={[styles.typePillText, fieldType === t.key && styles.typePillTextActive]}>
                                            {t.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* 3. Giá thuê mỗi giờ */}
                            <Text style={styles.formLabel}>Giá thuê mỗi giờ (VNĐ) *</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Ví dụ: 250000"
                                placeholderTextColor="#94a3b8"
                                keyboardType="numeric"
                                value={pricePerHour}
                                onChangeText={setPricePerHour}
                            />

                            {/* 4. Vị trí / Địa chỉ */}
                            <Text style={styles.formLabel}>Vị trí / Địa chỉ sân *</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Ví dụ: Hòa Xuân, Cẩm Lệ, Đà Nẵng"
                                placeholderTextColor="#94a3b8"
                                value={location}
                                onChangeText={setLocation}
                            />

                            {/* 5. Số điện thoại liên hệ */}
                            <Text style={styles.formLabel}>Số điện thoại liên hệ</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Ví dụ: 0905123456"
                                placeholderTextColor="#94a3b8"
                                keyboardType="phone-pad"
                                value={phone}
                                onChangeText={setPhone}
                            />

                            {/* 6. Mô tả chi tiết sân bóng */}
                            <Text style={styles.formLabel}>Mô tả chi tiết sân bóng</Text>
                            <TextInput
                                style={[styles.formInput, { height: 75, textAlignVertical: 'top', paddingTop: 8 }]}
                                placeholder="Mô tả về chất lượng cỏ, hệ thống chiếu sáng, tiện ích đi kèm..."
                                placeholderTextColor="#94a3b8"
                                multiline
                                numberOfLines={3}
                                value={description}
                                onChangeText={setDescription}
                            />

                            {/* 7. Trạng thái hoạt động sân bóng */}
                            {editingField ? (
                                <View style={{ marginTop: 12 }}>
                                    <Text style={styles.formLabel}>Trạng Thái Hoạt Động Của Sân</Text>
                                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                        <TouchableOpacity
                                            style={[
                                                styles.segmentBtn,
                                                { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 8 },
                                                isAvailable
                                                    ? { backgroundColor: '#ecfdf5', borderColor: '#059669' }
                                                    : { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }
                                            ]}
                                            onPress={() => setIsAvailable(true)}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="checkmark-circle" size={18} color={isAvailable ? '#059669' : '#94a3b8'} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 13, fontWeight: '700', color: isAvailable ? '#059669' : '#475569' }}>
                                                    Hoạt động
                                                </Text>
                                                <Text style={{ fontSize: 10.5, color: isAvailable ? '#047857' : '#94a3b8', marginTop: 1 }}>
                                                    Sẵn sàng đón khách
                                                </Text>
                                            </View>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.segmentBtn,
                                                { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 8 },
                                                !isAvailable
                                                    ? { backgroundColor: '#fff7ed', borderColor: '#ea580c' }
                                                    : { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }
                                            ]}
                                            onPress={() => setIsAvailable(false)}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="construct-outline" size={18} color={!isAvailable ? '#ea580c' : '#94a3b8'} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 13, fontWeight: '700', color: !isAvailable ? '#ea580c' : '#475569' }}>
                                                    Bảo trì
                                                </Text>
                                                <Text style={{ fontSize: 10.5, color: !isAvailable ? '#c2410c' : '#94a3b8', marginTop: 1 }}>
                                                    Tạm khóa bảo dưỡng
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : null}
                        </ScrollView>

                        {/* Footer buttons */}
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
                                    <>
                                        <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
                                        <Text style={styles.modalSubmitBtnText}>
                                            {editingField ? 'Lưu thay đổi' : 'Xác nhận thêm sân'}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* In-Screen Dialog (Thay thế hoàn toàn popup mặc định của trình duyệt) */}
            <AppConfirmDialog {...dialogConfig} />
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
    responsiveContainer: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    statsStrip: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 10,
        borderWidth: 1,
        borderColor: '#eceef0',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 4,
    },
    statCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    statActiveDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#006b2c',
    },
    topPill: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 9999,
    },
    topPillText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#b45309',
    },
    statBigNumber: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
    },
    statUnit: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6b7280',
    },
    statLabelGreen: {
        fontSize: 10,
        fontWeight: '700',
        color: '#15803d',
        marginTop: 2,
    },
    statLabelPrime: {
        fontSize: 10,
        fontWeight: '700',
        color: '#b45309',
        marginTop: 2,
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#6b7280',
        marginTop: 2,
    },
    statSubMaint: {
        fontSize: 9,
        color: '#94a3b8',
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
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingBottom: 90,
        gap: 14,
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
    pitchCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#eceef0',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
    },
    photoContainer: {
        width: '100%',
        height: 160,
        position: 'relative',
        backgroundColor: '#0f172a',
    },
    pitchImage: {
        width: '100%',
        height: '100%',
    },
    photoOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    photoTopRow: {
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
        gap: 4,
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
        borderWidth: 1,
        borderColor: '#dcfce7',
    },
    fifaBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#006b2c',
        letterSpacing: 0.3,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
    },
    statusActive: {
        backgroundColor: '#dcfce7',
    },
    statusMaint: {
        backgroundColor: '#fee2e2',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    dotActive: {
        backgroundColor: '#006b2c',
    },
    dotMaint: {
        backgroundColor: '#b91c1c',
    },
    statusPillText: {
        fontSize: 10,
        fontWeight: '700',
    },
    textActive: {
        color: '#15803d',
    },
    textMaint: {
        color: '#b91c1c',
    },
    photoBottomRow: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        right: 10,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    pitchHeaderTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#ffffff',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    typeBadge: {
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    typeBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#111827',
    },
    cardContent: {
        padding: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 6,
    },
    infoText: {
        fontSize: 12,
        color: '#374151',
        fontWeight: '500',
        flex: 1,
    },
    infoSubText: {
        fontSize: 11,
        color: '#6b7280',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
        marginTop: 4,
        marginBottom: 8,
    },
    priceLabel: {
        fontSize: 11,
        color: '#6b7280',
        fontWeight: '600',
    },
    priceValue: {
        fontSize: 17,
        fontWeight: '800',
        color: '#006b2c',
    },
    hourUnit: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6b7280',
    },
    
    specsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
        flexWrap: 'wrap',
    },
    specTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#f8fafc',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    specTagText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#475569',
    },

    actionBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f2f4f6',
    },
    viewActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#f0fdf4',
        paddingVertical: 7,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#dcfce7',
    },
    viewActionText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#006b2c',
    },
    editActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#f2f4f6',
        paddingVertical: 7,
        borderRadius: 8,
    },
    editActionText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#111827',
    },
    maintActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#ffedd5',
        paddingVertical: 7,
        borderRadius: 8,
    },
    maintActionBtnActive: {
        backgroundColor: '#dcfce7',
    },
    maintActionText: {
        fontSize: 11,
        fontWeight: '700',
    },
    deleteActionBtn: {
        width: 32,
        height: 32,
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
        maxWidth: 520,
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
        fontSize: 17,
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
    detailHeroBox: {
        width: '100%',
        height: 160,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        marginBottom: 12,
    },
    detailHeroImg: {
        width: '100%',
        height: '100%',
    },
    detailHeroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    detailHeroTopBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        right: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailSpecContainer: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    detailSpecRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailSpecCol: {
        flex: 1,
    },
    detailSpecLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#6b7280',
    },
    detailSpecValue: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
        marginTop: 2,
    },
    detailSpecDivider: {
        height: 1,
        backgroundColor: '#eceef0',
        marginVertical: 8,
    },
    detailDescSection: {
        marginBottom: 12,
    },
    detailSectionTitle: {
        fontSize: 10,
        fontWeight: '800',
        color: '#6b7280',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    detailDescBody: {
        fontSize: 12,
        color: '#374151',
        lineHeight: 18,
    },
    detailFooterRow: {
        flexDirection: 'row',
        gap: 8,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f2f4f6',
    },
    detailEditBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#f0fdf4',
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#dcfce7',
    },
    detailEditBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#006b2c',
    },
    modalDoneBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#006b2c',
        paddingVertical: 10,
        borderRadius: 10,
    },
    modalDoneBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    // Form styles
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
