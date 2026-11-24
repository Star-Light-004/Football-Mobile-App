import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    SafeAreaView,
    TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getRevenueAnalyticsApi } from '../api/paymentsApi';
import { getStaffBookingsApi } from '../api/bookingsApi';
import { getMaintenanceIssuesApi } from '../api/facilityApi';
import AdminBottomNav from '../components/AdminBottomNav';

export default function AdminRevenueScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [analytics, setAnalytics] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [maintIssues, setMaintIssues] = useState([]);
    const [filterPeriod, setFilterPeriod] = useState('month'); // 'today', 'week', 'month', 'year'
    const [searchQuery, setSearchQuery] = useState('');

    const formatDateVN = (dStr) => {
        if (!dStr) return '';
        const clean = String(dStr).split('T')[0];
        const parts = clean.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dStr;
    };

    const loadData = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        try {
            const [revRes, bookRes, maintRes] = await Promise.allSettled([
                getRevenueAnalyticsApi(),
                getStaffBookingsApi(),
                getMaintenanceIssuesApi()
            ]);

            if (revRes.status === 'fulfilled') setAnalytics(revRes.value);
            if (bookRes.status === 'fulfilled') {
                const list = Array.isArray(bookRes.value) ? bookRes.value : (bookRes.value?.results || []);
                setTransactions(list);
            }
            if (maintRes.status === 'fulfilled') {
                const mList = Array.isArray(maintRes.value) ? maintRes.value : (maintRes.value?.results || []);
                setMaintIssues(mList);
            }
        } catch (e) {
            console.warn('Lỗi tải doanh thu:', e.message);
        } finally {
            setLoading(false);
            if (isManual) setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();

        // Smart polling định kỳ mỗi 3.5s để cập nhật doanh thu tự động
        const timer = setInterval(() => {
            loadData(false);
        }, 3500);

        // Lắng nghe sự kiện storage / football_sync khi Web phát sinh đơn/bảo trì/thanh toán
        const handleSync = (e) => {
            try {
                const eventData = e?.detail || (e?.newValue ? JSON.parse(e.newValue) : null);
                if (
                    eventData?.type?.startsWith('booking_') ||
                    eventData?.type?.startsWith('payment_') ||
                    eventData?.type?.startsWith('maintenance_') ||
                    eventData?.type === 'field_maintenance_resolved' ||
                    eventData?.type === 'services_updated'
                ) {
                    loadData(false);
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
    }, []);

    const onRefresh = () => {
        loadData(true);
    };

    const txList = (analytics?.transactions && analytics.transactions.length > 0) ? analytics.transactions : transactions;

    // Calculate real dynamic numbers from database
    const kpis = useMemo(() => {
        let totalGross = 0;
        let sepayDeposit = 0;
        let counterCash = 0;

        txList.forEach(tx => {
            const st = String(tx.status || tx.status_class || '').trim().toLowerCase();
            const isCompleted = ['completed', 'hoàn thành', 'hoan thanh', 'đã hoàn thành', 'da hoan thanh', 'success'].includes(st);
            if (!isCompleted) return;
            const amt = Number(tx.total_price || tx.total_amount || tx.amount || tx.price || 0);
            const dep = Number(tx.deposit_amount || 0);
            const method = String(tx.payment_method || tx.method || '').toLowerCase();
            totalGross += amt;
            if (method.includes('vietqr') || method.includes('sepay') || method.includes('bank') || method.includes('qr')) {
                sepayDeposit += dep > 0 ? dep : amt;
                counterCash += Math.max(0, amt - (dep > 0 ? dep : amt));
            } else {
                counterCash += amt;
            }
        });

        const todayRev = analytics?.summary?.today_revenue ?? analytics?.today_revenue ?? 0;
        const monthRev = analytics?.summary?.this_month_revenue ?? analytics?.month_revenue ?? (filterPeriod === 'month' ? totalGross : 0);
        const totalRev = analytics?.summary?.total_revenue ?? analytics?.total_revenue ?? totalGross;

        // Real weekly calculation from past 7 days (Chỉ tính đơn đã hoàn thành)
        const weekRev = txList.filter(tx => {
            const st = String(tx.status || tx.status_class || '').trim().toLowerCase();
            const isCompleted = ['completed', 'hoàn thành', 'hoan thanh', 'đã hoàn thành', 'da hoan thanh', 'success'].includes(st);
            if (!isCompleted) return false;
            const d = tx.date || tx.booking_date;
            if (!d) return false;
            const diffDays = (new Date() - new Date(d)) / (1000 * 60 * 60 * 24);
            return diffDays >= 0 && diffDays <= 7;
        }).reduce((s, tx) => s + Number(tx.price || tx.total_price || tx.total_amount || 0), 0);

        // Real yearly calculation
        const yearRev = txList.filter(tx => {
            const st = String(tx.status || tx.status_class || '').trim().toLowerCase();
            const isCompleted = ['completed', 'hoàn thành', 'hoan thanh', 'đã hoàn thành', 'da hoan thanh', 'success'].includes(st);
            if (!isCompleted) return false;
            const d = tx.date || tx.booking_date;
            if (!d) return false;
            return new Date(d).getFullYear() === new Date().getFullYear();
        }).reduce((s, tx) => s + Number(tx.price || tx.total_price || tx.total_amount || 0), 0);

        const currentRev = filterPeriod === 'today'
            ? todayRev
            : filterPeriod === 'week'
            ? weekRev
            : filterPeriod === 'month'
            ? (monthRev > 0 ? monthRev : totalRev)
            : filterPeriod === 'year'
            ? (yearRev > 0 ? yearRev : totalRev)
            : totalRev;
        const sRev = analytics?.summary?.sepay_revenue ?? analytics?.sepay_revenue ?? sepayDeposit;
        const cRev = analytics?.summary?.cash_revenue ?? analytics?.cash_revenue ?? counterCash;
        const fnb = analytics?.summary?.service_revenue ?? analytics?.service_revenue ?? 0;
        const sepayRatio = currentRev > 0 ? Math.min(100, Math.round((sRev / currentRev) * 100)) : 0;

        // Calculate total maintenance & equipment repair cost from database
        const maintCost = (maintIssues || []).reduce((sum, item) => {
            return sum + Number(item.actual_cost || item.estimated_cost || 0);
        }, 0);

        const netProfit = Math.max(0, currentRev - maintCost);

        return {
            gross: currentRev,
            sepayDeposit: sRev,
            counterCash: cRev,
            fnbRev: fnb,
            maintCost,
            netProfit,
            refunds: 0,
            sepayRatio
        };
    }, [analytics, txList, filterPeriod, maintIssues]);

    const filteredTx = txList.filter(tx => {
        const id = String(tx.id || tx.booking_id || '').toLowerCase();
        const name = (tx.customer_name || tx.user_name || '').toLowerCase();
        const code = (tx.code || tx.order_id || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        return !q || id.includes(q) || name.includes(q) || code.includes(q);
    });

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.responsiveContainer}>
                {/* Header Clean Emerald */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => {
                                if (navigation.canGoBack()) navigation.goBack();
                                else navigation.navigate('AdminDashboard');
                            }}
                        >
                            <Ionicons name="arrow-back" size={20} color="#111827" />
                        </TouchableOpacity>

                        <View style={styles.brandIconBox}>
                            <Ionicons name="analytics" size={20} color="#ffffff" />
                        </View>

                        <View style={{ marginLeft: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.headerTitle}>Báo Cáo Doanh Thu</Text>
                                <View style={styles.proPill}>
                                    <Text style={styles.proPillText}>PRO</Text>
                                </View>
                            </View>
                            <Text style={styles.headerSubtitle}>ĐỐI SOÁT SEPAY VIETQR NAPAS 24/7</Text>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={styles.liveIndicator}>
                            <View style={styles.pulseDot} />
                            <Text style={styles.liveIndicatorText}>LIVE</Text>
                        </View>
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#006b2c']} />}
                >
                    {/* Period Filter Tabs */}
                    <View style={styles.periodRow}>
                        {[
                            { key: 'all', label: 'TẤT CẢ' },
                            { key: 'today', label: 'HÔM NAY' },
                            { key: 'week', label: 'TUẦN NÀY' },
                            { key: 'month', label: 'THÁNG NÀY' },
                            { key: 'year', label: 'NĂM NAY' },
                        ].map(t => {
                            const isSel = filterPeriod === t.key;
                            return (
                                <TouchableOpacity
                                    key={t.key}
                                    style={[styles.periodBtn, isSel && styles.periodBtnActive]}
                                    onPress={() => setFilterPeriod(t.key)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.periodBtnText, isSel && styles.periodBtnTextActive]}>
                                        {t.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Hero Gross Card */}
                    <View style={styles.heroRevCard}>
                        <View style={styles.heroHeader}>
                            <View style={styles.heroBadge}>
                                <Ionicons name="stats-chart" size={13} color="#ffffff" />
                                <Text style={styles.heroBadgeText}>TỔNG DOANH THU THỰC TẾ</Text>
                            </View>
                            <Text style={styles.heroPeriod}>
                                {filterPeriod === 'all'
                                    ? 'Toàn bộ thời gian'
                                    : filterPeriod === 'today'
                                    ? 'Hôm nay'
                                    : filterPeriod === 'week'
                                    ? '7 ngày qua'
                                    : filterPeriod === 'year'
                                    ? `Năm ${new Date().getFullYear()}`
                                    : `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`}
                            </Text>
                        </View>

                        <Text style={styles.heroRevValue}>
                            {Number(kpis.gross).toLocaleString('vi-VN')} <Text style={styles.heroRevUnit}>VNĐ</Text>
                        </Text>

                        <View style={styles.heroFooter}>
                            <Ionicons name="shield-checkmark" size={15} color="#86efac" />
                            <Text style={styles.heroFooterText}>
                                Phí cổng SePay VietQR: <Text style={{ fontWeight: '800', color: '#ffffff' }}>0đ / Miễn phí trọn đời</Text>
                            </Text>
                        </View>
                    </View>

                    {/* Net Profit Card for Field Owner (Lợi nhuận ròng sau chi phí bảo trì) */}
                    <View style={{ backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="wallet" size={15} color="#15803d" />
                                </View>
                                <Text style={{ fontSize: 13, fontWeight: '800', color: '#006b2c' }}>LỢI NHUẬN THUẦN (NET PROFIT)</Text>
                            </View>
                            <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#bbf7d0' }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#15803d' }}>Chủ Sân Pro</Text>
                            </View>
                        </View>

                        <Text style={{ fontSize: 24, fontWeight: '900', color: '#0f172a', marginVertical: 4 }}>
                            {Number(kpis.netProfit).toLocaleString('vi-VN')} <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748b' }}>VNĐ</Text>
                        </Text>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8, marginTop: 4 }}>
                            <Text style={{ fontSize: 11, color: '#64748b' }}>
                                Doanh thu gộp: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{Number(kpis.gross).toLocaleString('vi-VN')}đ</Text>
                            </Text>
                            <Text style={{ fontSize: 11, color: '#b91c1c' }}>
                                Chi phí sửa chữa: <Text style={{ fontWeight: '700', color: '#b91c1c' }}>-{Number(kpis.maintCost).toLocaleString('vi-VN')}đ</Text>
                            </Text>
                        </View>
                    </View>

                    {/* 4 Financial Sub Cards (Bento 2x2) */}
                    <View style={styles.kpiGrid}>
                        <View style={styles.kpiCard}>
                            <View style={[styles.kpiIcon, { backgroundColor: '#dcfce7' }]}>
                                <Ionicons name="qr-code" size={17} color="#15803d" />
                            </View>
                            <Text style={styles.kpiLabel}>CỌC SEPAY VIETQR</Text>
                            <Text style={styles.kpiVal}>{Number(kpis.sepayDeposit).toLocaleString('vi-VN')} đ</Text>
                            <Text style={styles.kpiSub}>Khớp lệnh Napas tự động</Text>
                        </View>

                        <View style={styles.kpiCard}>
                            <View style={[styles.kpiIcon, { backgroundColor: '#dbeafe' }]}>
                                <Ionicons name="storefront" size={17} color="#1d4ed8" />
                            </View>
                            <Text style={styles.kpiLabel}>THU TẠI QUẦY</Text>
                            <Text style={styles.kpiVal}>{Number(kpis.counterCash).toLocaleString('vi-VN')} đ</Text>
                            <Text style={styles.kpiSub}>Tiền mặt & quẹt thẻ</Text>
                        </View>

                        <View style={styles.kpiCard}>
                            <View style={[styles.kpiIcon, { backgroundColor: '#fef3c7' }]}>
                                <Ionicons name="fast-food" size={17} color="#b45309" />
                            </View>
                            <Text style={styles.kpiLabel}>DỊCH VỤ F&B</Text>
                            <Text style={styles.kpiVal}>{Number(kpis.fnbRev).toLocaleString('vi-VN')} đ</Text>
                            <Text style={styles.kpiSub}>Nước khoáng, áo bib, bóng</Text>
                        </View>

                        <View style={styles.kpiCard}>
                            <View style={[styles.kpiIcon, { backgroundColor: '#ffedd5' }]}>
                                <Ionicons name="return-down-back" size={17} color="#c2410c" />
                            </View>
                            <Text style={styles.kpiLabel}>HOÀN CỌC / HỦY</Text>
                            <Text style={[styles.kpiVal, { color: '#006b2c' }]}>0 đ (0%)</Text>
                            <Text style={styles.kpiSub}>Rủi ro hoàn cọc 0%</Text>
                        </View>
                    </View>

                    {/* SePay Automation Ratio Banner */}
                    <View style={styles.ratioCard}>
                        <View style={styles.ratioHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="flash" size={16} color="#006b2c" />
                                <Text style={styles.ratioTitle}>TỶ LỆ SỐ HÓA THANH TOÁN</Text>
                            </View>
                            <Text style={styles.ratioPercent}>{kpis.sepayRatio}% VietQR Napas</Text>
                        </View>

                        <View style={styles.ratioBarContainer}>
                            <View style={[styles.ratioBarFill, { width: `${kpis.sepayRatio}%` }]} />
                        </View>

                        <Text style={styles.ratioDesc}>
                            {kpis.sepayRatio}% giao dịch tiền cọc được xác thực tức thì qua Webhook SePay MBBank mà không cần nhân viên đối soát tay.
                        </Text>
                    </View>

                    {/* Transaction Audit Section */}
                    <View style={styles.txSection}>
                        <View style={styles.txSectionHeader}>
                            <View>
                                <Text style={styles.txSectionTitle}>Nhật Ký Giao Dịch SePay</Text>
                                <Text style={styles.txSectionSub}>Khớp lệnh tự động từ tài khoản MBBank</Text>
                            </View>
                            <View style={styles.txCountBadge}>
                                <Text style={styles.txCountText}>{filteredTx.length} GD</Text>
                            </View>
                        </View>

                        {/* Search inside transactions */}
                        <View style={styles.txSearchWrapper}>
                            <Ionicons name="search" size={16} color="#94a3b8" />
                            <TextInput
                                style={styles.txSearchInput}
                                placeholder="Tìm mã đơn, tên khách, số tiền..."
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

                        {loading ? (
                            <ActivityIndicator color="#006b2c" style={{ paddingVertical: 30 }} />
                        ) : filteredTx.length === 0 ? (
                            <View style={styles.emptyBox}>
                                <Ionicons name="receipt-outline" size={38} color="#94a3b8" />
                                <Text style={styles.emptyText}>Chưa có giao dịch nào được ghi nhận</Text>
                            </View>
                        ) : (
                            filteredTx.slice(0, 15).map((tx, idx) => {
                                const isPaid = ['paid', 'confirmed', 'success', 'completed'].includes(String(tx.status || tx.payment_status || '').toLowerCase());
                                const bId = tx.id || tx.booking_id || (idx + 101);
                                const amount = Number(tx.deposit_amount || tx.total_price || tx.total_amount || 0);

                                return (
                                    <View key={tx.id || idx} style={styles.txRow}>
                                        <View style={[styles.txIconBox, { backgroundColor: isPaid ? '#dcfce7' : '#fef3c7' }]}>
                                            <Ionicons
                                                name={isPaid ? 'arrow-down-circle' : 'time'}
                                                size={18}
                                                color={isPaid ? '#15803d' : '#b45309'}
                                            />
                                        </View>

                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={styles.txCode}>#PP-{String(bId).slice(0, 6).toUpperCase()}</Text>
                                                <View style={styles.bankTag}>
                                                    <Text style={styles.bankTagText}>MBBank</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.txCustomer} numberOfLines={1}>
                                                {tx.customer_name || 'Khách đặt sân qua VietQR'}
                                            </Text>
                                            <Text style={styles.txDate}>
                                                {formatDateVN(tx.booking_date) || 'Hôm nay'} • {tx.start_time?.slice(0, 5) || '17:30'}
                                            </Text>
                                        </View>

                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={[styles.txAmount, { color: isPaid ? '#006b2c' : '#b45309' }]}>
                                                +{amount.toLocaleString('vi-VN')} đ
                                            </Text>
                                            <View style={[styles.statusAutoBadge, { backgroundColor: isPaid ? '#f0fdf4' : '#fef3c7' }]}>
                                                <Ionicons name="checkmark-done" size={11} color={isPaid ? '#006b2c' : '#b45309'} />
                                                <Text style={[styles.statusAutoText, { color: isPaid ? '#006b2c' : '#b45309' }]}>
                                                    {isPaid ? 'Đã khớp lệnh' : 'Chờ cọc'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>
                    <View style={{ height: 80 }} />
                </ScrollView>

                {/* Bottom App Navigation Bar (Always Visible) */}
                <AdminBottomNav activeTab="revenue" navigation={navigation} />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f7f9fb',
    },
    responsiveContainer: {
        flex: 1,
        maxWidth: 768,
        width: '100%',
        alignSelf: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderColor: '#eceef0',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f2f4f6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },
    brandIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#006b2c',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
    },
    proPill: {
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 10,
    },
    proPillText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#006b2c',
    },
    headerSubtitle: {
        fontSize: 10,
        fontWeight: '700',
        color: '#6b7280',
        letterSpacing: 0.5,
        marginTop: 1,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    pulseDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#006b2c',
    },
    liveIndicatorText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#006b2c',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    periodRow: {
        flexDirection: 'row',
        backgroundColor: '#e6e8ea',
        borderRadius: 12,
        padding: 3,
        marginBottom: 12,
    },
    periodBtn: {
        flex: 1,
        paddingVertical: 7,
        alignItems: 'center',
        borderRadius: 9,
    },
    periodBtnActive: {
        backgroundColor: '#ffffff',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 1,
    },
    periodBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#6b7280',
    },
    periodBtnTextActive: {
        color: '#006b2c',
        fontWeight: '800',
    },
    heroRevCard: {
        backgroundColor: '#006b2c',
        borderRadius: 18,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#006b2c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    heroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        gap: 4,
    },
    heroBadgeText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    heroPeriod: {
        color: '#86efac',
        fontSize: 11,
        fontWeight: '600',
    },
    heroRevValue: {
        fontSize: 26,
        fontWeight: '800',
        color: '#ffffff',
        marginTop: 10,
        letterSpacing: -0.5,
    },
    heroRevUnit: {
        fontSize: 14,
        fontWeight: '600',
        color: '#86efac',
    },
    heroFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        gap: 6,
    },
    heroFooterText: {
        fontSize: 11,
        color: '#dcfce7',
    },
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    kpiCard: {
        flexBasis: '48.5%',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#eceef0',
    },
    kpiIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    kpiLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#6b7280',
        letterSpacing: 0.4,
    },
    kpiVal: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
        marginTop: 2,
    },
    kpiSub: {
        fontSize: 10,
        color: '#9ca3af',
        marginTop: 2,
    },
    ratioCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#eceef0',
        marginBottom: 12,
    },
    ratioHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    ratioTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: 0.3,
    },
    ratioPercent: {
        fontSize: 12,
        fontWeight: '800',
        color: '#006b2c',
    },
    ratioBarContainer: {
        height: 6,
        backgroundColor: '#f2f4f6',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 6,
    },
    ratioBarFill: {
        height: '100%',
        backgroundColor: '#006b2c',
        borderRadius: 3,
    },
    ratioDesc: {
        fontSize: 11,
        color: '#6b7280',
        lineHeight: 16,
    },
    txSection: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#eceef0',
    },
    txSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    txSectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#111827',
    },
    txSectionSub: {
        fontSize: 11,
        color: '#6b7280',
        marginTop: 1,
    },
    txCountBadge: {
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    txCountText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#006b2c',
    },
    txSearchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f7f9fb',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#eceef0',
        gap: 6,
    },
    txSearchInput: {
        flex: 1,
        fontSize: 12,
        color: '#111827',
        padding: 0,
    },
    emptyBox: {
        paddingVertical: 30,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 6,
    },
    txRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: '#f2f4f6',
    },
    txIconBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    txCode: {
        fontSize: 12,
        fontWeight: '800',
        color: '#111827',
    },
    bankTag: {
        backgroundColor: '#e0e7ff',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    bankTagText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#3730a3',
    },
    txCustomer: {
        fontSize: 12,
        color: '#4b5563',
        fontWeight: '500',
        marginTop: 1,
    },
    txDate: {
        fontSize: 10,
        color: '#9ca3af',
        marginTop: 1,
    },
    txAmount: {
        fontSize: 13,
        fontWeight: '800',
    },
    statusAutoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        gap: 2,
        marginTop: 2,
    },
    statusAutoText: {
        fontSize: 9,
        fontWeight: '700',
    },
});
