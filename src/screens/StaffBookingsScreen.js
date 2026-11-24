import React, { useState, useEffect, useMemo, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    RefreshControl,
    SafeAreaView,
    Modal,
    ScrollView,
    Linking,
    Platform
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../context/AuthContext';
import { getBookingsApi, updateBookingStatusApi, updateBookingApi, deleteBookingApi, createBookingApi } from '../api/bookingsApi';
import { getFieldsApi } from '../api/fieldsApi';
import {
    getLostFoundItemsApi,
    createLostFoundItemApi,
    updateLostFoundStatusApi,
    deleteLostFoundItemApi,
    getCleaningLogsApi,
    createCleaningLogApi,
    getMaintenanceIssuesApi,
    createMaintenanceIssueApi
} from '../api/facilityApi';
import { getServicesApi, getBookingServicesApi } from '../api/servicesApi';
import { getTimeslotsByFieldApi } from '../api/timeslotsApi';
import AdminBottomNav from '../components/AdminBottomNav';
import AppConfirmDialog from '../components/AppConfirmDialog';

// Standard fixed time slots in the system
const PRESET_TIME_SLOTS = [
    '06:00 - 07:00',
    '07:00 - 08:00',
    '08:00 - 09:00',
    '09:00 - 10:00',
    '15:00 - 16:00',
    '16:00 - 17:00',
    '17:00 - 18:00',
    '17:30 - 19:00',
    '18:00 - 19:00',
    '19:00 - 20:00',
    '20:00 - 21:00',
    '21:00 - 22:00'
];

export default function StaffBookingsScreen({ route, navigation }) {
    const { user } = useContext(AuthContext);
    const userRole = String(user?.role || 'admin').toLowerCase();
    const isAdmin = ['admin', 'field_owner', 'field_manager'].includes(userRole);

    const [bookings, setBookings] = useState([]);
    const [fields, setFields] = useState([]);
    const [lostFoundItems, setLostFoundItems] = useState([]);
    const [cleaningLogs, setCleaningLogs] = useState([]);
    const [maintenanceIssues, setMaintenanceIssues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // QR Code Check-In Modal state
    const [qrModalVisible, setQrModalVisible] = useState(false);
    const [qrSearchInput, setQrSearchInput] = useState('');
    const [qrFoundBooking, setQrFoundBooking] = useState(null);
    
    // Track bookings that have been reported for cleaning / maintenance in current session
    const [reportedCleaningKeys, setReportedCleaningKeys] = useState({});
    const [reportedMaintenanceKeys, setReportedMaintenanceKeys] = useState({});

    // Filter controls
    const [query, setQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('all'); // all, today, pending, guest, confirmed, completed, cancelled, lost_found
    const [filterField, setFilterField] = useState(''); // '' = all fields
    const [filterGuest, setFilterGuest] = useState('all'); // all, guest, member
    const [filterDate, setFilterDate] = useState(''); // '' = all dates
    const [filterPeriod, setFilterPeriod] = useState('all'); // 'all', 'today', 'week', 'month', 'year'

    // Filter Modal Pickers (xổ danh sách khi nhấn)
    const [fieldPickerVisible, setFieldPickerVisible] = useState(false);
    const [guestPickerVisible, setGuestPickerVisible] = useState(false);
    const [datePickerVisible, setDatePickerVisible] = useState(false);

    // Inspector Detail Modal state (Read)
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);

    // Create Booking Modal state (Create)
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [newField, setNewField] = useState('');
    const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [newTime, setNewTime] = useState('17:30 - 19:00');
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');
    const [newIsGuest, setNewIsGuest] = useState(true);
    const [newPrice, setNewPrice] = useState('350000');
    const [newDeposit, setNewDeposit] = useState('175000');
    const [newStatus, setNewStatus] = useState('confirmed');
    const [newNotes, setNewNotes] = useState('');
    const [addSubmitting, setAddSubmitting] = useState(false);

    // Edit Booking Modal state (Update)
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingBooking, setEditingBooking] = useState(null);
    const [editFieldId, setEditFieldId] = useState('');
    const [editField, setEditField] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editTime, setEditTime] = useState('');
    const [editPrice, setEditPrice] = useState('');
    const [editStatus, setEditStatus] = useState('confirmed');
    const [editCustomerName, setEditCustomerName] = useState('');
    const [editCustomerPhone, setEditCustomerPhone] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [editAvailableServices, setEditAvailableServices] = useState([]);
    const [editSelectedServices, setEditSelectedServices] = useState([]);
    const [editTimeslots, setEditTimeslots] = useState([]);
    const [editTimeslotsLoading, setEditTimeslotsLoading] = useState(false);
    const [editBasePitchPrice, setEditBasePitchPrice] = useState(0);
    const [isEditServicesInitialized, setIsEditServicesInitialized] = useState(false);
    const [editSubmitting, setEditSubmitting] = useState(false);

    // Edit Field Dropdown state (Chuẩn logic bản Web: chỉ hiển thị sân có khung giờ trong ngày)
    const [editFieldsList, setEditFieldsList] = useState([]);
    const [editFieldsLoading, setEditFieldsLoading] = useState(false);
    const [editFieldDropdownOpen, setEditFieldDropdownOpen] = useState(false);
    const [editFieldSearch, setEditFieldSearch] = useState('');

    // Cleaning Request modal state (Báo dọn vệ sinh sân)
    const [cleaningModalVisible, setCleaningModalVisible] = useState(false);
    const [selectedCleaningBooking, setSelectedCleaningBooking] = useState(null);
    const [cleaningNotes, setCleaningNotes] = useState('');
    const [cleaningSubmitting, setCleaningSubmitting] = useState(false);

    // Maintenance Request modal state (Báo sự cố & Bảo trì khẩn cấp)
    const [maintenanceModalVisible, setMaintenanceModalVisible] = useState(false);
    const [selectedMaintenanceBooking, setSelectedMaintenanceBooking] = useState(null);
    const [maintCategory, setMaintCategory] = useState('Đèn chiếu sáng cao áp');
    const [maintPriority, setMaintPriority] = useState('Khẩn cấp');
    const [maintDescription, setMaintDescription] = useState('');
    const [maintSubmitting, setMaintSubmitting] = useState(false);

    // Lost & Found modal state
    const [lostModalVisible, setLostModalVisible] = useState(false);
    const [lostItemType, setLostItemType] = useState('Áo khoác / Trang phục');
    const [lostFieldName, setLostFieldName] = useState('');
    const [lostLocation, setLostLocation] = useState('Băng ghế chờ');
    const [lostDescription, setLostDescription] = useState('');
    const [lostGuestName, setLostGuestName] = useState('');
    const [lostGuestPhone, setLostGuestPhone] = useState('');
    const [lostSubmitting, setLostSubmitting] = useState(false);

    // In-Screen Custom Dialog state (Không bao giờ dùng popup mặc định của trình duyệt)
    const [dialogConfig, setDialogConfig] = useState({
        visible: false,
        title: '',
        message: '',
        confirmText: 'Đã hiểu',
        cancelText: 'Hủy bỏ',
        confirmColor: '#006b2c',
        iconName: 'alert-circle',
        iconColor: '#dc2626',
        isAlert: true,
        onConfirm: () => {},
        onCancel: () => {},
    });

    const showAppAlert = (title, message, icon = 'alert-circle', color = '#dc2626') => {
        setDialogConfig({
            visible: true,
            title,
            message,
            confirmText: 'Đã hiểu',
            cancelText: 'Đóng',
            confirmColor: color === '#15803d' || color === '#006b2c' ? '#006b2c' : color,
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

    // Helper: Convert "HH:MM" to minutes
    const toMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const parts = String(timeStr).slice(0, 5).split(':').map(Number);
        return (parts[0] || 0) * 60 + (parts[1] || 0);
    };

    // Helper: Check if two time ranges overlap
    const isSlotOverlap = (slot1, slot2) => {
        if (!slot1 || !slot2) return false;
        const [s1, e1] = String(slot1).split('-').map(s => s.trim());
        const [s2, e2] = String(slot2).split('-').map(s => s.trim());
        if (!s1 || !e1 || !s2 || !e2) return false;
        return toMinutes(s1) < toMinutes(e2) && toMinutes(e1) > toMinutes(s2);
    };

    // Helper: Kiểm tra khung giờ đã qua so với thời gian hiện tại (Đồng bộ 100% bản Web)
    const isSlotExpired = (slotDateStr, startTimeStr) => {
        if (!slotDateStr || !startTimeStr) return false;

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        let dateFormatted = String(slotDateStr).split('T')[0].trim();
        if (dateFormatted.includes('/')) {
            const parts = dateFormatted.split('/');
            if (parts.length === 3) {
                dateFormatted = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }

        if (dateFormatted < todayStr) return true;
        if (dateFormatted > todayStr) return false;

        // Nếu ngày được chọn là hôm nay: kiểm tra giờ bắt đầu so với giờ hiện tại
        const match = String(startTimeStr).match(/^(\d{1,2}):(\d{2})/);
        if (!match) return false;
        const slotH = Number(match[1]);
        const slotM = Number(match[2]);
        const currentH = now.getHours();
        const currentM = now.getMinutes();

        return (slotH < currentH) || (slotH === currentH && slotM <= currentM);
    };

    // CONFLICT CHECK LOGIC (Đồng bộ chuẩn 100% bản Web):
    // Check if a time slot on a specific field & date already has an active booking
    const getConflictingBooking = (targetField, targetDate, slotTimeStr, excludeBookingId = null) => {
        if (!targetField || !targetDate || !slotTimeStr) return null;
        const normField = String(targetField).trim().toLowerCase();

        return bookings.find(b => {
            const bId = String(b.id || b.booking_id || '');
            if (excludeBookingId && bId === String(excludeBookingId)) return false;

            const bStatus = String(b.status || '').toLowerCase();
            if (['cancelled', 'rejected'].includes(bStatus)) return false;

            const bDate = b.date || b.booking_date || b.bookingDate;
            if (bDate !== targetDate) return false;

            const bField = String(b.field || b.field_name || b.fieldName || '').trim().toLowerCase();
            if (bField !== normField) return false;

            let bTime = b.time || b.time_slot || '';
            if (!bTime && b.start_time && b.end_time) {
                bTime = `${b.start_time.slice(0, 5)} - ${b.end_time.slice(0, 5)}`;
            }

            return isSlotOverlap(slotTimeStr, bTime);
        });
    };

    // Helper: Normalize time slot string into 'HH:MM:SS'
    const normalizeTimeSlot = (timeSlotStr) => {
        if (!timeSlotStr || typeof timeSlotStr !== 'string') {
            return { start: '17:30:00', end: '19:00:00' };
        }
        const parts = timeSlotStr.split('-').map(s => s.trim());
        const fmt = (t) => {
            if (!t) return '00:00:00';
            const segs = t.split(':').map(s => s.trim());
            const h = (segs[0] || '00').padStart(2, '0');
            const m = (segs[1] || '00').padStart(2, '0');
            const s = (segs[2] || '00').padStart(2, '0');
            return `${h}:${m}:${s}`;
        };
        return {
            start: fmt(parts[0]),
            end: fmt(parts[1] || parts[0])
        };
    };

    const broadcastAppSync = (type = 'booking_updated') => {
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

    const fetchAllData = async (isSilent = false) => {
        try {
            if (!isSilent && bookings.length === 0) {
                setLoading(true);
            }

            // 1. Tải Bookings và Fields ưu tiên hàng đầu (hiển thị giao diện ngay lập tức)
            const [bData, fData] = await Promise.all([
                getBookingsApi().catch(() => []),
                getFieldsApi().catch(() => [])
            ]);

            const rawBookings = Array.isArray(bData) ? bData : (bData?.bookings || bData?.results || []);
            setBookings(rawBookings);

            const rawFields = Array.isArray(fData) ? fData : (fData?.fields || fData?.results || []);
            setFields(rawFields);

            // Mở khóa UI ngay lập tức để người dùng xem và tương tác lịch đặt sân
            setLoading(false);
            setRefreshing(false);

            // 2. Tải ngầm các dữ liệu phụ bên dưới (Đồ thất lạc, Vệ sinh, Bảo trì)
            Promise.all([
                getLostFoundItemsApi().catch(() => []),
                getCleaningLogsApi().catch(() => []),
                getMaintenanceIssuesApi().catch(() => [])
            ]).then(([lData, cData, mData]) => {
                const rawLost = Array.isArray(lData) ? lData : lData?.results || [];
                setLostFoundItems(rawLost);

                const rawCleaning = Array.isArray(cData) ? cData : cData?.results || [];
                setCleaningLogs(rawCleaning);

                const rawMaint = Array.isArray(mData) ? mData : mData?.results || [];
                setMaintenanceIssues(rawMaint);
            }).catch(() => {});

        } catch (error) {
            console.error('Fetch staff bookings error:', error);
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAllData();

        // Lắng nghe sự kiện đồng bộ thời gian thực (0ms cross-platform / cross-client)
        const handleSync = (e) => {
            const ev = e?.detail || e;
            const t = ev?.type;
            if (
                !t ||
                t.startsWith('booking_') ||
                t.startsWith('pitch_') ||
                t.startsWith('maintenance_') ||
                t.startsWith('lost_found_') ||
                t.startsWith('services_')
            ) {
                fetchAllData();
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('football_sync', handleSync);
            window.addEventListener('storage', (e) => {
                if (
                    e.key === 'football_booking_sync_event' ||
                    e.key === 'pitch_cleaning_status' ||
                    e.key === 'pitch_maintenance_issues'
                ) {
                    fetchAllData();
                }
            });
        }

        const interval = setInterval(() => {
            fetchAllData();
        }, 3500);

        return () => {
            clearInterval(interval);
            if (typeof window !== 'undefined') {
                window.removeEventListener('football_sync', handleSync);
            }
        };
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchAllData();
    };

    // Helper to determine if cleaning button (chổi báo dọn) should be visible:
    // NẾU Ở TRANG VỆ SINH SÂN ĐÃ BẤM DỌN XONG (status = 'clean') THÌ MẤT ICON BÁO DỌN ĐI!
    const isCleaningActionVisible = (b) => {
        const s = String(b.status || '').toLowerCase();
        if (!['confirmed', 'paid', 'checked_in'].includes(s)) return false;

        const bId = String(b.id || b.booking_id || '');
        const bField = String(b.field || b.field_name || '').trim().toLowerCase();
        const bTime = String(b.time || b.time_slot || '').trim();
        const bDate = String(b.date || b.booking_date || '').trim();

        // 1. Kiểm tra từ danh sách cleaningLogs trong CSDL: nếu ca này đã có bản ghi 'clean' (đã dọn xong) -> ẨN ICON!
        const isCleanedInLogs = (cleaningLogs || []).some((log) => {
            if (log.status !== 'clean') return false;
            const logBId = String(log.booking_id || log.booking || '');
            if (logBId && bId) {
                return logBId === bId;
            }

            const logField = String(log.field_name || log.fieldName || '').trim().toLowerCase();
            const logTime = String(log.cleaned_match_time || '').trim();
            const logDate = String(log.created_at || '').slice(0, 10);

            // Nếu log không có booking_id cụ thể, CHỈ tính là đã dọn ca này NẾU CÙNG NGÀY ĐÁ!
            if (bField && logField === bField && bTime && logTime === bTime) {
                if (bDate && logDate) {
                    return logDate === bDate;
                }
            }

            return false;
        });
        if (isCleanedInLogs) return false;

        // 2. Kiểm tra từ pitch_cleaning_status trong AsyncStorage/localStorage nếu đã lưu dọn xong
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const saved = window.localStorage.getItem('pitch_cleaning_status');
                if (saved) {
                    const statusObj = JSON.parse(saved);
                    const fieldStatus = statusObj[bField] || (b.field_id && statusObj[b.field_id]);
                    if (fieldStatus) {
                        if (fieldStatus.cleanedBookingKey && bId && fieldStatus.cleanedBookingKey.includes(bId)) {
                            return false;
                        }
                        if (fieldStatus.cleanedSessions) {
                            const hasCleanSession = fieldStatus.cleanedSessions.some((cs) => {
                                const csTime = cs?.time || cs;
                                const csDate = cs?.date;
                                const csBId = cs?.bookingId;
                                if (csBId && bId && csBId === bId) return true;
                                if (csTime === bTime && csDate && bDate && csDate === bDate) return true;
                                return false;
                            });
                            if (hasCleanSession) return false;
                        }
                    }
                }
            }
        } catch {}

        return true;
    };

    // Helper to determine if maintenance button should be visible:
    // If user has reported it OR repair staff has resolved/done -> BUTTON VANISHES!
    const isMaintenanceActionVisible = (b) => {
        const s = String(b.status || '').toLowerCase();
        if (!['confirmed', 'paid', 'checked_in'].includes(s)) return false;

        const bId = String(b.id || b.booking_id || '');
        const bField = String(b.field || b.field_name || '').trim().toLowerCase();
        const bTime = String(b.time || b.time_slot || '').trim();

        // 1. If reported in current session -> disappear
        if (reportedMaintenanceKeys[bId] || (bField && bTime && reportedMaintenanceKeys[`${bField}_${bTime}`])) {
            return false;
        }

        // 2. If already logged in maintenance database (whether active issue or already repaired) -> disappear
        const hasIssue = (maintenanceIssues || []).some(issue => {
            const iBId = String(issue.booking_id || issue.bookingId || issue.booking || '');
            if (iBId && iBId === bId) return true;
            const iField = String(issue.field_name || issue.fieldName || issue.field || '').trim().toLowerCase();
            const iDesc = String(issue.description || '').toLowerCase();
            if (bField && iField === bField) {
                if (bTime && iDesc.includes(bTime.toLowerCase())) return true;
            }
            return false;
        });

        if (hasIssue) return false;

        return true;
    };

    // 4 KPI Summary Cards (Real CSDL)
    const kpis = useMemo(() => {
        const total = bookings.length;
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayCount = bookings.filter(b => {
            const d = b.date || b.booking_date || b.bookingDate;
            return d === todayStr;
        }).length;

        const guestCount = bookings.filter(b => Boolean(b.is_guest)).length;
        const guestPct = total > 0 ? Math.round((guestCount / total) * 100) : 0;

        const pendingCount = bookings.filter(b => {
            const st = String(b.status || '').toLowerCase();
            return st === 'pending' || !st;
        }).length;

        const confirmedCount = bookings.filter(b => {
            const st = String(b.status || '').toLowerCase();
            return st === 'confirmed' || st === 'paid';
        }).length;

        const completedCount = bookings.filter(b => {
            const st = String(b.status || '').toLowerCase();
            return st === 'completed';
        }).length;

        const cancelledCount = bookings.filter(b => {
            const st = String(b.status || '').toLowerCase();
            return st === 'cancelled' || st === 'rejected';
        }).length;

        return {
            total,
            todayCount,
            guestCount,
            guestPct,
            pendingCount,
            confirmedCount,
            completedCount,
            cancelledCount
        };
    }, [bookings]);

    // Format display date: YYYY-MM-DD -> DD/MM/YYYY
    const formatDisplayDate = (isoStr) => {
        if (!isoStr) return '';
        const parts = isoStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return isoStr;
    };

    // Filter Logic matching Web exactly
    const filtered = useMemo(() => {
        let list = [...bookings];
        const todayStr = new Date().toISOString().slice(0, 10);

        // 1. Filter Category (Tabs)
        if (filterCategory === 'today') {
            list = list.filter(b => (b.date || b.booking_date || b.bookingDate) === todayStr);
        } else if (filterCategory === 'pending') {
            list = list.filter(b => {
                const st = String(b.status || '').toLowerCase();
                return st === 'pending' || !st;
            });
        } else if (filterCategory === 'guest') {
            list = list.filter(b => Boolean(b.is_guest));
        } else if (filterCategory === 'confirmed') {
            list = list.filter(b => {
                const st = String(b.status || '').toLowerCase();
                return st === 'confirmed' || st === 'paid';
            });
        } else if (filterCategory === 'completed') {
            list = list.filter(b => String(b.status || '').toLowerCase() === 'completed');
        } else if (filterCategory === 'cancelled') {
            list = list.filter(b => {
                const st = String(b.status || '').toLowerCase();
                return st === 'cancelled' || st === 'rejected';
            });
        }

        // 2. Filter Field
        if (filterField) {
            list = list.filter(b => {
                const fName = b.field || b.field_name || b.fieldName || '';
                return fName.toLowerCase() === filterField.toLowerCase();
            });
        }

        // 3. Filter Guest vs Member
        if (filterGuest === 'guest') {
            list = list.filter(b => Boolean(b.is_guest));
        } else if (filterGuest === 'member') {
            list = list.filter(b => !b.is_guest);
        }

        // 4. Filter Date & Period
        if (filterPeriod === 'today') {
            list = list.filter(b => (b.date || b.booking_date || b.bookingDate) === todayStr);
        } else if (filterPeriod === 'week') {
            const now = new Date();
            const dayOfWeek = now.getDay() || 7;
            const monday = new Date(now);
            monday.setDate(now.getDate() - dayOfWeek + 1);
            monday.setHours(0, 0, 0, 0);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            sunday.setHours(23, 59, 59, 999);
            list = list.filter(b => {
                const d = new Date(b.date || b.booking_date || b.bookingDate);
                return !isNaN(d.getTime()) && d >= monday && d <= sunday;
            });
        } else if (filterPeriod === 'month') {
            const now = new Date();
            list = list.filter(b => {
                const d = new Date(b.date || b.booking_date || b.bookingDate);
                return !isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
            });
        } else if (filterPeriod === 'year') {
            const now = new Date();
            list = list.filter(b => {
                const d = new Date(b.date || b.booking_date || b.bookingDate);
                return !isNaN(d.getTime()) && d.getFullYear() === now.getFullYear();
            });
        } else if (filterDate) {
            list = list.filter(b => (b.date || b.booking_date || b.bookingDate) === filterDate);
        }

        // 5. Search Query
        if (query.trim()) {
            const q = query.toLowerCase().trim();
            list = list.filter(b => {
                const bId = String(b.id || b.booking_id || '').toLowerCase();
                const cName = String(b.name || b.customer_name || b.customerName || '').toLowerCase();
                const phone = String(b.phone || b.customer_phone || '').toLowerCase();
                const fName = String(b.field || b.field_name || b.fieldName || '').toLowerCase();
                return bId.includes(q) || cName.includes(q) || phone.includes(q) || fName.includes(q);
            });
        }

        // Sort: Today / Latest first
        list.sort((a, b) => {
            const dateA = a.date || a.booking_date || a.bookingDate || '';
            const dateB = b.date || b.booking_date || b.bookingDate || '';
            if (dateA !== dateB) return dateB.localeCompare(dateA);
            const timeA = a.time || a.time_slot || a.start_time || '';
            const timeB = b.time || b.time_slot || b.start_time || '';
            return timeB.localeCompare(timeA);
        });

        return list;
    }, [bookings, filterCategory, filterField, filterGuest, filterDate, query]);

    const hasActiveFilters = Boolean(query || filterCategory !== 'all' || filterField || filterGuest !== 'all' || filterDate);

    const handleResetFilters = () => {
        setQuery('');
        setFilterCategory('all');
        setFilterField('');
        setFilterGuest('all');
        setFilterDate('');
    };

    // CRUD: CREATE Booking (Walk-in / Add New) with Conflict Check
    const handleCreateBooking = async () => {
        if (!newCustomerName.trim()) {
            showAppAlert('Thiếu thông tin', 'Vui lòng nhập tên khách hàng hoặc đội bóng.');
            return;
        }
        if (!newCustomerPhone.trim()) {
            showAppAlert('Thiếu thông tin', 'Vui lòng nhập số điện thoại khách hàng.');
            return;
        }

        // Conflict check: không cho phép tạo vào khung giờ đã có người đặt
        const conflict = getConflictingBooking(newField, newDate, newTime);
        if (conflict) {
            showAppAlert(
                'Khung giờ đã có người đặt',
                `Sân "${newField}" vào ngày ${formatDisplayDate(newDate)} khung giờ "${newTime}" đã có người đặt (Đơn #BK${String(conflict.id || conflict.booking_id).slice(0, 8)} - ${conflict.name || conflict.customer_name || 'Khách'}). Vui lòng chọn khung giờ khác!`
            );
            return;
        }

        try {
            setAddSubmitting(true);
            const times = normalizeTimeSlot(newTime);
            const matchField = fields.find(f => (f.field_name || f.name) === newField) || fields[0] || {};

            const payload = {
                field_id: matchField.id || 1,
                field: matchField.id || 1,
                booking_date: newDate,
                start_time: times.start,
                end_time: times.end,
                customer_name: newCustomerName.trim(),
                name: newCustomerName.trim(),
                phone: newCustomerPhone.trim(),
                is_guest: newIsGuest,
                total_price: Number(newPrice) || 350000,
                deposit_amount: Number(newDeposit) || 0,
                status: newStatus === 'confirmed' ? 'Confirmed' : 'Pending',
                notes: newNotes.trim()
            };

            await createBookingApi(payload);
            broadcastAppSync('booking_created');
            showAppAlert('Thành công', 'Đã tạo đơn đặt sân mới thành công!');
            setAddModalVisible(false);
            setNewCustomerName('');
            setNewCustomerPhone('');
            setNewNotes('');
            fetchAllData();
        } catch (e) {
            showAppAlert('Lỗi', 'Không thể tạo đơn đặt sân: ' + (e.response?.data?.error || e.message));
        } finally {
            setAddSubmitting(false);
        }
    };

    // CRUD: UPDATE Booking (Open Edit Modal - Đồng bộ 100% chuẩn Web)
    const openEditBooking = async (item) => {
        setEditingBooking(item);
        let currentFields = fields;
        if (!currentFields || currentFields.length === 0) {
            try {
                const resF = await getFieldsApi();
                currentFields = Array.isArray(resF) ? resF : (resF?.fields || resF?.results || []);
                setFields(currentFields);
            } catch {
                currentFields = [];
            }
        }
        const fName = item.field || item.field_name || currentFields[0]?.field_name || '';
        const matchField = currentFields.find(f => (f.field_name || f.name) === fName) || currentFields[0] || {};
        const fId = matchField?.id || item.field_id || '';
        setEditFieldId(fId);
        setEditField(fName);
        const bDate = item.date || item.booking_date || '';
        setEditDate(bDate);
        const tSlot = item.time || item.time_slot || (item.start_time ? `${item.start_time.slice(0, 5)} - ${item.end_time?.slice(0, 5)}` : '17:30 - 19:00');
        setEditTime(tSlot);
        setEditPrice(String(item.price || item.total_price || item.total_amount || ''));
        const rawSt = String(item.status || 'Confirmed').toLowerCase();
        setEditStatus(rawSt === 'pending' ? 'pending' : rawSt === 'checked_in' ? 'checked_in' : rawSt === 'completed' ? 'completed' : rawSt === 'cancelled' ? 'cancelled' : 'confirmed');
        setEditCustomerName(item.name || item.customer_name || '');
        setEditCustomerPhone(item.phone || item.customer_phone || '');
        setEditNotes(item.notes || '');

        // 1. Tải danh sách dịch vụ khả dụng & dịch vụ hiện tại của đơn
        try {
            const [avail, curServices] = await Promise.all([
                getServicesApi(true).catch(() => []),
                item.services && item.services.length > 0
                    ? Promise.resolve(item.services)
                    : getBookingServicesApi(item.id || item.booking_id).catch(() => [])
            ]);
            const rawAvail = Array.isArray(avail) ? avail : avail?.services || [];
            setEditAvailableServices(rawAvail);

            const initialSelected = (Array.isArray(curServices) ? curServices : []).map(s => {
                const sMatch = rawAvail.find(a => String(a.id) === String(s.service_id || s.id));
                return {
                    service_id: s.service_id || s.id,
                    service_name: s.service_name || s.name || sMatch?.name || 'Dịch vụ',
                    quantity: Number(s.quantity || 1),
                    price: Number(s.price || (s.total_price && s.quantity ? s.total_price / s.quantity : sMatch?.price || 0)),
                    shoe_size: s.shoe_size || ''
                };
            });
            setEditSelectedServices(initialSelected);

            const initServCost = initialSelected.reduce((sum, s) => sum + s.quantity * s.price, 0);
            const rawTotalPrice = Number(item.price || item.total_price || item.total_amount || 0);
            const calculatedBase = Math.max(0, rawTotalPrice - initServCost);
            setEditBasePitchPrice(calculatedBase);
            setEditPrice(String(calculatedBase + initServCost));
            setIsEditServicesInitialized(true);
        } catch {
            setEditAvailableServices([]);
            setEditSelectedServices([]);
            const rawTotalPrice = Number(item.price || item.total_price || item.total_amount || 0);
            setEditBasePitchPrice(rawTotalPrice);
            setEditPrice(String(rawTotalPrice));
            setIsEditServicesInitialized(true);
        }

        // 2. Tải khung giờ từ API theo sân và ngày
        if (fId && bDate) {
            try {
                setEditTimeslotsLoading(true);
                const res = await getTimeslotsByFieldApi(fId, bDate);
                const sList = Array.isArray(res) ? res : res?.data || [];
                setEditTimeslots(sList);
            } catch {
                setEditTimeslots([]);
            } finally {
                setEditTimeslotsLoading(false);
            }
        }

        // 3. Tải danh sách sân có khung giờ trong ngày bDate (kèm sân hiện tại của đơn - chuẩn 100% bản Web)
        setEditFieldDropdownOpen(false);
        setEditFieldSearch('');
        loadFieldsForEditDate(bDate, fId);

        setEditModalVisible(true);
    };

    // Tải danh sách các sân đang mở khung giờ trong ngày được chọn
    const loadFieldsForEditDate = async (targetDate, currentFieldId) => {
        if (!targetDate) return;
        try {
            setEditFieldsLoading(true);
            const res = await getFieldsApi({
                date: targetDate,
                only_with_slots: true,
                include_field_id: currentFieldId,
                show_all: true
            });
            const fList = Array.isArray(res) ? res : (res?.fields || res?.results || []);
            setEditFieldsList(fList);
        } catch (err) {
            console.error("Lỗi tải danh sách sân theo ngày:", err);
            setEditFieldsList(fields || []);
        } finally {
            setEditFieldsLoading(false);
        }
    };

    const closeEditModal = () => {
        setEditModalVisible(false);
        setEditFieldDropdownOpen(false);
        setEditFieldSearch('');
        setIsEditServicesInitialized(false);
        setEditingBooking(null);
    };

    // Tự động tính toán tổng tiền editPrice = editBasePitchPrice + tổng tiền dịch vụ (chuẩn 100% bản Web)
    useEffect(() => {
        if (!isEditServicesInitialized || !editModalVisible) return;
        const servCost = (editSelectedServices || []).reduce(
            (sum, s) => sum + (Number(s.quantity) || 0) * (Number(s.price) || 0),
            0
        );
        setEditPrice(String(Math.max(0, (Number(editBasePitchPrice) || 0) + servCost)));
    }, [editSelectedServices, editBasePitchPrice, isEditServicesInitialized, editModalVisible]);

    const handleEditFieldChange = async (newFieldObj) => {
        if (!newFieldObj) return;
        const newFName = newFieldObj.field_name || newFieldObj.name;
        if (newFName === editField) return;

        const oldFieldObj = fields.find(f => (f.field_name || f.name) === editField) || {};
        const oldPrice = Number(oldFieldObj?.min_price || oldFieldObj?.price_per_hour || 0);
        const newPrice = Number(newFieldObj?.min_price || newFieldObj?.price_per_hour || 0);
        if (newPrice !== oldPrice) {
            const diff = newPrice - oldPrice;
            setEditBasePitchPrice(prev => Math.max(0, (Number(prev) || 0) + diff));
        }

        setEditField(newFName);
        setEditFieldId(newFieldObj.id);

        if (newFieldObj.id && editDate) {
            try {
                setEditTimeslotsLoading(true);
                const res = await getTimeslotsByFieldApi(newFieldObj.id, editDate);
                const sList = Array.isArray(res) ? res : res?.data || [];
                setEditTimeslots(sList);
            } catch {
                setEditTimeslots([]);
            } finally {
                setEditTimeslotsLoading(false);
            }
        }
    };

    const handleEditDateChange = async (newDate) => {
        setEditDate(newDate);
        const todayStr = new Date().toISOString().slice(0, 10);
        if (newDate && newDate < todayStr) {
            showAppAlert('Cảnh báo', 'Không được đổi sang ngày trong quá khứ!');
            return;
        }

        // Tải lại danh sách sân có slot trong ngày mới (chuẩn 100% bản Web)
        loadFieldsForEditDate(newDate, editFieldId);

        if (editFieldId && newDate) {
            try {
                setEditTimeslotsLoading(true);
                const res = await getTimeslotsByFieldApi(editFieldId, newDate);
                const sList = Array.isArray(res) ? res : res?.data || [];
                setEditTimeslots(sList);
            } catch {
                setEditTimeslots([]);
            } finally {
                setEditTimeslotsLoading(false);
            }
        }
    };

    const handleToggleService = (svc) => {
        const exist = editSelectedServices.find(s => String(s.service_id) === String(svc.id));
        if (exist) {
            const newSelected = editSelectedServices.filter(s => String(s.service_id) !== String(svc.id));
            setEditSelectedServices(newSelected);
        } else {
            const stock = Number(svc.stock ?? 999);
            if (stock <= 0) {
                showAppAlert('Hết hàng', `Dịch vụ "${svc.name}" hiện đã hết hàng trong kho!`);
                return;
            }
            const isShoes = String(svc.category || svc.name || '').toLowerCase().includes('giày') || String(svc.category || '').toLowerCase().includes('shoes');
            const newSelected = [
                ...editSelectedServices,
                {
                    service_id: svc.id,
                    service_name: svc.name,
                    quantity: 1,
                    price: Number(svc.price || 0),
                    shoe_size: isShoes ? '41' : ''
                }
            ];
            setEditSelectedServices(newSelected);
        }
    };

    const handleServiceQuantityChange = (svcId, delta) => {
        const matchSvc = editAvailableServices.find(s => String(s.id) === String(svcId));
        const stock = Number(matchSvc?.stock ?? 999);
        const exist = editSelectedServices.find(s => String(s.service_id) === String(svcId));
        if (!exist) return;

        const nextQty = exist.quantity + delta;
        if (nextQty <= 0) {
            handleToggleService(matchSvc || { id: svcId });
            return;
        }
        if (delta > 0 && nextQty > stock) {
            showAppAlert('Giới hạn tồn kho', `Dịch vụ "${matchSvc?.name || 'này'}" chỉ còn ${stock} sản phẩm trong kho.`);
            return;
        }

        const newSelected = editSelectedServices.map(s => {
            if (String(s.service_id) === String(svcId)) {
                return { ...s, quantity: nextQty };
            }
            return s;
        });
        setEditSelectedServices(newSelected);
    };

    const handleServiceShoeSizeChange = (svcId, size) => {
        setEditSelectedServices(prev => prev.map(s => {
            if (String(s.service_id) === String(svcId)) {
                return { ...s, shoe_size: size };
            }
            return s;
        }));
    };

    // CRUD: UPDATE Booking (Save to Server) with Conflict Check
    const handleSaveEditBooking = async () => {
        if (!editingBooking) return;
        const bId = editingBooking.id || editingBooking.booking_id;

        // Conflict check: không cho phép điều chỉnh qua khung giờ đã có người đặt!
        const conflict = getConflictingBooking(editField, editDate, editTime, bId);
        if (conflict) {
            showAppAlert(
                'Khung giờ đã có người đặt',
                `Sân "${editField}" vào ngày ${formatDisplayDate(editDate)} khung giờ "${editTime}" đã có người đặt (Đơn #BK${String(conflict.id || conflict.booking_id).slice(0, 8)}). Vui lòng chọn khung giờ hoặc sân khác!`
            );
            return;
        }

        try {
            setEditSubmitting(true);
            const times = normalizeTimeSlot(editTime || editingBooking.time);
            const matchField = fields.find(f => (f.field_name || f.name) === editField) || {};

            const statusMapToPascal = {
                'pending': 'Pending',
                'confirmed': 'Confirmed',
                'checked_in': 'Checked_in',
                'completed': 'Completed',
                'cancelled': 'Cancelled',
            };
            const finalStatus = statusMapToPascal[String(editStatus).toLowerCase()] || 'Confirmed';

            await updateBookingApi(bId, {
                field_id: matchField.id || editingBooking.field_id,
                field: matchField.id || editingBooking.field_id,
                booking_date: editDate || editingBooking.date,
                start_time: times.start,
                end_time: times.end,
                total_price: Number(editPrice) || editingBooking.price || 0,
                status: finalStatus,
                customer_name: editCustomerName.trim(),
                name: editCustomerName.trim(),
                phone: editCustomerPhone.trim(),
                notes: editNotes.trim(),
                services: (editSelectedServices || []).map(s => ({
                    service_id: s.service_id,
                    quantity: s.quantity,
                    total_price: s.quantity * (s.price || 0),
                    shoe_size: s.shoe_size || null
                }))
            });

            // Nếu chuyển trạng thái sang Hoàn thành (completed), tự động báo sân CẦN DỌN GẤP và thêm tag đỏ ở vệ sinh sân
            if (String(editStatus).toLowerCase() === 'completed') {
                try {
                    await createCleaningLogApi({
                        field: editFieldId || editingBooking?.field_id || null,
                        field_name: editField,
                        cleaned_match_time: editTime,
                        cleaned_match_customer: editCustomerName.trim(),
                        booking_id: bId,
                        notes: `Ca đá ${editTime} của khách vừa hoàn thành. Cần dọn dẹp gấp!`,
                        status: 'needs_clean',
                        status_text: `Ca đá ${editTime} hoàn thành - Cần dọn gấp`,
                    });
                } catch (err) {
                    console.log('Auto cleaning task created silently');
                }
            }

            broadcastAppSync('booking_updated');
            showAppAlert('Thành công', 'Đã cập nhật đơn đặt sân thành công!');
            closeEditModal();
            fetchAllData();
        } catch (e) {
            showAppAlert('Lỗi', 'Không thể cập nhật đơn: ' + (e.response?.data?.error || e.message));
        } finally {
            setEditSubmitting(false);
        }
    };

    const handleUpdateStatus = async (bookingId, nextStatus, label) => {
        const doUpdate = async () => {
            try {
                await updateBookingStatusApi(bookingId, nextStatus);
                if (String(nextStatus).toLowerCase() === 'completed') {
                    const targetB = bookings.find(b => (b.id || b.booking_id) === bookingId);
                    if (targetB) {
                        const bTime = targetB.time || targetB.time_slot || '';
                        const bField = targetB.field || targetB.field_name || '';
                        try {
                            await createCleaningLogApi({
                                field: targetB.field_id || null,
                                field_name: bField,
                                cleaned_match_time: bTime,
                                cleaned_match_customer: targetB.name || targetB.customer_name || '',
                                booking_id: bookingId,
                                notes: `Ca đá ${bTime} của khách vừa hoàn thành. Cần dọn dẹp gấp!`,
                                status: 'needs_clean',
                                status_text: `Ca đá ${bTime} hoàn thành - Cần dọn gấp`,
                            });
                        } catch { }
                    }
                }
                broadcastAppSync('booking_updated');
                showAppAlert('Thành công', `Đơn đặt đã được cập nhật thành "${label}".`, 'checkmark-circle', '#006b2c');
                if (selectedBooking && (selectedBooking.id === bookingId || selectedBooking.booking_id === bookingId)) {
                    setSelectedBooking(prev => ({ ...prev, status: nextStatus }));
                }
                fetchAllData();
            } catch (e) {
                showAppAlert('Lỗi', 'Không thể cập nhật trạng thái đơn lúc này.');
            }
        };

        showAppConfirm({
            title: 'Cập nhật trạng thái đơn',
            message: `Bạn có chắc chắn muốn chuyển trạng thái đơn này sang "${label}" không?`,
            confirmText: 'Đồng ý',
            cancelText: 'Hủy bỏ',
            confirmColor: '#006b2c',
            iconName: 'help-circle-outline',
            iconColor: '#006b2c',
            onConfirm: doUpdate
        });
    };

    // Quick Approve: Approve booking immediately from pending -> Confirmed (Like Web)
    const handleQuickApprove = async (bookingId) => {
        try {
            await updateBookingStatusApi(bookingId, 'Confirmed');
            broadcastAppSync('booking_updated');
            showAppAlert('Thành công', 'Đã duyệt đơn đặt sân thành công (Đã xác nhận).');
            if (selectedBooking && (selectedBooking.id === bookingId || selectedBooking.booking_id === bookingId)) {
                setSelectedBooking(prev => ({ ...prev, status: 'Confirmed' }));
            }
            fetchAllData();
        } catch (e) {
            showAppAlert('Lỗi', 'Không thể duyệt đơn đặt: ' + (e.response?.data?.error || e.message));
        }
    };

    // QR Code Search & 1-Touch Check-in
    const handleSearchQrCode = (text) => {
        setQrSearchInput(text);
        const clean = String(text || '').trim().toLowerCase();
        if (!clean) {
            setQrFoundBooking(null);
            return;
        }
        const found = bookings.find(b => {
            const id = String(b.id || b.booking_id || '').toLowerCase();
            const code = String(b.code || b.booking_code || '').toLowerCase();
            const phone = String(b.phone || b.customer_phone || b.user_phone || '').toLowerCase();
            const name = String(b.customer_name || b.user_name || '').toLowerCase();
            return id === clean || id.includes(clean) || code === clean || code.includes(clean) || (clean.length >= 4 && phone.includes(clean)) || (clean.length >= 3 && name.includes(clean));
        });
        setQrFoundBooking(found || 'not_found');
    };

    const handleConfirmQrCheckIn = async (booking) => {
        if (!booking) return;
        const bId = booking.id || booking.booking_id;
        try {
            await updateBookingStatusApi(bId, 'Checked_in');
            broadcastAppSync('booking_updated');
            showAppAlert('Check-in Thành công', `Đã xác nhận nhận sân cho khách: ${booking.customer_name || booking.user_name || 'Khách'}`);
            setQrModalVisible(false);
            setQrSearchInput('');
            setQrFoundBooking(null);
            fetchAllData();
        } catch (e) {
            showAppAlert('Lỗi', 'Không thể check-in lúc này: ' + (e.response?.data?.error || e.message));
        }
    };

    // Delete Booking (In-Screen confirmation dialog)
    const handleDeleteBooking = async (bookingId) => {
        const doDelete = async () => {
            try {
                await deleteBookingApi(bookingId);
                broadcastAppSync('booking_cancelled');
                showAppAlert('Thành công', 'Đã xóa đơn đặt sân thành công.', 'checkmark-circle', '#006b2c');
                if (selectedBooking && (selectedBooking.id === bookingId || selectedBooking.booking_id === bookingId)) {
                    setDetailModalVisible(false);
                    setSelectedBooking(null);
                }
                fetchAllData();
            } catch (e) {
                showAppAlert('Lỗi', 'Không thể xóa đơn: ' + (e.response?.data?.error || e.message));
            }
        };

        showAppConfirm({
            title: 'Xác nhận xóa đơn',
            message: 'Bạn có chắc chắn muốn xóa đơn đặt sân này không? Hành động này không thể hoàn tác.',
            confirmText: 'Xóa đơn',
            cancelText: 'Hủy bỏ',
            confirmColor: '#dc2626',
            iconName: 'trash-outline',
            iconColor: '#dc2626',
            onConfirm: doDelete
        });
    };

    // Report Cleaning Task (Like Web CompleteMatchModal / Báo cần dọn)
    const handleReportCleaning = (item) => {
        setSelectedCleaningBooking(item);
        setCleaningNotes('');
        setCleaningModalVisible(true);
    };

    const handleConfirmCleaning = async () => {
        if (!selectedCleaningBooking) return;
        try {
            setCleaningSubmitting(true);
            const bId = String(selectedCleaningBooking.id || selectedCleaningBooking.booking_id || '');
            const fName = selectedCleaningBooking.field || selectedCleaningBooking.field_name || 'Sân bóng';
            const tSlot = selectedCleaningBooking.time || selectedCleaningBooking.time_slot || 'Theo ca';
            const nowTimeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            const managerName = user?.full_name || 'Quản lý đặt sân';
            const noteContent = cleaningNotes.trim() || `Cần dọn gấp sau ca đá ${tSlot}`;

            // 1. Lưu trực tiếp vào CSDL backend facility_pitch_cleaning
            await createCleaningLogApi({
                field: selectedCleaningBooking.field_id || null,
                field_name: fName,
                booking: bId || null,
                status: 'needs_clean',
                status_text: `Báo dọn khẩn cấp: ${noteContent}`,
                cleaner_name: managerName,
                cleaned_match_time: tSlot,
                cleaned_match_customer: selectedCleaningBooking.name || selectedCleaningBooking.customer_name || 'Khách đặt sân',
                start_time: nowTimeStr,
                notes: noteContent,
            });

            // 2. Cập nhật AsyncStorage để giao diện phản hồi tức thì
            try {
                const STORAGE_KEY = 'pitch_cleaning_status';
                const saved = await AsyncStorage.getItem(STORAGE_KEY);
                let statusObj = saved ? JSON.parse(saved) : {};
                const updateEntry = {
                    status: 'needs_clean',
                    cleaningReason: 'urgent',
                    reportedBy: managerName,
                    lastCleaned: `Báo dọn lúc ${nowTimeStr}`,
                    start_time: nowTimeStr,
                    notes: noteContent,
                    completedMatch: {
                        time: tSlot,
                        name: selectedCleaningBooking.name || selectedCleaningBooking.customer_name || 'Khách đặt sân',
                        phone: selectedCleaningBooking.phone || selectedCleaningBooking.customer_phone || '',
                        date: selectedCleaningBooking.date || selectedCleaningBooking.booking_date || '',
                        reason: noteContent,
                    },
                };
                if (fName) statusObj[fName] = updateEntry;
                if (selectedCleaningBooking.field_id) statusObj[selectedCleaningBooking.field_id] = updateEntry;
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(statusObj));

                if (typeof window !== 'undefined' && window.localStorage) {
                    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(statusObj));
                    const syncData = {
                        type: 'pitch_cleaning_needed',
                        payload: { fieldName: fName, time: tSlot, reason: noteContent, reportedBy: managerName, reportedTime: nowTimeStr },
                        timestamp: Date.now(),
                    };
                    window.localStorage.setItem('football_booking_sync_event', JSON.stringify(syncData));
                    window.dispatchEvent(new CustomEvent('football_sync', { detail: syncData }));
                }
            } catch {}

            showAppAlert('Thành công', `Đã gửi báo dọn khẩn cấp cho ${fName} (${tSlot})!`);
            setCleaningModalVisible(false);
            setSelectedCleaningBooking(null);
            fetchAllData();
        } catch (e) {
            showAppAlert('Lỗi', 'Không thể tạo yêu cầu dọn sân: ' + (e.response?.data?.error || e.message));
        } finally {
            setCleaningSubmitting(false);
        }
    };

    // Report Maintenance Issue (Like Web ReportMaintenanceBookingModal / Báo sự cố sân)
    const handleReportMaintenance = (item) => {
        setSelectedMaintenanceBooking(item);
        setMaintCategory('Đèn chiếu sáng cao áp');
        setMaintPriority('Khẩn cấp');
        setMaintDescription('');
        setMaintenanceModalVisible(true);
    };

    const handleConfirmMaintenance = async () => {
        if (!selectedMaintenanceBooking) return;
        try {
            setMaintSubmitting(true);
            const bId = String(selectedMaintenanceBooking.id || selectedMaintenanceBooking.booking_id || '');
            const fName = selectedMaintenanceBooking.field || selectedMaintenanceBooking.field_name || 'Sân bóng';
            const tSlot = selectedMaintenanceBooking.time || selectedMaintenanceBooking.time_slot || 'Theo ca';

            await createMaintenanceIssueApi({
                field_name: fName,
                booking_id: bId || undefined,
                category: maintCategory,
                priority: maintPriority,
                description: maintDescription.trim() || `${maintCategory} - Ca đá ${tSlot}`,
                status: 'pending'
            });

            // Mark reported so button vanishes permanently
            setReportedMaintenanceKeys(prev => ({
                ...prev,
                [bId]: true,
                [`${fName.trim().toLowerCase()}_${tSlot.trim()}`]: true
            }));

            broadcastAppSync('maintenance_issue_reported');
            showAppAlert('Thành công', `Đã gửi báo cáo sự cố & bảo trì cho ${fName}! Đội kỹ thuật cơ sở sẽ tiếp nhận xử lý.`);
            setMaintenanceModalVisible(false);
            setSelectedMaintenanceBooking(null);
            fetchAllData();
        } catch (e) {
            showAppAlert('Lỗi', 'Không thể gửi yêu cầu bảo trì: ' + (e.response?.data?.error || e.message));
        } finally {
            setMaintSubmitting(false);
        }
    };

    // Lost and Found handlers
    const handleCreateLostItem = async () => {
        if (!lostItemType.trim()) {
            showAppAlert('Thiếu thông tin', 'Vui lòng nhập loại món đồ bỏ quên.');
            return;
        }
        try {
            setLostSubmitting(true);
            await createLostFoundItemApi({
                item_name: lostItemType.trim(),
                field_name: lostFieldName.trim() || fields[0]?.field_name || 'Sân bóng',
                location_found: lostLocation.trim(),
                description: lostDescription.trim(),
                guest_name: lostGuestName.trim(),
                customer_phone: lostGuestPhone.trim(),
                status: 'pending'
            });
            broadcastAppSync('lost_found_updated');
            showAppAlert('Thành công', 'Đã lưu món đồ vào kho tủ lễ tân!');
            setLostModalVisible(false);
            setLostItemType('Áo khoác / Trang phục');
            setLostDescription('');
            setLostGuestName('');
            setLostGuestPhone('');
            fetchAllData();
        } catch (e) {
            showAppAlert('Lỗi', 'Không thể tạo hồ sơ đồ bỏ quên: ' + (e.response?.data?.error || e.message));
        } finally {
            setLostSubmitting(false);
        }
    };

    const handleUpdateLostStatus = async (item, newStatus, statusLabel) => {
        try {
            await updateLostFoundStatusApi(item.id, {
                status: newStatus,
                return_note: newStatus === 'returned' ? 'Đã bàn giao tại quầy lễ tân' : 'Đã gọi điện liên hệ khách'
            });
            broadcastAppSync('lost_found_updated');
            showAppAlert('Thành công', `Đã cập nhật trạng thái đồ bỏ quên thành "${statusLabel}".`);
            fetchAllData();
        } catch (e) {
            showAppAlert('Lỗi', 'Không thể cập nhật trạng thái đồ thất lạc.');
        }
    };

    const getStatusBadge = (status) => {
        const s = String(status || '').toLowerCase();
        switch (s) {
            case 'confirmed':
            case 'paid':
                return { label: 'ĐÃ XÁC NHẬN', bg: '#dcfce7', color: '#059669', border: '#86efac', accent: '#059669' };
            case 'checked_in':
                return { label: 'ĐÃ CHECK-IN', bg: '#ccfbf1', color: '#0d9488', border: '#99f6e4', accent: '#0d9488' };
            case 'completed':
                return { label: 'HOÀN THÀNH', bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd', accent: '#1d4ed8' };
            case 'cancelled':
            case 'rejected':
                return { label: 'ĐÃ HỦY', bg: '#fee2e2', color: '#dc2626', border: '#fca5a5', accent: '#dc2626' };
            default:
                return { label: 'CHỜ XÁC NHẬN', bg: '#fef3c7', color: '#d97706', border: '#fde68a', accent: '#d97706' };
        }
    };

    const openBookingDetail = (item) => {
        setSelectedBooking(item);
        setDetailModalVisible(true);
    };

    const renderBookingItem = ({ item }) => {
        const bId = item.id || item.booking_id;
        const st = getStatusBadge(item.status);
        const s = String(item.status || '').toLowerCase();
        const isPending = s === 'pending' || !s;
        const isConfirmed = s === 'confirmed' || s === 'paid';
        const isCheckedIn = s === 'checked_in';
        const isCompleted = s === 'completed';

        // Parse real values from database
        const customerName = item.name || item.customer_name || item.customerName || 'Khách hàng';
        const customerPhone = item.phone || item.customer_phone || '';
        const isGuest = Boolean(item.is_guest);
        const fieldName = item.field || item.field_name || item.fieldName || 'Sân bóng';
        const bookingDate = item.date || item.booking_date || item.bookingDate || 'Hôm nay';
        const todayStr = new Date().toISOString().slice(0, 10);
        const isToday = bookingDate === todayStr;

        const timeStr = item.time || item.timeSlot || item.time_slot || (item.start_time ? `${item.start_time.slice(0, 5)} - ${item.end_time?.slice(0, 5)}` : 'Theo ca');
        const totalPrice = Number(item.price || item.total_price || item.total_amount || 0);
        const depositAmount = Number(item.payment_info?.deposit_amount ?? item.deposit_amount ?? (isConfirmed ? totalPrice * 0.5 : 0));
        const remainingAmount = Number(item.payment_info?.remaining_amount ?? (isCompleted || isCheckedIn ? 0 : Math.max(0, totalPrice - depositAmount)));

        // Payment status badge label like Web
        const pay = item.payment_info || {};
        let payLabel = pay.status_label;
        if (!payLabel) {
            if (isCompleted) payLabel = 'Đã thanh toán đủ';
            else if (depositAmount > 0) payLabel = 'Đã cọc 50%';
            else if (isPending) payLabel = 'Chờ cọc';
            else payLabel = 'Thanh toán tại sân';
        }

        // Check if cleaning & maintenance buttons should be visible (disappear if reported or cleaned/done)
        const canShowCleaning = isCleaningActionVisible(item);
        const canShowMaintenance = isMaintenanceActionVisible(item);

        return (
            <View style={styles.matchCard}>
                {/* Left Colored Accent Strip */}
                <View style={[styles.cardAccentBar, { backgroundColor: st.accent }]} />

                <View style={styles.cardInner}>
                    {/* Top Row: Pitch Badge & Code, Status Badge */}
                    <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                            <View style={styles.pitchBadgeRow}>
                                <View style={[styles.pitchCodeTag, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: 1 }]}>
                                    <Text style={[styles.pitchCodeText, { color: '#006b2c' }]}>
                                        {fieldName}
                                    </Text>
                                </View>
                                <Text style={styles.codeText}>#BK{String(bId).slice(0, 8).toUpperCase()}</Text>
                            </View>

                            {/* Customer row with Guest / Member Badge */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                <View style={[styles.customerMiniAvatar, { backgroundColor: isGuest ? '#e0f2fe' : '#dcfce7' }]}>
                                    <Text style={[styles.customerMiniAvatarText, { color: isGuest ? '#0284c7' : '#15803d' }]}>
                                        {customerName.trim().charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <Text style={styles.matchTitle} numberOfLines={1}>
                                    {customerName}
                                </Text>

                                {/* Tag Khách vãng lai / Thành viên (Like Web) */}
                                {isGuest ? (
                                    <View style={styles.tagGuestPill}>
                                        <Ionicons name="walk-outline" size={11} color="#0284c7" />
                                        <Text style={styles.tagGuestText}>Vãng lai</Text>
                                    </View>
                                ) : (
                                    <View style={styles.tagMemberPill}>
                                        <Ionicons name="checkmark-circle-outline" size={11} color="#059669" />
                                        <Text style={styles.tagMemberText}>Thành viên</Text>
                                    </View>
                                )}
                            </View>

                            {/* Phone number static display */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                <Ionicons name="call-outline" size={12} color="#94a3b8" />
                                <Text style={styles.customerPhoneText}>
                                    {customerPhone || 'Chưa có SĐT'}
                                </Text>
                            </View>
                        </View>

                        <View style={[styles.statusPill, { backgroundColor: st.bg, borderColor: st.border }]}>
                            {isPending && <View style={[styles.statusDot, { backgroundColor: st.color }]} />}
                            <Text style={[styles.statusPillText, { color: st.color }]}>{st.label}</Text>
                        </View>
                    </View>

                    {/* Time Slot & Match Schedule Row */}
                    <View style={styles.matchTimeRow}>
                        <View style={styles.timeTag}>
                            <Ionicons name="time-outline" size={13} color="#006b2c" />
                            <Text style={styles.timeTagText}>{timeStr}</Text>
                        </View>
                        <View style={[styles.dateTag, isToday && styles.dateTagToday]}>
                            <Ionicons name="calendar-outline" size={13} color={isToday ? "#006b2c" : "#64748b"} />
                            <Text style={[styles.dateTagText, isToday && styles.dateTagTextToday]}>
                                {bookingDate}
                            </Text>
                            {isToday && (
                                <View style={styles.todaySmallBadge}>
                                    <Text style={styles.todaySmallBadgeText}>Hôm nay</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Financial & Payment Ledger (Like Web) */}
                    <View style={styles.ledgerCard}>
                        <View style={styles.ledgerRow}>
                            <Text style={styles.ledgerColLabel}>Tổng tiền:</Text>
                            <Text style={styles.ledgerColVal}>{totalPrice.toLocaleString('vi-VN')}đ</Text>

                            <Text style={styles.ledgerColDot}>•</Text>
                            <View style={[styles.payBadgeMini, { backgroundColor: depositAmount > 0 ? '#fef3c7' : '#f1f5f9' }]}>
                                <Ionicons name={depositAmount > 0 ? "shield-checkmark" : "card-outline"} size={11} color={depositAmount > 0 ? "#b45309" : "#64748b"} />
                                <Text style={[styles.payBadgeMiniText, { color: depositAmount > 0 ? "#b45309" : "#64748b" }]}>
                                    {payLabel}
                                </Text>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderColor: '#f1f5f9' }}>
                            <Text style={{ fontSize: 11, color: '#64748b' }}>
                                Đã cọc: <Text style={{ fontWeight: '700', color: '#006b2c' }}>{depositAmount > 0 ? `${depositAmount.toLocaleString('vi-VN')}đ` : '0đ'}</Text>
                            </Text>
                            <Text style={{ fontSize: 11, color: '#64748b' }}>
                                Còn lại: <Text style={{ fontWeight: '700', color: remainingAmount > 0 ? '#b91c1c' : '#006b2c' }}>{remainingAmount.toLocaleString('vi-VN')}đ</Text>
                            </Text>
                        </View>

                        {/* Dịch vụ đi kèm (Đồng bộ chuẩn 100% bản Web) */}
                        {Array.isArray(item.services) && item.services.length > 0 && (
                            <View style={styles.bookingServicesRow}>
                                <Ionicons name="fast-food-outline" size={13} color="#0284c7" />
                                <View style={styles.bookingServicesList}>
                                    {item.services.map((svc, sIdx) => (
                                        <View key={svc.id || sIdx} style={styles.bookingServiceChip}>
                                            <Text style={styles.bookingServiceChipText}>
                                                {svc.service_name || svc.name || 'Dịch vụ'} x{svc.quantity}
                                                {svc.shoe_size ? ` (Size ${svc.shoe_size})` : ''}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {Boolean(item.notes) && (
                            <View style={styles.serviceNoteRow}>
                                <Ionicons name="document-text-outline" size={13} color="#64748b" />
                                <Text style={styles.serviceNoteText} numberOfLines={1}>
                                    Ghi chú: {item.notes}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Action Group CHUẨN 100% WEB */}
                    <View style={styles.webActionGroup}>
                        {/* 1. Nút duyệt nhanh: chỉ khi Chờ xác nhận */}
                        {isPending && (
                            <TouchableOpacity
                                style={styles.actionIconBtnApprove}
                                onPress={() => handleQuickApprove(bId)}
                                title="Xác nhận duyệt đơn ngay"
                                activeOpacity={0.8}
                            >
                                <MaterialIcons name="check-circle" size={18} color="#2563eb" />
                            </TouchableOpacity>
                        )}

                        {/* 2. Nút icon chổi báo dọn vệ sinh khẩn cấp: ẨN KHI ĐÃ BẤM DỌN XONG Ở TRANG VỆ SINH SÂN */}
                        {isCleaningActionVisible(item) && (
                            <TouchableOpacity
                                style={styles.actionIconBtnCleaning}
                                onPress={() => handleReportCleaning(item)}
                                title="Báo dọn vệ sinh khẩn cấp cho sân ca này"
                                activeOpacity={0.8}
                            >
                                <MaterialIcons name="cleaning-services" size={17} color="#059669" />
                            </TouchableOpacity>
                        )}

                        {/* 3. Báo sự cố kỹ thuật: BIẾN MẤT nếu đã báo hoặc đã khắc phục xong */}
                        {canShowMaintenance && (
                            <TouchableOpacity
                                style={styles.actionIconBtnMaintenance}
                                onPress={() => handleReportMaintenance(item)}
                                title="Báo sự cố & Bảo trì khẩn cấp cho sân ca này"
                                activeOpacity={0.8}
                            >
                                <MaterialIcons name="construction" size={17} color="#ea580c" />
                            </TouchableOpacity>
                        )}

                        {/* 4. Chỉnh sửa đơn */}
                        <TouchableOpacity
                            style={styles.actionIconBtnEdit}
                            onPress={() => openEditBooking(item)}
                            title="Chỉnh sửa đơn"
                            activeOpacity={0.8}
                        >
                            <MaterialIcons name="edit" size={17} color="#475569" />
                        </TouchableOpacity>

                        {/* 5. Xóa đơn */}
                        <TouchableOpacity
                            style={styles.actionIconBtnDelete}
                            onPress={() => handleDeleteBooking(bId)}
                            title="Xóa đơn"
                            activeOpacity={0.8}
                        >
                            <MaterialIcons name="delete" size={17} color="#dc2626" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    // Header component: Header + 4 KPI Cards + 4x2 Equal Width Tabs Grid + 3 Dropdown Pickers
    // Phân bổ ngay ngắn, cân xứng tuyệt đối, vừa khít 1 màn hình và cuộn đồng bộ!
    const renderListHeader = () => {
        // Tab Data definition: 2 rows of 4 columns each
        const tabRow1 = [
            { key: 'all', label: 'Tất cả', count: kpis.total },
            { key: 'today', label: 'Hôm nay', count: kpis.todayCount },
            { key: 'pending', label: 'Chờ duyệt', count: kpis.pendingCount, urgent: kpis.pendingCount > 0 },
            { key: 'guest', label: 'Vãng lai', count: kpis.guestCount, isGuest: true },
        ];
        const tabRow2 = [
            { key: 'confirmed', label: 'Đã duyệt', count: kpis.confirmedCount },
            { key: 'completed', label: 'Hoàn tất', count: kpis.completedCount },
            { key: 'cancelled', label: 'Đã hủy', count: kpis.cancelledCount },
            { key: 'lost_found', label: 'Đồ quên', count: lostFoundItems.length, isLost: true },
        ];

        const renderTabItem = (tab) => {
            const isSel = filterCategory === tab.key;
            return (
                <TouchableOpacity
                    key={tab.key}
                    style={[
                        styles.gridTabItem,
                        isSel && styles.gridTabItemActive,
                        tab.isGuest && !isSel && { borderColor: '#bae6fd' },
                    ]}
                    onPress={() => setFilterCategory(tab.key)}
                    activeOpacity={0.8}
                >
                    <View style={styles.gridTabContent}>
                        <Text style={[styles.gridTabLabel, isSel && styles.gridTabLabelActive]} numberOfLines={1}>
                            {tab.label}
                        </Text>
                        <View style={[
                            styles.gridTabBadge,
                            isSel && styles.gridTabBadgeActive,
                            tab.urgent && !isSel && { backgroundColor: '#fee2e2' }
                        ]}>
                            <Text style={[
                                styles.gridTabBadgeText,
                                isSel && styles.gridTabBadgeTextActive,
                                tab.urgent && !isSel && { color: '#dc2626', fontWeight: '800' }
                            ]}>
                                {tab.count}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        };

        return (
            <View style={styles.listHeaderWrapper}>
                {/* Web Standard Header */}
                <View style={styles.webPageHeader}>
                    <View style={styles.headerTopRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <TouchableOpacity
                                style={styles.headerBackBtnMini}
                                onPress={() => {
                                    if (navigation.canGoBack()) navigation.goBack();
                                    else navigation.navigate('AdminDashboard');
                                }}
                            >
                                <Ionicons name="arrow-back" size={18} color="#111827" />
                            </TouchableOpacity>
                            <Text style={styles.webEyebrowText}>
                                VẬN HÀNH CƠ SỞ <Text style={{ color: '#94a3b8' }}>›</Text> QUẢN LÝ ĐẶT SÂN
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity
                                style={[styles.btnAddBookingMain, { backgroundColor: '#0284c7' }]}
                                onPress={() => {
                                    setQrSearchInput('');
                                    setQrFoundBooking(null);
                                    setQrModalVisible(true);
                                }}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="qr-code" size={15} color="#ffffff" />
                                <Text style={styles.btnAddBookingMainText}>Quét QR</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.btnAddBookingMain}
                                onPress={() => {
                                    setNewField(fields[0]?.field_name || fields[0]?.name || '');
                                    setAddModalVisible(true);
                                }}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="add" size={16} color="#ffffff" />
                                <Text style={styles.btnAddBookingMainText}>+ Thêm đơn</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={styles.webPageTitle}>Quản lý đặt sân</Text>
                    <Text style={styles.webPageSubtitle}>
                        Theo dõi, phê duyệt và điều phối toàn bộ lịch đặt sân của thành viên và khách vãng lai theo thời gian thực.
                    </Text>
                </View>

                {/* 4 KPI Cards: Lưới 2 cột x 2 hàng (1 hàng 2 ô vuông) như Dashboard */}
                <View style={styles.metricsGridContainer}>
                    {/* Ô 1: Tổng đơn đặt sân */}
                    <View style={styles.metricCard}>
                        <View style={styles.metricCardTop}>
                            <View style={[styles.metricIconBox, { backgroundColor: '#f1f5f9' }]}>
                                <Ionicons name="document-text-outline" size={16} color="#475569" />
                            </View>
                            <Text style={styles.metricTagText}>Toàn bộ</Text>
                        </View>
                        <Text style={styles.metricLabel}>TỔNG ĐƠN ĐẶT SÂN</Text>
                        <Text style={styles.metricValue}>
                            {kpis.total} <Text style={styles.metricUnit}>lượt</Text>
                        </Text>
                        <Text style={styles.metricSub}>{kpis.confirmedCount} đơn đã xác nhận</Text>
                    </View>

                    {/* Ô 2: Lượt đá hôm nay */}
                    <View style={styles.metricCard}>
                        <View style={styles.metricCardTop}>
                            <View style={[styles.metricIconBox, { backgroundColor: '#f0fdf4' }]}>
                                <Ionicons name="today" size={16} color="#006b2c" />
                            </View>
                            <Text style={[styles.metricTagText, { color: '#006b2c' }]}>Hôm nay</Text>
                        </View>
                        <Text style={styles.metricLabel}>LƯỢT ĐÁ HÔM NAY</Text>
                        <Text style={[styles.metricValue, { color: '#006b2c' }]}>
                            {kpis.todayCount} <Text style={styles.metricUnit}>đơn</Text>
                        </Text>
                        <Text style={styles.metricSub}>Cần đón tiếp tại sân</Text>
                    </View>

                    {/* Ô 3: Khách vãng lai */}
                    <View style={styles.metricCard}>
                        <View style={styles.metricCardTop}>
                            <View style={[styles.metricIconBox, { backgroundColor: '#e0f2fe' }]}>
                                <Ionicons name="walk" size={16} color="#0284c7" />
                            </View>
                            <Text style={[styles.metricTagText, { color: '#0284c7' }]}>{kpis.guestPct}%</Text>
                        </View>
                        <Text style={styles.metricLabel}>KHÁCH VÃNG LAI</Text>
                        <Text style={[styles.metricValue, { color: '#0284c7' }]}>
                            {kpis.guestCount} <Text style={styles.metricUnit}>đơn</Text>
                        </Text>
                        <Text style={styles.metricSub}>Đặt qua quầy / website</Text>
                    </View>

                    {/* Ô 4: Chờ duyệt / xác nhận */}
                    <View style={styles.metricCard}>
                        <View style={styles.metricCardTop}>
                            <View style={[styles.metricIconBox, { backgroundColor: kpis.pendingCount > 0 ? '#fef3c7' : '#f8fafc' }]}>
                                <Ionicons name="clipboard-outline" size={16} color={kpis.pendingCount > 0 ? '#d97706' : '#64748b'} />
                            </View>
                            <Text style={[styles.metricTagText, { color: kpis.pendingCount > 0 ? '#d97706' : '#64748b' }]}>
                                {kpis.pendingCount > 0 ? 'Cần duyệt' : 'Xong'}
                            </Text>
                        </View>
                        <Text style={styles.metricLabel}>CHỜ DUYỆT / XÁC NHẬN</Text>
                        <Text style={[styles.metricValue, { color: kpis.pendingCount > 0 ? '#d97706' : '#0f172a' }]}>
                            {kpis.pendingCount} <Text style={styles.metricUnit}>đơn</Text>
                        </Text>
                        <Text style={[styles.metricSub, kpis.pendingCount > 0 && { color: '#dc2626', fontWeight: '700' }]}>
                            {kpis.pendingCount > 0 ? '• Cần duyệt đơn ngay' : 'Tất cả đơn đều đã xử lý'}
                        </Text>
                    </View>
                </View>

                {/* BẢNG TABS PHÂN BỐ CÂN XỨNG: LƯỚI 4 CỘT x 2 HÀNG (Hiển thị trọn vẹn trong 1 màn hình, vuông vắn, không lộn xộn!) */}
                {/* BẢNG TABS PHÂN BỔ CÂN XỨNG: LƯỚI 4 CỘT x 2 HÀNG (Hiển thị trọn vẹn trong 1 màn hình, vuông vắn, không lộn xộn!) */}
                <View style={styles.gridTabsCard}>
                    <View style={styles.gridTabsRow}>
                        {tabRow1.map(renderTabItem)}
                    </View>
                    <View style={[styles.gridTabsRow, { marginTop: 6 }]}>
                        {tabRow2.map(renderTabItem)}
                    </View>
                </View>
                {/* Filter Controls Panel: Ô tìm kiếm + 3 Dropdown xổ dữ liệu */}
                <View style={styles.filterControlsPanel}>
                    {/* Search Input */}
                    <View style={styles.filterSearchWrap}>
                        <Ionicons name="search" size={15} color="#94a3b8" />
                        <TextInput
                            style={styles.filterSearchInput}
                            placeholder="Tìm theo Mã đơn #BK..., Tên khách, SĐT..."
                            placeholderTextColor="#94a3b8"
                            value={query}
                            onChangeText={setQuery}
                        />
                        {query.length > 0 && (
                            <TouchableOpacity onPress={() => setQuery('')}>
                                <Ionicons name="close-circle" size={15} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Filter Dropdown Row: Nhấn vào thì XỔ DỮ LIỆU ĐANG CÓ XUỐNG */}
                    <View style={styles.filterDropdownRowResponsive}>
                        {/* Dropdown 1: Sân bóng (Xổ danh sách sân) */}
                        <TouchableOpacity
                            style={[styles.filterDropdownPill, Boolean(filterField) && styles.filterDropdownPillActive]}
                            onPress={() => setFieldPickerVisible(true)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="football-outline" size={12} color={Boolean(filterField) ? "#006b2c" : "#64748b"} />
                            <Text style={[styles.filterDropdownPillText, Boolean(filterField) && styles.filterDropdownPillTextActive]} numberOfLines={1}>
                                {filterField || 'Tất cả sân'}
                            </Text>
                            <Ionicons name="chevron-down" size={11} color={Boolean(filterField) ? "#006b2c" : "#94a3b8"} />
                        </TouchableOpacity>

                        {/* Dropdown 2: Tệp khách hàng (Xổ menu chọn loại khách) */}
                        <TouchableOpacity
                            style={[styles.filterDropdownPill, filterGuest !== 'all' && styles.filterDropdownPillActive]}
                            onPress={() => setGuestPickerVisible(true)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="people-outline" size={12} color={filterGuest !== 'all' ? "#006b2c" : "#64748b"} />
                            <Text style={[styles.filterDropdownPillText, filterGuest !== 'all' && styles.filterDropdownPillTextActive]} numberOfLines={1}>
                                {filterGuest === 'guest' ? 'Khách vãng lai' : filterGuest === 'member' ? 'Thành viên' : 'Tất cả khách'}
                            </Text>
                            <Ionicons name="chevron-down" size={11} color={filterGuest !== 'all' ? "#006b2c" : "#94a3b8"} />
                        </TouchableOpacity>

                        {/* Dropdown 3: Ngày đặt (Xổ lịch các ngày) */}
                        <TouchableOpacity
                            style={[styles.filterDropdownPill, Boolean(filterDate) && styles.filterDropdownPillActive]}
                            onPress={() => setDatePickerVisible(true)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="calendar-outline" size={12} color={Boolean(filterDate) ? "#006b2c" : "#64748b"} />
                            <Text style={[styles.filterDropdownPillText, Boolean(filterDate) && styles.filterDropdownPillTextActive]} numberOfLines={1}>
                                {filterDate ? formatDisplayDate(filterDate) : 'dd/mm/yyyy'}
                            </Text>
                            <Ionicons name="chevron-down" size={11} color={Boolean(filterDate) ? "#006b2c" : "#94a3b8"} />
                        </TouchableOpacity>

                        {/* Reset Filter Button */}
                        {hasActiveFilters && (
                            <TouchableOpacity
                                style={styles.btnResetFilters}
                                onPress={handleResetFilters}
                            >
                                <Ionicons name="refresh-outline" size={13} color="#dc2626" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Quick Period Filter Chips - Tối ưu hiển thị trọn vẹn trong 1 màn hình */}
                    <View style={styles.periodFilterRow}>
                        <Text style={styles.periodFilterLabel}>Thời gian:</Text>
                        <View style={styles.periodFilterChipsGroup}>
                            {[
                                { key: 'all', label: 'Tất cả' },
                                { key: 'today', label: 'Hôm nay' },
                                { key: 'week', label: 'Tuần này' },
                                { key: 'month', label: 'Tháng này' },
                                { key: 'year', label: 'Năm nay' },
                            ].map(p => {
                                const isSel = filterPeriod === p.key;
                                return (
                                    <TouchableOpacity
                                        key={p.key}
                                        style={[styles.periodFilterChip, isSel && styles.periodFilterChipActive]}
                                        onPress={() => {
                                            setFilterPeriod(p.key);
                                            if (p.key !== 'all') setFilterDate('');
                                        }}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.periodFilterChipText, isSel && styles.periodFilterChipTextActive]}>
                                            {p.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </View>

                {/* Color Legend Compact */}
                <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#15803d' }]} />
                        <Text style={styles.legendText}>Đã check-in</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#b45309' }]} />
                        <Text style={styles.legendText}>Đã cọc 50%</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#1d4ed8' }]} />
                        <Text style={styles.legendText}>Chờ cọc</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#dc2626' }]} />
                        <Text style={styles.legendText}>Đã hủy</Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.responsiveContainer}>
                {loading ? (
                    <View style={{ flex: 1 }}>
                        {renderListHeader()}
                        <View style={styles.centerBox}>
                            <ActivityIndicator size="large" color="#006b2c" />
                            <Text style={styles.loadingText}>Đang tải dữ liệu đặt sân từ CSDL...</Text>
                        </View>
                    </View>
                ) : filterCategory === 'lost_found' ? (
                    /* Lost & Found List View */
                    <ScrollView
                        style={{ flex: 1 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#006b2c']} />}
                        contentContainerStyle={{ paddingBottom: 100 }}
                    >
                        {renderListHeader()}

                        <View style={{ padding: 14, gap: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fef3c7', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#fde68a' }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#b45309' }}>
                                        QUẢN LÝ ĐỒ KHÁCH BỎ QUÊN ({lostFoundItems.length})
                                    </Text>
                                    <Text style={{ fontSize: 11, color: '#78350f', marginTop: 2 }}>
                                        Lưu trữ tại kho tủ lễ tân & bàn giao cho khách đến nhận lại.
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    style={{ backgroundColor: '#b45309', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                    onPress={() => {
                                        setLostFieldName(fields[0]?.field_name || fields[0]?.name || 'Sân bóng');
                                        setLostModalVisible(true);
                                    }}
                                >
                                    <Ionicons name="add" size={14} color="#ffffff" />
                                    <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 11 }}>+ Ghi nhận</Text>
                                </TouchableOpacity>
                            </View>

                            {lostFoundItems.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="bag-handle-outline" size={48} color="#94a3b8" />
                                    <Text style={styles.emptyTitle}>Kho tủ lễ tân trống</Text>
                                    <Text style={styles.emptySub}>Không có món đồ thất lạc nào đang lưu trữ</Text>
                                </View>
                            ) : (
                                lostFoundItems.map(item => {
                                    const st = String(item.status || 'pending').toLowerCase();
                                    const isRet = st === 'returned';
                                    const isCont = st === 'contacted';
                                    const statusLabel = isRet ? 'Đã trả khách' : isCont ? 'Đã liên hệ' : 'Chờ nhận';
                                    const statusBg = isRet ? '#dcfce7' : isCont ? '#e0f2fe' : '#fef3c7';
                                    const statusColor = isRet ? '#15803d' : isCont ? '#0284c7' : '#b45309';

                                    return (
                                        <View key={item.id} style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 8 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                                    <Ionicons name="bag-handle" size={16} color="#006b2c" />
                                                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}>
                                                        {item.item_name || 'Đồ bỏ quên'}
                                                    </Text>
                                                </View>
                                                <View style={{ backgroundColor: statusBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                                    <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>
                                                        {statusLabel}
                                                    </Text>
                                                </View>
                                            </View>

                                            <Text style={{ fontSize: 13, color: '#334155' }}>
                                                Khu vực: <Text style={{ fontWeight: '700' }}>{item.field_name || 'Sân bóng'}</Text>
                                                {item.location_found ? ` • Vị trí: ${item.location_found}` : ''}
                                            </Text>

                                            {item.description ? (
                                                <Text style={{ fontSize: 12, color: '#64748b' }}>
                                                    Mô tả: {item.description}
                                                </Text>
                                            ) : null}

                                            {item.guest_name && (
                                                <View style={{ backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#006b2c' }}>
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b' }}>
                                                        {item.guest_name || 'Khách liên hệ'}
                                                    </Text>
                                                    {item.customer_phone ? (
                                                        <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                                            SĐT: {item.customer_phone}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                            )}

                                            {item.return_note ? (
                                                <Text style={{ fontSize: 11, color: '#15803d', fontStyle: 'italic' }}>
                                                    Bàn giao: {item.return_note}
                                                </Text>
                                            ) : null}

                                            {!isRet && (
                                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8 }}>
                                                    {!isCont && (
                                                        <TouchableOpacity
                                                            style={{ flex: 1, paddingVertical: 7, borderRadius: 6, backgroundColor: '#e0f2fe', alignItems: 'center' }}
                                                            onPress={() => handleUpdateLostStatus(item, 'contacted', 'Đã liên hệ')}
                                                        >
                                                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#0284c7' }}>Đã liên hệ khách</Text>
                                                        </TouchableOpacity>
                                                    )}

                                                    <TouchableOpacity
                                                        style={{ flex: 1, paddingVertical: 7, borderRadius: 6, backgroundColor: '#dcfce7', alignItems: 'center' }}
                                                        onPress={() => handleUpdateLostStatus(item, 'returned', 'Đã trả khách')}
                                                    >
                                                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#15803d' }}>Đã trao trả khách</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    </ScrollView>
                ) : (
                    /* Timeline List View: Cuộn cả trang từ trên xuống dưới mượt mà */
                    <FlatList
                        data={filtered}
                        keyExtractor={(item) => String(item.id || item.booking_id || Math.random())}
                        renderItem={renderBookingItem}
                        ListHeaderComponent={renderListHeader}
                        contentContainerStyle={styles.listContent}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#006b2c']} />}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="calendar-outline" size={48} color="#94a3b8" />
                                <Text style={styles.emptyTitle}>Không tìm thấy đơn đặt sân nào</Text>
                                <Text style={styles.emptySub}>
                                    {hasActiveFilters
                                        ? 'Thử thay đổi bộ lọc trạng thái, loại khách, ngày hoặc từ khóa tìm kiếm'
                                        : 'Chưa có dữ liệu đơn đặt sân nào trong hệ thống'}
                                </Text>
                                {hasActiveFilters && (
                                    <TouchableOpacity
                                        style={{ backgroundColor: '#006b2c', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, marginTop: 14 }}
                                        onPress={handleResetFilters}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>Đặt lại tất cả bộ lọc</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        }
                    />
                )}

                {/* Bottom App Navigation Bar (Only for Admins/Managers) */}
                {isAdmin && <AdminBottomNav activeTab="bookings" navigation={navigation} />}
            </View>

            {/* MODAL: QUÉT MÃ QR CHECK-IN TIẾP ĐÓN KHÁCH */}
            <Modal
                visible={qrModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setQrModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCardLarge, { maxHeight: '90%', width: '92%', maxWidth: 500 }]}>
                        {/* Header */}
                        <View style={[styles.modalMainHeader, { backgroundColor: '#0284c7', borderTopLeftRadius: 16, borderTopRightRadius: 16 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="qr-code" size={19} color="#ffffff" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.modalTitleText, { color: '#ffffff', fontSize: 16 }]}>Quét QR Check-in</Text>
                                    <Text style={{ fontSize: 11, color: '#e0f2fe' }}>Tiếp đón khách • Xác nhận nhận sân 1 chạm</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setQrModalVisible(false)}>
                                <Ionicons name="close-circle" size={24} color="#ffffff" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ padding: 16 }}>
                            {/* Input Scan Code */}
                            <Text style={[styles.modalFieldLabel, { marginBottom: 6 }]}>NHẬP MÃ ĐƠN (#BK...), MÃ VÉ HOẶC SĐT KHÁCH:</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#0284c7', borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#f0f9ff', marginBottom: 14 }}>
                                <Ionicons name="barcode-outline" size={20} color="#0284c7" />
                                <TextInput
                                    style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, fontWeight: '700', color: '#0f172a' }}
                                    placeholder="Nhập mã #BK..., mã vé hoặc SĐT..."
                                    placeholderTextColor="#94a3b8"
                                    value={qrSearchInput}
                                    onChangeText={handleSearchQrCode}
                                    autoCapitalize="characters"
                                    autoFocus
                                />
                                {qrSearchInput ? (
                                    <TouchableOpacity onPress={() => handleSearchQrCode('')}>
                                        <Ionicons name="close-circle" size={18} color="#94a3b8" />
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            {/* Ticket Result Preview */}
                            {qrFoundBooking && qrFoundBooking !== 'not_found' ? (
                                <View style={{ backgroundColor: '#f0fdf4', borderRadius: 12, borderWidth: 1.5, borderColor: '#86efac', padding: 14, marginBottom: 16 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="checkmark-circle" size={16} color="#15803d" />
                                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#15803d' }}>
                                                VÉ MATCH PASS HỢP LỆ
                                            </Text>
                                        </View>
                                        <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#15803d' }}>
                                                #{qrFoundBooking.id}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={{ gap: 5 }}>
                                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}>
                                            Khách hàng: {qrFoundBooking.customer_name || qrFoundBooking.user_name || 'Khách'}
                                        </Text>
                                        <Text style={{ fontSize: 13, color: '#334155' }}>
                                            SĐT: <Text style={{ fontWeight: '600' }}>{qrFoundBooking.phone || qrFoundBooking.customer_phone || 'Chưa cập nhật'}</Text>
                                        </Text>
                                        <Text style={{ fontSize: 13, color: '#334155' }}>
                                            Sân bóng: <Text style={{ fontWeight: '700', color: '#006b2c' }}>{qrFoundBooking.field_name || qrFoundBooking.field || 'Sân bóng'}</Text>
                                        </Text>
                                        <Text style={{ fontSize: 13, color: '#334155' }}>
                                            Khung giờ: <Text style={{ fontWeight: '700' }}>{qrFoundBooking.time || qrFoundBooking.time_slot || '17:30 - 19:00'}</Text>
                                        </Text>
                                        <Text style={{ fontSize: 13, color: '#334155' }}>
                                            Ngày đá: <Text style={{ fontWeight: '600' }}>{formatDisplayDate(qrFoundBooking.date || qrFoundBooking.booking_date) || 'Hôm nay'}</Text>
                                        </Text>
                                        <Text style={{ fontSize: 13, color: '#334155' }}>
                                            Trạng thái hiện tại: <Text style={{ fontWeight: '700', color: '#0284c7' }}>{qrFoundBooking.status}</Text>
                                        </Text>
                                    </View>

                                    {/* Check-in Action Button */}
                                    <TouchableOpacity
                                        style={{ backgroundColor: '#006b2c', marginTop: 14, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                                        onPress={() => handleConfirmQrCheckIn(qrFoundBooking)}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="checkmark-done" size={18} color="#ffffff" />
                                        <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14 }}>
                                            XÁC NHẬN NHẬN SÂN (CHECK-IN 1 CHẠM)
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ) : qrFoundBooking === 'not_found' ? (
                                <View style={{ backgroundColor: '#fef2f2', borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#fca5a5', marginBottom: 16 }}>
                                    <Ionicons name="alert-circle" size={24} color="#b91c1c" />
                                    <Text style={{ color: '#b91c1c', fontWeight: '700', marginTop: 4 }}>Không tìm thấy mã đơn đặt sân phù hợp</Text>
                                    <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 2 }}>Vui lòng kiểm tra lại mã #BK hoặc số điện thoại của khách</Text>
                                </View>
                            ) : null}

                            {/* Quick suggestions */}
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 8 }}>
                                CÁC ĐƠN ĐẶT SÂN GẦN NHẤT HÔM NAY:
                            </Text>
                            <View style={{ gap: 6 }}>
                                {bookings.slice(0, 5).map(b => (
                                    <TouchableOpacity
                                        key={b.id}
                                        style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                                        onPress={() => handleSearchQrCode(String(b.id || b.code || ''))}
                                    >
                                        <View>
                                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b' }}>
                                                #{b.id} • {b.customer_name || 'Khách'}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: '#64748b' }}>
                                                {b.field_name || b.field} | {b.time || b.time_slot}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* MODAL: XỔ DANH SÁCH SÂN BÓNG ĐỂ LỌC (DROPDOWN 1) */}
            <Modal
                visible={fieldPickerVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setFieldPickerVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalPickerCard}>
                        <View style={styles.modalPickerHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="football" size={17} color="#006b2c" />
                                <Text style={styles.modalPickerTitle}>Chọn Sân Bóng Cần Lọc</Text>
                            </View>
                            <TouchableOpacity onPress={() => setFieldPickerVisible(false)}>
                                <Ionicons name="close" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 350 }}>
                            <TouchableOpacity
                                style={[styles.pickerItemRow, !filterField && styles.pickerItemRowActive]}
                                onPress={() => {
                                    setFilterField('');
                                    setFieldPickerVisible(false);
                                }}
                            >
                                <Ionicons name="apps" size={16} color={!filterField ? "#006b2c" : "#64748b"} />
                                <Text style={[styles.pickerItemText, !filterField && styles.pickerItemTextActive]}>
                                    Tất cả các sân bóng
                                </Text>
                                {!filterField && <Ionicons name="checkmark-circle" size={18} color="#006b2c" />}
                            </TouchableOpacity>

                            {fields.map(f => {
                                const fName = f.field_name || f.name || 'Sân';
                                const isSel = filterField === fName;
                                return (
                                    <TouchableOpacity
                                        key={f.id}
                                        style={[styles.pickerItemRow, isSel && styles.pickerItemRowActive]}
                                        onPress={() => {
                                            setFilterField(fName);
                                            setFieldPickerVisible(false);
                                        }}
                                    >
                                        <Ionicons name="football-outline" size={16} color={isSel ? "#006b2c" : "#64748b"} />
                                        <Text style={[styles.pickerItemText, isSel && styles.pickerItemTextActive]}>
                                            {fName}
                                        </Text>
                                        {isSel && <Ionicons name="checkmark-circle" size={18} color="#006b2c" />}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* MODAL: XỔ TỆP KHÁCH HÀNG ĐỂ LỌC (DROPDOWN 2) */}
            <Modal
                visible={guestPickerVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setGuestPickerVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalPickerCard}>
                        <View style={styles.modalPickerHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="people" size={17} color="#006b2c" />
                                <Text style={styles.modalPickerTitle}>Chọn Tệp Khách Hàng</Text>
                            </View>
                            <TouchableOpacity onPress={() => setGuestPickerVisible(false)}>
                                <Ionicons name="close" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {[
                                { key: 'all', label: 'Tất cả loại khách', sub: 'Toàn bộ khách vãng lai & thành viên', icon: 'people' },
                                { key: 'guest', label: 'Khách vãng lai', sub: 'Khách đặt trực tiếp qua quầy / website không tài khoản', icon: 'walk' },
                                { key: 'member', label: 'Thành viên sân bóng', sub: 'Khách đã có tài khoản hệ thống', icon: 'shield-checkmark' },
                            ].map(opt => {
                                const isSel = filterGuest === opt.key;
                                return (
                                    <TouchableOpacity
                                        key={opt.key}
                                        style={[styles.pickerItemRow, isSel && styles.pickerItemRowActive]}
                                        onPress={() => {
                                            setFilterGuest(opt.key);
                                            setGuestPickerVisible(false);
                                        }}
                                    >
                                        <Ionicons name={opt.icon} size={18} color={isSel ? "#006b2c" : "#64748b"} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.pickerItemText, isSel && styles.pickerItemTextActive]}>
                                                {opt.label}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                                                {opt.sub}
                                            </Text>
                                        </View>
                                        {isSel && <Ionicons name="checkmark-circle" size={18} color="#006b2c" />}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* MODAL: XỔ LỊCH NGÀY ĐỂ LỌC (DROPDOWN 3) */}
            <Modal
                visible={datePickerVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setDatePickerVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalPickerCard}>
                        <View style={styles.modalPickerHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="calendar" size={17} color="#006b2c" />
                                <Text style={styles.modalPickerTitle}>Chọn Ngày Cần Xem Lịch</Text>
                            </View>
                            <TouchableOpacity onPress={() => setDatePickerVisible(false)}>
                                <Ionicons name="close" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 350 }}>
                            <TouchableOpacity
                                style={[styles.pickerItemRow, !filterDate && styles.pickerItemRowActive]}
                                onPress={() => {
                                    setFilterDate('');
                                    setDatePickerVisible(false);
                                }}
                            >
                                <Ionicons name="calendar-outline" size={16} color={!filterDate ? "#006b2c" : "#64748b"} />
                                <Text style={[styles.pickerItemText, !filterDate && styles.pickerItemTextActive]}>
                                    Tất cả các ngày (Toàn hệ thống)
                                </Text>
                                {!filterDate && <Ionicons name="checkmark-circle" size={18} color="#006b2c" />}
                            </TouchableOpacity>

                            {/* Today quick option */}
                            {(() => {
                                const todayIso = new Date().toISOString().slice(0, 10);
                                const isSel = filterDate === todayIso;
                                return (
                                    <TouchableOpacity
                                        style={[styles.pickerItemRow, isSel && styles.pickerItemRowActive]}
                                        onPress={() => {
                                            setFilterDate(todayIso);
                                            setDatePickerVisible(false);
                                        }}
                                    >
                                        <Ionicons name="today" size={16} color={isSel ? "#006b2c" : "#64748b"} />
                                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={[styles.pickerItemText, isSel && styles.pickerItemTextActive]}>
                                                Hôm nay ({formatDisplayDate(todayIso)})
                                            </Text>
                                        </View>
                                        {isSel && <Ionicons name="checkmark-circle" size={18} color="#006b2c" />}
                                    </TouchableOpacity>
                                );
                            })()}

                            {/* List of distinct dates from bookings */}
                            {Array.from(new Set(bookings.map(b => b.date || b.booking_date || b.bookingDate).filter(Boolean))).sort().reverse().map(dStr => {
                                const isSel = filterDate === dStr;
                                const count = bookings.filter(b => (b.date || b.booking_date || b.bookingDate) === dStr).length;
                                return (
                                    <TouchableOpacity
                                        key={dStr}
                                        style={[styles.pickerItemRow, isSel && styles.pickerItemRowActive]}
                                        onPress={() => {
                                            setFilterDate(dStr);
                                            setDatePickerVisible(false);
                                        }}
                                    >
                                        <Ionicons name="calendar" size={16} color={isSel ? "#006b2c" : "#64748b"} />
                                        <Text style={[styles.pickerItemText, isSel && styles.pickerItemTextActive]}>
                                            Ngày {formatDisplayDate(dStr)} ({count} ca)
                                        </Text>
                                        {isSel && <Ionicons name="checkmark-circle" size={18} color="#006b2c" />}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* MODAL: THÊM ĐƠN ĐẶT SÂN MỚI (CRUD: CREATE) WITH CONFLICT VALIDATION */}
            <Modal
                visible={addModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setAddModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTicketCode}>QUẢN LÝ ĐẶT SÂN • THÊM ĐƠN</Text>
                                <Text style={styles.modalPitchName}>+ Thêm Đơn Đặt Sân Mới</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setAddModalVisible(false)}>
                                <Ionicons name="close" size={20} color="#0f172a" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
                            {/* Chọn Sân: Wrap for Mobile */}
                            <Text style={styles.formLabel}>Chọn Sân Bóng (*)</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                                {fields.map(f => {
                                    const fName = f.field_name || f.name || 'Sân';
                                    const isSel = (newField || (fields[0]?.field_name || fields[0]?.name)) === fName;
                                    return (
                                        <TouchableOpacity
                                            key={f.id}
                                            style={[styles.formSelectChip, isSel && styles.formSelectChipActive]}
                                            onPress={() => {
                                                setNewField(fName);
                                                if (f.price_per_hour) {
                                                    setNewPrice(String(f.price_per_hour));
                                                    setNewDeposit(String(Math.round(f.price_per_hour * 0.5)));
                                                }
                                            }}
                                        >
                                            <Text style={[styles.formSelectChipText, isSel && styles.formSelectChipTextActive]}>
                                                {fName}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Ngày Đặt */}
                            <Text style={styles.formLabel}>Ngày Đặt Sân (YYYY-MM-DD) (*)</Text>
                            <View style={styles.modalInputWrapper}>
                                <TextInput
                                    style={styles.modalInput}
                                    value={newDate}
                                    onChangeText={setNewDate}
                                    placeholder="2026-11-14"
                                />
                            </View>

                            {/* CHỌN KHUNG GIỜ VỚI CHỐNG XUNG ĐỘT (Conflict Check Real-time) */}
                            <View style={{ marginTop: 10, marginBottom: 4 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>
                                        Chọn Khung Giờ Thi Đấu (*)
                                    </Text>
                                    <Text style={{ fontSize: 11, color: '#64748b' }}>
                                        Khung giờ đã qua sẽ tự động khóa
                                    </Text>
                                </View>
                                <View style={styles.slotLegendBar}>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
                                        <Text style={styles.legendText}>Trống</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: '#006b2c' }]} />
                                        <Text style={styles.legendText}>Đang chọn</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                                        <Text style={styles.legendText}>Đã đặt</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: '#94a3b8' }]} />
                                        <Text style={styles.legendText}>Đã qua</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.slotGridContainer}>
                                {PRESET_TIME_SLOTS.map(slot => {
                                    const slotStart = slot.split('-')[0]?.trim();
                                    const isPast = isSlotExpired(newDate, slotStart);
                                    const conflict = getConflictingBooking(newField, newDate, slot);
                                    const isBooked = Boolean(conflict);
                                    const isSelected = newTime === slot;

                                    return (
                                        <TouchableOpacity
                                            key={slot}
                                            style={[
                                                styles.slotGridBtn,
                                                styles.slotGridBtnAvailable,
                                                isSelected && styles.slotGridBtnSelected,
                                                isBooked && styles.slotGridBtnBooked,
                                                isPast && styles.slotGridBtnPast,
                                            ]}
                                            onPress={() => {
                                                if (isPast) {
                                                    showAppAlert(
                                                        'Khung giờ đã qua',
                                                        `Khung giờ ${slot} ngày ${formatDisplayDate(newDate)} đã diễn ra trong quá khứ hoặc đang diễn ra. Không thể tạo đơn mới!`
                                                    );
                                                    return;
                                                }
                                                if (isBooked) {
                                                    showAppAlert(
                                                        'Khung giờ đã có người đặt',
                                                        `Khung giờ ${slot} tại ${newField} ngày ${formatDisplayDate(newDate)} đã có người đặt (Đơn #BK${String(conflict.id || conflict.booking_id).slice(0, 8)}). Vui lòng chọn ca khác!`
                                                    );
                                                    return;
                                                }
                                                setNewTime(slot);
                                            }}
                                            activeOpacity={isPast || isBooked ? 1 : 0.8}
                                        >
                                            <Text style={[
                                                styles.slotGridBtnText,
                                                isSelected && styles.slotGridBtnTextSelected,
                                                isBooked && styles.slotGridBtnTextBooked,
                                                isPast && styles.slotGridBtnTextPast,
                                            ]}>
                                                {slot}
                                            </Text>
                                            <Text style={[
                                                styles.slotGridSubText,
                                                isSelected && { color: '#ffffff' },
                                                isBooked && { color: '#dc2626' },
                                                isPast && { color: '#94a3b8' },
                                            ]}>
                                                {isPast ? '• Đã qua' : isBooked ? '• Đã đặt' : isSelected ? '✓ Đang chọn' : 'Trống'}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Tên khách & SĐT */}
                            <Text style={styles.formLabel}>Họ Tên Khách Hàng / Đội Bóng (*)</Text>
                            <View style={styles.modalInputWrapper}>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="VD: Nguyễn Văn A, FC Bách Khoa..."
                                    placeholderTextColor="#94a3b8"
                                    value={newCustomerName}
                                    onChangeText={setNewCustomerName}
                                />
                            </View>

                            <Text style={styles.formLabel}>Số Điện Thoại (*)</Text>
                            <View style={styles.modalInputWrapper}>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="0905123456"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="phone-pad"
                                    value={newCustomerPhone}
                                    onChangeText={setNewCustomerPhone}
                                />
                            </View>

                            {/* Phân loại khách */}
                            <Text style={styles.formLabel}>Phân Loại Khách Hàng</Text>
                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                                <TouchableOpacity
                                    style={[styles.segmentBtn, newIsGuest && styles.segmentBtnActive, { flex: 1, paddingVertical: 8 }]}
                                    onPress={() => setNewIsGuest(true)}
                                >
                                    <Ionicons name="walk" size={14} color={newIsGuest ? "#ffffff" : "#64748b"} />
                                    <Text style={[styles.segmentBtnText, newIsGuest && styles.segmentBtnTextActive]}>Khách vãng lai</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.segmentBtn, !newIsGuest && styles.segmentBtnActive, { flex: 1, paddingVertical: 8 }]}
                                    onPress={() => setNewIsGuest(false)}
                                >
                                    <Ionicons name="shield-checkmark" size={14} color={!newIsGuest ? "#ffffff" : "#64748b"} />
                                    <Text style={[styles.segmentBtnText, !newIsGuest && styles.segmentBtnTextActive]}>Thành viên</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Giá tiền & Tiền cọc */}
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.formLabel}>Giá Ca Sân (đ)</Text>
                                    <View style={styles.modalInputWrapper}>
                                        <TextInput
                                            style={styles.modalInput}
                                            value={newPrice}
                                            onChangeText={setNewPrice}
                                            keyboardType="numeric"
                                            placeholder="350000"
                                        />
                                    </View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.formLabel}>Tiền Cọc (đ)</Text>
                                    <View style={styles.modalInputWrapper}>
                                        <TextInput
                                            style={styles.modalInput}
                                            value={newDeposit}
                                            onChangeText={setNewDeposit}
                                            keyboardType="numeric"
                                            placeholder="175000"
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Trạng thái ban đầu */}
                            <Text style={styles.formLabel}>Trạng Thái Ban Đầu</Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                                {[
                                    { key: 'confirmed', label: 'Đã xác nhận' },
                                    { key: 'pending', label: 'Chờ duyệt' }
                                ].map(st => (
                                    <TouchableOpacity
                                        key={st.key}
                                        style={[styles.formSelectChip, newStatus === st.key && styles.formSelectChipActive]}
                                        onPress={() => setNewStatus(st.key)}
                                    >
                                        <Text style={[styles.formSelectChipText, newStatus === st.key && styles.formSelectChipTextActive]}>
                                            {st.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Ghi chú */}
                            <Text style={styles.formLabel}>Ghi Chú Đơn Đặt</Text>
                            <View style={styles.modalInputWrapper}>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Yêu cầu áo bib, bóng nảy, nước uống..."
                                    placeholderTextColor="#94a3b8"
                                    value={newNotes}
                                    onChangeText={setNewNotes}
                                />
                            </View>
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.modalCheckinBtn, { backgroundColor: '#006b2c', marginTop: 12 }]}
                            onPress={handleCreateBooking}
                            disabled={addSubmitting}
                        >
                            {addSubmitting ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                                    <Text style={styles.modalCheckinText}>TẠO ĐƠN ĐẶT SÂN</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL: CHỈNH SỬA ĐƠN ĐẶT SÂN (CRUD: UPDATE) - ĐỒNG BỘ 100% BẢN WEB */}
            <Modal
                visible={editModalVisible}
                transparent
                animationType="fade"
                onRequestClose={closeEditModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTicketCode}>
                                    CHỈNH SỬA ĐƠN #{String(editingBooking?.id || editingBooking?.booking_id || '').toUpperCase()}
                                </Text>
                                <Text style={styles.modalPitchName}>Cập Nhật Thông Tin Đơn</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={closeEditModal}>
                                <Ionicons name="close" size={20} color="#0f172a" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
                            {/* Top banner: Booking Summary chuẩn 100% bản Web */}
                            {editingBooking && (
                                <View style={styles.editSummaryCard}>
                                    <View style={styles.editSummaryRow}>
                                        <View style={styles.editSummaryCol}>
                                            <Text style={styles.editSummaryLabel}>Khách hàng</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                <Text style={styles.editSummaryVal}>{editingBooking.name || editingBooking.customer_name || 'Khách đặt'}</Text>
                                                <View style={[styles.editTagMini, { backgroundColor: editingBooking.is_guest ? '#fef3c7' : '#e0f2fe' }]}>
                                                    <Text style={[styles.editTagMiniText, { color: editingBooking.is_guest ? '#b45309' : '#0284c7' }]}>
                                                        {editingBooking.is_guest ? 'Vãng lai' : 'Thành viên'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>

                                        <View style={styles.editSummaryCol}>
                                            <Text style={styles.editSummaryLabel}>Số điện thoại</Text>
                                            <Text style={styles.editSummaryVal}>{editingBooking.phone || editingBooking.customer_phone || 'Chưa có SĐT'}</Text>
                                        </View>
                                    </View>

                                    <View style={[styles.editSummaryRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: '#f1f5f9' }]}>
                                        <View style={styles.editSummaryCol}>
                                            <Text style={styles.editSummaryLabel}>Sân đặt</Text>
                                            <Text style={styles.editSummaryVal}>{editField}</Text>
                                            {editField !== (editingBooking.field || editingBooking.field_name) && (
                                                <Text style={{ fontSize: 11, color: '#059669', fontWeight: '700' }}>
                                                    (Đổi từ {editingBooking.field || editingBooking.field_name})
                                                </Text>
                                            )}
                                        </View>

                                        <View style={styles.editSummaryCol}>
                                            <Text style={styles.editSummaryLabel}>Thanh toán & Cọc</Text>
                                            <Text style={[styles.editSummaryVal, { color: editingBooking.payment_info?.badge_type === 'full_paid' ? '#16a34a' : '#d97706' }]}>
                                                {editingBooking.payment_info?.status_label || 'Thanh toán tại sân'}
                                            </Text>
                                            {editingBooking.payment_info?.sub_label ? (
                                                <Text style={{ fontSize: 11, color: '#64748b' }}>
                                                    {editingBooking.payment_info.sub_label}
                                                </Text>
                                            ) : null}
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* 1. Chọn Sân Bóng (Đổi sân) - DROPDOWN SỔ XUỐNG CHUẨN 100% BẢN WEB */}
                            <View style={{ marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="football-outline" size={15} color="#006b2c" />
                                        <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>
                                            Sân Bóng Thi Đấu (*)
                                        </Text>
                                    </View>
                                    {editField !== (editingBooking?.field || editingBooking?.field_name) && (
                                        <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                                            <Text style={{ fontSize: 10, color: '#059669', fontWeight: '700' }}>
                                                Đổi từ {editingBooking?.field || editingBooking?.field_name}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* Trigger button: Click vào thì sổ xuống danh sách sân */}
                                <TouchableOpacity
                                    style={[
                                        styles.fieldDropdownTrigger,
                                        editFieldDropdownOpen && styles.fieldDropdownTriggerOpen
                                    ]}
                                    onPress={() => setEditFieldDropdownOpen(!editFieldDropdownOpen)}
                                    activeOpacity={0.8}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                                        <View style={styles.fieldDropdownIconWrap}>
                                            <Ionicons name="football" size={18} color="#006b2c" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={styles.fieldDropdownSelectedTitle} numberOfLines={1}>
                                                    {editField || 'Chọn sân bóng thi đấu...'}
                                                </Text>
                                                {(() => {
                                                    const curObj = (editFieldsList.length > 0 ? editFieldsList : fields).find(
                                                        f => (f.field_name || f.name) === editField || String(f.id) === String(editFieldId)
                                                    );
                                                    const fType = curObj?.field_type_name || curObj?.field_type || '';
                                                    if (!fType) return null;
                                                    return (
                                                        <View style={styles.fieldTypeBadgeMini}>
                                                            <Text style={styles.fieldTypeBadgeMiniText}>
                                                                {fType.includes('5') ? 'Sân 5' : fType.includes('11') ? 'Sân 11' : 'Sân 7'}
                                                            </Text>
                                                        </View>
                                                    );
                                                })()}
                                            </View>
                                            <Text style={styles.fieldDropdownSelectedSub} numberOfLines={1}>
                                                {(() => {
                                                    const curObj = (editFieldsList.length > 0 ? editFieldsList : fields).find(
                                                        f => (f.field_name || f.name) === editField || String(f.id) === String(editFieldId)
                                                    );
                                                    const p = curObj?.annotated_min_price || curObj?.min_price || curObj?.price_per_hour;
                                                    const pText = p ? `Giá từ ${Number(p).toLocaleString('vi-VN')}đ/giờ` : '';
                                                    const locText = curObj?.location ? ` · ${curObj.location}` : '';
                                                    return pText + locText || 'Bấm để đổi sân đang mở khung giờ đá';
                                                })()}
                                            </Text>
                                        </View>
                                    </View>
                                    <Ionicons
                                        name={editFieldDropdownOpen ? "chevron-up" : "chevron-down"}
                                        size={18}
                                        color="#64748b"
                                    />
                                </TouchableOpacity>

                                {/* Dropdown menu sổ xuống: Danh sách sân đang có khung giờ đá trong ngày */}
                                {editFieldDropdownOpen && (
                                    <View style={styles.fieldDropdownMenu}>
                                        <View style={styles.dropdownSearchBox}>
                                            <Ionicons name="search" size={16} color="#94a3b8" />
                                            <TextInput
                                                style={styles.dropdownSearchInput}
                                                placeholder="🔍 Tìm theo tên sân bóng..."
                                                placeholderTextColor="#94a3b8"
                                                value={editFieldSearch}
                                                onChangeText={setEditFieldSearch}
                                            />
                                            {editFieldSearch ? (
                                                <TouchableOpacity onPress={() => setEditFieldSearch('')}>
                                                    <Ionicons name="close-circle" size={16} color="#94a3b8" />
                                                </TouchableOpacity>
                                            ) : null}
                                        </View>

                                        <ScrollView
                                            style={{ maxHeight: 200 }}
                                            nestedScrollEnabled={true}
                                            showsVerticalScrollIndicator={true}
                                        >
                                            {editFieldsLoading ? (
                                                <View style={{ padding: 14, alignItems: 'center' }}>
                                                    <Text style={{ fontSize: 12, color: '#64748b' }}>Đang tải danh sách sân mở khung giờ...</Text>
                                                </View>
                                            ) : (() => {
                                                const availableList = editFieldsList.length > 0 ? editFieldsList : fields;
                                                const filteredFields = availableList.filter(f => {
                                                    if (!editFieldSearch) return true;
                                                    const q = editFieldSearch.toLowerCase();
                                                    return (f.field_name || f.name || '').toLowerCase().includes(q) ||
                                                           (f.location || '').toLowerCase().includes(q);
                                                });

                                                if (filteredFields.length === 0) {
                                                    return (
                                                        <View style={{ padding: 14, alignItems: 'center' }}>
                                                            <Text style={{ fontSize: 12, color: '#ef4444', fontStyle: 'italic' }}>
                                                                Không có sân nào mở khung giờ trong ngày này
                                                            </Text>
                                                        </View>
                                                    );
                                                }

                                                return filteredFields.map(f => {
                                                    const fName = f.field_name || f.name || 'Sân';
                                                    const isSel = editField === fName || String(editFieldId) === String(f.id);
                                                    const fType = f.field_type_name || f.field_type || '';
                                                    const p = f.annotated_min_price || f.min_price || f.price_per_hour;

                                                    return (
                                                        <TouchableOpacity
                                                            key={f.id}
                                                            style={[
                                                                styles.dropdownFieldItem,
                                                                isSel && styles.dropdownFieldItemActive
                                                            ]}
                                                            onPress={() => {
                                                                handleEditFieldChange(f);
                                                                setEditFieldDropdownOpen(false);
                                                            }}
                                                            activeOpacity={0.7}
                                                        >
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                                                                <View style={[
                                                                    styles.dropdownFieldItemIcon,
                                                                    isSel && { backgroundColor: '#006b2c' }
                                                                ]}>
                                                                    <Ionicons
                                                                        name="football"
                                                                        size={14}
                                                                        color={isSel ? '#ffffff' : '#64748b'}
                                                                    />
                                                                </View>
                                                                <View style={{ flex: 1 }}>
                                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                                        <Text style={[
                                                                            styles.dropdownFieldName,
                                                                            isSel && { color: '#006b2c', fontWeight: '700' }
                                                                        ]}>
                                                                            {fName}
                                                                        </Text>
                                                                        {fType ? (
                                                                            <View style={[
                                                                                styles.fieldTypeBadgeMini,
                                                                                isSel && { backgroundColor: '#dcfce7', borderColor: '#86efac' }
                                                                            ]}>
                                                                                <Text style={[
                                                                                    styles.fieldTypeBadgeMiniText,
                                                                                    isSel && { color: '#166534' }
                                                                                ]}>
                                                                                    {fType.includes('5') ? 'Sân 5' : fType.includes('11') ? 'Sân 11' : 'Sân 7'}
                                                                                </Text>
                                                                            </View>
                                                                        ) : null}
                                                                    </View>
                                                                    <Text style={styles.dropdownFieldMeta}>
                                                                        {p ? `Giá từ ${Number(p).toLocaleString('vi-VN')}đ/giờ` : ''}
                                                                        {f.location ? ` · ${f.location}` : ''}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                            {isSel && (
                                                                <Ionicons name="checkmark-circle" size={18} color="#006b2c" />
                                                            )}
                                                        </TouchableOpacity>
                                                    );
                                                });
                                            })()}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>

                            {/* 2. Ngày Đặt Sân (Ngày / Tháng / Năm - Chuẩn form bản Web) */}
                            <View style={{ marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="calendar-outline" size={15} color="#006b2c" />
                                        <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>
                                            Ngày Đặt Sân (Ngày / Tháng / Năm)
                                        </Text>
                                    </View>
                                    {editDate ? (
                                        <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0' }}>
                                            <Text style={{ fontSize: 11, color: '#166534', fontWeight: '700' }}>
                                                {formatDisplayDate(editDate)}
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>

                                {Platform.OS === 'web' ? (
                                    <View style={styles.webDateInputWrapper}>
                                        <input
                                            type="date"
                                            min={new Date().toISOString().slice(0, 10)}
                                            value={editDate}
                                            onChange={(e) => handleEditDateChange(e.target.value)}
                                            style={{
                                                width: '100%',
                                                height: 42,
                                                padding: '8px 12px',
                                                borderRadius: 10,
                                                border: '1.5px solid #cbd5e1',
                                                fontSize: 14,
                                                fontWeight: '600',
                                                color: '#0f172a',
                                                backgroundColor: '#ffffff',
                                                outline: 'none',
                                                fontFamily: 'inherit',
                                                boxSizing: 'border-box',
                                            }}
                                        />
                                    </View>
                                ) : (
                                    <View style={styles.modalInputWrapper}>
                                        <TextInput
                                            style={styles.modalInput}
                                            value={editDate}
                                            onChangeText={handleEditDateChange}
                                            placeholder="YYYY-MM-DD"
                                        />
                                    </View>
                                )}
                            </View>

                            {/* 3. CHỌN KHUNG GIỜ VỚI CHỐNG XUNG ĐỘT & KHÓA CA ĐÃ QUA */}
                            <View style={{ marginTop: 10, marginBottom: 4 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>
                                        Khung Giờ Thi Đấu (*)
                                    </Text>
                                    {editTimeslotsLoading && (
                                        <Text style={{ fontSize: 11, color: '#64748b' }}>Đang tải khung giờ...</Text>
                                    )}
                                </View>
                                <View style={styles.slotLegendBar}>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
                                        <Text style={styles.legendText}>Trống</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: '#006b2c' }]} />
                                        <Text style={styles.legendText}>Đang chọn</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                                        <Text style={styles.legendText}>Đã đặt</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: '#94a3b8' }]} />
                                        <Text style={styles.legendText}>Đã qua</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.slotGridContainer}>
                                {(() => {
                                    const slotsToRender = editTimeslots && editTimeslots.length > 0
                                        ? editTimeslots.map(s => {
                                            const start = s.start_time?.slice(0, 5) || s.start || '';
                                            const end = s.end_time?.slice(0, 5) || s.end || '';
                                            return {
                                                slotStr: `${start} - ${end}`,
                                                price: Number(s.price || 0),
                                                status: s.status
                                            };
                                        })
                                        : PRESET_TIME_SLOTS.map(str => ({ slotStr: str, price: 0, status: 'available' }));

                                    const currentBookingTime = editingBooking?.time || editingBooking?.time_slot || (editingBooking?.start_time ? `${editingBooking.start_time.slice(0, 5)} - ${editingBooking.end_time?.slice(0, 5)}` : '');
                                    const isCurrentField = editField === (editingBooking?.field || editingBooking?.field_name);
                                    const isCurrentDate = editDate === (editingBooking?.date || editingBooking?.booking_date);

                                    return slotsToRender.map(item => {
                                        const slot = item.slotStr;
                                        const slotStart = slot.split('-')[0]?.trim();
                                        const isSelf = isCurrentField && isCurrentDate && (slot === currentBookingTime);
                                        const isPast = !isSelf && isSlotExpired(editDate, slotStart);
                                        const conflict = !isSelf && getConflictingBooking(editField, editDate, slot, editingBooking?.id || editingBooking?.booking_id);
                                        const isBooked = !isSelf && (Boolean(conflict) || item.status === 'booked');
                                        const isBlocked = !isSelf && item.status === 'blocked';
                                        const isSelected = editTime === slot;

                                        return (
                                            <TouchableOpacity
                                                key={slot}
                                                style={[
                                                    styles.slotGridBtn,
                                                    styles.slotGridBtnAvailable,
                                                    isSelected && styles.slotGridBtnSelected,
                                                    isBooked && styles.slotGridBtnBooked,
                                                    isBlocked && styles.slotGridBtnBlocked,
                                                    isPast && styles.slotGridBtnPast,
                                                    isSelf && !isSelected && styles.slotGridBtnSelf,
                                                ]}
                                                onPress={() => {
                                                    if (isPast) {
                                                        showAppAlert(
                                                            'Khung giờ đã qua',
                                                            `Khung giờ ${slot} ngày ${formatDisplayDate(editDate)} đã diễn ra trong quá khứ hoặc đang diễn ra. Không thể chọn ca này!`
                                                        );
                                                        return;
                                                    }
                                                    if (isBooked) {
                                                        showAppAlert(
                                                            'Khung giờ đã có người đặt',
                                                            `Khung giờ ${slot} tại ${editField} ngày ${formatDisplayDate(editDate)} đã có người đặt. Không thể chọn ca này!`
                                                        );
                                                        return;
                                                    }
                                                    if (isBlocked) {
                                                        showAppAlert(
                                                            'Khung giờ đã bị khóa',
                                                            `Khung giờ ${slot} tại sân đang bảo trì hoặc tạm khóa.`
                                                        );
                                                        return;
                                                    }
                                                    setEditTime(slot);
                                                    if (item.price > 0) {
                                                        setEditBasePitchPrice(item.price);
                                                    }
                                                }}
                                                activeOpacity={isPast || isBooked || isBlocked ? 1 : 0.8}
                                            >
                                                <Text style={[
                                                    styles.slotGridBtnText,
                                                    isSelected && styles.slotGridBtnTextSelected,
                                                    isBooked && styles.slotGridBtnTextBooked,
                                                    isPast && styles.slotGridBtnTextPast,
                                                    isSelf && !isSelected && { color: '#0284c7' },
                                                ]}>
                                                    {slot}
                                                </Text>
                                                {item.price > 0 && (
                                                    <Text style={[
                                                        styles.slotPriceText,
                                                        isSelected && { color: '#dcfce7' },
                                                        isBooked && { color: '#f87171' },
                                                        isPast && { color: '#94a3b8' },
                                                    ]}>
                                                        {item.price.toLocaleString('vi-VN')}đ
                                                    </Text>
                                                )}
                                                <Text style={[
                                                    styles.slotGridSubText,
                                                    isSelected && { color: '#ffffff' },
                                                    isBooked && { color: '#dc2626' },
                                                    isPast && { color: '#94a3b8' },
                                                    isSelf && !isSelected && { color: '#0284c7', fontWeight: '700' }
                                                ]}>
                                                    {isSelf
                                                        ? (isSelected ? '✓ Ca hiện tại' : 'Ca gốc của đơn')
                                                        : isBooked
                                                        ? '• Đã đặt'
                                                        : isPast
                                                        ? '• Đã qua'
                                                        : isBlocked
                                                        ? '• Đã khóa'
                                                        : isSelected
                                                        ? '✓ Đang chọn'
                                                        : 'Trống'}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    });
                                })()}
                            </View>

                            {/* 4. Tên & SĐT */}
                            <Text style={styles.formLabel}>Họ Tên Khách Hàng</Text>
                            <View style={styles.modalInputWrapper}>
                                <TextInput
                                    style={styles.modalInput}
                                    value={editCustomerName}
                                    onChangeText={setEditCustomerName}
                                    placeholder="Tên khách hàng"
                                />
                            </View>

                            <Text style={styles.formLabel}>Số Điện Thoại</Text>
                            <View style={styles.modalInputWrapper}>
                                <TextInput
                                    style={styles.modalInput}
                                    value={editCustomerPhone}
                                    onChangeText={setEditCustomerPhone}
                                    keyboardType="phone-pad"
                                    placeholder="Số điện thoại"
                                />
                            </View>

                            {/* 5. Giá tiền */}
                            <Text style={styles.formLabel}>Tổng Tiền Sân & Dịch Vụ (đ)</Text>
                            <View style={styles.modalInputWrapper}>
                                <TextInput
                                    style={styles.modalInput}
                                    value={editPrice}
                                    onChangeText={(val) => {
                                        setEditPrice(val);
                                        const num = Number(val) || 0;
                                        const servCost = (editSelectedServices || []).reduce(
                                            (sum, s) => sum + (Number(s.quantity) || 0) * (Number(s.price) || 0),
                                            0
                                        );
                                        setEditBasePitchPrice(Math.max(0, num - servCost));
                                    }}
                                    keyboardType="numeric"
                                    placeholder="Giá tiền"
                                />
                            </View>

                            {/* 6. Trạng thái đơn */}
                            <Text style={styles.formLabel}>Trạng Thái Đơn</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                                {[
                                    { key: 'pending', label: 'Chờ duyệt', col: '#d97706', bg: '#fef3c7' },
                                    { key: 'confirmed', label: 'Đã xác nhận', col: '#15803d', bg: '#dcfce7' },
                                    { key: 'checked_in', label: 'Đã check-in', col: '#0284c7', bg: '#e0f2fe' },
                                    { key: 'completed', label: 'Hoàn thành', col: '#475569', bg: '#f1f5f9' },
                                    { key: 'cancelled', label: 'Hủy đơn', col: '#dc2626', bg: '#fee2e2' },
                                ].map(st => {
                                    const isSel = editStatus === st.key;
                                    return (
                                        <TouchableOpacity
                                            key={st.key}
                                            style={[
                                                styles.formSelectChip,
                                                { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
                                                isSel
                                                    ? { backgroundColor: st.col, borderColor: st.col, borderWidth: 1.5, shadowColor: st.col, shadowOpacity: 0.3, elevation: 2 }
                                                    : { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1 }
                                            ]}
                                            onPress={() => setEditStatus(st.key)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={{
                                                width: 7,
                                                height: 7,
                                                borderRadius: 4,
                                                backgroundColor: isSel ? '#ffffff' : st.col,
                                                marginRight: 6
                                            }} />
                                            <Text style={[
                                                styles.formSelectChipText,
                                                isSel ? { color: '#ffffff', fontWeight: '800' } : { color: '#334155', fontWeight: '600' }
                                            ]}>
                                                {isSel ? `✓ ${st.label}` : st.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* 7. Dịch vụ & Tiện ích thêm (Đồng bộ chuẩn 100% bản Web) */}
                            <View style={{ marginTop: 8, marginBottom: 10 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>
                                        Dịch Vụ & Tiện Ích Thêm
                                    </Text>
                                    <Text style={{ fontSize: 11, color: '#64748b' }}>
                                        {editSelectedServices.length > 0 ? `Đã chọn ${editSelectedServices.length} món` : 'Chọn thêm đồ uống, giày...'}
                                    </Text>
                                </View>

                                {editAvailableServices.length === 0 ? (
                                    <Text style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginVertical: 4 }}>
                                        Không có dịch vụ khả dụng trong kho
                                    </Text>
                                ) : (
                                    <View style={{ gap: 8 }}>
                                        {editAvailableServices.map(svc => {
                                            const selected = editSelectedServices.find(s => String(s.service_id) === String(svc.id));
                                            const isSelected = Boolean(selected);
                                            const stock = Number(svc.stock ?? 999);
                                            const isShoes = String(svc.category || svc.name || '').toLowerCase().includes('giày') || String(svc.category || '').toLowerCase().includes('shoes');

                                            return (
                                                <View
                                                    key={svc.id}
                                                    style={[
                                                        styles.editServiceCard,
                                                        isSelected && styles.editServiceCardActive,
                                                        stock <= 0 && { opacity: 0.6 }
                                                    ]}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <TouchableOpacity
                                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}
                                                            onPress={() => handleToggleService(svc)}
                                                            disabled={stock <= 0 && !isSelected}
                                                        >
                                                            <Ionicons
                                                                name={isSelected ? 'checkbox' : 'square-outline'}
                                                                size={20}
                                                                color={isSelected ? '#006b2c' : '#94a3b8'}
                                                            />
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b' }}>
                                                                    {svc.name}
                                                                </Text>
                                                                <Text style={{ fontSize: 11, color: '#64748b' }}>
                                                                    {Number(svc.price || 0).toLocaleString('vi-VN')} đ • Tồn kho: <Text style={{ fontWeight: '700', color: stock <= 0 ? '#dc2626' : '#059669' }}>{stock}</Text>
                                                                </Text>
                                                            </View>
                                                        </TouchableOpacity>

                                                        {isSelected && (
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                                <TouchableOpacity
                                                                    style={styles.qtyBtn}
                                                                    onPress={() => handleServiceQuantityChange(svc.id, -1)}
                                                                >
                                                                    <Text style={styles.qtyBtnText}>-</Text>
                                                                </TouchableOpacity>
                                                                <Text style={{ fontSize: 13, fontWeight: '700', minWidth: 20, textAlign: 'center' }}>
                                                                    {selected.quantity}
                                                                </Text>
                                                                <TouchableOpacity
                                                                    style={styles.qtyBtn}
                                                                    onPress={() => handleServiceQuantityChange(svc.id, 1)}
                                                                >
                                                                    <Text style={styles.qtyBtnText}>+</Text>
                                                                </TouchableOpacity>
                                                            </View>
                                                        )}
                                                    </View>

                                                    {/* Chọn size giày nếu là dịch vụ giày đá banh */}
                                                    {isSelected && isShoes && (
                                                        <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderColor: '#e2e8f0' }}>
                                                            <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                                                                Chọn size giày thi đấu:
                                                            </Text>
                                                            <View style={{ flexDirection: 'row', gap: 6 }}>
                                                                {['39', '40', '41', '42', '43', '44'].map(sz => {
                                                                    const isSzSel = selected.shoe_size === sz;
                                                                    return (
                                                                        <TouchableOpacity
                                                                            key={sz}
                                                                            style={[styles.sizeChip, isSzSel && styles.sizeChipActive]}
                                                                            onPress={() => handleServiceShoeSizeChange(svc.id, sz)}
                                                                        >
                                                                            <Text style={[styles.sizeChipText, isSzSel && styles.sizeChipTextActive]}>
                                                                                {sz}
                                                                            </Text>
                                                                        </TouchableOpacity>
                                                                    );
                                                                })}
                                                            </View>
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>

                            {/* 8. Ghi chú */}
                            <Text style={styles.formLabel}>Ghi Chú</Text>
                            <View style={styles.modalInputWrapper}>
                                <TextInput
                                    style={styles.modalInput}
                                    value={editNotes}
                                    onChangeText={setEditNotes}
                                    placeholder="Ghi chú thêm..."
                                />
                            </View>
                        </ScrollView>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                            <TouchableOpacity
                                style={[styles.modalDeleteBtn, { flex: 1 }]}
                                onPress={closeEditModal}
                            >
                                <Text style={{ color: '#dc2626', fontWeight: '700' }}>Hủy bỏ</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalCheckinBtn, { flex: 2, backgroundColor: '#006b2c' }]}
                                onPress={handleSaveEditBooking}
                                disabled={editSubmitting}
                            >
                                {editSubmitting ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <>
                                        <Ionicons name="save-outline" size={18} color="#ffffff" />
                                        <Text style={styles.modalCheckinText}>LƯU THAY ĐỔI</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* DETAIL INSPECTOR MODAL */}
            <Modal
                visible={detailModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setDetailModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {selectedBooking && (
                            <>
                                <View style={styles.modalHeader}>
                                    <View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={styles.modalTicketCode}>
                                                PHIẾU THI ĐẤU #PP-{String(selectedBooking.id || selectedBooking.booking_id).slice(0, 6).toUpperCase()}
                                            </Text>
                                            <View style={[styles.statusPill, {
                                                backgroundColor: getStatusBadge(selectedBooking.status).bg,
                                                borderColor: getStatusBadge(selectedBooking.status).border
                                            }]}>
                                                <Text style={[styles.statusPillText, { color: getStatusBadge(selectedBooking.status).color }]}>
                                                    {getStatusBadge(selectedBooking.status).label}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={styles.modalPitchName}>
                                            {selectedBooking.field || selectedBooking.field_name || 'Sân bóng'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.modalCloseBtn}
                                        onPress={() => setDetailModalVisible(false)}
                                    >
                                        <Ionicons name="close" size={20} color="#6b7280" />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                                    {/* Customer info */}
                                    <View style={styles.modalInfoBox}>
                                        <Text style={styles.modalSectionLabel}>THÔNG TIN NGƯỜI ĐẶT</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                <View style={styles.avatarCircle}>
                                                    <Text style={styles.avatarText}>
                                                        {(selectedBooking.name || selectedBooking.customer_name || 'K').charAt(0).toUpperCase()}
                                                    </Text>
                                                </View>
                                                <View>
                                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>
                                                        {selectedBooking.name || selectedBooking.customer_name || 'Khách đặt'}
                                                    </Text>
                                                    <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                                        {selectedBooking.phone || selectedBooking.customer_phone || 'Chưa có SĐT'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Match schedule info */}
                                    <View style={styles.modalInfoBox}>
                                        <Text style={styles.modalSectionLabel}>LỊCH THI ĐẤU</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                            <Ionicons name="calendar-outline" size={16} color="#006b2c" />
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
                                                {formatDisplayDate(selectedBooking.date || selectedBooking.booking_date) || 'Hôm nay'}
                                            </Text>
                                            <Text style={{ color: '#9ca3af' }}>•</Text>
                                            <Ionicons name="time-outline" size={16} color="#006b2c" />
                                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#006b2c' }}>
                                                {selectedBooking.time || selectedBooking.time_slot || (selectedBooking.start_time ? `${selectedBooking.start_time.slice(0, 5)} - ${selectedBooking.end_time?.slice(0, 5)}` : 'Theo ca')}
                                            </Text>
                                        </View>

                                        {Boolean(selectedBooking.notes) && (
                                            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: '#eceef0' }}>
                                                <Text style={{ fontSize: 12, color: '#4b5563' }}>
                                                    <Text style={{ fontWeight: '700' }}>Ghi chú: </Text>
                                                    {selectedBooking.notes}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Dịch vụ đi kèm (Đồng bộ chuẩn 100% bản Web) */}
                                    {Array.isArray(selectedBooking.services) && selectedBooking.services.length > 0 && (
                                        <View style={styles.modalInfoBox}>
                                            <Text style={styles.modalSectionLabel}>DỊCH VỤ ĐI KÈM</Text>
                                            <View style={{ marginTop: 8, gap: 6 }}>
                                                {selectedBooking.services.map((svc, sIdx) => (
                                                    <View key={svc.id || sIdx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Text style={{ fontSize: 13, color: '#1e293b', fontWeight: '600' }}>
                                                            • {svc.service_name || svc.name || 'Dịch vụ'} x{svc.quantity}
                                                            {svc.shoe_size ? ` (Size ${svc.shoe_size})` : ''}
                                                        </Text>
                                                        <Text style={{ fontSize: 12, color: '#006b2c', fontWeight: '700' }}>
                                                            {svc.total_price ? `${Number(svc.total_price).toLocaleString('vi-VN')} đ` : ''}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    )}

                                    {/* Payment Ledger */}
                                    <View style={styles.modalInfoBox}>
                                        <Text style={styles.modalSectionLabel}>THÔNG TIN THANH TOÁN (SEPAY NAPAS 24/7)</Text>
                                        <View style={{ marginTop: 8, gap: 6 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                <Text style={{ fontSize: 12, color: '#64748b' }}>Tổng giá trị đơn:</Text>
                                                <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827' }}>
                                                    {Number(selectedBooking.price || selectedBooking.total_price || selectedBooking.total_amount || 0).toLocaleString('vi-VN')} đ
                                                </Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                <Text style={{ fontSize: 12, color: '#64748b' }}>Tiền cọc:</Text>
                                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#006b2c' }}>
                                                    {Number(selectedBooking.payment_info?.deposit_amount ?? selectedBooking.deposit_amount ?? 0).toLocaleString('vi-VN')} đ
                                                </Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#eceef0', paddingTop: 6, marginTop: 4 }}>
                                                <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827' }}>Còn thu tại quầy:</Text>
                                                <Text style={{ fontSize: 14, fontWeight: '800', color: '#006b2c' }}>
                                                    {String(selectedBooking.status).toLowerCase() === 'completed'
                                                        ? '0 đ (Đã tất toán)'
                                                        : `${Math.max(0, Number(selectedBooking.price || selectedBooking.total_price || selectedBooking.total_amount || 0) - Number(selectedBooking.payment_info?.deposit_amount ?? selectedBooking.deposit_amount ?? 0)).toLocaleString('vi-VN')} đ`}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </ScrollView>

                                {/* Modal Actions */}
                                <View style={styles.modalActionRow}>
                                    {String(selectedBooking.status).toLowerCase() === 'pending' && (
                                        <TouchableOpacity
                                            style={[styles.modalCheckinBtn, { backgroundColor: '#059669' }]}
                                            onPress={() => {
                                                const bId = selectedBooking.id || selectedBooking.booking_id;
                                                handleQuickApprove(bId);
                                            }}
                                        >
                                            <MaterialIcons name="check-circle" size={18} color="#ffffff" />
                                            <Text style={styles.modalCheckinText}>DUYỆT ĐƠN NGAY</Text>
                                        </TouchableOpacity>
                                    )}

                                    {['confirmed', 'paid'].includes(String(selectedBooking.status).toLowerCase()) && (
                                        <TouchableOpacity
                                            style={styles.modalCheckinBtn}
                                            onPress={() => {
                                                const bId = selectedBooking.id || selectedBooking.booking_id;
                                                handleUpdateStatus(bId, 'checked_in', 'Đã check-in');
                                            }}
                                        >
                                            <Ionicons name="finger-print" size={18} color="#ffffff" />
                                            <Text style={styles.modalCheckinText}>XÁC NHẬN CHECK-IN</Text>
                                        </TouchableOpacity>
                                    )}

                                    <TouchableOpacity
                                        style={styles.modalDeleteBtn}
                                        onPress={() => {
                                            const bId = selectedBooking.id || selectedBooking.booking_id;
                                            handleDeleteBooking(bId);
                                        }}
                                    >
                                        <MaterialIcons name="delete" size={18} color="#dc2626" />
                                        <Text style={{ color: '#dc2626', fontSize: 13, fontWeight: '700', marginLeft: 4 }}>Xóa đơn</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* MODAL: BÁO CẦN DỌN VỆ SINH SÂN 5S */}
            <Modal
                visible={cleaningModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setCleaningModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={[styles.modalTicketCode, { color: '#0f766e' }]}>VẬN HÀNH SÂN • DỌN DẸP 5S</Text>
                                <Text style={styles.modalPitchName}>Bàn Giao Vệ Sinh Ca Đá</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setCleaningModalVisible(false)}>
                                <Ionicons name="close" size={20} color="#0f172a" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                            <View style={styles.cleaningBookingInfoBox}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="football" size={16} color="#0f766e" />
                                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}>
                                        {selectedCleaningBooking?.field || selectedCleaningBooking?.field_name || 'Sân bóng'}
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                                    Ca đá: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{selectedCleaningBooking?.time || selectedCleaningBooking?.time_slot || 'Theo ca'}</Text>
                                    {' • '}
                                    Ngày: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{formatDisplayDate(selectedCleaningBooking?.date || selectedCleaningBooking?.booking_date) || 'Hôm nay'}</Text>
                                </Text>
                                <Text style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                                    Khách đặt: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{selectedCleaningBooking?.name || selectedCleaningBooking?.customer_name || 'Khách đá'}</Text>
                                </Text>
                            </View>

                            <Text style={styles.formLabel}>Ghi Chú Yêu Cầu Dọn Dẹp (*)</Text>
                            <View style={styles.modalInputWrapper}>
                                <TextInput
                                    style={[styles.modalInput, { minHeight: 70, textAlignVertical: 'top' }]}
                                    multiline
                                    placeholder="VD: Quét dọn rác khán đài, gom chai nhựa, lau ghế chờ, thay túi rác mới..."
                                    placeholderTextColor="#94a3b8"
                                    value={cleaningNotes}
                                    onChangeText={setCleaningNotes}
                                />
                            </View>
                            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>
                                Yêu cầu sẽ được gửi tới nhân viên trực sân và lưu vào nhật ký vệ sinh cơ sở.
                            </Text>
                        </ScrollView>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                            <TouchableOpacity
                                style={[styles.modalDeleteBtn, { flex: 1 }]}
                                onPress={() => setCleaningModalVisible(false)}
                            >
                                <Text style={{ color: '#dc2626', fontWeight: '700' }}>Hủy bỏ</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalCheckinBtn, { flex: 2, backgroundColor: '#0f766e' }]}
                                onPress={handleConfirmCleaning}
                                disabled={cleaningSubmitting}
                            >
                                {cleaningSubmitting ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <>
                                        <MaterialIcons name="cleaning-services" size={17} color="#ffffff" />
                                        <Text style={styles.modalCheckinText}>BÁO CẦN DỌN 5S</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* MODAL: BÁO SỰ CỐ & BẢO TRÌ SÂN GẤP */}
            <Modal
                visible={maintenanceModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setMaintenanceModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={[styles.modalTicketCode, { color: '#b45309' }]}>SỰ CỐ KỸ THUẬT • KHẨN CẤP</Text>
                                <Text style={styles.modalPitchName}>Báo Cáo Sự Cố Sân Bóng</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setMaintenanceModalVisible(false)}>
                                <Ionicons name="close" size={20} color="#0f172a" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                            <View style={[styles.cleaningBookingInfoBox, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="alert-circle" size={16} color="#b45309" />
                                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}>
                                        {selectedMaintenanceBooking?.field || selectedMaintenanceBooking?.field_name || 'Sân bóng'}
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                                    Phát hiện trong ca: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{selectedMaintenanceBooking?.time || selectedMaintenanceBooking?.time_slot || 'Theo ca'}</Text>
                                </Text>
                            </View>

                            {/* Hạng mục sự cố */}
                            <Text style={styles.formLabel}>Hạng Mục Sự Cố (*)</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                                {[
                                    'Đèn chiếu sáng cao áp',
                                    'Mặt cỏ nhân tạo',
                                    'Lưới khung thành',
                                    'Hệ thống thoát nước',
                                    'Lưới chắn bóng quanh sân',
                                    'Thiết bị khác'
                                ].map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[
                                            styles.formSelectChip,
                                            maintCategory === cat && { backgroundColor: '#b45309', borderColor: '#b45309' }
                                        ]}
                                        onPress={() => setMaintCategory(cat)}
                                    >
                                        <Text style={[styles.formSelectChipText, maintCategory === cat && { color: '#ffffff', fontWeight: '700' }]}>
                                            {cat}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Mức độ ưu tiên */}
                            <Text style={styles.formLabel}>Mức Độ Ưu Tiên (*)</Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                                {[
                                    { label: 'Khẩn cấp', color: '#dc2626', bg: '#fee2e2' },
                                    { label: 'Cao', color: '#ea580c', bg: '#ffedd5' },
                                    { label: 'Trung bình', color: '#0284c7', bg: '#e0f2fe' },
                                ].map(pri => {
                                    const isSel = maintPriority === pri.label;
                                    return (
                                        <TouchableOpacity
                                            key={pri.label}
                                            style={[
                                                styles.formSelectChip,
                                                { flex: 1, alignItems: 'center', justifyContent: 'center' },
                                                isSel ? { backgroundColor: pri.color, borderColor: pri.color } : { backgroundColor: pri.bg }
                                            ]}
                                            onPress={() => setMaintPriority(pri.label)}
                                        >
                                            <Text style={[styles.formSelectChipText, isSel ? { color: '#ffffff', fontWeight: '800' } : { color: pri.color }]}>
                                                {pri.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Mô tả hiện trạng */}
                            <Text style={styles.formLabel}>Mô Tả Hiện Trạng Chi Tiết (*)</Text>
                            <View style={styles.modalInputWrapper}>
                                <TextInput
                                    style={[styles.modalInput, { minHeight: 70, textAlignVertical: 'top' }]}
                                    multiline
                                    placeholder="Mô tả cụ thể vị trí hỏng hóc, nguy cơ gián đoạn ca thi đấu..."
                                    placeholderTextColor="#94a3b8"
                                    value={maintDescription}
                                    onChangeText={setMaintDescription}
                                />
                            </View>
                        </ScrollView>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                            <TouchableOpacity
                                style={[styles.modalDeleteBtn, { flex: 1 }]}
                                onPress={() => setMaintenanceModalVisible(false)}
                            >
                                <Text style={{ color: '#dc2626', fontWeight: '700' }}>Hủy bỏ</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalCheckinBtn, { flex: 2, backgroundColor: '#b45309' }]}
                                onPress={handleConfirmMaintenance}
                                disabled={maintSubmitting}
                            >
                                {maintSubmitting ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <>
                                        <MaterialIcons name="construction" size={17} color="#ffffff" />
                                        <Text style={styles.modalCheckinText}>GỬI BÁO CÁO SỰ CỐ</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* MODAL: CREATE LOST & FOUND ITEM */}
            <Modal
                visible={lostModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setLostModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalSubHeader}>LỄ TÂN & KHO ĐỒ THẤT LẠC</Text>
                                <Text style={styles.modalMainHeader}>Ghi Nhận Đồ Khách Quên</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.closeBtn}
                                onPress={() => setLostModalVisible(false)}
                            >
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                            <View style={{ gap: 12, marginTop: 4 }}>
                                <View>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b', marginBottom: 4 }}>
                                        Loại món đồ <Text style={{ color: '#ef4444' }}>*</Text>
                                    </Text>
                                    <TextInput
                                        style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a' }}
                                        placeholder="Ví dụ: Áo khoác Nike, Giày Puma sz 41, Bình giữ nhiệt..."
                                        placeholderTextColor="#94a3b8"
                                        value={lostItemType}
                                        onChangeText={setLostItemType}
                                    />
                                </View>

                                <View>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b', marginBottom: 4 }}>
                                        Khu vực sân bóng
                                    </Text>
                                    <TextInput
                                        style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a' }}
                                        placeholder="Sân A1, Sân 7 vs 7..."
                                        placeholderTextColor="#94a3b8"
                                        value={lostFieldName}
                                        onChangeText={setLostFieldName}
                                    />
                                </View>

                                <View>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b', marginBottom: 4 }}>
                                        Vị trí tìm thấy
                                    </Text>
                                    <TextInput
                                        style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a' }}
                                        placeholder="Băng ghế chờ, Phòng thay đồ, Cạnh khung thành..."
                                        placeholderTextColor="#94a3b8"
                                        value={lostLocation}
                                        onChangeText={setLostLocation}
                                    />
                                </View>

                                <View>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b', marginBottom: 4 }}>
                                        Mô tả chi tiết đặc điểm
                                    </Text>
                                    <TextInput
                                        style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a', minHeight: 60 }}
                                        placeholder="Màu sắc, kích thước, đặc điểm nhận dạng..."
                                        placeholderTextColor="#94a3b8"
                                        multiline
                                        value={lostDescription}
                                        onChangeText={setLostDescription}
                                    />
                                </View>

                                <View>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b', marginBottom: 4 }}>
                                        Tên khách liên hệ (nếu có)
                                    </Text>
                                    <TextInput
                                        style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a' }}
                                        placeholder="Họ tên người liên hệ..."
                                        placeholderTextColor="#94a3b8"
                                        value={lostGuestName}
                                        onChangeText={setLostGuestName}
                                    />
                                </View>

                                <View>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b', marginBottom: 4 }}>
                                        Số điện thoại khách (nếu có)
                                    </Text>
                                    <TextInput
                                        style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a' }}
                                        placeholder="0905xxxxxx..."
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="phone-pad"
                                        value={lostGuestPhone}
                                        onChangeText={setLostGuestPhone}
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        <TouchableOpacity
                            style={{ backgroundColor: '#006b2c', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 14 }}
                            onPress={handleCreateLostItem}
                            disabled={lostSubmitting}
                        >
                            {lostSubmitting ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>
                                    LƯU VÀO KHO TỦ LỄ TÂN
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* In-Screen Dialog (Thay thế hoàn toàn window.alert và window.confirm mặc định của trình duyệt) */}
            <AppConfirmDialog {...dialogConfig} />
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
        maxWidth: 600,
        width: '100%',
        alignSelf: 'center',
        backgroundColor: '#f7f9fb',
    },
    listHeaderWrapper: {
        width: '100%',
        marginBottom: 8,
    },
    webPageHeader: {
        backgroundColor: '#ffffff',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    headerBackBtnMini: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },
    webEyebrowText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748b',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    webPageTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        marginTop: 2,
    },
    webPageSubtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
        lineHeight: 16,
    },
    btnAddBookingMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#006b2c',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 8,
    },
    btnAddBookingMainText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },
    metricsGridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#f8fafc',
    },
    metricCard: {
        width: '48.5%',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 13,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    metricCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    metricIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    metricTagText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
    },
    metricLabel: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#64748b',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    metricValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        marginVertical: 2,
    },
    metricUnit: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    metricSub: {
        fontSize: 10.5,
        color: '#64748b',
        marginTop: 2,
    },
    // BẢNG TABS PHÂN BỐ CÂN XỨNG: LƯỚI 4 CỘT x 2 HÀNG ĐỀU TĂM TẮP
    // BẢNG TABS PHÂN BỔ CÂN XỨNG: LƯỚI 4 CỘT x 2 HÀNG ĐỀU TĂM TẮP
    gridTabsCard: {
        backgroundColor: '#ffffff',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    gridTabsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    gridTabItem: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        paddingVertical: 7,
        paddingHorizontal: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridTabItemActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
        shadowColor: '#006b2c',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 2,
    },
    gridTabContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    gridTabLabel: {
        fontSize: 10.5,
        fontWeight: '600',
        color: '#475569',
        flexShrink: 1,
    },
    gridTabLabelActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    gridTabBadge: {
        minWidth: 16,
        height: 16,
        paddingHorizontal: 3,
        borderRadius: 8,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridTabBadgeActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    gridTabBadgeText: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#475569',
    },
    gridTabBadgeTextActive: {
        color: '#ffffff',
        fontWeight: '800',
    },
    filterControlsPanel: {
        backgroundColor: '#ffffff',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        gap: 8,
    },
    filterSearchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 8,
    },
    filterSearchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
        paddingVertical: 0,
    },
    filterDropdownRowResponsive: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    filterDropdownPill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    filterDropdownPillActive: {
        backgroundColor: '#f0fdf4',
        borderColor: '#86efac',
    },
    filterDropdownPillText: {
        fontSize: 10.5,
        color: '#475569',
        fontWeight: '600',
        flex: 1,
    },
    filterDropdownPillTextActive: {
        color: '#006b2c',
        fontWeight: '700',
    },
    btnResetFilters: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 7,
        borderRadius: 6,
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    legendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f1f5f9',
        marginHorizontal: 14,
        marginTop: 8,
        marginBottom: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    legendDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
    },
    legendText: {
        fontSize: 10.5,
        color: '#64748b',
        fontWeight: '500',
    },
    listContent: {
        paddingBottom: 110,
    },
    matchCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        position: 'relative',
        marginHorizontal: 14,
        marginBottom: 12,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardAccentBar: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: 4.5,
    },
    cardInner: {
        paddingLeft: 16,
        paddingRight: 14,
        paddingVertical: 14,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    pitchBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    pitchCodeTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    pitchCodeText: {
        fontSize: 12,
        fontWeight: '800',
    },
    codeText: {
        fontSize: 11,
        color: '#6b7280',
        fontWeight: '600',
    },
    customerMiniAvatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    customerMiniAvatarText: {
        fontSize: 11,
        fontWeight: '800',
    },
    matchTitle: {
        fontSize: 14.5,
        fontWeight: '700',
        color: '#111827',
    },
    tagGuestPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: '#e0f2fe',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
    },
    tagGuestText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#0284c7',
    },
    tagMemberPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: '#dcfce7',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
    },
    tagMemberText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#059669',
    },
    customerPhoneText: {
        fontSize: 11,
        color: '#64748b',
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
        gap: 4,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusPillText: {
        fontSize: 10,
        fontWeight: '700',
    },
    matchTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
    },
    timeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    timeTagText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#006b2c',
    },
    dateTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    dateTagText: {
        fontSize: 12,
        color: '#64748b',
    },
    dateTagToday: {
        backgroundColor: '#dcfce7',
        borderColor: '#86efac',
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    dateTagTextToday: {
        color: '#006b2c',
        fontWeight: '700',
    },
    todaySmallBadge: {
        backgroundColor: '#006b2c',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        marginLeft: 4,
    },
    todaySmallBadgeText: {
        color: '#ffffff',
        fontSize: 9,
        fontWeight: '700',
    },
    ledgerCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 10,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    ledgerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ledgerColLabel: {
        fontSize: 11,
        color: '#4b5563',
    },
    ledgerColVal: {
        fontSize: 11,
        fontWeight: '700',
        color: '#111827',
        marginLeft: 3,
    },
    ledgerColDot: {
        fontSize: 11,
        color: '#9ca3af',
        marginHorizontal: 5,
    },
    payBadgeMini: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    payBadgeMiniText: {
        fontSize: 10,
        fontWeight: '700',
    },
    bookingServicesRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 1,
        borderColor: '#f1f5f9',
    },
    bookingServicesList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        flex: 1,
    },
    bookingServiceChip: {
        backgroundColor: '#f0f9ff',
        borderColor: '#bae6fd',
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    bookingServiceChipText: {
        fontSize: 11,
        color: '#0369a1',
        fontWeight: '600',
    },
    serviceNoteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 1,
        borderColor: '#e5e7eb',
    },
    serviceNoteText: {
        fontSize: 11,
        color: '#6b7280',
        flex: 1,
    },
    webActionGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    actionIconBtnApprove: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionIconBtnCleaning: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionIconBtnMaintenance: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#fff7ed',
        borderWidth: 1,
        borderColor: '#fed7aa',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionIconBtnEdit: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionIconBtnDelete: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerBox: {
        paddingVertical: 50,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 13,
        color: '#6b7280',
    },
    emptyContainer: {
        paddingVertical: 50,
        alignItems: 'center',
        marginHorizontal: 16,
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
        marginTop: 10,
        textAlign: 'center',
    },
    emptySub: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 4,
        textAlign: 'center',
    },
    // Modals: Căn giữa, chuẩn container mobile app, không bị bè ngang desktop
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 20,
        paddingBottom: 24,
        width: '100%',
        maxWidth: 480,
        maxHeight: '90%',
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    modalCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxWidth: 480,
        maxHeight: '90%',
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    modalPickerCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        width: '100%',
        maxWidth: 420,
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
    },
    modalPickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        marginBottom: 8,
    },
    modalPickerTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f172a',
    },
    pickerItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    pickerItemRowActive: {
        backgroundColor: '#f0fdf4',
    },
    pickerItemText: {
        fontSize: 13,
        color: '#334155',
        flex: 1,
    },
    pickerItemTextActive: {
        color: '#006b2c',
        fontWeight: '700',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderColor: '#eceef0',
        paddingBottom: 12,
        marginBottom: 12,
    },
    modalTicketCode: {
        fontSize: 11,
        fontWeight: '800',
        color: '#006b2c',
        letterSpacing: 0.5,
    },
    modalPitchName: {
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
    modalSubHeader: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#b45309',
        letterSpacing: 0.5,
    },
    modalMainHeader: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
        marginTop: 2,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f2f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalInfoBox: {
        backgroundColor: '#f7f9fb',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#eceef0',
    },
    modalSectionLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748b',
        letterSpacing: 0.5,
    },
    avatarCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#006b2c',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '800',
    },
    modalActionRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
    },
    modalCheckinBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#006b2c',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 6,
    },
    modalCheckinText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '800',
    },
    modalDeleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fee2e2',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
    },
    formLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 6,
        marginTop: 8,
    },
    formSelectChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#f2f4f6',
        marginRight: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    formSelectChipActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    formSelectChipText: {
        fontSize: 12,
        color: '#374151',
        fontWeight: '600',
    },
    formSelectChipTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    modalInputWrapper: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    modalInput: {
        fontSize: 13,
        color: '#111827',
        padding: 0,
    },
    segmentBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    segmentBtnActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    segmentBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    segmentBtnTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    cleaningBookingInfoBox: {
        backgroundColor: '#f0fdfa',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#99f6e4',
        marginBottom: 10,
    },
    // Grid Time Slots for Conflict Prevention
    slotGridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    slotGridBtn: {
        width: '31.5%',
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    slotGridBtnSelected: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    slotGridBtnBooked: {
        backgroundColor: '#fef2f2',
        borderColor: '#fecaca',
        opacity: 0.65,
    },
    slotGridBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#334155',
    },
    slotGridBtnTextSelected: {
        color: '#ffffff',
    },
    slotGridBtnTextBooked: {
        color: '#b91c1c',
        textDecorationLine: 'line-through',
    },
    slotGridSubText: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#006b2c',
        marginTop: 2,
    },
    editSummaryCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        marginBottom: 12,
    },
    editSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    editSummaryCol: {
        flex: 1,
    },
    editSummaryLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
    },
    editSummaryVal: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    editTagMini: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
    },
    editTagMiniText: {
        fontSize: 10,
        fontWeight: '700',
    },
    slotPriceText: {
        fontSize: 10,
        color: '#006b2c',
        fontWeight: '600',
        marginTop: 1,
    },
    slotGridBtnSelf: {
        borderColor: '#38bdf8',
        backgroundColor: '#f0f9ff',
    },
    slotGridBtnPast: {
        backgroundColor: '#f1f5f9',
        borderColor: '#e2e8f0',
        opacity: 0.55,
    },
    slotGridBtnBlocked: {
        backgroundColor: '#fff7ed',
        borderColor: '#fed7aa',
        opacity: 0.7,
    },
    slotGridBtnAvailable: {
        backgroundColor: '#ffffff',
        borderColor: '#bbf7d0',
    },
    slotGridBtnTextPast: {
        color: '#94a3b8',
        textDecorationLine: 'line-through',
    },
    slotLegendBar: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        marginTop: 4,
        marginBottom: 8,
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
    legendText: {
        fontSize: 10.5,
        color: '#64748b',
        fontWeight: '600',
    },
    editServiceCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 10,
    },
    editServiceCardActive: {
        borderColor: '#86efac',
        backgroundColor: '#f0fdf4',
    },
    qtyBtn: {
        width: 26,
        height: 26,
        borderRadius: 6,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    qtyBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    sizeChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    sizeChipActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    sizeChipText: {
        fontSize: 11,
        color: '#475569',
        fontWeight: '600',
    },
    sizeChipTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    fieldDropdownTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
    },
    fieldDropdownTriggerOpen: {
        borderColor: '#006b2c',
        backgroundColor: '#f0fdf4',
    },
    fieldDropdownIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#ecfdf5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fieldDropdownSelectedTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    fieldDropdownSelectedSub: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    fieldTypeBadgeMini: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    fieldTypeBadgeMiniText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#475569',
    },
    fieldDropdownMenu: {
        marginTop: 6,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    dropdownSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 8,
        gap: 6,
    },
    dropdownSearchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
        padding: 0,
    },
    dropdownFieldItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingVertical: 9,
        borderRadius: 8,
        marginBottom: 4,
    },
    dropdownFieldItemActive: {
        backgroundColor: '#ecfdf5',
    },
    dropdownFieldItemIcon: {
        width: 26,
        height: 26,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dropdownFieldName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0f172a',
    },
    dropdownFieldMeta: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 1,
    },
    webDateInputWrapper: {
        width: '100%',
    },
    periodFilterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 6,
        width: '100%',
    },
    periodFilterLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
        flexShrink: 0,
    },
    periodFilterChipsGroup: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 4,
    },
    periodFilterChip: {
        flex: 1,
        paddingHorizontal: 2,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    periodFilterChipActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    periodFilterChipText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#475569',
        textAlign: 'center',
    },
    periodFilterChipTextActive: {
        color: '#ffffff',
    },
});
