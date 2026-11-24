import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Alert,
    SafeAreaView,
    Linking,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { getRevenueAnalyticsApi } from '../api/paymentsApi';
import { getBookingsApi, updateBookingStatusApi } from '../api/bookingsApi';
import { getFieldsApi } from '../api/fieldsApi';
import AdminBottomNav from '../components/AdminBottomNav';

export default function AdminDashboardScreen({ navigation }) {
    const { user } = useContext(AuthContext);
    const [analytics, setAnalytics] = useState(null);
    const [recentBookings, setRecentBookings] = useState([]);
    const [fields, setFields] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        try {
            const [analyticsRes, bookingsRes, fieldsRes] = await Promise.allSettled([
                getRevenueAnalyticsApi(),
                getBookingsApi(),
                getFieldsApi()
            ]);

            if (analyticsRes.status === 'fulfilled') {
                setAnalytics(analyticsRes.value);
            }

            if (bookingsRes.status === 'fulfilled') {
                const bList = Array.isArray(bookingsRes.value) ? bookingsRes.value : (bookingsRes.value?.results || []);
                setRecentBookings(bList);
            }

            if (fieldsRes.status === 'fulfilled') {
                const fData = fieldsRes.value;
                const fList = fData?.fields || fData?.results || (Array.isArray(fData) ? fData : []);
                setFields(fList);
            }
        } catch (e) {
            console.warn('Lỗi tải dữ liệu Dashboard:', e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
        const poller = setInterval(() => {
            loadData();
        }, 10000);
        return () => clearInterval(poller);
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleQuickCheckIn = async (bookingId, customerName) => {
        try {
            await updateBookingStatusApi(bookingId, 'Checked_in');
            Alert.alert('Thành công', `Đã xác nhận check-in nhận sân cho đơn: ${customerName || 'Khách'}`);
            loadData();
        } catch (e) {
            Alert.alert('Lỗi', 'Không thể cập nhật trạng thái check-in.');
        }
    };

    // User Role Display mapping strictly from user session
    const getRoleInfo = (rawRole) => {
        const r = String(rawRole || '').toLowerCase();
        if (r === 'admin') return { label: 'Quản Trị Viên', color: '#15803d', bg: '#dcfce7', icon: 'shield-checkmark' };
        if (r === 'field_owner') return { label: 'Chủ Sân Bóng (PRO)', color: '#006b2c', bg: '#f0fdf4', icon: 'business' };
        if (r === 'field_manager') return { label: 'Quản Lý Vận Hành', color: '#1d4ed8', bg: '#dbeafe', icon: 'briefcase' };
        if (r === 'receptionist') return { label: 'Lễ Tân Trực Ban', color: '#b45309', bg: '#fef3c7', icon: 'person' };
        if (r === 'cashier') return { label: 'Thu Ngân Quầy', color: '#0f766e', bg: '#ccfbf1', icon: 'card' };
        return { label: 'Nhân Viên Vận Hành', color: '#4b5563', bg: '#f2f4f6', icon: 'person-circle' };
    };

    const roleInfo = getRoleInfo(user?.role);
    // User name from database (handling user.fullname from Django response)
    const userName = user?.fullname || user?.full_name || user?.name || user?.username || 'Admin';
    const userPhone = user?.phone || user?.email || 'Chưa cập nhật SĐT';

    // Facility complex name strictly set to Cụm Sân Hải Châu
    const facilityLocation = 'Cụm Sân Hải Châu';


    // Real calendar dates
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

    // Định dạng ngày tháng năm chuẩn Việt Nam (DD/MM/YYYY)
    const formatDateVN = (dStr) => {
        if (!dStr) return '';
        const clean = String(dStr).split('T')[0];
        const parts = clean.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dStr;
    };

    // 1. Đơn đặt trong ngày hôm nay
    const todayBookings = recentBookings.filter(b => {
        const bDate = b.date || b.booking_date || b.bookingDate || (b.created_at ? String(b.created_at).slice(0, 10) : '');
        return bDate === todayStr;
    });
    const todayOrdersCount = todayBookings.length;
    const todayConfirmedCount = todayBookings.filter(b => ['confirmed', 'paid', 'checked_in', 'completed'].includes(String(b.status || '').toLowerCase())).length;

    const todayRev = analytics?.summary?.today_revenue ?? analytics?.today_revenue ?? 0;
    const activeFieldsCount = fields.filter(f => f.status !== 'maintenance' && f.is_available !== false).length;
    const totalFieldsCount = fields.length;

    // 2. Real upcoming matches: strictly today after current time OR future dates
    const upcomingList = useMemo(() => {
        return recentBookings.filter(b => {
            const bDate = b.date || b.booking_date || b.bookingDate || '';
            const status = String(b.status || '').toLowerCase();
            if (['cancelled', 'rejected'].includes(status)) return false;

            if (bDate > todayStr) return true;
            if (bDate === todayStr) {
                // If match is today, check if end_time has not passed
                if (!b.end_time) return true;
                return b.end_time >= nowTimeStr;
            }
            return false; // Past date is NOT upcoming!
        });
    }, [recentBookings, todayStr, nowTimeStr]);

    // 3. Past matches (Lịch sử ca đấu gần đây)
    const pastMatchesList = useMemo(() => {
        return recentBookings.filter(b => {
            const bDate = b.date || b.booking_date || b.bookingDate || '';
            if (bDate < todayStr) return true;
            if (bDate === todayStr && b.end_time && b.end_time < nowTimeStr) return true;
            return false;
        }).slice(0, 3);
    }, [recentBookings, todayStr, nowTimeStr]);

    // 4. Real 7-day cashflow calculated from actual database bookings
    const last7DaysCashflow = useMemo(() => {
        const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        const days = [];
        let totalWeekRev = 0;

        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const dayName = dayLabels[d.getDay()];

            // Real revenue on this day (Chỉ tính các đơn có trạng thái ĐÃ HOÀN THÀNH)
            const dayRev = recentBookings
                .filter(b => {
                    const bDate = b.date || b.booking_date || b.bookingDate || '';
                    const st = String(b.status || '').trim().toLowerCase();
                    const isCompleted = ['completed', 'hoàn thành', 'hoan thanh', 'đã hoàn thành', 'da hoan thanh'].includes(st);
                    return bDate === iso && isCompleted;
                })
                .reduce((sum, b) => sum + Number(b.price || b.total_price || b.total_amount || 0), 0);

            totalWeekRev += dayRev;
            days.push({
                day: dayName,
                iso,
                revenue: dayRev,
                isToday: i === 0
            });
        }

        const maxRev = Math.max(...days.map(d => d.revenue), 1);
        const bars = days.map(d => ({
            ...d,
            barHeight: d.revenue > 0 ? Math.max(12, Math.round((d.revenue / maxRev) * 100)) : 0
        }));

        return { bars, totalWeekRev };
    }, [recentBookings]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.responsiveContainer}>
                {/* Top Navigation Bar: Clean Emerald Modernism */}
                <View style={styles.topHeader}>
                    <View style={styles.topLeftGroup}>
                        <View style={styles.brandRow}>
                            <View style={styles.brandIconBox}>
                                <Ionicons name="football" size={19} color="#ffffff" />
                            </View>
                            <View>
                                <View style={styles.brandTitleRow}>
                                    <Text style={styles.brandTitle}>Sân Bóng Hải Châu</Text>
                                    <View style={styles.proBadge}>
                                        <Text style={styles.proBadgeText}>ĐÀ NẴNG</Text>
                                    </View>
                                </View>
                                <View style={styles.clusterRow}>
                                    <Ionicons name="location-sharp" size={11} color="#059669" />
                                    <Text style={styles.clusterText} numberOfLines={1}>{facilityLocation}</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={styles.topRightGroup}>
                        <TouchableOpacity
                            style={styles.profileHeaderBtn}
                            onPress={() => navigation.navigate('ProfileTab')}
                            activeOpacity={0.7}
                        >
                            <View style={styles.headerAvatar}>
                                <Text style={styles.headerAvatarText}>
                                    {userName.slice(0, 2).toUpperCase()}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#006b2c']} />}
                >
                    {/* 1. HERO USER PROFILE & SHIFT CARD (Deep Emerald Modern Theme) */}
                    <View style={styles.userProfileCard}>
                        <View style={styles.userProfileTop}>
                            <View style={styles.avatarLargeBox}>
                                <Text style={styles.avatarLargeText}>
                                    {userName.slice(0, 2).toUpperCase()}
                                </Text>
                                <View style={styles.avatarOnlineDot} />
                            </View>

                            <View style={{ flex: 1, marginLeft: 14 }}>
                                <View style={styles.userNameRow}>
                                    <Text style={styles.userNameText} numberOfLines={1}>
                                        {userName}
                                    </Text>
                                    <View style={styles.userRoleBadge}>
                                        <Ionicons name={roleInfo.icon} size={11} color="#ffffff" />
                                        <Text style={styles.userRoleText}>
                                            {roleInfo.label}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={styles.userSubText} numberOfLines={1}>
                                    {userPhone}
                                </Text>

                                <View style={styles.shiftStatusRow}>
                                    <View style={styles.pulseActiveDot} />
                                    <Text style={styles.shiftStatusText}>Đang trực ca • Sẵn sàng điều phối</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.userProfileBottomBar}>
                            <View style={styles.userProfileStat}>
                                <Ionicons name="business" size={13} color="#a7f3d0" />
                                <Text style={styles.userProfileStatText}>{facilityLocation}</Text>
                            </View>
                            <View style={styles.readinessPill}>
                                <Ionicons name="checkmark-circle" size={13} color="#22c55e" />
                                <Text style={styles.readinessPillText}>{activeFieldsCount}/{totalFieldsCount} sân mở</Text>
                            </View>
                        </View>
                    </View>

                    {/* 2. Operational Metrics Overview (Real Data from CSDL) */}
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeading}>Chỉ số vận hành hôm nay</Text>
                        <View style={styles.realtimePill}>
                            <View style={styles.realtimeDot} />
                            <Text style={styles.realtimeText}>Thời gian thực</Text>
                        </View>
                    </View>

                    <View style={styles.metricsGridContainer}>
                        {/* Metric 1: Revenue Today */}
                        <View style={[styles.metricCard, styles.metricCardGreen]}>
                            <View style={styles.metricCardTop}>
                                <View style={[styles.metricIconBox, { backgroundColor: '#dcfce7' }]}>
                                    <Ionicons name="cash" size={18} color="#059669" />
                                </View>
                                <View style={styles.metricTagPillGreen}>
                                    <Text style={styles.metricTagTextGreen}>Hôm nay</Text>
                                </View>
                            </View>
                            <Text style={styles.metricLabelGreen}>Doanh thu ngày</Text>
                            <Text style={styles.metricValueGreen}>
                                {new Intl.NumberFormat('vi-VN').format(todayRev)}
                                <Text style={styles.metricUnitGreen}>đ</Text>
                            </Text>
                            {todayRev > 0 ? (
                                <View style={styles.metricProgressBar}>
                                    <View style={[styles.metricProgressFill, { width: `${Math.min(100, Math.round((todayRev / 10000000) * 100))}%` }]} />
                                </View>
                            ) : (
                                <Text style={styles.metricEmptyNote}>Chưa có doanh thu</Text>
                            )}
                        </View>

                        {/* Metric 2: Today Matches */}
                        <View style={[styles.metricCard, styles.metricCardBlue]}>
                            <View style={styles.metricCardTop}>
                                <View style={[styles.metricIconBox, { backgroundColor: '#dbeafe' }]}>
                                    <Ionicons name="football-outline" size={18} color="#2563eb" />
                                </View>
                                <View style={styles.metricTagPillBlue}>
                                    <Text style={styles.metricTagTextBlue}>{todayOrdersCount > 0 ? 'Có trận' : 'Trống ca'}</Text>
                                </View>
                            </View>
                            <Text style={styles.metricLabelBlue}>Tổng trận đấu</Text>
                            <Text style={styles.metricValueBlue}>
                                {todayOrdersCount}
                                <Text style={styles.metricUnitBlue}> trận</Text>
                            </Text>
                            <View style={styles.metricSubInfoRow}>
                                <Text style={{ color: '#16a34a', fontWeight: '700', fontSize: 11 }}>{todayConfirmedCount} chốt</Text>
                                <Text style={{ color: '#94a3b8', fontSize: 11 }}> • </Text>
                                <Text style={{ color: '#ea580c', fontWeight: '700', fontSize: 11 }}>{todayOrdersCount - todayConfirmedCount} chờ</Text>
                            </View>
                        </View>

                        {/* Metric 3: Check-in Rate */}
                        <View style={[styles.metricCard, styles.metricCardPurple]}>
                            <View style={styles.metricCardTop}>
                                <View style={[styles.metricIconBox, { backgroundColor: '#ede9fe' }]}>
                                    <Ionicons name="checkmark-done-circle" size={18} color="#7c3aed" />
                                </View>
                                <View style={styles.metricTagPillPurple}>
                                    <Text style={styles.metricTagTextPurple}>
                                        {todayOrdersCount > 0 ? `${todayConfirmedCount}/${todayOrdersCount}` : '0 ca'}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.metricLabelPurple}>Tỷ lệ Check-in</Text>
                            <Text style={styles.metricValuePurple}>
                                {todayOrdersCount > 0 ? `${Math.round((todayConfirmedCount / todayOrdersCount) * 100)}%` : '--%'}
                            </Text>
                            <Text style={styles.metricEmptyNote}>
                                {todayOrdersCount > 0 ? 'Tỷ lệ vào sân' : 'Chưa có ca đấu'}
                            </Text>
                        </View>

                        {/* Metric 4: Active Fields Capacity */}
                        <View style={[styles.metricCard, styles.metricCardAmber]}>
                            <View style={styles.metricCardTop}>
                                <View style={[styles.metricIconBox, { backgroundColor: '#fef3c7' }]}>
                                    <Ionicons name="football" size={18} color="#d97706" />
                                </View>
                                <View style={styles.metricTagPillAmber}>
                                    <Text style={styles.metricTagTextAmber}>Sẵn sàng</Text>
                                </View>
                            </View>
                            <Text style={styles.metricLabelAmber}>Cơ sở sân bãi</Text>
                            <Text style={styles.metricValueAmber}>
                                {activeFieldsCount}/{totalFieldsCount}
                                <Text style={styles.metricUnitAmber}> sân</Text>
                            </Text>
                            <Text style={{ fontSize: 11, color: activeFieldsCount < totalFieldsCount ? '#b91c1c' : '#15803d', fontWeight: '700', marginTop: 4 }}>
                                {activeFieldsCount === totalFieldsCount ? '100% mở' : `${totalFieldsCount - activeFieldsCount} sân bảo trì`}
                            </Text>
                        </View>
                    </View>


                    {/* 3. Upcoming Matches (Strictly future/active only) */}
                    <View style={styles.sectionContainer}>
                        <View style={styles.sectionHeaderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={styles.pulseDotGreen} />
                                <Text style={styles.sectionHeading}>Trận đấu sắp diễn ra</Text>
                            </View>
                            <TouchableOpacity onPress={() => navigation.navigate('StaffBookings')}>
                                <Text style={styles.seeAllText}>Lịch đặt sân ({recentBookings.length})</Text>
                            </TouchableOpacity>
                        </View>

                        {upcomingList.length === 0 ? (
                            <View style={styles.emptyCard}>
                                <Ionicons name="calendar-outline" size={32} color="#94a3b8" />
                                <Text style={styles.emptyCardTitle}>Không có trận đấu nào sắp diễn ra hôm nay</Text>
                                <Text style={styles.emptyCardSub}>Các ca đặt sân mới của cầu thủ sẽ tự động xuất hiện tại đây</Text>
                            </View>
                        ) : (
                            <View style={styles.matchesList}>
                                {upcomingList.map((b, idx) => {
                                    const pitchName = b.field || b.field_name || b.fieldName || `Sân ${idx + 1}`;
                                    const timeStr = b.time || b.time_slot || (b.start_time ? `${b.start_time.slice(0, 5)} - ${b.end_time?.slice(0, 5)}` : 'Theo ca');
                                    const customerName = b.name || b.customer_name || b.customerName || 'Khách đặt sân';
                                    const phone = b.phone || b.customer_phone || '';
                                    const total = Number(b.price || b.total_price || b.total_amount || 0);
                                    const deposit = Number(b.payment_info?.deposit_amount ?? b.deposit_amount ?? (total * 0.5));
                                    const isCheckedIn = ['completed', 'checked_in'].includes(String(b.status || '').toLowerCase());

                                    return (
                                        <View key={b.id || idx} style={styles.matchCard}>
                                            <View style={styles.matchCardHeader}>
                                                <View style={styles.pitchPill}>
                                                    <Ionicons name="football-outline" size={13} color="#006b2c" />
                                                    <Text style={styles.pitchPillText}>{pitchName}</Text>
                                                </View>
                                                <Text style={styles.matchTimeText}>{timeStr}</Text>
                                                <View style={[styles.statusBadge, isCheckedIn ? styles.statusBadgeSuccess : styles.statusBadgeWarning]}>
                                                    <Text style={[styles.statusBadgeText, isCheckedIn ? styles.statusTextSuccess : styles.statusTextWarning]}>
                                                        {isCheckedIn ? 'ĐÃ CHECK-IN' : 'CHỜ VÀO SÂN'}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={styles.matchTeamsRow}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.teamName}>{customerName}</Text>
                                                    <Text style={styles.teamSub}>
                                                        {phone ? `SĐT: ${phone}` : 'Chưa có SĐT'} • {formatDateVN(b.date || b.booking_date || todayStr)}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={styles.matchFinanceRow}>
                                                <View style={styles.financeItem}>
                                                    <Ionicons name="checkmark-circle" size={14} color="#15803d" />
                                                    <Text style={styles.financeText}>
                                                        Cọc: <Text style={styles.financeBold}>{deposit > 0 ? `${(deposit / 1000).toFixed(0)}k` : '0đ'}</Text>
                                                    </Text>
                                                </View>
                                                <View style={styles.financeItem}>
                                                    <Ionicons name="cash-outline" size={14} color="#b45309" />
                                                    <Text style={styles.financeText}>
                                                        Còn lại: <Text style={[styles.financeBold, { color: '#b45309' }]}>{new Intl.NumberFormat('vi-VN').format(Math.max(0, total - deposit))}đ</Text>
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={styles.matchActionsRow}>
                                                <TouchableOpacity
                                                    style={[styles.checkInActionBtn, isCheckedIn && styles.checkInActionBtnDisabled]}
                                                    onPress={() => !isCheckedIn && handleQuickCheckIn(b.id, customerName)}
                                                    disabled={isCheckedIn}
                                                    activeOpacity={0.85}
                                                >
                                                    <Ionicons name={isCheckedIn ? "checkmark" : "finger-print"} size={16} color="#ffffff" />
                                                    <Text style={styles.checkInActionText}>
                                                        {isCheckedIn ? 'ĐÃ VÀO SÂN' : 'CHECK-IN 1 CHẠM'}
                                                    </Text>
                                                </TouchableOpacity>

                                                {phone ? (
                                                    <TouchableOpacity
                                                        style={styles.callActionBtn}
                                                        onPress={() => Linking.openURL(`tel:${phone}`)}
                                                    >
                                                        <Ionicons name="call" size={15} color="#006b2c" />
                                                        <Text style={styles.callActionText}>Gọi</Text>
                                                    </TouchableOpacity>
                                                ) : null}

                                                <TouchableOpacity
                                                    style={styles.detailActionBtn}
                                                    onPress={() => navigation.navigate('StaffBookings')}
                                                >
                                                    <Ionicons name="eye-outline" size={16} color="#374151" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>

                    {/* 4. Past Matches History (Lịch sử ca đấu đã qua) */}
                    {pastMatchesList.length > 0 && (
                        <View style={styles.sectionContainer}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionHeading}>Lịch sử ca đấu gần nhất</Text>
                                <TouchableOpacity onPress={() => navigation.navigate('StaffBookings')}>
                                    <Text style={styles.seeAllText}>Xem tất cả ›</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.matchesList}>
                                {pastMatchesList.map((b, idx) => {
                                    const pitchName = b.field || b.field_name || b.fieldName || 'Sân bóng';
                                    const customerName = b.name || b.customer_name || b.customerName || 'Khách đá';
                                    const total = Number(b.price || b.total_price || b.total_amount || 0);
                                    const isComp = ['completed', 'checked_in'].includes(String(b.status || '').toLowerCase());

                                    return (
                                        <View key={b.id || idx} style={styles.pastMatchCard}>
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={styles.pastPitchName}>{pitchName}</Text>
                                                    <Text style={styles.pastDateText}>{formatDateVN(b.date || b.booking_date)} • {b.time || (b.start_time ? b.start_time.slice(0, 5) : '')}</Text>
                                                </View>
                                                <Text style={styles.pastCustomerText}>{customerName} (SĐT: {b.phone || b.customer_phone || '---'})</Text>
                                            </View>

                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.pastPriceText}>{total.toLocaleString('vi-VN')} đ</Text>
                                                <View style={[styles.pastStatusPill, isComp ? styles.pastStatusPillSuccess : styles.pastStatusPillMuted]}>
                                                    <Text style={[styles.pastStatusText, isComp ? styles.pastTextSuccess : styles.pastTextMuted]}>
                                                        {isComp ? 'HOÀN THÀNH' : 'ĐÃ QUA CA'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* 5. Real Cashflow 7-day Breakdown from Database */}
                    <View style={styles.cashflowCard}>
                        <View style={styles.cashflowHeader}>
                            <View>
                                <Text style={styles.cashflowTitle}>Dòng tiền 7 ngày qua</Text>
                                <Text style={styles.cashflowSub}>
                                    Tổng tuần: {new Intl.NumberFormat('vi-VN').format(last7DaysCashflow.totalWeekRev)}đ
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => navigation.navigate('AdminRevenue')}>
                                <Text style={styles.seeAllText}>Báo cáo</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Real Chart Bars */}
                        <View style={styles.chartBarsRow}>
                            {last7DaysCashflow.bars.map((bar, i) => (
                                <View key={i} style={styles.chartBarCol}>
                                    <View style={styles.chartBarTrack}>
                                        {bar.revenue > 0 ? (
                                            <View
                                                style={[
                                                    styles.chartBarFill,
                                                    { height: `${bar.barHeight}%`, backgroundColor: bar.isToday ? '#006b2c' : '#79db8d' }
                                                ]}
                                            />
                                        ) : null}
                                    </View>
                                    <Text style={[styles.chartDayLabel, bar.isToday && styles.chartDayLabelActive]}>
                                        {bar.day}
                                    </Text>
                                    <Text style={styles.chartDayPrice}>
                                        {bar.revenue > 0 ? `${(bar.revenue / 1000).toFixed(0)}k` : '0'}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        <View style={styles.cashflowFooter}>
                            <Ionicons name="analytics-outline" size={14} color="#006b2c" />
                            <Text style={styles.cashflowFooterText}>Biểu đồ dòng tiền tính trực tiếp từ các đơn đặt sân trong CSDL</Text>
                        </View>
                    </View>

                    <View style={{ height: 40 }} />
                </ScrollView>

                {/* Bottom App Navigation Bar (Always Visible) */}
                <AdminBottomNav activeTab="dashboard" navigation={navigation} />
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
    topHeader: {
        height: 62,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    topLeftGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    brandIconBox: {
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
    brandTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    brandTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.3,
    },
    proBadge: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 9999,
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    proBadgeText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#15803d',
    },
    clusterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: 1,
    },
    clusterText: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
    },
    topRightGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    refreshBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileHeaderBtn: {
        padding: 2,
    },
    headerAvatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#059669',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerAvatarText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '800',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 100,
    },
    // User Profile Hero Card
    userProfileCard: {
        backgroundColor: '#064e3b',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#059669',
        shadowColor: '#064e3b',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 14,
        elevation: 6,
    },
    userProfileTop: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarLargeBox: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#022c1e',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        borderWidth: 2,
        borderColor: '#34d399',
    },
    avatarLargeText: {
        color: '#ffffff',
        fontSize: 19,
        fontWeight: '800',
    },
    avatarOnlineDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#22c55e',
        borderWidth: 2.5,
        borderColor: '#064e3b',
    },
    userNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    userNameText: {
        fontSize: 17,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: -0.3,
    },
    userRoleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        gap: 4,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    userRoleText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#ffffff',
    },
    userSubText: {
        fontSize: 12,
        color: '#a7f3d0',
        marginTop: 2,
        fontWeight: '500',
    },
    shiftStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    pulseActiveDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#22c55e',
    },
    shiftStatusText: {
        fontSize: 11,
        color: '#86efac',
        fontWeight: '700',
    },
    userProfileBottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    userProfileStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    userProfileStatText: {
        fontSize: 11.5,
        color: '#ffffff',
        fontWeight: '700',
    },
    readinessPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(34, 197, 94, 0.25)',
        borderWidth: 1,
        borderColor: '#22c55e',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        gap: 4,
    },
    readinessPillText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#ffffff',
    },
    // Metrics Styles
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        marginTop: 4,
    },
    sectionHeading: {
        fontSize: 14.5,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.2,
    },
    realtimePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#dcfce7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    realtimeDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#16a34a',
    },
    realtimeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#15803d',
    },
    metricsGridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 10,
        paddingBottom: 6,
    },
    metricCard: {
        width: '48.5%',
        borderRadius: 18,
        padding: 13,
        borderWidth: 1.5,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    metricCardGreen: {
        backgroundColor: '#f0fdf4',
        borderColor: '#bbf7d0',
    },
    metricCardBlue: {
        backgroundColor: '#eff6ff',
        borderColor: '#bfdbfe',
    },
    metricCardPurple: {
        backgroundColor: '#faf5ff',
        borderColor: '#e9d5ff',
    },
    metricCardAmber: {
        backgroundColor: '#fffbeb',
        borderColor: '#fde68a',
    },
    metricCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    metricIconBox: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    metricTagPillGreen: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    metricTagTextGreen: {
        fontSize: 10,
        fontWeight: '700',
        color: '#15803d',
    },
    metricLabelGreen: {
        fontSize: 11.5,
        color: '#166534',
        fontWeight: '600',
    },
    metricValueGreen: {
        fontSize: 18,
        fontWeight: '900',
        color: '#14532d',
        marginTop: 2,
    },
    metricUnitGreen: {
        fontSize: 12,
        fontWeight: '700',
        color: '#166534',
    },
    metricTagPillBlue: {
        backgroundColor: '#dbeafe',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    metricTagTextBlue: {
        fontSize: 10,
        fontWeight: '700',
        color: '#1d4ed8',
    },
    metricLabelBlue: {
        fontSize: 11.5,
        color: '#1e40af',
        fontWeight: '600',
    },
    metricValueBlue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1e3a8a',
        marginTop: 2,
    },
    metricUnitBlue: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1e40af',
    },
    metricTagPillPurple: {
        backgroundColor: '#ede9fe',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    metricTagTextPurple: {
        fontSize: 10,
        fontWeight: '700',
        color: '#7c3aed',
    },
    metricLabelPurple: {
        fontSize: 11.5,
        color: '#6b21a8',
        fontWeight: '600',
    },
    metricValuePurple: {
        fontSize: 18,
        fontWeight: '900',
        color: '#581c87',
        marginTop: 2,
    },
    metricTagPillAmber: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    metricTagTextAmber: {
        fontSize: 10,
        fontWeight: '700',
        color: '#b45309',
    },
    metricLabelAmber: {
        fontSize: 11.5,
        color: '#92400e',
        fontWeight: '600',
    },
    metricValueAmber: {
        fontSize: 18,
        fontWeight: '900',
        color: '#78350f',
        marginTop: 2,
    },
    metricUnitAmber: {
        fontSize: 12,
        fontWeight: '700',
        color: '#92400e',
    },
    metricProgressBar: {
        height: 5,
        backgroundColor: '#dcfce7',
        borderRadius: 2.5,
        marginTop: 8,
        overflow: 'hidden',
    },
    metricProgressFill: {
        height: '100%',
        backgroundColor: '#059669',
        borderRadius: 2.5,
    },
    metricEmptyNote: {
        fontSize: 10.5,
        color: '#94a3b8',
        marginTop: 6,
        fontWeight: '500',
    },
    metricSubInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    // Upcoming matches
    sectionContainer: {
        marginTop: 16,
    },
    pulseDotGreen: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#059669',
    },
    seeAllText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#059669',
    },
    matchesList: {
        gap: 12,
    },
    matchCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderLeftWidth: 4,
        borderLeftColor: '#059669',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    matchCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    pitchPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        gap: 4,
    },
    pitchPillText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#059669',
    },
    matchTimeText: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#0f172a',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    statusBadgeSuccess: {
        backgroundColor: '#dcfce7',
    },
    statusBadgeWarning: {
        backgroundColor: '#fef3c7',
    },
    statusBadgeText: {
        fontSize: 9.5,
        fontWeight: '800',
    },
    statusTextSuccess: {
        color: '#15803d',
    },
    statusTextWarning: {
        color: '#b45309',
    },
    matchTeamsRow: {
        marginTop: 8,
    },
    teamName: {
        fontSize: 14.5,
        fontWeight: '800',
        color: '#0f172a',
    },
    teamSub: {
        fontSize: 11.5,
        color: '#64748b',
        marginTop: 2,
    },
    matchFinanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderColor: '#f1f5f9',
    },
    financeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    financeText: {
        fontSize: 11.5,
        color: '#64748b',
    },
    financeBold: {
        fontWeight: '800',
        color: '#0f172a',
    },
    matchActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
    },
    checkInActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#059669',
        paddingVertical: 9,
        borderRadius: 12,
        gap: 5,
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    checkInActionBtnDisabled: {
        backgroundColor: '#15803d',
        opacity: 0.85,
    },
    checkInActionText: {
        color: '#ffffff',
        fontSize: 11.5,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    callActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 4,
    },
    callActionText: {
        color: '#059669',
        fontSize: 11.5,
        fontWeight: '800',
    },
    detailActionBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    emptyCardTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0f172a',
        marginTop: 8,
        textAlign: 'center',
    },
    emptyCardSub: {
        fontSize: 11.5,
        color: '#64748b',
        marginTop: 4,
        textAlign: 'center',
        lineHeight: 17,
    },
    // Past Match Card
    pastMatchCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    pastPitchName: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0f172a',
    },
    pastDateText: {
        fontSize: 11,
        color: '#64748b',
    },
    pastCustomerText: {
        fontSize: 11,
        color: '#475569',
        marginTop: 2,
    },
    pastPriceText: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0f172a',
    },
    pastStatusPill: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 2,
    },
    pastStatusPillSuccess: {
        backgroundColor: '#dcfce7',
    },
    pastStatusPillMuted: {
        backgroundColor: '#f1f5f9',
    },
    pastStatusText: {
        fontSize: 9.5,
        fontWeight: '800',
    },
    pastTextSuccess: {
        color: '#15803d',
    },
    pastTextMuted: {
        color: '#64748b',
    },
    // Cashflow Chart
    cashflowCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 16,
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    cashflowHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cashflowTitle: {
        fontSize: 14.5,
        fontWeight: '800',
        color: '#0f172a',
    },
    cashflowSub: {
        fontSize: 11.5,
        color: '#059669',
        fontWeight: '700',
        marginTop: 1,
    },
    chartBarsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: 110,
        paddingHorizontal: 4,
    },
    chartBarCol: {
        alignItems: 'center',
        gap: 4,
        flex: 1,
    },
    chartBarTrack: {
        width: 18,
        height: 70,
        backgroundColor: '#f1f5f9',
        borderRadius: 6,
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    chartBarFill: {
        width: '100%',
        borderRadius: 6,
    },
    chartDayLabel: {
        fontSize: 10.5,
        color: '#64748b',
        fontWeight: '600',
    },
    chartDayLabelActive: {
        color: '#059669',
        fontWeight: '800',
    },
    chartDayPrice: {
        fontSize: 9.5,
        color: '#94a3b8',
        fontWeight: '700',
    },
    cashflowFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderColor: '#f1f5f9',
    },
    cashflowFooterText: {
        fontSize: 11,
        color: '#64748b',
    },
    // Facility Dual Widgets
    dualWidgetsGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    widgetCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    widgetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    widgetIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    widgetIndicatorOrange: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#c2410c',
    },
    widgetPillClean: {
        backgroundColor: '#ccfbf1',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 8,
    },
    widgetPillCleanText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#0f766e',
    },
    widgetBigNum: {
        fontSize: 19,
        fontWeight: '900',
        color: '#0f172a',
        marginTop: 6,
    },
    widgetUnit: {
        fontSize: 11.5,
        color: '#64748b',
        fontWeight: '600',
    },
    widgetTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#0f172a',
        marginTop: 2,
    },
    widgetDesc: {
        fontSize: 10.5,
        color: '#64748b',
        marginTop: 2,
    },
    widgetFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 10,
    },
    widgetActionText: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#059669',
    },
    // Categorized App Modules
    badgeTotalModules: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    badgeTotalModulesText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#15803d',
    },
    categoryCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 14,
        marginBottom: 12,
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
