import React, { useContext, useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    RefreshControl,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { getRevenueAnalyticsApi } from '../api/paymentsApi';
import { getStaffBookingsApi } from '../api/bookingsApi';
import { getFieldsApi } from '../api/fieldsApi';
import AdminBottomNav from '../components/AdminBottomNav';

export default function StaffOperationsScreen({ navigation }) {
    const { user, logout } = useContext(AuthContext);
    const [kpis, setKpis] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [fields, setFields] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    const userName = user?.fullname || user?.full_name || user?.name || user?.username || 'Quản trị viên';
    const userRole = String(user?.role || 'admin').toLowerCase();
    const isAdmin = ['admin', 'field_owner', 'field_manager'].includes(userRole);

    const ROLE_NAME_MAP = {
        admin: 'Quản Trị Viên',
        field_owner: 'Chủ Sân Bóng',
        field_manager: 'Người Quản Lý Sân',
        receptionist: 'Lễ Tân Tiếp Đón',
        cashier: 'Nhân Viên Thu Ngân',
        service_staff: 'Nhân Viên Dịch Vụ',
        cleaner: 'Nhân Viên Dọn Dẹp',
        maintenance: 'Nhân Viên Kỹ Thuật',
    };

    const ROLE_ALLOWED_SCREENS = {
        admin: ['StaffBookings', 'AdminTimeslots', 'AdminTournaments', 'AdminFields', 'Cleaning', 'Maintenance', 'AdminRevenue', 'AdminServices', 'AdminVouchers', 'AdminUsers', 'ProfileTab'],
        field_owner: ['AdminRevenue', 'AdminFields', 'StaffBookings', 'AdminTournaments', 'AdminVouchers', 'AdminTimeslots', 'ProfileTab'],
        field_manager: ['StaffBookings', 'AdminTimeslots', 'AdminTournaments', 'AdminFields', 'Cleaning', 'Maintenance', 'AdminServices', 'AdminUsers', 'ProfileTab'],
        receptionist: ['StaffBookings', 'Cleaning', 'AdminServices', 'AdminTournaments', 'ProfileTab'],
        cashier: ['StaffBookings', 'AdminRevenue', 'AdminServices', 'ProfileTab'],
        service_staff: ['AdminServices', 'StaffBookings', 'ProfileTab'],
        cleaner: ['Cleaning', 'Maintenance', 'StaffBookings', 'ProfileTab'],
        maintenance: ['Maintenance', 'AdminFields', 'Cleaning', 'ProfileTab'],
    };

    const loadData = async () => {
        try {
            const [revRes, bookRes, fieldsRes] = await Promise.allSettled([
                getRevenueAnalyticsApi(),
                getStaffBookingsApi(),
                getFieldsApi()
            ]);

            if (revRes.status === 'fulfilled') setKpis(revRes.value);
            if (bookRes.status === 'fulfilled') {
                const list = Array.isArray(bookRes.value) ? bookRes.value : (bookRes.value?.results || []);
                setBookings(list);
            }
            if (fieldsRes.status === 'fulfilled') {
                const fData = fieldsRes.value;
                const fList = fData?.fields || fData?.results || (Array.isArray(fData) ? fData : []);
                setFields(fList);
            }
        } catch (e) {
            console.warn('Lỗi lấy dữ liệu vận hành:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleLogout = () => {
        Alert.alert(
            'Đăng xuất tài khoản',
            'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản quản lý và ca trực hiện tại không?',
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Đăng xuất',
                    style: 'destructive',
                    onPress: async () => {
                        await logout();
                    }
                }
            ]
        );
    };

    const moduleCategories = [
        {
            categoryTitle: 'ĐIỀU PHỐI SÂN & GIẢI ĐẤU',
            categoryIcon: 'calendar',
            categoryColor: '#006b2c',
            items: [
                { label: 'Quản lý đặt sân', sub: 'Lịch thi đấu, cọc & check-in 1 chạm', icon: 'calendar', screen: 'StaffBookings', color: '#006b2c', bg: '#f0fdf4' },
                { label: 'Khung giờ & Giờ vàng', sub: 'Thiết lập ca & phụ thu đèn LED', icon: 'time', screen: 'AdminTimeslots', color: '#b45309', bg: '#fef3c7' },
                { label: 'Điều phối giải đấu', sub: 'Tiếp nhận & duyệt giải doanh nghiệp', icon: 'trophy', screen: 'AdminTournaments', color: '#1d4ed8', bg: '#dbeafe' },
            ]
        },
        {
            categoryTitle: 'SÂN BÃI, 5S & BẢO TRÌ',
            categoryIcon: 'football',
            categoryColor: '#055b35',
            items: [
                { label: 'Quản lý sân bóng', sub: 'Danh sách sân, giá & thư viện ảnh', icon: 'football', screen: 'AdminFields', color: '#006b2c', bg: '#f0fdf4' },
                { label: 'Giám sát vệ sinh 5S', sub: 'Checklist vệ sinh mặt cỏ & rác', icon: 'sparkles', screen: 'Cleaning', color: '#0f766e', bg: '#ccfbf1' },
                { label: 'Bảo trì sự cố kỹ thuật', sub: 'Sửa chữa dàn đèn Philips & mặt sân', icon: 'construct', screen: 'Maintenance', color: '#b91c1c', bg: '#fee2e2' },
            ]
        },
        {
            categoryTitle: 'TÀI CHÍNH, KHO & KHUYẾN MÃI',
            categoryIcon: 'cash',
            categoryColor: '#006b2c',
            items: [
                { label: 'Báo cáo doanh thu', sub: 'Thống kê tài chính & SePay VietQR', icon: 'cash', screen: 'AdminRevenue', color: '#006b2c', bg: '#dcfce7' },
                { label: 'Kho dịch vụ & Hàng', sub: 'F&B, nước uống Revive & phụ kiện', icon: 'cube', screen: 'AdminServices', color: '#c2410c', bg: '#ffedd5' },
                { label: 'Voucher khuyến mãi', sub: 'Mã giảm giá & chiến dịch', icon: 'pricetag', screen: 'AdminVouchers', color: '#7c3aed', bg: '#ede9fe' },
            ]
        },
        {
            categoryTitle: 'HỆ THỐNG & NHÂN SỰ',
            categoryIcon: 'settings',
            categoryColor: '#374151',
            items: [
                { label: 'Quản trị tài khoản', sub: 'Danh sách nhân viên & khách hàng', icon: 'people', screen: 'AdminUsers', color: '#0284c7', bg: '#e0f2fe' },
                { label: 'Hồ sơ cá nhân', sub: 'Cập nhật mật khẩu & thông tin tài khoản', icon: 'person', screen: 'ProfileTab', color: '#006b2c', bg: '#f0fdf4' },
            ]
        }
    ];

    const filteredCategories = useMemo(() => {
        const allowedScreens = ROLE_ALLOWED_SCREENS[userRole] || ROLE_ALLOWED_SCREENS.admin;
        return moduleCategories
            .map(cat => ({
                ...cat,
                items: cat.items.filter(item => allowedScreens.includes(item.screen))
            }))
            .filter(cat => cat.items.length > 0);
    }, [userRole]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.responsiveContainer}>
                {/* Top Bar */}
                <View style={styles.topBar}>
                    <View style={styles.brandRow}>
                        <View style={styles.logoBadge}>
                            <Ionicons name="options" size={18} color="#ffffff" />
                        </View>
                        <View style={{ marginLeft: 8 }}>
                            <Text style={styles.brandTitle}>Trung Tâm Vận Hành</Text>
                            <Text style={styles.brandSub}>PHÂN HỆ & ĐIỀU PHỐI HỆ THỐNG</Text>
                        </View>
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#006b2c']} />}
                >
                    {/* User Profile Card: Deep Emerald Theme */}
                    <View style={styles.profileCard}>
                        <View style={styles.profileTop}>
                            <View style={styles.avatarCircle}>
                                <Text style={styles.avatarText}>{userName.slice(0, 2).toUpperCase()}</Text>
                            </View>

                            <View style={{ flex: 1, marginLeft: 14 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.profileName}>{userName}</Text>
                                    <View style={styles.roleBadge}>
                                        <Text style={styles.roleBadgeText}>
                                            {ROLE_NAME_MAP[userRole] || 'Nhân Viên Hệ Thống'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.profilePhone}>{user?.phone || user?.email || 'Tài khoản hệ thống'}</Text>
                            </View>

                            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} title="Đăng xuất" activeOpacity={0.8}>
                                <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Operational Categories Menu Filtered by Role */}
                    <View style={styles.categoriesContainer}>
                        {filteredCategories.map((cat, cIdx) => (
                            <View key={cIdx} style={styles.categoryCard}>
                                <View style={styles.categoryHeader}>
                                    <Ionicons name={cat.categoryIcon} size={15} color={cat.categoryColor} />
                                    <Text style={[styles.categoryTitle, { color: cat.categoryColor }]}>
                                        {cat.categoryTitle}
                                    </Text>
                                </View>

                                <View style={styles.categoryItemsList}>
                                    {cat.items.map((m, mIdx) => (
                                        <TouchableOpacity
                                            key={mIdx}
                                            style={[styles.appMenuItem, mIdx < cat.items.length - 1 && styles.appMenuItemBorder]}
                                            onPress={() => navigation.navigate(m.screen)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={[styles.appMenuIconBox, { backgroundColor: m.bg }]}>
                                                <Ionicons name={m.icon} size={20} color={m.color} />
                                            </View>
                                            <View style={{ flex: 1, marginLeft: 12 }}>
                                                <Text style={styles.appMenuTitle}>{m.label}</Text>
                                                <Text style={styles.appMenuSub} numberOfLines={1}>{m.sub}</Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        ))}
                    </View>

                    <View style={{ height: 85 }} />
                </ScrollView>

                {/* Bottom App Navigation Bar (Only for Admins/Managers) */}
                {isAdmin && <AdminBottomNav activeTab="operations" navigation={navigation} />}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    responsiveContainer: {
        flex: 1,
        maxWidth: 768,
        width: '100%',
        alignSelf: 'center',
    },
    topBar: {
        height: 62,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoBadge: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#059669',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    brandTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.3,
    },
    brandSub: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748b',
        letterSpacing: 0.5,
    },
    refreshBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 100,
    },
    profileCard: {
        backgroundColor: '#064e3b',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#059669',
        shadowColor: '#064e3b',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
        elevation: 5,
    },
    profileTop: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#022c1e',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#34d399',
    },
    avatarText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '800',
    },
    profileName: {
        fontSize: 16,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: -0.2,
    },
    roleBadge: {
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 10,
    },
    roleBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#ffffff',
    },
    profilePhone: {
        fontSize: 12,
        color: '#a7f3d0',
        marginTop: 2,
        fontWeight: '500',
    },
    logoutBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoriesContainer: {
        gap: 12,
    },
    categoryCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    categoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderColor: '#f1f5f9',
    },
    categoryTitle: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    categoryItemsList: {
        gap: 2,
    },
    appMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 9,
    },
    appMenuItemBorder: {
        borderBottomWidth: 1,
        borderColor: '#f8fafc',
    },
    appMenuIconBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    appMenuTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0f172a',
    },
    appMenuSub: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 1,
    },
});
