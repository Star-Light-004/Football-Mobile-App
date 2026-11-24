import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    Switch,
    Modal,
    TextInput,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFieldsApi } from '../api/fieldsApi';
import {
    getTimeslotsByFieldApi,
    createTimeslotApi,
    updateTimeslotApi,
    deleteTimeslotApi,
    generateSlotsApi,
    deleteAllSlotsApi
} from '../api/timeslotsApi';

const generateDates = () => {
    const list = [];
    const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        list.push({
            dateStr: `${yyyy}-${mm}-${dd}`,
            display: `${dd}/${mm}`,
            label: i === 0 ? 'Hôm nay' : (i === 1 ? 'Ngày mai' : weekdays[d.getDay()]),
            weekday: weekdays[d.getDay()],
            dayNum: dd,
            monthNum: mm,
        });
    }
    return list;
};

// 16 Khung giờ chuẩn theo mô hình Web
const DEFAULT_SLOT_TEMPLATES = [
    { hour: 6, start_time: '06:00', end_time: '07:00', label: '06:00 – 07:00', price: 80000, enabled: true, session: 'morning', sessionLabel: 'Sáng' },
    { hour: 7, start_time: '07:00', end_time: '08:00', label: '07:00 – 08:00', price: 80000, enabled: true, session: 'morning', sessionLabel: 'Sáng' },
    { hour: 8, start_time: '08:00', end_time: '09:00', label: '08:00 – 09:00', price: 100000, enabled: true, session: 'morning', sessionLabel: 'Sáng' },
    { hour: 9, start_time: '09:00', end_time: '10:00', label: '09:00 – 10:00', price: 100000, enabled: true, session: 'morning', sessionLabel: 'Sáng' },
    { hour: 10, start_time: '10:00', end_time: '11:00', label: '10:00 – 11:00', price: 120000, enabled: false, session: 'midday', sessionLabel: 'Trưa' },
    { hour: 11, start_time: '11:00', end_time: '12:00', label: '11:00 – 12:00', price: 120000, enabled: false, session: 'midday', sessionLabel: 'Trưa' },
    { hour: 12, start_time: '12:00', end_time: '13:00', label: '12:00 – 13:00', price: 120000, enabled: false, session: 'midday', sessionLabel: 'Trưa' },
    { hour: 13, start_time: '13:00', end_time: '14:00', label: '13:00 – 14:00', price: 120000, enabled: false, session: 'midday', sessionLabel: 'Trưa' },
    { hour: 14, start_time: '14:00', end_time: '15:00', label: '14:00 – 15:00', price: 150000, enabled: true, session: 'afternoon', sessionLabel: 'Chiều' },
    { hour: 15, start_time: '15:00', end_time: '16:00', label: '15:00 – 16:00', price: 150000, enabled: true, session: 'afternoon', sessionLabel: 'Chiều' },
    { hour: 16, start_time: '16:00', end_time: '17:00', label: '16:00 – 17:00', price: 180000, enabled: true, session: 'afternoon', sessionLabel: 'Chiều' },
    { hour: 17, start_time: '17:00', end_time: '18:00', label: '17:00 – 18:00', price: 200000, enabled: true, session: 'peak', sessionLabel: 'Cao điểm' },
    { hour: 18, start_time: '18:00', end_time: '19:00', label: '18:00 – 19:00', price: 250000, enabled: true, session: 'peak', sessionLabel: 'Cao điểm' },
    { hour: 19, start_time: '19:00', end_time: '20:00', label: '19:00 – 20:00', price: 270000, enabled: true, session: 'peak', sessionLabel: 'Cao điểm' },
    { hour: 20, start_time: '20:00', end_time: '21:00', label: '20:00 – 21:00', price: 270000, enabled: true, session: 'peak', sessionLabel: 'Cao điểm' },
    { hour: 21, start_time: '21:00', end_time: '22:00', label: '21:00 – 22:00', price: 250000, enabled: true, session: 'peak', sessionLabel: 'Cao điểm' },
];

export default function AdminTimeslotsScreen({ navigation }) {
    const [fields, setFields] = useState([]);
    const [selectedField, setSelectedField] = useState(null);
    const dateList = generateDates();
    const [selectedDate, setSelectedDate] = useState(dateList[0].dateStr);

    const [slots, setSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    // Modal add / edit single slot
    const [modalVisible, setModalVisible] = useState(false);
    const [editingSlot, setEditingSlot] = useState(null);
    const [startTime, setStartTime] = useState('17:30');
    const [endTime, setEndTime] = useState('19:00');
    const [price, setPrice] = useState('250000');
    const [isAvailable, setIsAvailable] = useState(true);
    const [saving, setSaving] = useState(false);

    // Modal GENERATE SLOTS
    const [genModalVisible, setGenModalVisible] = useState(false);
    const [genSelectedField, setGenSelectedField] = useState('all');
    const [genDays, setGenDays] = useState(30);
    const [genSlotConfigs, setGenSlotConfigs] = useState(() => {
        const currentHour = new Date().getHours();
        const upcoming = DEFAULT_SLOT_TEMPLATES.filter((s) => s.hour > currentHour);
        const templates = upcoming.length > 0 ? upcoming : DEFAULT_SLOT_TEMPLATES;
        return templates.map((s) => ({
            ...s,
            enabled: s.session !== 'midday',
        }));
    });
    const [bulkPriceInput, setBulkPriceInput] = useState('');
    const [generating, setGenerating] = useState(false);
    const [genResult, setGenResult] = useState(null);

    const QUICK_PRICES = [80000, 100000, 120000, 150000, 180000, 200000, 250000, 270000];

    const formatNumberWithDot = (val) => {
        if (val === null || val === undefined || val === '') return '';
        const num = typeof val === 'number' ? val : parseInt(String(val).replace(/\D/g, ''), 10);
        if (isNaN(num)) return '';
        return num.toLocaleString('vi-VN');
    };

    const openGenModal = () => {
        setGenResult(null);
        setGenDays(30);
        setBulkPriceInput('');
        const currentHour = new Date().getHours();
        const upcoming = DEFAULT_SLOT_TEMPLATES.filter((s) => s.hour > currentHour);
        const templates = upcoming.length > 0 ? upcoming : DEFAULT_SLOT_TEMPLATES;
        setGenSlotConfigs(templates.map((s) => ({
            ...s,
            enabled: s.session !== 'midday',
        })));
        setGenModalVisible(true);
    };

    // Tính khoảng ngày bắt đầu & kết thúc cho modal tự động
    const genToday = new Date();
    const genEndDate = new Date();
    genEndDate.setDate(genToday.getDate() + Math.max(0, genDays - 1));
    const formatDateDisplay = (d) => {
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    useEffect(() => {
        (async () => {
            try {
                const res = await getFieldsApi();
                const list = res?.fields || res?.results || (Array.isArray(res) ? res : []);
                setFields(list);
                if (list.length > 0) setSelectedField(list[0].id);
            } catch (e) {
                console.warn('Lỗi lấy danh sách sân:', e.message);
            }
        })();
    }, []);

    // Broadcast sync event cho Web và các thiết bị khác
    const broadcastAppSync = (type = 'timeslot_updated') => {
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

    const fetchLiveSlots = async (fieldId, date, isSilent = false) => {
        if (!fieldId) return;
        if (!isSilent) setLoadingSlots(true);
        try {
            const data = await getTimeslotsByFieldApi(fieldId, date);
            const list = Array.isArray(data) ? data : (data?.timeslots || data?.results || []);
            setSlots(list);
        } catch (e) {
            console.warn('Lỗi tải khung giờ:', e.message);
            setSlots([]);
        } finally {
            if (!isSilent) setLoadingSlots(false);
        }
    };

    useEffect(() => {
        if (selectedField) {
            fetchLiveSlots(selectedField, selectedDate, false);
        }

        // Smart polling định kỳ mỗi 3.5s để cập nhật khung giờ tự động
        const timer = setInterval(() => {
            if (selectedField) {
                fetchLiveSlots(selectedField, selectedDate, true);
            }
        }, 3500);

        // Lắng nghe sự kiện storage / football_sync khi Web hoặc app khác thay đổi slot hoặc booking
        const handleSync = (e) => {
            try {
                const eventData = e?.detail || (e?.newValue ? JSON.parse(e.newValue) : null);
                if (
                    eventData?.type?.startsWith('timeslot_') ||
                    eventData?.type?.startsWith('booking_')
                ) {
                    if (selectedField) {
                        fetchLiveSlots(selectedField, selectedDate, true);
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
    }, [selectedField, selectedDate]);

    // Handle GENERATE SLOTS
    const handleToggleSlot = (startTimeVal) => {
        setGenSlotConfigs(prev =>
            prev.map(s => s.start_time === startTimeVal ? { ...s, enabled: !s.enabled } : s)
        );
    };

    const handlePriceChange = (startTimeVal, newPrice) => {
        const clean = String(newPrice).replace(/\D/g, '');
        const num = clean ? parseInt(clean, 10) : 0;
        setGenSlotConfigs(prev =>
            prev.map(s => s.start_time === startTimeVal ? { ...s, price: num } : s)
        );
    };

    const handleSelectAllSlots = (enableAll = true) => {
        setGenSlotConfigs(prev => prev.map(s => ({ ...s, enabled: enableAll })));
    };

    const handleRestoreDefaultSlots = () => {
        const currentHour = new Date().getHours();
        const upcoming = DEFAULT_SLOT_TEMPLATES.filter((s) => s.hour > currentHour);
        const templates = upcoming.length > 0 ? upcoming : DEFAULT_SLOT_TEMPLATES;
        setGenSlotConfigs(
            templates.map(s => ({ ...s, enabled: s.session !== 'midday' }))
        );
    };

    const handleApplyBulkPrice = (customVal) => {
        const valToApply = customVal !== undefined ? customVal : bulkPriceInput;
        const clean = String(valToApply).replace(/\D/g, '');
        const p = clean ? parseInt(clean, 10) : 0;
        if (!p || p <= 0) {
            Alert.alert('Giá không hợp lệ', 'Vui lòng nhập hoặc chọn mức giá hợp lệ.');
            return;
        }
        setGenSlotConfigs(prev =>
            prev.map(s => s.enabled ? { ...s, price: p } : s)
        );
        if (customVal === undefined) setBulkPriceInput('');
    };

    const handleExecuteGenerate = async () => {
        const enabledSlots = genSlotConfigs.filter(s => s.enabled);
        if (enabledSlots.length === 0) {
            Alert.alert('Chưa chọn khung giờ', 'Vui lòng bật ít nhất 1 khung giờ để hệ thống tạo slot!');
            return;
        }

        const daysNum = Math.max(1, Math.min(parseInt(String(genDays), 10) || 30, 90));

        setGenerating(true);
        try {
            const payload = {
                days: daysNum,
                field_id: genSelectedField === 'all' ? null : genSelectedField,
                slot_configs: enabledSlots.map(s => ({
                    start_time: s.start_time,
                    end_time: s.end_time,
                    price: s.price,
                    enabled: true
                }))
            };

            const res = await generateSlotsApi(payload);
            setGenResult(res);
            broadcastAppSync('timeslot_updated');
            if (selectedField) {
                fetchLiveSlots(selectedField, selectedDate, true);
            }
        } catch (e) {
            Alert.alert('Lỗi khởi tạo', e.response?.data?.error || e.message || 'Không thể tạo slot lúc này.');
        } finally {
            setGenerating(false);
        }
    };

    const handleDoneGenerate = () => {
        setGenModalVisible(false);
        setGenResult(null);
        if (selectedField) {
            fetchLiveSlots(selectedField, selectedDate, false);
        }
    };

    const handleDeleteAll = () => {
        const doDelete = async () => {
            try {
                await deleteAllSlotsApi();
                broadcastAppSync('timeslot_updated');
                Alert.alert('Đã xóa', 'Đã xóa toàn bộ khung giờ chưa được đặt.');
                fetchLiveSlots(selectedField, selectedDate);
            } catch (e) {
                Alert.alert('Lỗi', 'Không thể xóa khung giờ');
            }
        };

        Alert.alert(
            'Xác nhận xóa',
            'Bạn có chắc chắn muốn xóa tất cả khung giờ chưa được đặt?',
            [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Xóa ngay', style: 'destructive', onPress: doDelete }
            ]
        );
    };

    const openAddModal = () => {
        setEditingSlot(null);
        setStartTime('17:30');
        setEndTime('19:00');
        setPrice('250000');
        setIsAvailable(true);
        setModalVisible(true);
    };

    const openEditModal = (slot) => {
        setEditingSlot(slot);
        setStartTime(slot.start_time ? String(slot.start_time).slice(0, 5) : '17:30');
        setEndTime(slot.end_time ? String(slot.end_time).slice(0, 5) : '19:00');
        setPrice(String(slot.price || '250000'));
        setIsAvailable(slot.status === 'available');
        setModalVisible(true);
    };

    const handleSaveSlot = async () => {
        if (!startTime.trim() || !endTime.trim()) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập giờ bắt đầu và kết thúc (VD: 17:30 - 19:00)');
            return;
        }
        if (!price || isNaN(Number(price))) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập giá tiền hợp lệ');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                field_id: selectedField,
                slot_date: selectedDate,
                start_time: startTime.trim().length === 5 ? `${startTime.trim()}:00` : startTime.trim(),
                end_time: endTime.trim().length === 5 ? `${endTime.trim()}:00` : endTime.trim(),
                price: parseFloat(price) || 0,
                status: isAvailable ? 'available' : 'locked'
            };

            if (editingSlot) {
                await updateTimeslotApi(editingSlot.id, payload);
                broadcastAppSync('timeslot_updated');
                Alert.alert('Thành công', 'Đã cập nhật khung giờ');
            } else {
                await createTimeslotApi(payload);
                broadcastAppSync('timeslot_updated');
                Alert.alert('Thành công', 'Đã thêm khung giờ mới');
            }
            setModalVisible(false);
            fetchLiveSlots(selectedField, selectedDate);
        } catch (e) {
            Alert.alert('Lỗi', 'Không thể lưu khung giờ: ' + (e.message || ''));
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSingleSlot = (slot) => {
        const doDelete = async () => {
            try {
                await deleteTimeslotApi(slot.id);
                broadcastAppSync('timeslot_updated');
                fetchLiveSlots(selectedField, selectedDate);
            } catch (e) {
                Alert.alert('Lỗi', 'Không thể xóa khung giờ');
            }
        };

        Alert.alert(
            'Xóa khung giờ',
            `Bạn có chắc muốn xóa ca ${slot.start_time?.slice(0, 5)} - ${slot.end_time?.slice(0, 5)}?`,
            [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Xóa', style: 'destructive', onPress: doDelete }
            ]
        );
    };

    const toggleSlotStatus = async (slot) => {
        const nextStatus = slot.status === 'available' ? 'locked' : 'available';
        try {
            await updateTimeslotApi(slot.id, {
                ...slot,
                status: nextStatus
            });
            broadcastAppSync('timeslot_updated');
            fetchLiveSlots(selectedField, selectedDate);
        } catch (e) {
            Alert.alert('Lỗi', 'Không thể đổi trạng thái khung giờ');
        }
    };

    // Real stats
    const stats = useMemo(() => {
        const total = slots.length;
        const available = slots.filter(s => s.status === 'available').length;
        const booked = slots.filter(s => s.status === 'booked').length;
        const locked = slots.filter(s => s.status === 'locked').length;
        const prime = slots.filter(s => {
            const h = parseInt(String(s.start_time || '0').split(':')[0], 10);
            return h >= 17 && h <= 21;
        }).length;
        const reservationRate = total > 0 ? Math.round((booked / total) * 100) : 0;
        return { total, available, booked, locked, prime, reservationRate };
    }, [slots]);

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
                            <Text style={styles.topBarTitle}>Khung Giờ & Giờ Vàng</Text>
                            <View style={styles.proPill}>
                                <Text style={styles.proPillText}>PRIME</Text>
                            </View>
                        </View>
                        <Text style={styles.topBarSubtitle}>ĐIỀU CHỈNH MA TRẬN CA & GIÁ PHỤ THU</Text>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity style={styles.addBtn} onPress={openAddModal} activeOpacity={0.85}>
                        <Ionicons name="add" size={16} color="#ffffff" />
                        <Text style={styles.addBtnText}>+ Thêm ca</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Quick Action Bar (3 CTA Buttons) */}
                <View style={styles.quickActionRow}>
                    <TouchableOpacity
                        style={styles.primaryActionBtn}
                        onPress={openGenModal}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="sparkles" size={16} color="#ffffff" />
                        <Text style={styles.primaryActionBtnText}>Tạo tự động 30 ngày</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryActionBtn}
                        onPress={openAddModal}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="add-circle-outline" size={16} color="#006b2c" />
                        <Text style={styles.secondaryActionBtnText}>+ Ca lẻ</Text>
                    </TouchableOpacity>

                    {slots.length > 0 && (
                        <TouchableOpacity
                            style={styles.dangerActionBtn}
                            onPress={handleDeleteAll}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="trash-outline" size={16} color="#b91c1c" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* 2x2 Bento Metric Overview */}
                <View style={styles.bentoGrid}>
                    {/* Metric 1 */}
                    <View style={styles.bentoCard}>
                        <View style={styles.bentoCardHeader}>
                            <Text style={styles.bentoLabel}>Tổng ca chuẩn</Text>
                            <View style={[styles.bentoIconBox, { backgroundColor: '#f0fdf4' }]}>
                                <Ionicons name="time" size={15} color="#006b2c" />
                            </View>
                        </View>
                        <Text style={styles.bentoBigNum}>
                            {stats.total} ca <Text style={styles.bentoUnit}>/ ngày</Text>
                        </Text>
                        <Text style={styles.bentoSubText}>Khung 06:00 – 23:30</Text>
                    </View>

                    {/* Metric 2 */}
                    <View style={styles.bentoCard}>
                        <View style={styles.bentoCardHeader}>
                            <Text style={[styles.bentoLabel, { color: '#b45309' }]}>Giờ vàng Prime</Text>
                            <View style={[styles.bentoIconBox, { backgroundColor: '#fef3c7' }]}>
                                <Ionicons name="flame" size={15} color="#b45309" />
                            </View>
                        </View>
                        <Text style={styles.bentoBigNum}>
                            {stats.prime} ca <Text style={[styles.bentoUnit, { color: '#b45309' }]}>cao điểm</Text>
                        </Text>
                        <Text style={styles.bentoSubText}>LED phụ thu +30%</Text>
                    </View>

                    {/* Metric 3 */}
                    <View style={styles.bentoCard}>
                        <View style={styles.bentoCardHeader}>
                            <Text style={styles.bentoLabel}>Tỷ lệ đặt trước</Text>
                            <View style={[styles.bentoIconBox, { backgroundColor: '#dcfce7' }]}>
                                <Ionicons name="trending-up" size={15} color="#15803d" />
                            </View>
                        </View>
                        <Text style={styles.bentoBigNum}>{stats.reservationRate}%</Text>
                        <Text style={[styles.bentoSubText, { color: '#15803d', fontWeight: '700' }]}>
                            {stats.booked} ca đã chốt
                        </Text>
                    </View>

                    {/* Metric 4 */}
                    <View style={styles.bentoCard}>
                        <View style={styles.bentoCardHeader}>
                            <Text style={[styles.bentoLabel, { color: '#c2410c' }]}>Bảo trì & Khóa</Text>
                            <View style={[styles.bentoIconBox, { backgroundColor: '#ffedd5' }]}>
                                <Ionicons name="lock-closed" size={15} color="#c2410c" />
                            </View>
                        </View>
                        <Text style={styles.bentoBigNum}>
                            {stats.locked} ca <Text style={[styles.bentoUnit, { color: '#c2410c' }]}>khóa</Text>
                        </Text>
                        <Text style={styles.bentoSubText}>Dành bảo dưỡng mặt cỏ</Text>
                    </View>
                </View>

                {/* Pitch Selector Horizontal Bar */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Chọn sân bóng</Text>
                </View>
                {/* Pitch Selector: Wrap for Mobile */}
                <View style={styles.fieldWrap}>
                    {fields.map(f => {
                        const isSel = selectedField === f.id;
                        return (
                            <TouchableOpacity
                                key={f.id}
                                style={[styles.fieldChip, isSel && styles.fieldChipActive]}
                                onPress={() => setSelectedField(f.id)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="football" size={14} color={isSel ? '#ffffff' : '#006b2c'} />
                                <Text style={[styles.fieldChipText, isSel && styles.fieldChipTextActive]}>
                                    {f.field_name || f.name}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Horizontal Date Picker Strip */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Chọn ngày xem ca</Text>
                    <Text style={styles.sectionSubTitle}>Tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateSelectorScroll}>
                    {dateList.map((d, i) => {
                        const isSel = selectedDate === d.dateStr;
                        return (
                            <TouchableOpacity
                                key={d.dateStr}
                                style={[styles.dateCard, isSel && styles.dateCardActive]}
                                onPress={() => setSelectedDate(d.dateStr)}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.dateWeekday, isSel && styles.dateWeekdayActive]}>
                                    {d.weekday}
                                </Text>
                                <Text style={[styles.dateDayNum, isSel && styles.dateDayNumActive]}>
                                    {d.dayNum}
                                </Text>
                                <View style={[styles.dateIndicator, isSel ? styles.dateIndicatorActive : (i === 0 && styles.dateIndicatorToday)]}>
                                    <Text style={[styles.dateIndicatorText, isSel && styles.dateIndicatorTextActive]}>
                                        {i === 0 ? 'H.nay' : d.monthNum}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Slots List Header */}
                <View style={styles.listHeaderRow}>
                    <Text style={styles.sectionTitle}>Danh sách ca thi đấu ({slots.length})</Text>
                    <View style={styles.liveIndicator}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>Thời gian thực</Text>
                    </View>
                </View>

                {/* Slots List Content */}
                {loadingSlots ? (
                    <View style={styles.centerBox}>
                        <ActivityIndicator size="large" color="#006b2c" />
                        <Text style={styles.centerText}>Đang tải khung giờ từ CSDL...</Text>
                    </View>
                ) : slots.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Ionicons name="time-outline" size={48} color="#94a3b8" />
                        <Text style={styles.emptyTitle}>Chưa có khung giờ nào được thiết lập</Text>
                        <Text style={styles.emptySub}>
                            Ngày này chưa có ca thi đấu. Hãy nhấn nút dưới để hệ thống sinh toàn bộ ca tự động.
                        </Text>
                        <TouchableOpacity
                            style={styles.emptyGenBtn}
                            onPress={openGenModal}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="sparkles" size={16} color="#ffffff" />
                            <Text style={styles.emptyGenBtnText}>Tạo tự động 30 ngày</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.slotsGrid}>
                        {slots.map(s => {
                            const isBooked = s.status === 'booked';
                            const isLocked = s.status === 'locked';
                            const isAvail = s.status === 'available';

                            const startH = parseInt(String(s.start_time || '0').split(':')[0], 10);
                            const isPrime = startH >= 17 && startH <= 21;

                            return (
                                <View key={s.id} style={[styles.slotCard, isPrime && styles.slotCardPrime]}>
                                    <View style={styles.slotCardTop}>
                                        <View style={styles.slotTimeGroup}>
                                            <Ionicons name="time-outline" size={15} color={isPrime ? "#b45309" : "#006b2c"} />
                                            <Text style={styles.slotTimeText}>
                                                {String(s.start_time || '').slice(0, 5)} – {String(s.end_time || '').slice(0, 5)}
                                            </Text>
                                        </View>

                                        {isPrime ? (
                                            <View style={styles.primeBadge}>
                                                <Ionicons name="flame" size={11} color="#b45309" />
                                                <Text style={styles.primeBadgeText}>GIỜ VÀNG</Text>
                                            </View>
                                        ) : (
                                            <View style={styles.standardBadge}>
                                                <Text style={styles.standardBadgeText}>TIÊU CHUẨN</Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.slotPriceRow}>
                                        <Text style={styles.slotPriceNum}>
                                            {Number(s.price || 0).toLocaleString('vi-VN')}đ
                                        </Text>
                                        <Text style={styles.slotUnit}> / ca</Text>
                                        {isPrime && (
                                            <Text style={styles.ledNote}>• LED Philips +30k</Text>
                                        )}
                                    </View>

                                    <View style={styles.slotCardBottom}>
                                        <View style={[
                                            styles.statusBadge,
                                            isAvail && styles.badgeAvail,
                                            isBooked && styles.badgeBooked,
                                            isLocked && styles.badgeLocked
                                        ]}>
                                            <View style={[
                                                styles.statusDot,
                                                isAvail && { backgroundColor: '#006b2c' },
                                                isBooked && { backgroundColor: '#1d4ed8' },
                                                isLocked && { backgroundColor: '#c2410c' },
                                            ]} />
                                            <Text style={[
                                                styles.statusBadgeText,
                                                isAvail && styles.textAvail,
                                                isBooked && styles.textBooked,
                                                isLocked && styles.textLocked
                                            ]}>
                                                {isAvail ? 'Sẵn sàng nhận khách' : isBooked ? 'Đã có khách đặt' : 'Tạm khóa bảo trì'}
                                            </Text>
                                        </View>

                                        {!isBooked && (
                                            <View style={styles.slotActionIcons}>
                                                <TouchableOpacity
                                                    style={styles.actionIconBtn}
                                                    onPress={() => toggleSlotStatus(s)}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons
                                                        name={isAvail ? 'lock-open-outline' : 'lock-closed'}
                                                        size={15}
                                                        color={isAvail ? '#006b2c' : '#c2410c'}
                                                    />
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={styles.actionIconBtn}
                                                    onPress={() => openEditModal(s)}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons name="create-outline" size={15} color="#111827" />
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={styles.actionIconBtn}
                                                    onPress={() => handleDeleteSingleSlot(s)}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons name="trash-outline" size={15} color="#b91c1c" />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* MODAL: TẠO SLOT TỰ ĐỘNG BULK (ĐỒNG BỘ 100% VỚI WEB) */}
            <Modal
                visible={genModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setGenModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBoxLarge}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="sparkles" size={18} color="#006b2c" />
                                    <Text style={styles.modalSubTitle}>TẠO SLOT GIỜ TỰ ĐỘNG</Text>
                                </View>
                                <Text style={styles.modalMainTitle}>Tùy chỉnh sân áp dụng, số ngày và giá từng khung giờ</Text>
                            </View>
                            <TouchableOpacity onPress={() => setGenModalVisible(false)} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
                            {/* 1. Chọn sân áp dụng */}
                            <Text style={styles.sectionHeaderLabel}>1. ÁP DỤNG CHO SÂN BÓNG NÀO?</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                <TouchableOpacity
                                    style={[styles.fieldSelectPill, genSelectedField === 'all' && styles.fieldSelectPillActive]}
                                    onPress={() => setGenSelectedField('all')}
                                >
                                    <Ionicons name="globe-outline" size={14} color={genSelectedField === 'all' ? '#ffffff' : '#006b2c'} />
                                    <Text style={[styles.fieldSelectPillText, genSelectedField === 'all' && styles.fieldSelectPillTextActive]}>
                                        Tất cả các sân ({fields.length} sân)
                                    </Text>
                                </TouchableOpacity>

                                {fields.map(f => {
                                    const isSel = genSelectedField === f.id;
                                    return (
                                        <TouchableOpacity
                                            key={f.id}
                                            style={[styles.fieldSelectPill, isSel && styles.fieldSelectPillActive]}
                                            onPress={() => setGenSelectedField(f.id)}
                                        >
                                            <Ionicons name="football" size={14} color={isSel ? '#ffffff' : '#006b2c'} />
                                            <Text style={[styles.fieldSelectPillText, isSel && styles.fieldSelectPillTextActive]}>
                                                {f.field_name || f.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            {/* 2. Số ngày tới & Phạm vi ngày */}
                            <Text style={styles.sectionHeaderLabel}>2. TẠO CHO BAO NHIÊU NGÀY TỚI?</Text>
                            <View style={styles.daysSelectorRow}>
                                {[1, 7, 14, 30, 60, 90].map(d => (
                                    <TouchableOpacity
                                        key={d}
                                        style={[styles.daysPill, genDays === d && styles.daysPillActive]}
                                        onPress={() => setGenDays(d)}
                                    >
                                        <Text style={[styles.daysPillText, genDays === d && styles.daysPillTextActive]}>
                                            {d === 1 ? '1 ngày' : `${d} ngày`}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={styles.dateRangeBadge}>
                                <Ionicons name="calendar-outline" size={13} color="#0369a1" />
                                <Text style={styles.dateRangeText}>
                                    Khoảng thời gian: Từ <Text style={{ fontWeight: '700' }}>{formatDateDisplay(genToday)}</Text> đến <Text style={{ fontWeight: '700' }}>{formatDateDisplay(genEndDate)}</Text> ({genDays} ngày)
                                </Text>
                            </View>

                            <View style={styles.infoAlertBox}>
                                <Ionicons name="information-circle-outline" size={14} color="#0369a1" />
                                <Text style={styles.infoAlertText}>
                                    Hệ thống tự động bỏ qua các khung giờ trước thời điểm hiện tại của hôm nay để tránh tạo dữ liệu thừa.
                                </Text>
                            </View>

                            {/* 3. Khung giờ & Bảng giá áp dụng */}
                            <View style={[styles.sectionTitleRow, { marginTop: 12 }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.sectionHeaderLabel}>3. BẢNG GIÁ & KHUNG GIỜ ÁP DỤNG</Text>
                                    <Text style={styles.genSlotsHint}>
                                        Đang bật <Text style={{ fontWeight: '700', color: '#006b2c' }}>{genSlotConfigs.filter(s => s.enabled).length}</Text> / {genSlotConfigs.length} khung giờ.
                                    </Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                    <TouchableOpacity style={styles.quickActionSmallBtn} onPress={() => handleSelectAllSlots(true)}>
                                        <Text style={styles.quickActionSmallText}>Bật hết</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.quickActionSmallBtn} onPress={() => handleSelectAllSlots(false)}>
                                        <Text style={[styles.quickActionSmallText, { color: '#64748b' }]}>Tắt hết</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.quickActionSmallBtn, { backgroundColor: '#f0fdf4' }]} onPress={handleRestoreDefaultSlots}>
                                        <Text style={[styles.quickActionSmallText, { color: '#006b2c' }]}>Mặc định</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Đặt giá nhanh đồng loạt */}
                            <View style={styles.bulkPriceContainer}>
                                <Text style={styles.bulkPriceHeaderTitle}>Đặt giá nhanh đồng loạt:</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                                    {QUICK_PRICES.map(p => (
                                        <TouchableOpacity
                                            key={p}
                                            style={styles.quickPriceChip}
                                            onPress={() => handleApplyBulkPrice(p)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.quickPriceChipText}>{formatNumberWithDot(p)}đ</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                <View style={styles.bulkPriceRow}>
                                    <TextInput
                                        style={styles.bulkPriceInput}
                                        placeholder="Nhập giá khác (VNĐ)..."
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="numeric"
                                        value={bulkPriceInput}
                                        onChangeText={setBulkPriceInput}
                                    />
                                    <TouchableOpacity style={styles.bulkPriceBtn} onPress={() => handleApplyBulkPrice()}>
                                        <Text style={styles.bulkPriceBtnText}>Áp dụng tất cả</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Slot Config Rows */}
                            <View style={styles.slotConfigsList}>
                                {genSlotConfigs.map(item => {
                                    const sessionBg = item.session === 'peak' ? '#fee2e2' : item.session === 'midday' ? '#f1f5f9' : item.session === 'afternoon' ? '#fef3c7' : '#dbeafe';
                                    const sessionColor = item.session === 'peak' ? '#b91c1c' : item.session === 'midday' ? '#64748b' : item.session === 'afternoon' ? '#b45309' : '#1d4ed8';

                                    return (
                                        <View key={item.start_time} style={[styles.configRow, !item.enabled && { opacity: 0.5, backgroundColor: '#f8fafc' }]}>
                                            <Switch
                                                value={item.enabled}
                                                onValueChange={() => handleToggleSlot(item.start_time)}
                                                trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                                                thumbColor={item.enabled ? '#006b2c' : '#f1f5f9'}
                                            />
                                            <View style={{ flex: 1, marginLeft: 8 }}>
                                                <Text style={styles.configSlotLabel}>{item.label}</Text>
                                                <View style={[styles.sessionTag, { backgroundColor: sessionBg }]}>
                                                    <Text style={[styles.sessionTagText, { color: sessionColor }]}>{item.sessionLabel}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.configPriceWrapper}>
                                                <TextInput
                                                    style={styles.configPriceInput}
                                                    value={formatNumberWithDot(item.price)}
                                                    onChangeText={(v) => handlePriceChange(item.start_time, v)}
                                                    keyboardType="numeric"
                                                    editable={item.enabled}
                                                />
                                                <Text style={styles.configCurrencyUnit}>VNĐ</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>

                            {/* Summary Card */}
                            <View style={styles.summaryCard}>
                                <Ionicons name="information-circle" size={16} color="#006b2c" />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.summaryText}>
                                        Sẽ tạo tối đa <Text style={{ fontWeight: '800', color: '#006b2c' }}>
                                            {genSlotConfigs.filter(s => s.enabled).length * genDays * (genSelectedField === 'all' ? (fields.length || 1) : 1)}
                                        </Text> slot ({genSlotConfigs.filter(s => s.enabled).length} khung giờ × {genDays} ngày × {genSelectedField === 'all' ? `Tất cả (${fields.length} sân)` : 'Sân đã chọn'}).
                                    </Text>
                                    <Text style={styles.summarySubText}>
                                        Hệ thống tự động bỏ qua những slot giờ đã tồn tại trước đó để tránh trùng lặp.
                                    </Text>
                                </View>
                            </View>

                            {/* Kết quả sau khi tạo */}
                            {genResult && (
                                <View style={styles.genResultBox}>
                                    <View style={styles.genResultRow}>
                                        <Ionicons name="checkmark-circle" size={16} color="#15803d" />
                                        <Text style={styles.genResultText}>
                                            <Text style={{ fontWeight: '800' }}>{genResult.created?.toLocaleString('vi-VN') || 0}</Text> slot đã tạo mới thành công
                                        </Text>
                                    </View>
                                    <View style={styles.genResultRow}>
                                        <Ionicons name="play-skip-forward-circle" size={16} color="#b45309" />
                                        <Text style={[styles.genResultText, { color: '#b45309' }]}>
                                            <Text style={{ fontWeight: '800' }}>{genResult.skipped?.toLocaleString('vi-VN') || 0}</Text> slot đã tồn tại trước đó (bỏ qua)
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            {genResult ? (
                                <TouchableOpacity
                                    style={[styles.modalSubmitBtn, { flex: 1, backgroundColor: '#006b2c' }]}
                                    onPress={handleDoneGenerate}
                                >
                                    <Ionicons name="checkmark-done" size={16} color="#ffffff" />
                                    <Text style={styles.modalSubmitBtnText}>Hoàn tất</Text>
                                </TouchableOpacity>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={styles.modalCancelBtn}
                                        onPress={() => setGenModalVisible(false)}
                                        disabled={generating}
                                    >
                                        <Text style={styles.modalCancelBtnText}>Hủy</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.modalSubmitBtn, (generating || genSlotConfigs.filter(s => s.enabled).length === 0) && { opacity: 0.6 }]}
                                        onPress={handleExecuteGenerate}
                                        disabled={generating || genSlotConfigs.filter(s => s.enabled).length === 0}
                                    >
                                        {generating ? (
                                            <ActivityIndicator size="small" color="#ffffff" />
                                        ) : (
                                            <>
                                                <Ionicons name="flash" size={15} color="#ffffff" />
                                                <Text style={styles.modalSubmitBtnText}>
                                                    Tạo ngay ({genSlotConfigs.filter(s => s.enabled).length} giờ / ngày)
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* MODAL: SINGLE SLOT ADD / EDIT */}
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
                                <Text style={styles.modalSubTitle}>
                                    {editingSlot ? 'CHỈNH SỬA KHUNG GIỜ' : 'THÊM KHUNG GIỜ MỚI'}
                                </Text>
                                <Text style={styles.modalMainTitle}>
                                    {editingSlot ? `${startTime} – ${endTime}` : 'Khung Giờ Mới'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ paddingVertical: 10 }}>
                            <Text style={styles.formLabel}>Giờ bắt đầu (HH:mm) *</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Ví dụ: 17:30"
                                placeholderTextColor="#94a3b8"
                                value={startTime}
                                onChangeText={setStartTime}
                            />

                            <Text style={styles.formLabel}>Giờ kết thúc (HH:mm) *</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Ví dụ: 19:00"
                                placeholderTextColor="#94a3b8"
                                value={endTime}
                                onChangeText={setEndTime}
                            />

                            <Text style={styles.formLabel}>Giá tiền mỗi ca (VNĐ) *</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Ví dụ: 250000"
                                placeholderTextColor="#94a3b8"
                                keyboardType="numeric"
                                value={price}
                                onChangeText={setPrice}
                            />

                            <View style={styles.statusToggleRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.statusToggleTitle}>Trạng thái ca đấu</Text>
                                    <Text style={styles.statusToggleSub}>
                                        {isAvailable ? 'Sẵn sàng mở nhận khách đặt' : 'Tạm khóa bảo dưỡng'}
                                    </Text>
                                </View>
                                <Switch
                                    value={isAvailable}
                                    onValueChange={setIsAvailable}
                                    trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                                    thumbColor={isAvailable ? '#006b2c' : '#f1f5f9'}
                                />
                            </View>
                        </View>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.modalCancelBtnText}>Hủy</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalSubmitBtn, saving && { opacity: 0.7 }]}
                                onPress={handleSaveSlot}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <Text style={styles.modalSubmitBtnText}>
                                        {editingSlot ? 'Lưu thay đổi' : 'Thêm ca mới'}
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
        backgroundColor: '#fef3c7',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 9999,
    },
    proPillText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#b45309',
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
    quickActionRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
    },
    primaryActionBtn: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#006b2c',
        paddingVertical: 10,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#006b2c',
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    primaryActionBtnText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },
    secondaryActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#dcfce7',
        paddingVertical: 10,
        borderRadius: 12,
    },
    secondaryActionBtnText: {
        color: '#006b2c',
        fontSize: 12,
        fontWeight: '700',
    },
    dangerActionBtn: {
        width: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fee2e2',
        borderRadius: 12,
    },
    bentoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 14,
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
        fontSize: 17,
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
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    sectionSubTitle: {
        fontSize: 11,
        color: '#6b7280',
        fontWeight: '600',
    },
    fieldWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingBottom: 12,
    },
    fieldSelectorScroll: {
        gap: 8,
        paddingBottom: 12,
    },
    fieldChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#ffffff',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 9999,
        borderWidth: 1,
        borderColor: '#eceef0',
    },
    fieldChipActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    fieldChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
    },
    fieldChipTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    dateSelectorScroll: {
        gap: 8,
        paddingBottom: 14,
    },
    dateCard: {
        width: 60,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        paddingVertical: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#eceef0',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 4,
    },
    dateCardActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    dateWeekday: {
        fontSize: 10,
        fontWeight: '700',
        color: '#6b7280',
        textTransform: 'uppercase',
    },
    dateWeekdayActive: {
        color: '#dcfce7',
    },
    dateDayNum: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        marginVertical: 2,
    },
    dateDayNumActive: {
        color: '#ffffff',
    },
    dateIndicator: {
        backgroundColor: '#f2f4f6',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 9999,
    },
    dateIndicatorToday: {
        backgroundColor: '#dcfce7',
    },
    dateIndicatorActive: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    dateIndicatorText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#6b7280',
    },
    dateIndicatorTextActive: {
        color: '#ffffff',
    },
    listHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
        marginBottom: 10,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#006b2c',
    },
    liveText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#006b2c',
    },
    centerBox: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    centerText: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 8,
    },
    emptyBox: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#eceef0',
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
        marginTop: 10,
    },
    emptySub: {
        fontSize: 12,
        color: '#6b7280',
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 12,
    },
    emptyGenBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#006b2c',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },
    emptyGenBtnText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },
    slotsGrid: {
        gap: 10,
    },
    slotCard: {
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
    slotCardPrime: {
        borderColor: '#fde68a',
        backgroundColor: '#fffdfa',
    },
    slotCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    slotTimeGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    slotTimeText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#111827',
    },
    primeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#fef3c7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    primeBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#b45309',
    },
    standardBadge: {
        backgroundColor: '#f2f4f6',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    standardBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#6b7280',
    },
    slotPriceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
        marginBottom: 8,
    },
    slotPriceNum: {
        fontSize: 16,
        fontWeight: '800',
        color: '#006b2c',
    },
    slotUnit: {
        fontSize: 11,
        color: '#6b7280',
    },
    ledNote: {
        fontSize: 11,
        color: '#b45309',
        fontWeight: '600',
        marginLeft: 4,
    },
    slotCardBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f8fafc',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    badgeAvail: {
        backgroundColor: '#dcfce7',
    },
    badgeBooked: {
        backgroundColor: '#dbeafe',
    },
    badgeLocked: {
        backgroundColor: '#ffedd5',
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    textAvail: {
        color: '#15803d',
    },
    textBooked: {
        color: '#1d4ed8',
    },
    textLocked: {
        color: '#c2410c',
    },
    slotActionIcons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionIconBtn: {
        width: 28,
        height: 28,
        borderRadius: 7,
        backgroundColor: '#f2f4f6',
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
    modalBoxLarge: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 18,
        width: '100%',
        maxWidth: 540,
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 16,
    },
    modalCardWrapper: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 18,
        width: '100%',
        maxWidth: 460,
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f2f4f6',
        marginBottom: 10,
    },
    modalSubTitle: {
        fontSize: 10,
        fontWeight: '800',
        color: '#006b2c',
        letterSpacing: 0.5,
    },
    modalMainTitle: {
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
    sectionHeaderLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#374151',
        marginBottom: 6,
        marginTop: 8,
    },
    fieldSelectPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 9999,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#eceef0',
        marginRight: 6,
    },
    fieldSelectPillActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    fieldSelectPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
    },
    fieldSelectPillTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    daysSelectorRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    daysPill: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#eceef0',
        alignItems: 'center',
    },
    daysPillActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    daysPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
    },
    daysPillTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    quickTextBtn: {
        fontSize: 11,
        color: '#006b2c',
        fontWeight: '700',
    },
    bulkPriceRow: {
        flexDirection: 'row',
        gap: 8,
        marginVertical: 8,
    },
    bulkPriceInput: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#eceef0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        fontSize: 12,
        color: '#111827',
    },
    bulkPriceBtn: {
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#dcfce7',
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bulkPriceBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#006b2c',
    },
    slotConfigsList: {
        gap: 6,
    },
    configRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#eceef0',
    },
    configSlotLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
    },
    configSessionText: {
        fontSize: 10,
        color: '#6b7280',
    },
    configPriceInput: {
        width: 80,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#eceef0',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        fontSize: 11,
        textAlign: 'right',
        color: '#111827',
    },
    dateRangeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f0f9ff',
        borderWidth: 1,
        borderColor: '#bae6fd',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        marginBottom: 6,
    },
    dateRangeText: {
        fontSize: 11,
        color: '#0369a1',
        flex: 1,
    },
    infoAlertBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        marginBottom: 8,
    },
    infoAlertText: {
        fontSize: 10.5,
        color: '#64748b',
        flex: 1,
    },
    genSlotsHint: {
        fontSize: 10.5,
        color: '#64748b',
        marginTop: 1,
    },
    quickActionSmallBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
    },
    quickActionSmallText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#111827',
    },
    bulkPriceContainer: {
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 10,
        marginVertical: 8,
    },
    bulkPriceHeaderTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 6,
    },
    quickPriceChip: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 9999,
        marginRight: 6,
    },
    quickPriceChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#006b2c',
    },
    sessionTag: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginTop: 2,
    },
    sessionTagText: {
        fontSize: 9,
        fontWeight: '700',
    },
    configPriceWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    configCurrencyUnit: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
    },
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        padding: 10,
        borderRadius: 10,
        marginTop: 10,
    },
    summaryText: {
        fontSize: 11,
        color: '#166534',
        lineHeight: 16,
    },
    summarySubText: {
        fontSize: 10,
        color: '#15803d',
        marginTop: 2,
    },
    genResultBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 10,
        marginTop: 10,
        gap: 6,
    },
    genResultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    genResultText: {
        fontSize: 11.5,
        color: '#15803d',
    },
    modalFooter: {
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
});
