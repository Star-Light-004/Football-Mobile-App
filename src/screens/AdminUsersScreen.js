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
    RefreshControl,
    Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
    getUsersApi,
    updateUserApi,
    toggleUserStatusApi,
    createGuestCustomerApi,
    createUserApi,
    deleteUserApi,
    getRolePermissionsApi,
    updateRolePermissionsApi,
    resetRolePermissionsApi
} from '../api/usersApi';


const ROLE_OPTIONS = [
    { value: 'admin', label: '1. Quản trị viên (Admin)', desc: 'Toàn quyền hệ thống, cấu hình cổng SePay', color: '#b91c1c', bg: '#fee2e2' },
    { value: 'field_owner', label: '2. Chủ sân bóng (Owner)', desc: 'Xem dòng tiền doanh thu, phê duyệt giải', color: '#006b2c', bg: '#dcfce7' },
    { value: 'field_manager', label: '3. Quản lý vận hành (Manager)', desc: 'Điều phối ca đấu, phân công kíp trực', color: '#b45309', bg: '#fef3c7' },
    { value: 'receptionist', label: '4. Lễ tân tiếp đón (Receptionist)', desc: 'Check-in 1 chạm, đặt quầy walk-in', color: '#0284c7', bg: '#e0f2fe' },
    { value: 'cashier', label: '5. Thu ngân thanh toán (Cashier)', desc: 'Đối soát chuyển khoản SePay, xuất bill', color: '#db2777', bg: '#fce7f3' },
    { value: 'service_staff', label: '6. Nhân viên kho F&B (Service)', desc: 'Xuất nhập nước Revive, phát áo bib', color: '#7c3aed', bg: '#ede9fe' },
    { value: 'cleaner', label: '7. Nhân viên vệ sinh (Cleaner)', desc: 'Checklist 5S mặt cỏ & phòng thay đồ', color: '#0f766e', bg: '#ccfbf1' },
    { value: 'maintenance', label: '8. Kỹ thuật viên (Technician)', desc: 'Sửa chữa dàn đèn LED Philips, mặt cỏ', color: '#c2410c', bg: '#ffedd5' },
    { value: 'customer', label: '9. Khách hàng cầu thủ (Player)', desc: 'Đặt sân online, quét QR Napas 247', color: '#374151', bg: '#f2f4f6' },
];

export default function AdminUsersScreen({ navigation }) {
    // Main Sub-tabs: 'system' | 'guests' | 'roles'
    const [mainTab, setMainTab] = useState('system');

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'matrix'
    const [filterRole, setFilterRole] = useState('all');

    // Modal Edit Role
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedRole, setSelectedRole] = useState('customer');
    const [saving, setSaving] = useState(false);

    // Modal Create Guest Customer
    const [guestModalVisible, setGuestModalVisible] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [guestNotes, setGuestNotes] = useState('');
    const [savingGuest, setSavingGuest] = useState(false);

    // Role Permissions Matrix State
    const [permissionsData, setPermissionsData] = useState(null);
    const [loadingPermissions, setLoadingPermissions] = useState(false);
    const [savingPermissions, setSavingPermissions] = useState(false);


    const [refreshing, setRefreshing] = useState(false);

    const loadUsers = async () => {
        try {
            const data = await getUsersApi();
            const list = Array.isArray(data) ? data : (data?.results || data?.users || []);
            setUsers(list);
        } catch (e) {
            console.warn('Lỗi lấy danh sách người dùng:', e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadPermissions = async () => {
        setLoadingPermissions(true);
        try {
            const data = await getRolePermissionsApi();
            setPermissionsData(data?.permissions || data || {});
        } catch (e) {
            console.warn('Lỗi lấy ma trận phân quyền:', e.message);
        } finally {
            setLoadingPermissions(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadUsers();
        if (mainTab === 'roles') {
            loadPermissions();
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    useEffect(() => {
        if (mainTab === 'roles') {
            loadPermissions();
        }
    }, [mainTab]);

    const handleCreateGuest = async () => {
        if (!guestName.trim() || !guestPhone.trim()) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ tên và số điện thoại khách vãng lai');
            return;
        }

        setSavingGuest(true);
        try {
            await createGuestCustomerApi({
                name: guestName.trim(),
                phone: guestPhone.trim(),
                email: guestEmail.trim() || undefined,
                notes: guestNotes.trim() || undefined,
            });
            Alert.alert('Thành công', 'Đã lưu thông tin khách vãng lai vào hệ thống');
            setGuestModalVisible(false);
            setGuestName('');
            setGuestPhone('');
            setGuestEmail('');
            setGuestNotes('');
            loadUsers();
        } catch (e) {
            Alert.alert('Lỗi', e.response?.data?.error || e.message || 'Không thể tạo khách vãng lai');
        } finally {
            setSavingGuest(false);
        }
    };

    const handleTogglePermission = async (roleKey, permKey) => {
        if (!permissionsData) return;
        const currentPerms = permissionsData[roleKey] || [];
        const exists = currentPerms.includes(permKey);
        const nextPerms = exists ? currentPerms.filter(k => k !== permKey) : [...currentPerms, permKey];

        const updatedMatrix = {
            ...permissionsData,
            [roleKey]: nextPerms
        };
        setPermissionsData(updatedMatrix);

        try {
            await updateRolePermissionsApi(updatedMatrix);
        } catch (e) {
            console.warn('Lỗi cập nhật quyền vai trò:', e);
            Alert.alert('Lỗi', 'Không thể lưu thay đổi quyền hạn');
        }
    };

    const handleResetPermissions = async () => {
        Alert.alert(
            'Khôi phục mặc định',
            'Bạn có chắc muốn khôi phục phân quyền 9 vai trò về mặc định ban đầu không?',
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Khôi phục',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await resetRolePermissionsApi();
                            setPermissionsData(res?.permissions || res || {});
                            Alert.alert('Thành công', 'Đã khôi phục phân quyền về mặc định');
                        } catch (e) {
                            Alert.alert('Lỗi', 'Không thể khôi phục phân quyền');
                        }
                    }
                }
            ]
        );
    };


    const handleToggleStatus = async (user) => {
        const isCurrentActive = user.is_active !== false && user.status !== 'blocked';
        const actionText = isCurrentActive ? 'khóa' : 'mở khóa';

        const doToggle = async () => {
            try {
                await toggleUserStatusApi(user.id);
                loadUsers();
            } catch (e) {
                Alert.alert('Lỗi', 'Không thể thay đổi trạng thái tài khoản');
            }
        };

        Alert.alert(
            'Xác nhận thao tác',
            `Bạn có chắc chắn muốn ${actionText} tài khoản của "${user.name || user.username}"?`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Đồng ý',
                    onPress: doToggle,
                }
            ]
        );
    };

    const openEditRole = (user) => {
        setSelectedUser(user);
        setSelectedRole(user.role || 'customer');
        setModalVisible(true);
    };

    const handleSaveRole = async () => {
        if (!selectedUser) return;
        setSaving(true);
        try {
            await updateUserApi(selectedUser.id, { role: selectedRole });
            Alert.alert('Thành công', 'Đã cấp quyền RBAC mới cho tài khoản thành công!');
            setModalVisible(false);
            loadUsers();
        } catch (e) {
            Alert.alert('Lỗi', 'Không thể cập nhật quyền');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUser = (userItem) => {
        const name = userItem.name || userItem.full_name || userItem.username || 'người dùng này';
        Alert.alert(
            'Xác nhận xóa tài khoản',
            `Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản "${name}" khỏi hệ thống không?`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Xóa vĩnh viễn',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteUserApi(userItem.id);
                            Alert.alert('Thành công', `Đã xóa tài khoản "${name}".`);
                            loadUsers();
                        } catch (e) {
                            Alert.alert('Lỗi', 'Không thể xóa: ' + (e.response?.data?.error || e.message));
                        }
                    }
                }
            ]
        );
    };

    // Dynamic RBAC Telemetry from database
    const kpis = useMemo(() => {
        const registered = users.filter(u => !u.is_guest);
        const total = registered.length;
        const staff = registered.filter(u => u.role && u.role !== 'customer').length;
        const customers = total - staff;
        const activeUsers = registered.filter(u => u.is_active !== false && u.status !== 'blocked').length;
        return {
            total,
            staff,
            customers,
            activeCount: activeUsers
        };
    }, [users]);

    const filtered = users.filter(u => {
        // Tách biệt: Tab Tài khoản hệ thống chỉ hiển thị tài khoản thành viên/nhân sự, không lẫn khách vãng lai
        if (u.is_guest) return false;

        const n = (u.name || u.full_name || u.username || '').toLowerCase();
        const p = (u.phone || '').toLowerCase();
        const e = (u.email || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        const matchesQ = !q || n.includes(q) || p.includes(q) || e.includes(q);
        if (!matchesQ) return false;

        if (filterRole === 'all') return true;
        if (filterRole === 'staff') return u.role && u.role !== 'customer';
        if (filterRole === 'customer') return !u.role || u.role === 'customer';
        return u.role === filterRole;
    });

    const getRoleMeta = (r) => {
        return ROLE_OPTIONS.find(item => item.value === r) || ROLE_OPTIONS[8];
    };

    const renderItem = ({ item }) => {
        const roleMeta = getRoleMeta(item.role);
        const isActive = item.is_active !== false && item.status !== 'blocked';
        const name = item.name || item.full_name || item.username || 'Người dùng';

        return (
            <View style={styles.userCard}>
                <View style={styles.cardTopRow}>
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{name.slice(0, 2).toUpperCase()}</Text>
                        <View style={[styles.avatarStatusDot, isActive ? styles.avatarDotOnline : styles.avatarDotBlocked]} />
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={styles.nameStatusRow}>
                            <Text style={styles.userName} numberOfLines={1}>{name}</Text>
                            <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusBlocked]}>
                                <Text style={[styles.statusBadgeText, isActive ? styles.textActive : styles.textBlocked]}>
                                    {isActive ? 'Hoạt động' : 'Tạm khóa'}
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.userContact}>
                            {item.phone || 'Chưa cập nhật SĐT'} • {item.email || 'Chưa cập nhật email'}
                        </Text>

                        {/* RBAC Role Chip */}
                        <View style={[styles.roleBadge, { backgroundColor: roleMeta.bg }]}>
                            <Ionicons name="shield-checkmark" size={12} color={roleMeta.color} />
                            <Text style={[styles.roleBadgeText, { color: roleMeta.color }]}>{roleMeta.label}</Text>
                        </View>
                    </View>
                </View>

                {/* Operations Footer */}
                <View style={styles.cardFooter}>
                    {item.phone ? (
                        <TouchableOpacity
                            style={[styles.roleAssignBtn, { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }]}
                            onPress={() => Linking.openURL(`tel:${item.phone}`)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="call" size={14} color="#006b2c" />
                            <Text style={[styles.roleAssignText, { color: '#006b2c' }]}>Gọi điện</Text>
                        </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity style={styles.roleAssignBtn} onPress={() => openEditRole(item)} activeOpacity={0.8}>
                        <Ionicons name="key" size={14} color="#006b2c" />
                        <Text style={styles.roleAssignText}>Đổi Role</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.toggleStatusBtn, isActive ? styles.btnBlock : styles.btnActive]}
                        onPress={() => handleToggleStatus(item)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name={isActive ? "lock-closed" : "lock-open"} size={14} color={isActive ? "#b91c1c" : "#15803d"} />
                        <Text style={[styles.toggleStatusText, { color: isActive ? '#b91c1c' : '#15803d' }]}>
                            {isActive ? 'Khóa' : 'Mở'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.toggleStatusBtn, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
                        onPress={() => handleDeleteUser(item)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="trash-outline" size={14} color="#b91c1c" />
                        <Text style={[styles.toggleStatusText, { color: '#b91c1c' }]}>Xóa</Text>
                    </TouchableOpacity>
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
                            <Text style={styles.topBarTitle}>Quản Trị Người Dùng</Text>
                            <View style={styles.proPill}>
                                <Text style={styles.proPillText}>HỆ THỐNG</Text>
                            </View>
                        </View>
                        <Text style={styles.topBarSubtitle}>QUẢN TRỊ TÀI KHOẢN</Text>
                    </View>
                </View>

                {/* Action Button */}
                {mainTab === 'guests' ? (
                    <TouchableOpacity
                        style={{
                            backgroundColor: '#006b2c',
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                            borderRadius: 8,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4
                        }}
                        onPress={() => setGuestModalVisible(true)}
                    >
                        <Ionicons name="person-add" size={15} color="#ffffff" />
                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>+ Thêm khách</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* Sub-menu Tabs: Tài khoản hệ thống | Khách vãng lai */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 8 }}>
                {[
                    { key: 'system', label: 'Tài khoản hệ thống' },
                    { key: 'guests', label: 'Khách vãng lai' },
                ].map(t => {
                    const isSel = mainTab === t.key;
                    return (
                        <TouchableOpacity
                            key={t.key}
                            style={{
                                flex: 1,
                                paddingVertical: 9,
                                alignItems: 'center',
                                borderRadius: 8,
                                backgroundColor: isSel ? '#006b2c' : '#f8fafc',
                                borderWidth: 1,
                                borderColor: isSel ? '#006b2c' : '#e2e8f0'
                            }}
                            onPress={() => setMainTab(t.key)}
                        >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: isSel ? '#ffffff' : '#64748b' }}>
                                {t.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#006b2c']} />}
            >
                {mainTab === 'system' ? (
                    <>
                        {/* 2x2 Bento KPI Matrix */}
                        <View style={styles.bentoGrid}>
                            <View style={styles.bentoCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={styles.bentoLabel}>Tổng tài khoản</Text>
                                    <View style={[styles.bentoIconBox, { backgroundColor: '#f0fdf4' }]}>
                                        <Ionicons name="people" size={15} color="#006b2c" />
                                    </View>
                                </View>
                                <Text style={styles.bentoBigNum}>{kpis.total} <Text style={styles.bentoUnit}>User</Text></Text>
                                <Text style={styles.bentoSubText}>{kpis.staff} NV • {kpis.customers} khách</Text>
                            </View>

                            <View style={styles.bentoCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={styles.bentoLabel}>Khách đặt sân</Text>
                                    <View style={[styles.bentoIconBox, { backgroundColor: '#dbeafe' }]}>
                                        <Ionicons name="football" size={15} color="#1d4ed8" />
                                    </View>
                                </View>
                                <Text style={styles.bentoBigNum}>{kpis.customers} <Text style={styles.bentoUnit}>hồ sơ</Text></Text>
                                <Text style={[styles.bentoSubText, { color: '#15803d', fontWeight: '700' }]}>Đặt qua ứng dụng</Text>
                            </View>

                            <View style={styles.bentoCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={styles.bentoLabel}>Nhân sự ca trực</Text>
                                    <View style={[styles.bentoIconBox, { backgroundColor: '#fef3c7' }]}>
                                        <Ionicons name="shield-checkmark" size={15} color="#b45309" />
                                    </View>
                                </View>
                                <Text style={[styles.bentoBigNum, { color: '#b45309' }]}>{kpis.staff} <Text style={styles.bentoUnit}>kíp trực</Text></Text>
                                <Text style={styles.bentoSubText}>8 vị trí chức danh</Text>
                            </View>

                            <View style={styles.bentoCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={[styles.bentoLabel, { color: '#15803d' }]}>Đang hoạt động</Text>
                                    <View style={[styles.bentoIconBox, { backgroundColor: '#dcfce7' }]}>
                                        <Ionicons name="checkmark-circle" size={15} color="#15803d" />
                                    </View>
                                </View>
                                <Text style={[styles.bentoBigNum, { color: '#15803d' }]}>{kpis.activeCount} <Text style={styles.bentoUnit}>/{kpis.total}</Text></Text>
                                <Text style={styles.bentoSubText}>Khả dụng trên hệ thống</Text>
                            </View>
                        </View>

                        {/* Filter Chips: Wrap smoothly on mobile without being cut off */}
                        <View style={styles.filterWrap}>
                            {[
                                { key: 'all', label: `Tất cả (${users.length})` },
                                { key: 'staff', label: `Nhân sự (${kpis.staff})` },
                                { key: 'customer', label: `Khách hàng (${kpis.customers})` },
                                { key: 'admin', label: 'Admin' },
                                { key: 'receptionist', label: 'Lễ tân' },
                                { key: 'cashier', label: 'Thu ngân' },
                                { key: 'cleaner', label: 'Vệ sinh' },
                                { key: 'maintenance', label: 'Kỹ thuật' },
                            ].map(tab => {
                                const isSel = filterRole === tab.key;
                                return (
                                    <TouchableOpacity
                                        key={tab.key}
                                        style={[styles.filterChip, isSel && styles.filterChipActive]}
                                        onPress={() => setFilterRole(tab.key)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.filterChipText, isSel && styles.filterChipTextActive]}>
                                            {tab.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                                <View style={styles.searchWrapper}>
                                    <View style={styles.searchInner}>
                                        <Ionicons name="search" size={18} color="#6b7280" />
                                        <TextInput
                                            style={styles.searchInput}
                                            placeholder="Tìm kiếm họ tên, số điện thoại, email..."
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

                                {loading ? (
                                    <View style={styles.centerBox}>
                                        <ActivityIndicator size="large" color="#006b2c" />
                                        <Text style={{ marginTop: 10, color: '#6b7280', fontSize: 13 }}>Đang tải người dùng...</Text>
                                    </View>
                                ) : filtered.length === 0 ? (
                                    <View style={styles.emptyContainer}>
                                        <Ionicons name="people-outline" size={48} color="#94a3b8" />
                                        <Text style={styles.emptyTitle}>Không tìm thấy tài khoản phù hợp</Text>
                                        <Text style={styles.emptySub}>Thử thay đổi từ khóa hoặc bộ lọc</Text>
                                    </View>
                                ) : (
                                    <View style={styles.usersGrid}>
                                        {filtered.map(item => (
                                            <View key={item.id}>
                                                {renderItem({ item })}
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </>
                ) : (
                    /* TAB 2: KHÁCH VÃNG LAI */
                    <>
                        <View style={styles.bentoGrid}>
                            <View style={styles.bentoCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={styles.bentoLabel}>Khách vãng lai</Text>
                                    <View style={[styles.bentoIconBox, { backgroundColor: '#f0fdf4' }]}>
                                        <Ionicons name="walk" size={15} color="#006b2c" />
                                    </View>
                                </View>
                                <Text style={styles.bentoBigNum}>
                                    {users.filter(u => u.is_guest || u.role === 'customer').length} <Text style={styles.bentoUnit}>khách</Text>
                                </Text>
                                <Text style={styles.bentoSubText}>Đặt sân tại quầy / vãng lai</Text>
                            </View>

                            <View style={styles.bentoCard}>
                                <View style={styles.bentoCardHeader}>
                                    <Text style={styles.bentoLabel}>Đã có đơn đặt</Text>
                                    <View style={[styles.bentoIconBox, { backgroundColor: '#dbeafe' }]}>
                                        <Ionicons name="calendar" size={15} color="#1d4ed8" />
                                    </View>
                                </View>
                                <Text style={styles.bentoBigNum}>
                                    {users.filter(u => (u.is_guest || u.role === 'customer') && (u.booking_count > 0 || u.bookings_count > 0)).length} <Text style={styles.bentoUnit}>hồ sơ</Text>
                                </Text>
                                <Text style={[styles.bentoSubText, { color: '#15803d', fontWeight: '700' }]}>Phát sinh giao dịch</Text>
                            </View>
                        </View>

                        <View style={styles.searchWrapper}>
                            <View style={styles.searchInner}>
                                <Ionicons name="search" size={18} color="#6b7280" />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Tìm kiếm khách vãng lai theo tên, SĐT..."
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

                        {loading ? (
                            <View style={styles.centerBox}>
                                <ActivityIndicator size="large" color="#006b2c" />
                                <Text style={{ marginTop: 10, color: '#6b7280', fontSize: 13 }}>Đang tải danh sách khách...</Text>
                            </View>
                        ) : (
                            <View style={styles.usersGrid}>
                                {users
                                    .filter(u => {
                                        const isGuestMatch = u.is_guest || u.role === 'customer';
                                        if (!isGuestMatch) return false;
                                        const q = searchQuery.toLowerCase().trim();
                                        if (!q) return true;
                                        const name = (u.name || u.full_name || u.username || '').toLowerCase();
                                        const phone = (u.phone || '').toLowerCase();
                                        return name.includes(q) || phone.includes(q);
                                    })
                                    .map(guest => {
                                        const name = guest.name || guest.full_name || guest.username || 'Khách vãng lai';
                                        return (
                                            <View key={guest.id} style={styles.userCard}>
                                                <View style={styles.cardTopRow}>
                                                    <View style={[styles.avatarCircle, { backgroundColor: '#e0f2fe' }]}>
                                                        <Text style={[styles.avatarText, { color: '#0284c7' }]}>
                                                            {name.slice(0, 2).toUpperCase()}
                                                        </Text>
                                                    </View>

                                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                                        <View style={styles.nameStatusRow}>
                                                            <Text style={styles.userName} numberOfLines={1}>{name}</Text>
                                                            <View style={[styles.statusBadge, { backgroundColor: '#f0fdf4' }]}>
                                                                <Text style={[styles.statusBadgeText, { color: '#15803d' }]}>
                                                                    Khách vãng lai
                                                                </Text>
                                                            </View>
                                                        </View>

                                                        <Text style={styles.userContact}>
                                                            {guest.phone || 'Chưa cập nhật SĐT'} • {guest.email || 'Đặt tại quầy'}
                                                        </Text>

                                                        {guest.notes ? (
                                                            <Text style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
                                                                Ghi chú: {guest.notes}
                                                            </Text>
                                                        ) : null}
                                                    </View>
                                                </View>

                                                {guest.phone ? (
                                                    <View style={styles.cardFooter}>
                                                        <TouchableOpacity
                                                            style={styles.roleAssignBtn}
                                                            onPress={() => Alert.alert('Số điện thoại', guest.phone)}
                                                            activeOpacity={0.8}
                                                        >
                                                            <Ionicons name="call" size={14} color="#006b2c" />
                                                            <Text style={styles.roleAssignText}>Gọi khách: {guest.phone}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                ) : null}
                                            </View>
                                        );
                                    })}
                            </View>
                        )}
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>


            {/* MODAL: ASSIGN ROLE */}
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
                                <Text style={styles.modalSubHeader}>PHÂN QUYỀN TRUY CẬP RBAC</Text>
                                <Text style={styles.modalMainHeader}>
                                    {selectedUser?.name || selectedUser?.full_name || selectedUser?.username || 'Tài khoản'}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                            <Text style={styles.formLabel}>Chọn cấp bậc & vai trò đảm nhiệm:</Text>
                            <View style={{ gap: 8, marginTop: 4 }}>
                                {ROLE_OPTIONS.map(r => {
                                    const isSel = selectedRole === r.value;
                                    return (
                                        <TouchableOpacity
                                            key={r.value}
                                            style={[styles.roleSelectOption, isSel && styles.roleSelectOptionActive]}
                                            onPress={() => setSelectedRole(r.value)}
                                            activeOpacity={0.8}
                                        >
                                            <View style={[styles.roleOptionDot, { backgroundColor: r.color }]} />
                                            <View style={{ flex: 1, marginLeft: 8 }}>
                                                <Text style={[styles.roleOptionLabel, isSel && { color: '#006b2c', fontWeight: '800' }]}>
                                                    {r.label}
                                                </Text>
                                                <Text style={styles.roleOptionDesc}>{r.desc}</Text>
                                            </View>
                                            {isSel && (
                                                <Ionicons name="checkmark-circle" size={18} color="#006b2c" />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
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
                                onPress={handleSaveRole}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#ffffff" size="small" />
                                ) : (
                                    <Text style={styles.modalSubmitBtnText}>Xác nhận cấp quyền</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* MODAL: CREATE GUEST CUSTOMER */}
            <Modal
                visible={guestModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setGuestModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCardWrapper}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalSubHeader}>KHÁCH VÃNG LAI TẠI QUẦY</Text>
                                <Text style={styles.modalMainHeader}>Thêm Khách Mới</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setGuestModalVisible(false)}>
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                            <View style={{ gap: 12, marginTop: 4 }}>
                                <View>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b', marginBottom: 4 }}>
                                        Họ và tên khách <Text style={{ color: '#ef4444' }}>*</Text>
                                    </Text>
                                    <TextInput
                                        style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a' }}
                                        placeholder="Ví dụ: Nguyễn Văn A"
                                        placeholderTextColor="#94a3b8"
                                        value={guestName}
                                        onChangeText={setGuestName}
                                    />
                                </View>

                                <View>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b', marginBottom: 4 }}>
                                        Số điện thoại liên hệ <Text style={{ color: '#ef4444' }}>*</Text>
                                    </Text>
                                    <TextInput
                                        style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a' }}
                                        placeholder="Ví dụ: 0905123456"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="phone-pad"
                                        value={guestPhone}
                                        onChangeText={setGuestPhone}
                                    />
                                </View>

                                <View>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b', marginBottom: 4 }}>
                                        Email (không bắt buộc)
                                    </Text>
                                    <TextInput
                                        style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a' }}
                                        placeholder="khach@gmail.com"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="email-address"
                                        value={guestEmail}
                                        onChangeText={setGuestEmail}
                                    />
                                </View>

                                <View>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b', marginBottom: 4 }}>
                                        Ghi chú
                                    </Text>
                                    <TextInput
                                        style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a', minHeight: 60 }}
                                        placeholder="Ví dụ: Khách quen đội bóng thứ 3 hàng tuần"
                                        placeholderTextColor="#94a3b8"
                                        multiline
                                        value={guestNotes}
                                        onChangeText={setGuestNotes}
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooterRow}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setGuestModalVisible(false)}
                            >
                                <Text style={styles.modalCancelBtnText}>Hủy</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalSubmitBtn, savingGuest && { opacity: 0.7 }]}
                                onPress={handleCreateGuest}
                                disabled={savingGuest}
                            >
                                {savingGuest ? (
                                    <ActivityIndicator color="#ffffff" size="small" />
                                ) : (
                                    <Text style={styles.modalSubmitBtnText}>Lưu khách vãng lai</Text>
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
    modeToggleGroup: {
        flexDirection: 'row',
        backgroundColor: '#f2f4f6',
        borderRadius: 8,
        padding: 2,
    },
    modeToggleBtn: {
        width: 32,
        height: 32,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modeToggleBtnActive: {
        backgroundColor: '#006b2c',
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
    usersGrid: {
        gap: 10,
    },
    userCard: {
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
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    avatarCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#006b2c',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    avatarText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#ffffff',
    },
    avatarStatusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: '#ffffff',
    },
    avatarDotOnline: {
        backgroundColor: '#15803d',
    },
    avatarDotBlocked: {
        backgroundColor: '#b91c1c',
    },
    nameStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
    },
    userName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 9999,
    },
    statusActive: {
        backgroundColor: '#dcfce7',
    },
    statusBlocked: {
        backgroundColor: '#fee2e2',
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    textActive: {
        color: '#15803d',
    },
    textBlocked: {
        color: '#b91c1c',
    },
    userContact: {
        fontSize: 11,
        color: '#6b7280',
        marginTop: 2,
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 6,
    },
    roleBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f8fafc',
    },
    roleAssignBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#dcfce7',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    roleAssignText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#006b2c',
    },
    toggleStatusBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    btnBlock: {
        backgroundColor: '#fee2e2',
    },
    btnActive: {
        backgroundColor: '#dcfce7',
    },
    toggleStatusText: {
        fontSize: 11,
        fontWeight: '700',
    },
    // Matrix Table styles
    matrixCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#eceef0',
    },
    matrixHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    matrixHeaderTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#111827',
    },
    matrixHeaderSub: {
        fontSize: 11,
        color: '#6b7280',
        marginTop: 4,
        marginBottom: 12,
    },
    matrixList: {
        gap: 8,
    },
    matrixRowItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#eceef0',
    },
    matrixLevelBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    matrixLevelText: {
        fontSize: 11,
        fontWeight: '800',
    },
    matrixRowTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
    },
    matrixRowDesc: {
        fontSize: 10,
        color: '#6b7280',
        marginTop: 1,
    },
    roleRoleBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    roleRoleText: {
        fontSize: 9,
        fontWeight: '700',
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
        marginBottom: 6,
    },
    roleSelectOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#eceef0',
        borderRadius: 10,
        padding: 10,
    },
    roleSelectOptionActive: {
        borderColor: '#006b2c',
        backgroundColor: '#f0fdf4',
    },
    roleOptionDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    roleOptionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
    },
    roleOptionDesc: {
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
