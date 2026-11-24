import React, { useContext, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    Alert,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext, ADMIN_ROLES, DEFAULT_ADMIN_USER } from '../context/AuthContext';

export default function ProfileScreen({ navigation }) {
    const { user, logout } = useContext(AuthContext);

    const currentRole = String(user?.role || 'admin').toLowerCase();

    const ROLE_LIST = [
        {
            key: 'admin',
            title: 'Quản Trị Viên (Super Admin)',
            desc: 'Toàn quyền quản trị 11 phân hệ & cấu hình hệ thống',
            icon: 'shield-checkmark',
            color: '#15803d',
            bg: '#dcfce7',
        },
        {
            key: 'field_owner',
            title: 'Chủ Sân Bóng Đối Tác',
            desc: 'Báo cáo doanh thu, quản lý tài sản & điều phối',
            icon: 'business',
            color: '#006b2c',
            bg: '#f0fdf4',
        },
        {
            key: 'field_manager',
            title: 'Người Quản Lý Cụm Sân',
            desc: 'Giám sát vận hành, nhân sự, lịch đấu & bảo trì',
            icon: 'briefcase',
            color: '#1d4ed8',
            bg: '#dbeafe',
        },
        {
            key: 'receptionist',
            title: 'Lễ Tân Tiếp Đón Quầy',
            desc: 'Check-in khách, đặt sân trực tiếp & bán dịch vụ',
            icon: 'person',
            color: '#b45309',
            bg: '#fef3c7',
        },
        {
            key: 'cashier',
            title: 'Nhân Viên Thu Ngân',
            desc: 'Quản lý thu chi ca trực & đối soát SePay VietQR',
            icon: 'card',
            color: '#0f766e',
            bg: '#ccfbf1',
        },
        {
            key: 'service_staff',
            title: 'Nhân Viên Kho & Dịch Vụ',
            desc: 'Quản lý F&B, nước giải khát Revive & cho thuê giày',
            icon: 'cube',
            color: '#c2410c',
            bg: '#ffedd5',
        },
        {
            key: 'cleaner',
            title: 'Nhân Viên Vệ Sinh 5S',
            desc: 'Checklist dọn rác mặt sân & quản lý đồ thất lạc',
            icon: 'sparkles',
            color: '#059669',
            bg: '#ecfdf5',
        },
        {
            key: 'maintenance',
            title: 'Kỹ Thuật & Bảo Trì Sân',
            desc: 'Sửa chữa dàn đèn Philips cao áp, lưới & cỏ nhân tạo',
            icon: 'construct',
            color: '#b91c1c',
            bg: '#fee2e2',
        },
    ];

    const currentRoleObj = ROLE_LIST.find(r => r.key === currentRole) || ROLE_LIST[0];

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
                    },
                },
            ]
        );
    };

    const displayName = user?.full_name || user?.fullname || user?.name || user?.username || 'Quản Trị Viên';
    const displayPhone = user?.phone || '0988 123 456';
    const displayEmail = user?.email || 'admin@sanbonghaichau.vn';
    const avatarLetter = (displayName || 'Q').charAt(0).toUpperCase();

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Top Bar */}
            <View style={styles.topBar}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity
                        style={styles.backCircleBtn}
                        onPress={() => {
                            if (navigation.canGoBack()) {
                                navigation.goBack();
                            } else {
                                navigation.navigate('AdminDashboard');
                            }
                        }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={20} color="#0f172a" />
                    </TouchableOpacity>

                    <View style={styles.brandRow}>
                        <View style={styles.logoBadge}>
                            <Ionicons name="shield-checkmark" size={18} color="#ffffff" />
                        </View>
                        <View>
                            <Text style={styles.brandTitle}>Hồ Sơ Quản Trị & Nhân Sự</Text>
                            <Text style={styles.brandSub}>HỆ THỐNG VẬN HÀNH SÂN BÓNG</Text>
                        </View>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.settingsBtn}
                    onPress={handleLogout}
                    title="Đăng xuất"
                >
                    <Ionicons name="log-out-outline" size={20} color="#b91c1c" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* 1. THẺ ĐỊNH DANH QUẢN LÝ / NHÂN SỰ (Deep Emerald Hero Theme) */}
                <View style={styles.identityCard}>
                    <View style={styles.identityRow}>
                        <View style={styles.avatarWrapper}>
                            <View style={styles.avatarInner}>
                                <Text style={styles.avatarLetter}>{avatarLetter}</Text>
                            </View>
                        </View>

                        <View style={styles.playerMeta}>
                            <View style={styles.nameRow}>
                                <Text style={styles.playerName} numberOfLines={1}>{displayName}</Text>
                                <Ionicons name="checkmark-circle" size={18} color="#34d399" style={{ marginLeft: 4 }} />
                            </View>
                            <View style={styles.metaRow}>
                                <Ionicons name="call-outline" size={13} color="#a7f3d0" />
                                <Text style={styles.metaText}>{displayPhone}</Text>
                            </View>
                            <View style={styles.metaRow}>
                                <Ionicons name="mail-outline" size={13} color="#a7f3d0" />
                                <Text style={styles.metaText} numberOfLines={1}>{displayEmail}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Role Badge Container */}
                    <View style={styles.roleBadgeContainer}>
                        <Ionicons name={currentRoleObj.icon} size={18} color="#ffffff" />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.roleBadgeTitle}>
                                {currentRoleObj.title}
                            </Text>
                            <Text style={styles.roleBadgeDesc} numberOfLines={1}>
                                {currentRoleObj.desc}
                            </Text>
                        </View>
                        <View style={styles.activePill}>
                            <Text style={styles.activePillText}>ĐANG TRỰC</Text>
                        </View>
                    </View>
                </View>

                {/* PHÂN HỆ QUẢN TRỊ & ĐIỀU HÀNH */}
                <View style={styles.sectionWrap}>
                    <View style={styles.sectionHeaderRow}>
                        <Ionicons name="apps" size={18} color="#006b2c" />
                        <Text style={styles.sectionTitle}>Các Phân Hệ Quản Trị & Vận Hành</Text>
                    </View>

                    <View style={styles.actionGroupCard}>
                        <TouchableOpacity
                            style={styles.actionRow}
                            onPress={() => navigation.navigate('AdminDashboard')}
                        >
                            <View style={[styles.actionIconBox, { backgroundColor: '#ecfdf5' }]}>
                                <Ionicons name="grid" size={18} color="#055b35" />
                            </View>
                            <View style={styles.actionTextWrap}>
                                <Text style={styles.actionTitle}>Bảng điều khiển KPI & Tổng quan</Text>
                                <Text style={styles.actionSubtitle}>Doanh thu, tỉ lệ lấp đầy sân & đơn đặt mới</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                        </TouchableOpacity>

                        <View style={styles.itemDivider} />

                        <TouchableOpacity
                            style={styles.actionRow}
                            onPress={() => navigation.navigate('StaffBookings')}
                        >
                            <View style={[styles.actionIconBox, { backgroundColor: '#eff6ff' }]}>
                                <Ionicons name="calendar" size={18} color="#2563eb" />
                            </View>
                            <View style={styles.actionTextWrap}>
                                <Text style={styles.actionTitle}>Quản lý Đặt sân & Lịch thi đấu</Text>
                                <Text style={styles.actionSubtitle}>Check-in vào sân, đặt tại quầy & đổi ca</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                        </TouchableOpacity>

                        <View style={styles.itemDivider} />

                        <TouchableOpacity
                            style={styles.actionRow}
                            onPress={() => navigation.navigate('AdminFields')}
                        >
                            <View style={[styles.actionIconBox, { backgroundColor: '#f0fdf4' }]}>
                                <Ionicons name="football" size={18} color="#006b2c" />
                            </View>
                            <View style={styles.actionTextWrap}>
                                <Text style={styles.actionTitle}>Quản lý Sân bóng & Mặt cỏ</Text>
                                <Text style={styles.actionSubtitle}>Thêm sân 5/7/11, bảo trì & cập nhật giá</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                        </TouchableOpacity>

                        <View style={styles.itemDivider} />

                        <TouchableOpacity
                            style={styles.actionRow}
                            onPress={() => navigation.navigate('AdminRevenue')}
                        >
                            <View style={[styles.actionIconBox, { backgroundColor: '#ecfdf5' }]}>
                                <Ionicons name="cash" size={18} color="#006b2c" />
                            </View>
                            <View style={styles.actionTextWrap}>
                                <Text style={styles.actionTitle}>Báo cáo Doanh thu & SePay VietQR</Text>
                                <Text style={styles.actionSubtitle}>Thống kê dòng tiền, số dư & phương thức thanh toán</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                        </TouchableOpacity>

                        <View style={styles.itemDivider} />

                        <TouchableOpacity
                            style={styles.actionRow}
                            onPress={() => navigation.navigate('AdminTimeslots')}
                        >
                            <View style={[styles.actionIconBox, { backgroundColor: '#fef3c7' }]}>
                                <Ionicons name="time" size={18} color="#b45309" />
                            </View>
                            <View style={styles.actionTextWrap}>
                                <Text style={styles.actionTitle}>Khung giờ & Ca vàng (Peak Hours)</Text>
                                <Text style={styles.actionSubtitle}>Thiết lập slot thi đấu và phụ thu giờ cao điểm</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                        </TouchableOpacity>

                        <View style={styles.itemDivider} />

                        <TouchableOpacity
                            style={styles.actionRow}
                            onPress={() => navigation.navigate('AdminServices')}
                        >
                            <View style={[styles.actionIconBox, { backgroundColor: '#ffedd5' }]}>
                                <Ionicons name="cube" size={18} color="#c2410c" />
                            </View>
                            <View style={styles.actionTextWrap}>
                                <Text style={styles.actionTitle}>Kho Dịch Vụ, F&B & Giày Thi Đấu</Text>
                                <Text style={styles.actionSubtitle}>Quản lý tồn kho nước giải khát & phụ kiện</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                        </TouchableOpacity>

                        <View style={styles.itemDivider} />

                        <TouchableOpacity
                            style={styles.actionRow}
                            onPress={() => navigation.navigate('Cleaning')}
                        >
                            <View style={[styles.actionIconBox, { backgroundColor: '#ccfbf1' }]}>
                                <Ionicons name="sparkles" size={18} color="#0f766e" />
                            </View>
                            <View style={styles.actionTextWrap}>
                                <Text style={styles.actionTitle}>Giám sát Vệ sinh 5S & Đồ Thất Lạc</Text>
                                <Text style={styles.actionSubtitle}>Quy trình dọn rác sân và kho đồ bỏ quên</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                        </TouchableOpacity>

                        <View style={styles.itemDivider} />

                        <TouchableOpacity
                            style={styles.actionRow}
                            onPress={() => navigation.navigate('Maintenance')}
                        >
                            <View style={[styles.actionIconBox, { backgroundColor: '#fee2e2' }]}>
                                <Ionicons name="construct" size={18} color="#b91c1c" />
                            </View>
                            <View style={styles.actionTextWrap}>
                                <Text style={styles.actionTitle}>Bảo Trì Sự Cố & Dàn Đèn LED</Text>
                                <Text style={styles.actionSubtitle}>Tiếp nhận báo hỏng và phiếu sửa chữa mặt sân</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                        </TouchableOpacity>

                        <View style={styles.itemDivider} />

                        <TouchableOpacity
                            style={styles.actionRow}
                            onPress={() => navigation.navigate('AdminTournaments')}
                        >
                            <View style={[styles.actionIconBox, { backgroundColor: '#dbeafe' }]}>
                                <Ionicons name="trophy" size={18} color="#1d4ed8" />
                            </View>
                            <View style={styles.actionTextWrap}>
                                <Text style={styles.actionTitle}>Điều Phối Giải Đấu Thể Thao</Text>
                                <Text style={styles.actionSubtitle}>Tiếp nhận và duyệt hồ sơ giải bóng đá</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                        </TouchableOpacity>

                        <View style={styles.itemDivider} />

                        <TouchableOpacity
                            style={styles.actionRow}
                            onPress={() => navigation.navigate('AdminUsers')}
                        >
                            <View style={[styles.actionIconBox, { backgroundColor: '#e0f2fe' }]}>
                                <Ionicons name="people" size={18} color="#0284c7" />
                            </View>
                            <View style={styles.actionTextWrap}>
                                <Text style={styles.actionTitle}>Quản Trị Người Dùng & Tài Khoản</Text>
                                <Text style={styles.actionSubtitle}>Danh sách khách hàng & nhân sự vận hành</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 4. NÚT ĐĂNG XUẤT TÀI KHOẢN QUẢN LÝ */}
                <TouchableOpacity style={styles.resetBtn} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color="#b91c1c" style={{ marginRight: 6 }} />
                    <Text style={[styles.resetBtnText, { color: '#b91c1c' }]}>Đăng xuất tài khoản quản lý</Text>
                </TouchableOpacity>

                {/* APP BUILD VERSION FOOTER */}
                <View style={styles.footerMeta}>
                    <View style={styles.footerBrandRow}>
                        <View style={styles.greenDot} />
                        <Text style={styles.footerBrandText}>Sân Bóng Hải Châu • Quản Trị Vận Hành Cụm Sân</Text>
                    </View>
                    <Text style={styles.footerVersionText}>Phiên bản Quản lý v2.5.0 • Đà Nẵng</Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f7f9fb',
    },
    topBar: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backCircleBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    logoBadge: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#006b2c',
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    brandSub: {
        fontSize: 10,
        fontWeight: '700',
        color: '#006b2c',
        letterSpacing: 0.5,
    },
    settingsBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
        gap: 16,
    },

    /* Identity Hero Card */
    identityCard: {
        backgroundColor: '#064e3b',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#059669',
        position: 'relative',
        overflow: 'hidden',
        shadowColor: '#064e3b',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
        elevation: 5,
    },
    identityRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarWrapper: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#022c1e',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#34d399',
    },
    avatarInner: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#022c1e',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLetter: {
        fontSize: 22,
        fontWeight: '800',
        color: '#ffffff',
    },
    playerMeta: {
        flex: 1,
        marginLeft: 14,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 3,
    },
    playerName: {
        fontSize: 17,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: -0.2,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: '#a7f3d0',
        fontWeight: '500',
    },

    /* Role Badge Container */
    roleBadgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
        marginTop: 14,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
    },
    roleBadgeTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#ffffff',
    },
    roleBadgeDesc: {
        fontSize: 11,
        color: '#a7f3d0',
        marginTop: 1,
    },
    activePill: {
        backgroundColor: '#22c55e',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    activePillText: {
        color: '#064e3b',
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.5,
    },

    /* Section & Role Switcher Grid */
    sectionWrap: {
        gap: 8,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f172a',
    },
    sectionSub: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 4,
    },
    rolesGrid: {
        gap: 8,
    },
    roleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    roleIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    roleCardTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    roleCardDesc: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },

    /* Action Groups */
    actionGroupCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    actionIconBox: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionTextWrap: {
        flex: 1,
        marginLeft: 12,
    },
    actionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    actionSubtitle: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 1,
    },
    itemDivider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginLeft: 58,
    },

    /* Reset Button */
    resetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        backgroundColor: '#f0fdf4',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#bbf7d0',
        marginTop: 4,
    },
    resetBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#006b2c',
    },

    /* Footer Meta */
    footerMeta: {
        alignItems: 'center',
        paddingVertical: 10,
        gap: 4,
    },
    footerBrandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    greenDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#006b2c',
    },
    footerBrandText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
    },
    footerVersionText: {
        fontSize: 10,
        color: '#94a3b8',
    },
});
