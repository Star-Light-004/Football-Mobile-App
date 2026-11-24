import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { getTimeslotsByFieldApi } from '../api/timeslotsApi';
import { getServicesApi } from '../api/servicesApi';
import { validateVoucherApi } from '../api/vouchersApi';
import { createBookingApi } from '../api/bookingsApi';
import { getFieldsApi } from '../api/fieldsApi';

const generateUpcomingDays = () => {
    const days = [];
    const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        days.push({
            dateStr,
            dayNum: dd,
            monthNum: mm,
            weekday: weekdays[d.getDay()],
            isToday: i === 0,
        });
    }
    return days;
};

export default function BookingScreen({ route, navigation }) {
    const initialField = route.params?.field || null;
    const [field, setField] = useState(initialField);
    const [availableFields, setAvailableFields] = useState([]);
    const { user } = useContext(AuthContext);

    // Fallback load fields if not passed
    useEffect(() => {
        if (!field?.id) {
            getFieldsApi().then(res => {
                const list = res?.fields || res?.results || (Array.isArray(res) ? res : []);
                setAvailableFields(list);
                if (list.length > 0) setField(list[0]);
            }).catch(() => {});
        }
    }, [field?.id]);

    const upcomingDays = generateUpcomingDays();
    const [selectedDate, setSelectedDate] = useState(upcomingDays[0].dateStr);

    const [slots, setSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedSlots, setSelectedSlots] = useState([]);

    const [services, setServices] = useState([]);
    const [selectedServices, setSelectedServices] = useState({});

    const [voucherCode, setVoucherCode] = useState('');
    const [voucherDiscount, setVoucherDiscount] = useState(0);
    const [voucherApplied, setVoucherApplied] = useState(false);
    const [validatingVoucher, setValidatingVoucher] = useState(false);

    const [customerName, setCustomerName] = useState(user?.full_name || user?.name || '');
    const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
    const [notes, setNotes] = useState('');

    const [submitting, setSubmitting] = useState(false);

    // Tải khung giờ theo ngày
    useEffect(() => {
        const fetchSlots = async () => {
            if (!field?.id) return;
            setLoadingSlots(true);
            setSelectedSlots([]);
            try {
                const data = await getTimeslotsByFieldApi(field.id, selectedDate);
                setSlots(Array.isArray(data) ? data : []);
            } catch (err) {
                console.warn('Lỗi lấy khung giờ:', err);
                setSlots([]);
            } finally {
                setLoadingSlots(false);
            }
        };
        fetchSlots();
    }, [field?.id, selectedDate]);

    // Tải danh mục dịch vụ
    useEffect(() => {
        const fetchServices = async () => {
            try {
                const data = await getServicesApi();
                setServices(Array.isArray(data) ? data : []);
            } catch (err) {
                console.warn('Lỗi lấy dịch vụ:', err);
            }
        };
        fetchServices();
    }, []);

    const toggleSlot = (slot) => {
        if (slot.status === 'booked' || slot.status === 'locked') {
            Alert.alert('Khung giờ đã kín', 'Khung giờ này đã được đội bóng khác đặt cọc giữ chỗ.');
            return;
        }

        const isSelected = selectedSlots.some(s => s.id === slot.id);
        if (isSelected) {
            setSelectedSlots(selectedSlots.filter(s => s.id !== slot.id));
        } else {
            if (selectedSlots.length >= 3) {
                Alert.alert('Giới hạn', 'Bạn chỉ có thể đặt tối đa 3 khung giờ trong một đơn.');
                return;
            }
            setSelectedSlots([...selectedSlots, slot]);
        }
    };

    const toggleService = (srv) => {
        setSelectedServices(prev => {
            const next = { ...prev };
            if (next[srv.id]) {
                delete next[srv.id];
            } else {
                next[srv.id] = { ...srv, quantity: 1 };
            }
            return next;
        });
    };

    const handleApplyVoucher = async () => {
        if (!voucherCode.trim()) {
            Alert.alert('Lỗi', 'Vui lòng nhập mã giảm giá');
            return;
        }
        setValidatingVoucher(true);
        try {
            const rawFieldPrice = selectedSlots.reduce((sum, s) => sum + Number(s.price || 0), 0);
            const res = await validateVoucherApi(voucherCode.trim().toUpperCase(), rawFieldPrice);
            const discount = Number(res.discount_amount || res.discount || 0);
            setVoucherDiscount(discount);
            setVoucherApplied(true);
            Alert.alert('Áp dụng thành công', `Đã giảm ${new Intl.NumberFormat('vi-VN').format(discount)}đ vào hóa đơn!`);
        } catch (e) {
            Alert.alert('Không hợp lệ', e.error || e.message || 'Mã giảm giá không áp dụng được cho đơn này.');
            setVoucherDiscount(0);
            setVoucherApplied(false);
        } finally {
            setValidatingVoucher(false);
        }
    };

    const totalSlotPrice = selectedSlots.reduce((sum, s) => sum + Number(s.price || 0), 0);
    const totalServicePrice = Object.values(selectedServices).reduce((sum, s) => sum + (Number(s.price || 0) * (s.quantity || 1)), 0);
    const finalTotal = Math.max(0, totalSlotPrice + totalServicePrice - voucherDiscount);
    const deposit50 = Math.round(finalTotal * 0.5);

    const handleSubmitBooking = async () => {
        if (selectedSlots.length === 0) {
            Alert.alert('Chưa chọn giờ', 'Vui lòng chọn ít nhất một khung giờ thi đấu.');
            return;
        }
        if (!customerName.trim()) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ tên người đặt.');
            return;
        }
        if (!customerPhone.trim() || customerPhone.trim().length < 9) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập số điện thoại liên hệ hợp lệ.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                field_id: field?.id,
                booking_date: selectedDate,
                customer_name: customerName.trim(),
                name: customerName.trim(),
                guest_name: customerName.trim(),
                phone: customerPhone.trim(),
                guest_phone: customerPhone.trim(),
                slots: selectedSlots.map(s => ({
                    start_time: s.start_time?.slice(0, 5),
                    end_time: s.end_time?.slice(0, 5),
                    price: Number(s.price || 0)
                })),
                time_slots: selectedSlots.map(s => ({
                    start_time: s.start_time?.slice(0, 5),
                    end_time: s.end_time?.slice(0, 5),
                    price: Number(s.price || 0)
                })),
                timeslot_ids: selectedSlots.map(s => s.id),
                time_slot_id: selectedSlots[0]?.id,
                start_time: selectedSlots[0]?.start_time?.slice(0, 5),
                end_time: selectedSlots[selectedSlots.length - 1]?.end_time?.slice(0, 5),
                services: Object.values(selectedServices).map(s => ({
                    service_id: s.id,
                    quantity: s.quantity || 1
                })),
                voucher_code: voucherApplied ? voucherCode.trim().toUpperCase() : '',
                total_price: finalTotal,
                notes: notes.trim(),
                customer_id: user?.id || null
            };

            const res = await createBookingApi(payload);
            const bookingId = res.booking_id || res.id;

            navigation.navigate('Payment', {
                bookingId: bookingId,
                amount: deposit50,
                fullAmount: finalTotal,
                field: field,
            });
        } catch (err) {
            const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Lỗi đặt sân';
            Alert.alert('Đặt sân thất bại', msg);
        } finally {
            setSubmitting(false);
        }
    };

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN').format(p);

    // Group slots into shifts
    const morningSlots = slots.filter(s => {
        const hour = parseInt(String(s.start_time || '').split(':')[0], 10);
        return hour < 16;
    });
    const afternoonSlots = slots.filter(s => {
        const hour = parseInt(String(s.start_time || '').split(':')[0], 10);
        return hour >= 16 && hour < 19;
    });
    const eveningSlots = slots.filter(s => {
        const hour = parseInt(String(s.start_time || '').split(':')[0], 10);
        return hour >= 19;
    });

    const renderSlotCard = (slot) => {
        const isSelected = selectedSlots.some(s => s.id === slot.id);
        const isBooked = slot.status === 'booked' || slot.status === 'locked';
        const isPrime = Boolean(slot.is_prime || slot.is_peak);
        const timeDisplay = `${slot.start_time?.slice(0, 5)} - ${slot.end_time?.slice(0, 5)}`;
        const slotPrice = Number(slot.price || field?.price_per_hour || 0);

        if (isBooked) {
            return (
                <View key={slot.id} style={styles.slotLockedCard}>
                    <Text style={styles.slotTimeLocked}>{timeDisplay}</Text>
                    <View style={styles.slotLockedRow}>
                        <Ionicons name="lock-closed" size={13} color="#9ca3af" />
                        <Text style={styles.slotLockedText}>Đã đặt</Text>
                    </View>
                </View>
            );
        }

        if (isSelected) {
            return (
                <TouchableOpacity
                    key={slot.id}
                    style={styles.slotActiveCard}
                    onPress={() => toggleSlot(slot)}
                    activeOpacity={0.8}
                >
                    {isPrime && (
                        <View style={styles.activePrimeTag}>
                            <Text style={styles.activePrimeTagText}>🔥 Giờ vàng</Text>
                        </View>
                    )}
                    <View style={styles.slotActiveHeader}>
                        <Text style={styles.slotTimeActive}>{timeDisplay}</Text>
                        <Ionicons name="checkmark-circle" size={18} color="#006b2c" />
                    </View>
                    <View style={styles.slotActiveFooter}>
                        <Text style={styles.slotDurationActive}>90 phút</Text>
                        <Text style={styles.slotPriceActive}>{formatPrice(slotPrice)}đ</Text>
                    </View>
                </TouchableOpacity>
            );
        }

        return (
            <TouchableOpacity
                key={slot.id}
                style={styles.slotNormalCard}
                onPress={() => toggleSlot(slot)}
                activeOpacity={0.8}
            >
                <View style={styles.slotNormalHeader}>
                    <Text style={styles.slotTimeNormal}>{timeDisplay}</Text>
                    <Ionicons name="ellipse-outline" size={16} color="#9ca3af" />
                </View>
                <View style={styles.slotNormalFooter}>
                    <Text style={styles.slotDurationNormal}>90 phút</Text>
                    <Text style={styles.slotPriceNormal}>{formatPrice(slotPrice)}đ</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* 1. TOP APP BAR */}
            <View style={styles.topBar}>
                <View style={styles.brandRow}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => {
                            if (navigation.canGoBack()) navigation.goBack();
                            else navigation.navigate('Fields');
                        }}
                    >
                        <Ionicons name="chevron-back" size={22} color="#111827" />
                    </TouchableOpacity>
                    <View style={styles.brandTextGroup}>
                        <Text style={styles.brandSub}>SÂN BÓNG HẢI CHÂU</Text>
                        <Text style={styles.brandTitle}>Đặt Sân</Text>
                    </View>
                </View>

                <View style={styles.topRightActions}>
                    <TouchableOpacity
                        style={styles.notifBtn}
                        onPress={() => navigation.navigate('Contact')}
                    >
                        <Ionicons name="notifications-outline" size={22} color="#111827" />
                        <View style={styles.notifDot} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.avatarBtn}
                        onPress={() => navigation.navigate(user ? 'ProfileTab' : 'Login')}
                    >
                        <Ionicons name="person" size={18} color="#006b2c" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* 2. VENUE HEADER BRIEF CARD */}
                <View style={styles.venueBriefCard}>
                    <View style={styles.venueBriefLeft}>
                        <View style={styles.venueBadgesRow}>
                            <View style={styles.venueTypeBadge}>
                                <Ionicons name="checkmark-circle" size={13} color="#006b2c" />
                                <Text style={styles.venueTypeBadgeText}>
                                    {field?.field_type_name || field?.field_type?.name || 'Sân 7 người'}
                                </Text>
                            </View>
                            <View style={styles.venueVipBadge}>
                                <Ionicons name="star" size={12} color="#b45309" />
                                <Text style={styles.venueVipBadgeText}>VIP Tiêu Chuẩn</Text>
                            </View>
                        </View>

                        <Text style={styles.venueName} numberOfLines={1}>
                            {field?.name || field?.field_name || 'Sân bóng đá'}
                        </Text>
                        <View style={styles.venueAddrRow}>
                            <Ionicons name="location-outline" size={14} color="#006b2c" />
                            <Text style={styles.venueAddrText} numberOfLines={1}>
                                {field?.address || field?.location || 'Đà Nẵng'}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.venueInfoBtn}
                        onPress={() => navigation.navigate('FieldDetail', { fieldId: field?.id })}
                    >
                        <Ionicons name="information-circle-outline" size={22} color="#6b7280" />
                    </TouchableOpacity>
                </View>

                {/* 3. HORIZONTAL DATE PICKER */}
                <View style={styles.datePickerSection}>
                    <View style={styles.sectionHeaderRow}>
                        <View style={styles.sectionHeaderTitleGroup}>
                            <Ionicons name="calendar-outline" size={18} color="#006b2c" />
                            <Text style={styles.sectionHeaderTitle}>Chọn ngày thi đấu</Text>
                        </View>
                        <Text style={styles.monthLabelText}>
                            Tháng {upcomingDays[0].monthNum}/{new Date().getFullYear()}
                        </Text>
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.dateStripContent}
                        style={styles.dateStripScroll}
                    >
                        {upcomingDays.map((d) => {
                            const isSelected = selectedDate === d.dateStr;
                            return (
                                <TouchableOpacity
                                    key={d.dateStr}
                                    style={[
                                        styles.dateStripBtn,
                                        isSelected && styles.dateStripBtnActive
                                    ]}
                                    onPress={() => setSelectedDate(d.dateStr)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[
                                        styles.dateWeekdayText,
                                        isSelected && styles.dateWeekdayTextActive
                                    ]}>
                                        {d.isToday ? 'Hôm nay' : d.weekday}
                                    </Text>
                                    <Text style={[
                                        styles.dateNumberText,
                                        isSelected && styles.dateNumberTextActive
                                    ]}>
                                        {d.dayNum}
                                    </Text>
                                    <View style={[
                                        styles.dateDotIndicator,
                                        isSelected && styles.dateDotIndicatorActive
                                    ]} />
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* 4. TIMESLOTS SECTION (3 CA) */}
                <View style={styles.slotsSection}>
                    <View style={styles.sectionHeaderRow}>
                        <View style={styles.sectionHeaderTitleGroup}>
                            <Ionicons name="time-outline" size={18} color="#006b2c" />
                            <Text style={styles.sectionHeaderTitle}>Khung giờ thi đấu</Text>
                        </View>
                        <View style={styles.slotsLegend}>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#006b2c' }]} />
                                <Text style={styles.legendLabel}>Đang chọn</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#cbd5e1' }]} />
                                <Text style={styles.legendLabel}>Đã đặt</Text>
                            </View>
                        </View>
                    </View>

                    {loadingSlots ? (
                        <View style={{ padding: 24, alignItems: 'center' }}>
                            <ActivityIndicator size="small" color="#006b2c" />
                            <Text style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>Đang tải khung giờ...</Text>
                        </View>
                    ) : (
                        <View style={{ gap: 12 }}>
                            {/* Ca 1: Sáng */}
                            {morningSlots.length > 0 && (
                                <View style={styles.shiftContainerCard}>
                                    <View style={styles.shiftHeaderRow}>
                                        <View style={styles.shiftHeaderLeft}>
                                            <Ionicons name="sunny-outline" size={16} color="#f59e0b" />
                                            <Text style={styles.shiftHeaderTitle}>Ca sáng (06:00 - 16:00)</Text>
                                        </View>
                                        <Text style={styles.shiftSubBadge}>Giá tiết kiệm</Text>
                                    </View>
                                    <View style={styles.slotsGrid}>
                                        {morningSlots.map(renderSlotCard)}
                                    </View>
                                </View>
                            )}

                            {/* Ca 2: Chiều Vàng Prime */}
                            {afternoonSlots.length > 0 && (
                                <View style={styles.shiftContainerCard}>
                                    <View style={styles.shiftHeaderRow}>
                                        <View style={styles.shiftHeaderLeft}>
                                            <Ionicons name="flame" size={16} color="#b45309" />
                                            <Text style={styles.shiftHeaderTitle}>Ca chiều vàng (16:00 - 18:30)</Text>
                                        </View>
                                        <View style={styles.primeHeaderBadge}>
                                            <Ionicons name="flame" size={12} color="#b45309" />
                                            <Text style={styles.primeHeaderBadgeText}>Giờ Prime</Text>
                                        </View>
                                    </View>
                                    <View style={styles.slotsGrid}>
                                        {afternoonSlots.map(renderSlotCard)}
                                    </View>
                                </View>
                            )}

                            {/* Ca 3: Tối Đèn LED */}
                            {eveningSlots.length > 0 && (
                                <View style={styles.shiftContainerCard}>
                                    <View style={styles.shiftHeaderRow}>
                                        <View style={styles.shiftHeaderLeft}>
                                            <Ionicons name="moon-outline" size={16} color="#6366f1" />
                                            <Text style={styles.shiftHeaderTitle}>Ca tối đèn cao áp (19:00 - 23:00)</Text>
                                        </View>
                                        <Text style={styles.shiftSubBadge}>Đèn LED Pro</Text>
                                    </View>
                                    <View style={styles.slotsGrid}>
                                        {eveningSlots.map(renderSlotCard)}
                                    </View>
                                </View>
                            )}

                            {slots.length === 0 && (
                                <View style={styles.noSlotsCard}>
                                    <Text style={styles.noSlotsText}>Không có khung giờ nào trong ngày này.</Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>

                {/* 5. ADD-ON SERVICES */}
                <View style={styles.addOnSection}>
                    <View style={styles.sectionHeaderTitleGroup}>
                        <Ionicons name="football-outline" size={18} color="#006b2c" />
                        <Text style={styles.sectionHeaderTitle}>Dịch vụ tiện ích thêm</Text>
                    </View>

                    <View style={styles.servicesList}>
                        {services.map(srv => {
                            const isChecked = !!selectedServices[srv.id];
                            return (
                                <TouchableOpacity
                                    key={srv.id}
                                    style={[
                                        styles.serviceCard,
                                        isChecked && styles.serviceCardActive
                                    ]}
                                    onPress={() => toggleService(srv)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.serviceLeft}>
                                        <View style={[
                                            styles.serviceIconWrap,
                                            isChecked && styles.serviceIconWrapActive
                                        ]}>
                                            <Ionicons
                                                name="water-outline"
                                                size={20}
                                                color={isChecked ? '#006b2c' : '#6b7280'}
                                            />
                                        </View>
                                        <View style={styles.serviceTextGroup}>
                                            <View style={styles.serviceTitleRow}>
                                                <Text style={styles.serviceTitle}>{srv.name || srv.service_name}</Text>
                                                {isChecked && (
                                                    <View style={styles.serviceCheckedBadge}>
                                                        <Text style={styles.serviceCheckedBadgeText}>Đã chọn</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.serviceDesc} numberOfLines={1}>
                                                {srv.description || 'Ướp lạnh sẵn sàng khi nhận sân'}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.serviceRight}>
                                        <Text style={[
                                            styles.servicePriceText,
                                            isChecked && styles.servicePriceTextActive
                                        ]}>
                                            +{formatPrice(srv.price || 0)}đ
                                        </Text>
                                        <View style={[
                                            styles.checkboxBox,
                                            isChecked && styles.checkboxBoxActive
                                        ]}>
                                            {isChecked && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* 6. PROMO CODE BOX */}
                <View style={styles.voucherCard}>
                    <View style={styles.voucherHeader}>
                        <View style={styles.voucherHeaderLeft}>
                            <Ionicons name="pricetag-outline" size={18} color="#006b2c" />
                            <Text style={styles.voucherTitle}>Mã ưu đãi / Voucher</Text>
                        </View>
                        {voucherApplied && (
                            <View style={styles.voucherAppliedBadge}>
                                <Text style={styles.voucherAppliedBadgeText}>Đã áp dụng</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.voucherInputRow}>
                        <View style={styles.voucherInputWrap}>
                            <TextInput
                                style={styles.voucherTextInput}
                                placeholder="NHẬP MÃ GIẢM GIÁ (VD: VIETQR20)"
                                placeholderTextColor="#9ca3af"
                                value={voucherCode}
                                onChangeText={setVoucherCode}
                                autoCapitalize="characters"
                                editable={!voucherApplied}
                            />
                            {voucherApplied && (
                                <Ionicons name="checkmark-circle" size={18} color="#006b2c" style={styles.voucherValidIcon} />
                            )}
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.voucherApplyBtn,
                                voucherApplied && { backgroundColor: '#6b7280' }
                            ]}
                            onPress={voucherApplied ? () => {
                                setVoucherApplied(false);
                                setVoucherDiscount(0);
                                setVoucherCode('');
                            } : handleApplyVoucher}
                            disabled={validatingVoucher}
                        >
                            {validatingVoucher ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <Text style={styles.voucherApplyBtnText}>
                                    {voucherApplied ? 'Hủy bỏ' : 'Áp dụng'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {voucherApplied ? (
                        <Text style={styles.voucherSuccessMsg}>
                            ✓ Đã trừ {formatPrice(voucherDiscount)}đ vào hóa đơn thanh toán
                        </Text>
                    ) : null}
                </View>

                {/* 7. CUSTOMER INFORMATION FORM */}
                <View style={styles.customerCard}>
                    <Text style={styles.customerCardTitle}>Thông tin người đặt</Text>
                    <View style={styles.customerInputGroup}>
                        <Text style={styles.inputLabel}>Họ và tên <Text style={{ color: '#dc2626' }}>*</Text></Text>
                        <TextInput
                            style={styles.textInputBox}
                            placeholder="Nguyễn Văn A"
                            placeholderTextColor="#9ca3af"
                            value={customerName}
                            onChangeText={setCustomerName}
                        />
                    </View>
                    <View style={styles.customerInputGroup}>
                        <Text style={styles.inputLabel}>Số điện thoại <Text style={{ color: '#dc2626' }}>*</Text></Text>
                        <TextInput
                            style={styles.textInputBox}
                            placeholder="0905 123 456"
                            placeholderTextColor="#9ca3af"
                            keyboardType="phone-pad"
                            value={customerPhone}
                            onChangeText={setCustomerPhone}
                        />
                    </View>
                    <View style={styles.customerInputGroup}>
                        <Text style={styles.inputLabel}>Ghi chú cho quản lý sân (tùy chọn)</Text>
                        <TextInput
                            style={[styles.textInputBox, { height: 60 }]}
                            placeholder="VD: Cần mượn áo bib phân đội..."
                            placeholderTextColor="#9ca3af"
                            multiline
                            value={notes}
                            onChangeText={setNotes}
                        />
                    </View>
                </View>

                {/* 8. ORDER SUMMARY CARD */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryHeader}>
                        <View style={styles.summaryHeaderLeft}>
                            <Ionicons name="receipt-outline" size={20} color="#006b2c" />
                            <Text style={styles.summaryTitle}>Chi tiết thanh toán</Text>
                        </View>
                        <View style={styles.summaryCodeBadge}>
                            <Text style={styles.summaryCodeText}>ID: BK-{Date.now().toString().slice(-4)}</Text>
                        </View>
                    </View>

                    <View style={styles.summaryLedger}>
                        <View style={styles.ledgerRow}>
                            <Text style={styles.ledgerLabel}>
                                Tiền thuê sân ({selectedSlots.length} ca):
                            </Text>
                            <Text style={styles.ledgerVal}>{formatPrice(totalSlotPrice)}đ</Text>
                        </View>

                        {totalServicePrice > 0 && (
                            <View style={styles.ledgerRow}>
                                <Text style={styles.ledgerLabel}>Dịch vụ tiện ích thêm:</Text>
                                <Text style={styles.ledgerVal}>+{formatPrice(totalServicePrice)}đ</Text>
                            </View>
                        )}

                        {voucherDiscount > 0 && (
                            <View style={styles.ledgerRow}>
                                <Text style={[styles.ledgerLabel, { color: '#15803d' }]}>
                                    Giảm giá voucher:
                                </Text>
                                <Text style={[styles.ledgerVal, { color: '#15803d', fontWeight: '700' }]}>
                                    -{formatPrice(voucherDiscount)}đ
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Dashed Perforated Separator */}
                    <View style={styles.summaryDashedLine} />

                    <View style={styles.summaryTotalRow}>
                        <Text style={styles.summaryTotalLabel}>Tổng hóa đơn:</Text>
                        <Text style={styles.summaryTotalVal}>{formatPrice(finalTotal)}đ</Text>
                    </View>

                    {/* Deposit Highlight Card */}
                    <View style={styles.depositHighlightCard}>
                        <View style={styles.depositLeft}>
                            <Text style={styles.depositTitle}>TIỀN CỌC GIỮ SÂN (50%)</Text>
                            <Text style={styles.depositSub}>Thanh toán ngay qua VietQR</Text>
                        </View>
                        <Text style={styles.depositAmount}>{formatPrice(deposit50)}đ</Text>
                    </View>
                </View>
            </ScrollView>

            {/* 9. STICKY BOTTOM TASKBAR */}
            <View style={styles.bottomTaskbar}>
                <View style={styles.bottomLeft}>
                    <Text style={styles.bottomCọcLabel}>Cần cọc ngay</Text>
                    <Text style={styles.bottomCọcAmount}>{formatPrice(deposit50)}đ</Text>
                </View>

                <TouchableOpacity
                    style={styles.bottomSubmitBtn}
                    onPress={handleSubmitBooking}
                    disabled={submitting}
                    activeOpacity={0.9}
                >
                    {submitting ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                        <>
                            <Text style={styles.bottomSubmitBtnText}>Tiến hành cọc & Giữ chỗ</Text>
                            <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f7f9fb',
    },
    scrollContent: {
        paddingBottom: 110,
    },
    // Top Bar
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#eceef0',
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },
    brandTextGroup: {
        marginLeft: 2,
    },
    brandSub: {
        fontSize: 10,
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
    topRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    notifBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
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
    avatarBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#f0fdf4',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#dcfce7',
    },
    // Venue Brief
    venueBriefCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 12,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    venueBriefLeft: {
        flex: 1,
        paddingRight: 8,
    },
    venueBadgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    venueTypeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
        gap: 3,
    },
    venueTypeBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#006b2c',
    },
    venueVipBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef3c7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
        gap: 3,
    },
    venueVipBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#b45309',
    },
    venueName: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
    },
    venueAddrRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 3,
    },
    venueAddrText: {
        fontSize: 12,
        color: '#6b7280',
        flexShrink: 1,
    },
    venueInfoBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Date Picker
    datePickerSection: {
        marginTop: 16,
        paddingHorizontal: 16,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    sectionHeaderTitleGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sectionHeaderTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    monthLabelText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#006b2c',
    },
    dateStripScroll: {
        marginHorizontal: -16,
    },
    dateStripContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    dateStripBtn: {
        width: 58,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    dateStripBtnActive: {
        backgroundColor: '#006b2c',
        shadowColor: '#006b2c',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    dateWeekdayText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6b7280',
    },
    dateWeekdayTextActive: {
        color: '#f0fdf4',
    },
    dateNumberText: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        marginTop: 2,
    },
    dateNumberTextActive: {
        color: '#ffffff',
    },
    dateDotIndicator: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'transparent',
        marginTop: 4,
    },
    dateDotIndicatorActive: {
        backgroundColor: '#7ffc97',
    },
    // Slots Section
    slotsSection: {
        marginTop: 18,
        paddingHorizontal: 16,
    },
    slotsLegend: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendLabel: {
        fontSize: 11,
        color: '#6b7280',
    },
    shiftContainerCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    shiftHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        marginBottom: 10,
    },
    shiftHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    shiftHeaderTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    shiftSubBadge: {
        fontSize: 11,
        fontWeight: '600',
        color: '#006b2c',
    },
    primeHeaderBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef3c7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 9999,
        gap: 3,
    },
    primeHeaderBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#b45309',
    },
    slotsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    slotLockedCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        padding: 10,
        opacity: 0.65,
    },
    slotTimeLocked: {
        fontSize: 13,
        color: '#6b7280',
        textDecorationLine: 'line-through',
    },
    slotLockedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
    },
    slotLockedText: {
        fontSize: 11,
        color: '#9ca3af',
    },
    slotActiveCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#f0fdf4',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1.5,
        borderColor: '#006b2c',
        position: 'relative',
    },
    activePrimeTag: {
        position: 'absolute',
        top: -8,
        right: 8,
        backgroundColor: '#fef3c7',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 9999,
    },
    activePrimeTagText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#b45309',
    },
    slotActiveHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    slotTimeActive: {
        fontSize: 13,
        fontWeight: '800',
        color: '#006b2c',
    },
    slotActiveFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
    },
    slotDurationActive: {
        fontSize: 11,
        color: '#055b35',
        fontWeight: '500',
    },
    slotPriceActive: {
        fontSize: 14,
        fontWeight: '800',
        color: '#006b2c',
    },
    slotNormalCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#f2f4f6',
        borderRadius: 10,
        padding: 10,
    },
    slotNormalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    slotTimeNormal: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
    },
    slotNormalFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
    },
    slotDurationNormal: {
        fontSize: 11,
        color: '#6b7280',
    },
    slotPriceNormal: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    noSlotsCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 20,
        alignItems: 'center',
    },
    noSlotsText: {
        fontSize: 13,
        color: '#6b7280',
    },
    // Add-on Services
    addOnSection: {
        marginTop: 18,
        paddingHorizontal: 16,
    },
    servicesList: {
        gap: 8,
        marginTop: 10,
    },
    serviceCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    serviceCardActive: {
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#dcfce7',
    },
    serviceLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    serviceIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    serviceIconWrapActive: {
        backgroundColor: '#dcfce7',
    },
    serviceTextGroup: {
        flex: 1,
    },
    serviceTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    serviceTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    serviceCheckedBadge: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 9999,
    },
    serviceCheckedBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#15803d',
    },
    serviceDesc: {
        fontSize: 11,
        color: '#6b7280',
        marginTop: 2,
    },
    serviceRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    servicePriceText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    servicePriceTextActive: {
        color: '#006b2c',
    },
    checkboxBox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#bdcaba',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxBoxActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    // Voucher Card
    voucherCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 18,
        padding: 14,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
        gap: 10,
    },
    voucherHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    voucherHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    voucherTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    voucherAppliedBadge: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 9999,
    },
    voucherAppliedBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#15803d',
    },
    voucherInputRow: {
        flexDirection: 'row',
        gap: 8,
    },
    voucherInputWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f2f4f6',
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 42,
    },
    voucherTextInput: {
        flex: 1,
        fontSize: 13,
        fontWeight: '700',
        color: '#006b2c',
    },
    voucherValidIcon: {
        marginLeft: 6,
    },
    voucherApplyBtn: {
        backgroundColor: '#006b2c',
        paddingHorizontal: 16,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    voucherApplyBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },
    voucherSuccessMsg: {
        fontSize: 12,
        color: '#15803d',
        fontWeight: '600',
    },
    // Customer Card
    customerCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 18,
        padding: 14,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
        gap: 10,
    },
    customerCardTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    customerInputGroup: {
        gap: 4,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
    },
    textInputBox: {
        backgroundColor: '#f2f4f6',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        color: '#111827',
    },
    // Summary Card
    summaryCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 18,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
        gap: 10,
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    summaryHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    summaryTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    summaryCodeBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    summaryCodeText: {
        fontSize: 11,
        color: '#6b7280',
        fontWeight: '600',
    },
    summaryLedger: {
        gap: 6,
        marginTop: 4,
    },
    ledgerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    ledgerLabel: {
        fontSize: 13,
        color: '#6b7280',
    },
    ledgerVal: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    summaryDashedLine: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        marginVertical: 4,
    },
    summaryTotalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    summaryTotalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    summaryTotalVal: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
    },
    depositHighlightCard: {
        backgroundColor: '#f0fdf4',
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
        borderWidth: 1,
        borderColor: '#dcfce7',
    },
    depositLeft: {
        gap: 2,
    },
    depositTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: '#006b2c',
        letterSpacing: 0.5,
    },
    depositSub: {
        fontSize: 11,
        color: '#6b7280',
    },
    depositAmount: {
        fontSize: 20,
        fontWeight: '900',
        color: '#006b2c',
    },
    // Bottom Taskbar
    bottomTaskbar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 76,
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 8,
    },
    bottomLeft: {
        flexDirection: 'column',
    },
    bottomCọcLabel: {
        fontSize: 11,
        color: '#6b7280',
    },
    bottomCọcAmount: {
        fontSize: 18,
        fontWeight: '900',
        color: '#006b2c',
    },
    bottomSubmitBtn: {
        flex: 1,
        marginLeft: 16,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#006b2c',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#006b2c',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
        elevation: 4,
    },
    bottomSubmitBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
});
