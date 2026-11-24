import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    TextInput,
    Platform,
    Modal,
    Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
    getTournamentRequestsApi,
    updateTournamentRequestApi,
    createTournamentRequestApi,
    deleteTournamentRequestApi
} from '../api/tournamentsApi';
import { getFieldsApi } from '../api/fieldsApi';
import { getUsersApi } from '../api/usersApi';
import AppConfirmDialog from '../components/AppConfirmDialog';

const STATUS_MAP = {
    Pending: { label: 'Chờ xử lý', color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
    Contacted: { label: 'Đang liên hệ', color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },
    Approved: { label: 'Đã chốt duyệt', color: '#15803d', bg: '#dcfce7', border: '#86efac' },
    Rejected: { label: 'Đã từ chối', color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' },
    Cancelled: { label: 'Khách đã hủy', color: '#6b7280', bg: '#f2f4f6', border: '#e2e8f0' },
};

const SERVICE_PACKAGES = [
    {
        id: 'referee',
        name: 'Tổ trọng tài chuẩn VFF',
        label: 'Tổ trọng tài chuẩn VFF',
        fullName: 'Tổ trọng tài chuẩn VFF (Trọn gói sẵn có)',
        desc: 'Trọn gói sẵn có - 2 trọng tài chính + biên bản',
        icon: 'shield-checkmark',
    },
    {
        id: 'livestream',
        name: 'BLV & Livestream HD',
        label: 'BLV & Livestream HD',
        fullName: 'BLV & Livestream HD (Trọn gói sẵn có)',
        desc: 'Trọn gói sẵn có - Bình luận viên & máy quay trực tiếp',
        icon: 'videocam',
    },
    {
        id: 'trophy',
        name: 'Cúp vô địch, Huy chương & Cờ',
        label: 'Cúp vô địch, Huy chương & Cờ',
        fullName: 'Cúp vô địch, Huy chương & Cờ (Trọn gói sẵn có)',
        desc: 'Trọn gói sẵn có - Bộ cúp vàng + 25 huy chương',
        icon: 'trophy',
    },
    {
        id: 'medical',
        name: 'Túi y tế sơ cứu & Xịt giảm đau',
        label: 'Túi y tế sơ cứu & Xịt giảm đau',
        fullName: 'Túi y tế sơ cứu & Xịt giảm đau (Trọn gói sẵn có)',
        desc: 'Trọn gói sẵn có - Băng gạc, salonpas & đá lạnh',
        icon: 'medkit',
    },
    {
        id: 'sound_light',
        name: 'Hệ thống âm thanh & Đèn LED đêm',
        label: 'Hệ thống âm thanh & Đèn LED đêm',
        fullName: 'Hệ thống âm thanh & Đèn LED đêm (Trọn gói sẵn có)',
        desc: 'Trọn gói sẵn có - Loa công suất lớn & mic không dây',
        icon: 'volume-high',
    },
    {
        id: 'coordinator',
        name: 'Điều phối viên & Lễ tân đón tiếp',
        label: 'Điều phối viên & Lễ tân đón tiếp',
        fullName: 'Điều phối viên & Lễ tân đón tiếp (Trọn gói sẵn có)',
        desc: 'Trọn gói sẵn có - 2 nhân sự đón tiếp & điều phối sân',
        icon: 'people',
    },
];

const STANDARD_EVENT_PACKAGES = SERVICE_PACKAGES;

const MORNING_SLOTS = [
    '06:00 - 07:00',
    '07:00 - 08:00',
    '08:00 - 09:00',
    '09:00 - 10:00',
    '10:00 - 11:00',
    '11:00 - 12:00',
];

const AFTERNOON_EVENING_SLOTS = [
    '14:00 - 15:00',
    '15:00 - 16:00',
    '16:00 - 17:00',
    '17:00 - 18:00',
    '18:00 - 19:00',
    '19:00 - 20:00',
    '20:00 - 21:00',
    '21:00 - 22:00',
];

const getTournamentDaysList = (sDate, eDate) => {
    if (!sDate || !eDate) return [];
    const s = new Date(sDate);
    const e = new Date(eDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return [];
    const days = [];
    const cur = new Date(s);
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    while (cur <= e && days.length <= 45) {
        const dateStr = cur.toISOString().split('T')[0];
        const weekdayName = dayNames[cur.getDay()];
        const isWeekend = cur.getDay() === 0 || cur.getDay() === 6;
        days.push({
            dateStr,
            displayDate: `${cur.getDate().toString().padStart(2, '0')}/${(cur.getMonth() + 1).toString().padStart(2, '0')}`,
            weekdayName,
            isWeekend,
        });
        cur.setDate(cur.getDate() + 1);
    }
    return days;
};

const parseJsonSafe = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        return [String(parsed)];
    } catch {
        return [String(raw)];
    }
};

const formatDateVN = (dateStr) => {
    if (!dateStr) return 'Chưa định';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return String(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return String(dateStr);
    }
};

const formatVND = (num) => {
    if (num === null || num === undefined || num === '') return '0đ';
    const n = Math.round(Number(num));
    if (isNaN(n)) return '0đ';
    return `${n.toLocaleString('vi-VN')}đ`;
};

const addDaysToStr = (baseDateStr, daysToAdd) => {
    try {
        const d = baseDateStr ? new Date(baseDateStr) : new Date();
        d.setDate(d.getDate() + daysToAdd);
        return d.toISOString().slice(0, 10);
    } catch {
        const d = new Date();
        d.setDate(d.getDate() + daysToAdd);
        return d.toISOString().slice(0, 10);
    }
};

const getUpcomingSaturday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = (6 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
};

const getUpcomingMonday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = (8 - day) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
};

export default function AdminTournamentsScreen({ navigation }) {
    const [requests, setRequests] = useState([]);
    const [fieldsList, setFieldsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterPeriod, setFilterPeriod] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal Detail
    const [selectedDetail, setSelectedDetail] = useState(null);

    // Modal Edit (Đầy đủ các trường và lựa chọn đồng bộ như bản Web)
    const [selectedEdit, setSelectedEdit] = useState(null);
    const [editTourName, setEditTourName] = useState('');
    const [editOrgName, setEditOrgName] = useState('');
    const [editContactName, setEditContactName] = useState('');
    const [editContactPhone, setEditContactPhone] = useState('');
    const [editContactEmail, setEditContactEmail] = useState('');
    const [editStartDate, setEditStartDate] = useState('');
    const [editEndDate, setEditEndDate] = useState('');
    const [editTeamsCount, setEditTeamsCount] = useState('8');
    const [editSelectedFields, setEditSelectedFields] = useState([]);
    const [editSelectedServices, setEditSelectedServices] = useState([]);
    const [editTourNotes, setEditTourNotes] = useState('');
    const [editStatus, setEditStatus] = useState('Pending');
    const [editBudget, setEditBudget] = useState('');
    const [editPaidAmount, setEditPaidAmount] = useState('');
    const [editDepositAmount, setEditDepositAmount] = useState('');
    const [editRemainingAmount, setEditRemainingAmount] = useState('');
    const [editPaymentStatus, setEditPaymentStatus] = useState('Unpaid');
    const [editAdminNotes, setEditAdminNotes] = useState('');
    const [editTimeSlots, setEditTimeSlots] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    const toggleEditFieldSelect = (fName) => {
        setEditSelectedFields((prev) => {
            if (prev.includes(fName)) {
                return prev.filter((x) => x !== fName);
            } else {
                return [...prev, fName];
            }
        });
    };

    const toggleEditServicePackage = (pkgFullName) => {
        setEditSelectedServices((prev) => {
            const isMatch = (x) => x === pkgFullName || (typeof x === 'string' && (pkgFullName.includes(x) || x.includes(pkgFullName)));
            if (prev.some(isMatch)) {
                return prev.filter((x) => !isMatch(x));
            } else {
                return [...prev, pkgFullName];
            }
        });
    };

    const handleEditBudgetChange = (text) => {
        const raw = text.replace(/[^0-9]/g, '');
        setEditBudget(raw);
        const b = Number(raw) || 0;
        if (editPaymentStatus === 'Deposit_Paid') {
            const p = Math.round(b * 0.5);
            setEditPaidAmount(String(p));
            setEditRemainingAmount(String(Math.max(0, b - p)));
        } else if (editPaymentStatus === 'Paid') {
            setEditPaidAmount(String(b));
            setEditRemainingAmount('0');
        } else {
            setEditPaidAmount('0');
            setEditRemainingAmount(String(b));
        }
    };

    const handleEditPaymentStatusChange = (status) => {
        setEditPaymentStatus(status);
        const b = Number(String(editBudget).replace(/[^0-9]/g, '')) || 0;
        if (status === 'Deposit_Paid') {
            const p = Math.round(b * 0.5);
            setEditPaidAmount(String(p));
            setEditRemainingAmount(String(Math.max(0, b - p)));
        } else if (status === 'Paid') {
            setEditPaidAmount(String(b));
            setEditRemainingAmount('0');
        } else {
            setEditPaidAmount('0');
            setEditRemainingAmount(String(b));
        }
    };

    // Modal Create Tournament Request state (đồng bộ đầy đủ với bản Web)
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [slotPickerModal, setSlotPickerModal] = useState({
        isOpen: false,
        target: 'create', // 'create' | 'edit'
        mode: 'all_days', // 'all_days' | 'weekends' | 'custom_days'
        selectedCommonSlots: ['17:00 - 18:00', '18:00 - 19:00', '19:00 - 20:00'],
        selectedDaySlots: {},
        activeDayIndex: 0,
        slotNote: '',
    });
    const [showUserPickerModal, setShowUserPickerModal] = useState(false);
    const [userPickerSearch, setUserPickerSearch] = useState('');

    const handleOpenSlotPicker = (target) => {
        const isCreate = target === 'create';
        const sDate = isCreate ? startDate : editStartDate;
        const eDate = isCreate ? endDate : editEndDate;
        const currentInfo = String((isCreate ? timeSlotsInfo : editTimeSlots) || '');

        let initMode = 'all_days';
        let initCommon = ['17:00 - 18:00', '18:00 - 19:00', '19:00 - 20:00'];
        let initDaySlots = {};
        let initNote = '';

        if (currentInfo.toLowerCase().includes('thứ 7') || currentInfo.toLowerCase().includes('cuối tuần')) {
            initMode = 'weekends';
        }

        const allKnownSlots = [...MORNING_SLOTS, ...AFTERNOON_EVENING_SLOTS];
        const matchedSlots = allKnownSlots.filter((slot) => currentInfo.includes(slot));
        if (matchedSlots.length > 0) {
            initCommon = matchedSlots;
        }

        if (currentInfo.includes('Ghi chú:')) {
            initNote = currentInfo.split('Ghi chú:')[1]?.trim() || '';
        }

        setSlotPickerModal({
            isOpen: true,
            target,
            mode: initMode,
            selectedCommonSlots: initCommon,
            selectedDaySlots: initDaySlots,
            activeDayIndex: 0,
            slotNote: initNote,
        });
    };

    const handleTogglePickerSlot = (slot) => {
        const { mode, selectedCommonSlots, selectedDaySlots, target, activeDayIndex } = slotPickerModal;
        const isCreate = target === 'create';
        const sDate = isCreate ? startDate : editStartDate;
        const eDate = isCreate ? endDate : editEndDate;
        const daysList = getTournamentDaysList(sDate, eDate);

        if (mode === 'custom_days') {
            const activeDateStr = daysList[activeDayIndex]?.dateStr;
            if (!activeDateStr) return;
            const cur = selectedDaySlots[activeDateStr] || [];
            const next = cur.includes(slot) ? cur.filter((s) => s !== slot) : [...cur, slot];
            setSlotPickerModal((prev) => ({
                ...prev,
                selectedDaySlots: { ...prev.selectedDaySlots, [activeDateStr]: next },
            }));
        } else {
            const next = selectedCommonSlots.includes(slot)
                ? selectedCommonSlots.filter((s) => s !== slot)
                : [...selectedCommonSlots, slot];
            setSlotPickerModal((prev) => ({ ...prev, selectedCommonSlots: next }));
        }
    };

    const handleConfirmSlotPicker = () => {
        const { target, mode, selectedCommonSlots, selectedDaySlots, slotNote } = slotPickerModal;
        const isCreate = target === 'create';
        const sDate = isCreate ? startDate : editStartDate;
        const eDate = isCreate ? endDate : editEndDate;
        const daysList = getTournamentDaysList(sDate, eDate);

        let summary = '';
        if (mode === 'all_days') {
            if (selectedCommonSlots.length > 0) {
                summary = `Các ngày trong giải: ${selectedCommonSlots.join(', ')}`;
            }
        } else if (mode === 'weekends') {
            if (selectedCommonSlots.length > 0) {
                summary = `Chỉ Thứ 7 & Chủ Nhật: ${selectedCommonSlots.join(', ')}`;
            }
        } else if (mode === 'custom_days') {
            const parts = Object.entries(selectedDaySlots)
                .filter(([_, slots]) => slots.length > 0)
                .map(([date, slots]) => {
                    const d = new Date(date);
                    const formatted = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                    return `${formatted}: ${slots.join(', ')}`;
                });
            if (parts.length > 0) {
                summary = parts.join('; ');
            } else if (selectedCommonSlots.length > 0) {
                summary = `Các ngày trong giải: ${selectedCommonSlots.join(', ')}`;
            }
        }

        if (slotNote.trim()) {
            summary = summary ? `${summary} (Ghi chú: ${slotNote.trim()})` : `Ghi chú: ${slotNote.trim()}`;
        }

        if (isCreate) {
            setTimeSlotsInfo(summary || '17:00 - 20:00');
        } else {
            setEditTimeSlots(summary || '17:00 - 20:00');
        }

        setSlotPickerModal((prev) => ({ ...prev, isOpen: false }));
    };
    const [tourName, setTourName] = useState('');
    const [orgName, setOrgName] = useState('');
    const [systemUsers, setSystemUsers] = useState([]);
    const [selectedCustomerMode, setSelectedCustomerMode] = useState('guest'); // 'guest' | userId
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [selectedFields, setSelectedFields] = useState([]);
    const [teamsCount, setTeamsCount] = useState('8');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d.toISOString().slice(0, 10);
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 14);
        return d.toISOString().slice(0, 10);
    });
    const [timeSlotsInfo, setTimeSlotsInfo] = useState('17:00 - 20:00');
    const [createStatus, setCreateStatus] = useState('Pending');
    const [estimatedBudget, setEstimatedBudget] = useState('');
    const [paymentStatus, setPaymentStatus] = useState('Unpaid');
    const [paidAmount, setPaidAmount] = useState('0');
    const [remainingAmount, setRemainingAmount] = useState('0');
    const [tourNotes, setTourNotes] = useState('');
    const [adminNotes, setAdminNotes] = useState('');
    const [selectedServices, setSelectedServices] = useState([
        'Tổ trọng tài chuẩn VFF (Trọn gói sẵn có)',
        'Bình luận viên & Livestream HD (Trọn gói sẵn có)',
        'Cúp vô địch, Huy chương & Cờ lưu niệm (Trọn gói sẵn có)',
        'Túi y tế sơ cứu & Xịt giảm đau (Trọn gói sẵn có)',
        'Hệ thống âm thanh & Đèn LED đêm (Trọn gói sẵn có)',
        'Điều phối viên & Lễ tân đón tiếp (Trọn gói sẵn có)',
    ]);
    const [submittingTour, setSubmittingTour] = useState(false);

    const handleBudgetChange = (text) => {
        const raw = text.replace(/[^0-9]/g, '');
        setEstimatedBudget(raw);
        const b = Number(raw) || 0;
        if (paymentStatus === 'Deposit_Paid') {
            const p = Math.round(b * 0.5);
            setPaidAmount(String(p));
            setRemainingAmount(String(Math.max(0, b - p)));
        } else if (paymentStatus === 'Paid') {
            setPaidAmount(String(b));
            setRemainingAmount('0');
        } else {
            setPaidAmount('0');
            setRemainingAmount(String(b));
        }
    };

    const handlePaymentStatusChange = (status) => {
        setPaymentStatus(status);
        const b = Number(estimatedBudget.replace(/[^0-9]/g, '')) || 0;
        if (status === 'Deposit_Paid') {
            const p = Math.round(b * 0.5);
            setPaidAmount(String(p));
            setRemainingAmount(String(Math.max(0, b - p)));
        } else if (status === 'Paid') {
            setPaidAmount(String(b));
            setRemainingAmount('0');
        } else {
            setPaidAmount('0');
            setRemainingAmount(String(b));
        }
    };

    const handleSelectCustomer = (val) => {
        setSelectedCustomerMode(val);
        if (val === 'guest') {
            setContactName('');
            setContactPhone('');
            setContactEmail('');
        } else {
            const u = systemUsers.find((usr) => String(usr.id) === String(val));
            if (u) {
                setContactName(u.name || u.full_name || u.username || '');
                setContactPhone(u.phone || '');
                setContactEmail(u.email || '');
            }
        }
    };

    const toggleFieldSelect = (fName) => {
        setSelectedFields((prev) => {
            if (prev.includes(fName)) {
                return prev.filter((x) => x !== fName);
            } else {
                return [...prev, fName];
            }
        });
    };

    const toggleServicePackage = (pkgFullName) => {
        setSelectedServices((prev) => {
            const isMatch = (x) => x === pkgFullName || (typeof x === 'string' && (pkgFullName.includes(x) || x.includes(pkgFullName)));
            if (prev.some(isMatch)) {
                return prev.filter((x) => !isMatch(x));
            } else {
                return [...prev, pkgFullName];
            }
        });
    };

    // In-screen dialog config (thay thế Alert.alert mặc định)
    const [dialogConfig, setDialogConfig] = useState({
        visible: false,
        title: '',
        message: '',
        confirmText: 'Đã hiểu',
        confirmColor: '#006b2c',
        iconName: 'alert-circle',
        iconColor: '#b91c1c',
        isAlert: true,
        onConfirm: () => setDialogConfig((prev) => ({ ...prev, visible: false })),
        onCancel: null,
    });

    const showDialog = (title, message, isError = true, onConfirm = null) => {
        setDialogConfig({
            visible: true,
            title,
            message,
            confirmText: 'Đã hiểu',
            confirmColor: isError ? '#dc2626' : '#006b2c',
            iconName: isError ? 'alert-circle' : 'checkmark-circle',
            iconColor: isError ? '#dc2626' : '#006b2c',
            isAlert: true,
            onConfirm: () => {
                setDialogConfig((prev) => ({ ...prev, visible: false }));
                if (onConfirm) onConfirm();
            },
            onCancel: null,
        });
    };

    // Broadcast sync event cho Web và các thiết bị khác
    const broadcastAppSync = (type = 'tournament_updated') => {
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

    const loadRequests = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        try {
            const [data, fieldsRes, usersRes] = await Promise.all([
                getTournamentRequestsApi(),
                getFieldsApi().catch(() => []),
                getUsersApi().catch(() => [])
            ]);
            setRequests(Array.isArray(data) ? data : (data?.results || []));
            const fList = fieldsRes?.fields || fieldsRes?.results || (Array.isArray(fieldsRes) ? fieldsRes : []);
            setFieldsList(fList);
            const uList = usersRes?.users || usersRes?.results || (Array.isArray(usersRes) ? usersRes : []);
            setSystemUsers(uList);
            if (fList.length > 0 && selectedFields.length === 0) {
                setSelectedFields([fList[0].field_name || fList[0].name || String(fList[0].id)]);
            }
        } catch (e) {
            console.warn('Lỗi lấy danh sách giải đấu:', e.message);
        } finally {
            setLoading(false);
            if (isManual) setRefreshing(false);
        }
    };

    useEffect(() => {
        loadRequests();

        // Smart polling định kỳ mỗi 3.5s để đồng bộ tức thời với Web
        const timer = setInterval(() => {
            loadRequests(false);
        }, 3500);

        // Lắng nghe sự kiện storage / football_sync khi Web thay đổi dữ liệu
        const handleSync = (e) => {
            try {
                const eventData = e?.detail || (e?.newValue ? JSON.parse(e.newValue) : null);
                if (eventData?.type?.startsWith('tournament_')) {
                    loadRequests(false);
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

    const handleUpdateStatus = async (reqId, newStatus) => {
        const actionLabel = STATUS_MAP[newStatus]?.label || newStatus;

        const doUpdate = async () => {
            try {
                await updateTournamentRequestApi(reqId, { status: newStatus });
                broadcastAppSync('tournament_updated');
                Alert.alert('Thành công', `Đã cập nhật trạng thái hồ sơ thành: ${actionLabel}`);
                loadRequests();
            } catch (e) {
                Alert.alert('Lỗi', 'Không thể cập nhật hồ sơ giải đấu');
            }
        };

        Alert.alert(
            'Xác nhận điều phối',
            `Bạn có chắc chắn muốn chuyển hồ sơ này sang "${actionLabel}"?`,
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Đồng ý',
                    onPress: doUpdate,
                }
            ]
        );
    };

    const handleDeleteRequest = (req) => {
        const doDelete = async () => {
            try {
                await deleteTournamentRequestApi(req.id);
                broadcastAppSync('tournament_updated');
                Alert.alert('Thành công', 'Đã xóa hồ sơ giải đấu khỏi hệ thống');
                loadRequests();
            } catch (e) {
                Alert.alert('Lỗi', 'Không thể xóa hồ sơ giải đấu lúc này');
            }
        };

        Alert.alert(
            'Xóa hồ sơ giải đấu',
            `Bạn có chắc chắn muốn xóa hồ sơ "${req.tournament_name}" không?`,
            [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Xóa ngay', style: 'destructive', onPress: doDelete }
            ]
        );
    };

    const handleOpenEdit = (req) => {
        setSelectedEdit(req);
        setEditTourName(req.tournament_name || '');
        setEditOrgName(req.organization || '');
        setEditContactName(req.contact_name || '');
        setEditContactPhone(req.contact_phone || '');
        setEditContactEmail(req.contact_email || '');
        setEditStartDate(req.start_date || '');
        setEditEndDate(req.end_date || '');
        setEditTeamsCount(String(req.expected_teams || 8));
        setEditSelectedFields(parseListSafe(req.selected_fields_info));
        setEditSelectedServices(parseListSafe(req.services_requested));
        setEditTourNotes(req.notes || '');
        setEditStatus(req.status || 'Pending');
        setEditBudget(req.estimated_budget ? String(req.estimated_budget) : '');
        setEditPaidAmount(req.paid_amount ? String(req.paid_amount) : '0');
        setEditDepositAmount(req.deposit_amount ? String(req.deposit_amount) : '0');
        setEditRemainingAmount(req.remaining_amount ? String(req.remaining_amount) : '0');
        setEditPaymentStatus(req.payment_status || 'Unpaid');
        setEditAdminNotes(req.admin_notes || '');
        setEditTimeSlots(req.time_slots_info || '17:00 - 20:00 (Thứ 7 & CN)');
    };

    const handleSaveEdit = async () => {
        if (!selectedEdit) return;
        if (!editTourName.trim()) {
            showDialog('Thiếu thông tin', 'Vui lòng nhập tên giải đấu!');
            return;
        }
        if (!editContactName.trim() || !editContactPhone.trim()) {
            showDialog('Thiếu thông tin', 'Vui lòng nhập họ tên và SĐT người liên hệ!');
            return;
        }
        if (!editStartDate || !editEndDate) {
            showDialog('Thiếu thời gian', 'Vui lòng chọn ngày bắt đầu và ngày kết thúc giải đấu!');
            return;
        }
        if (editEndDate < editStartDate) {
            showDialog('Ngày không hợp lệ', 'Ngày kết thúc giải đấu phải bằng hoặc sau ngày bắt đầu!');
            return;
        }

        setSavingEdit(true);
        try {
            const budgetNum = editBudget ? parseFloat(editBudget) : null;
            const paidNum = editPaidAmount ? parseFloat(editPaidAmount) : 0;
            const depNum = editDepositAmount ? parseFloat(editDepositAmount) : 0;
            const remNum = editRemainingAmount ? parseFloat(editRemainingAmount) : (budgetNum ? Math.max(0, budgetNum - paidNum) : 0);

            const payload = {
                tournament_name: editTourName.trim(),
                organization: editOrgName.trim(),
                contact_name: editContactName.trim(),
                contact_phone: editContactPhone.trim(),
                contact_email: editContactEmail.trim(),
                start_date: editStartDate,
                end_date: editEndDate,
                expected_teams: Number(editTeamsCount) || 8,
                selected_fields_info: editSelectedFields.length > 0 ? editSelectedFields : ['Chưa chỉ định sân cụ thể'],
                services_requested: editSelectedServices,
                notes: editTourNotes.trim() || undefined,
                status: editStatus,
                estimated_budget: budgetNum,
                paid_amount: paidNum,
                deposit_amount: depNum,
                remaining_amount: remNum,
                payment_status: editPaymentStatus,
                admin_notes: editAdminNotes.trim(),
                time_slots_info: editTimeSlots.trim() || '17:00 - 20:00 (Thứ 7 & CN)',
            };

            await updateTournamentRequestApi(selectedEdit.id, payload);
            broadcastAppSync('tournament_updated');
            showDialog('Thành công', 'Đã cập nhật thông tin giải đấu thành công!', false);
            setSelectedEdit(null);
            loadRequests(false);
        } catch (e) {
            showDialog('Lỗi', e.response?.data?.error || e.message || 'Không thể lưu thay đổi');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleCreateTournament = async () => {
        if (!tourName.trim()) {
            showDialog('Thiếu thông tin', 'Vui lòng nhập tên giải đấu!');
            return;
        }
        if (!contactName.trim() || !contactPhone.trim()) {
            showDialog('Thiếu thông tin', 'Vui lòng nhập họ tên và số điện thoại người liên hệ!');
            return;
        }

        const sDate = startDate ? startDate.trim() : '';
        const eDate = endDate ? endDate.trim() : '';
        if (!sDate || !eDate) {
            showDialog('Thiếu thời gian', 'Vui lòng chọn ngày khởi tranh và ngày bế mạc giải đấu!');
            return;
        }
        const todayStr = new Date().toISOString().slice(0, 10);
        if (sDate < todayStr) {
            showDialog('Ngày không hợp lệ', 'Ngày khởi tranh giải đấu không được là ngày đã qua trong quá khứ!');
            return;
        }
        if (eDate < sDate) {
            showDialog('Ngày không hợp lệ', 'Ngày bế mạc giải đấu phải bằng hoặc sau ngày khởi tranh!');
            return;
        }

        setSubmittingTour(true);
        try {
            const budgetNum = estimatedBudget ? parseFloat(estimatedBudget.replace(/[^0-9]/g, '')) : null;
            const paidNum = paidAmount ? parseFloat(paidAmount.replace(/[^0-9]/g, '')) : 0;
            const remNum = remainingAmount ? parseFloat(remainingAmount.replace(/[^0-9]/g, '')) : (budgetNum ? Math.max(0, budgetNum - paidNum) : 0);
            const depNum = paymentStatus === 'Deposit_Paid' ? (paidNum || Math.round((budgetNum || 0) * 0.5)) : 0;

            const selectedFieldNames = selectedFields.length > 0
                ? selectedFields
                : (fieldsList.length > 0 ? [fieldsList[0].field_name || fieldsList[0].name] : []);

            await createTournamentRequestApi({
                tournament_name: tourName.trim(),
                organization: orgName.trim() || 'Doanh nghiệp',
                contact_name: contactName.trim(),
                contact_phone: contactPhone.trim(),
                contact_email: contactEmail.trim() || undefined,
                expected_teams: parseInt(teamsCount, 10) || 8,
                start_date: sDate,
                end_date: eDate,
                selected_fields_info: selectedFieldNames,
                time_slots_info: timeSlotsInfo.trim() || '17:00 - 20:00',
                estimated_budget: budgetNum,
                payment_method: paymentStatus === 'Deposit_Paid' ? 'deposit' : 'full',
                payment_status: paymentStatus,
                deposit_amount: depNum,
                paid_amount: paidNum,
                remaining_amount: remNum,
                services_requested: selectedServices,
                notes: tourNotes.trim() || undefined,
                admin_notes: adminNotes.trim() || '[Khởi tạo bởi Quản trị viên]',
                status: createStatus
            });
            broadcastAppSync('tournament_updated');
            showDialog('Thành công', 'Đã tiếp nhận và tạo hồ sơ giải đấu mới thành công!', false);
            setCreateModalVisible(false);
            setTourName('');
            setOrgName('');
            setContactName('');
            setContactPhone('');
            setContactEmail('');
            setSelectedFields(fieldsList.length > 0 ? [fieldsList[0].field_name || fieldsList[0].name] : []);
            setEstimatedBudget('');
            setPaidAmount('0');
            setRemainingAmount('0');
            setTourNotes('');
            setAdminNotes('');
            loadRequests(false);
        } catch (e) {
            showDialog('Lỗi', e.response?.data?.error || e.message || 'Không thể tạo hồ sơ giải đấu');
        } finally {
            setSubmittingTour(false);
        }
    };

    // Lọc loại bỏ các đơn khách trực tuyến chưa thanh toán/chưa cọc (Unpaid + Pending)
    const validRequests = useMemo(() => {
        return requests.filter(r => {
            const isUnpaidClientDraft =
                r.payment_status === 'Unpaid' &&
                r.status === 'Pending' &&
                (!r.admin_notes || !r.admin_notes.trim());
            return !isUnpaidClientDraft;
        });
    }, [requests]);

    // Calculate dynamic tournament KPIs from database
    const kpis = useMemo(() => {
        const total = validRequests.length;
        const pending = validRequests.filter(r => (r.status || '').toLowerCase() === 'pending').length;
        const contacted = validRequests.filter(r => (r.status || '').toLowerCase() === 'contacted').length;
        const approved = validRequests.filter(r => (r.status || '').toLowerCase() === 'approved').length;
        const rejected = validRequests.filter(r => (r.status || '').toLowerCase() === 'rejected').length;
        const cancelled = validRequests.filter(r => (r.status || '').toLowerCase() === 'cancelled').length;
        return {
            total,
            pending,
            contacted,
            approved,
            rejected,
            cancelled
        };
    }, [validRequests]);

    const filtered = validRequests.filter(r => {
        const name = (r.tournament_name || '').toLowerCase();
        const org = (r.organization || r.organization_name || '').toLowerCase();
        const contact = (r.contact_name || '').toLowerCase();
        const phone = (r.contact_phone || '').toLowerCase();
        const code = (r.request_id_short || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        const matchesQ = !q || name.includes(q) || org.includes(q) || contact.includes(q) || phone.includes(q) || code.includes(q);
        if (!matchesQ) return false;

        // Filter period
        if (filterPeriod !== 'ALL') {
            const dStr = r.start_date || r.created_at;
            if (dStr) {
                const now = new Date();
                const tDate = new Date(dStr);
                if (!isNaN(tDate.getTime())) {
                    if (filterPeriod === 'TODAY') {
                        if (String(dStr).slice(0, 10) !== now.toISOString().slice(0, 10)) return false;
                    } else if (filterPeriod === 'WEEK') {
                        const dayOfWeek = now.getDay() || 7;
                        const monday = new Date(now);
                        monday.setDate(now.getDate() - dayOfWeek + 1);
                        monday.setHours(0, 0, 0, 0);
                        const sunday = new Date(monday);
                        sunday.setDate(monday.getDate() + 6);
                        sunday.setHours(23, 59, 59, 999);
                        if (tDate < monday || tDate > sunday) return false;
                    } else if (filterPeriod === 'MONTH') {
                        if (tDate.getFullYear() !== now.getFullYear() || tDate.getMonth() !== now.getMonth()) return false;
                    } else if (filterPeriod === 'YEAR') {
                        if (tDate.getFullYear() !== now.getFullYear()) return false;
                    }
                }
            }
        }

        if (filterStatus === 'ALL') return true;
        return (r.status || '').toLowerCase() === filterStatus.toLowerCase();
    });

    const renderItem = ({ item }) => {
        const sInfo = STATUS_MAP[item.status] || STATUS_MAP.Pending;
        const isPending = item.status === 'Pending';
        const isContacted = item.status === 'Contacted';
        const isApproved = item.status === 'Approved';

        const reqCode = item.request_id_short || `#TR-${(item.id || '').slice(0, 8).toUpperCase()}`;
        const fieldsArr = parseJsonSafe(item.selected_fields_info);
        const servicesArr = parseJsonSafe(item.services_requested);

        // Payment status check
        const pStatus = String(item.payment_status || 'Unpaid').toLowerCase().trim();
        const isFullPaid = ['paid', 'completed', 'success', 'full_paid'].includes(pStatus);
        const isDepositPaid = ['deposit_paid', 'partial_paid'].includes(pStatus);

        return (
            <View style={styles.tournamentCard}>
                {/* Header */}
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <View style={styles.codeBadge}>
                                <Text style={styles.codeBadgeText}>{reqCode}</Text>
                            </View>
                            <View style={styles.categoryBadge}>
                                <Ionicons name="trophy" size={11} color="#006b2c" />
                                <Text style={styles.categoryBadgeText}>GIẢI ĐẤU</Text>
                            </View>
                        </View>
                        <Text style={styles.tournamentName} numberOfLines={2}>
                            {item.tournament_name || 'Giải bóng đá doanh nghiệp'}
                        </Text>
                        <Text style={styles.orgName} numberOfLines={1}>
                            Đơn vị: <Text style={{ fontWeight: '700', color: '#111827' }}>{item.organization || item.organization_name || 'Cá nhân / Đội bóng'}</Text>
                        </Text>
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: sInfo.bg, borderColor: sInfo.border }]}>
                        <View style={[styles.statusDot, { backgroundColor: sInfo.color }]} />
                        <Text style={[styles.statusBadgeText, { color: sInfo.color }]}>{sInfo.label}</Text>
                    </View>
                </View>

                {/* Body Specs */}
                <View style={styles.specsContainer}>
                    {/* Schedule & Teams */}
                    <View style={styles.specRow}>
                        <View style={styles.specBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="calendar-outline" size={13} color="#006b2c" />
                                <Text style={styles.specLabel}>Thời gian thi đấu</Text>
                            </View>
                            <Text style={styles.specVal}>
                                {formatDateVN(item.start_date)} → {formatDateVN(item.end_date || item.start_date)}
                            </Text>
                        </View>

                        <View style={styles.specBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="people-outline" size={13} color="#006b2c" />
                                <Text style={styles.specLabel}>Quy mô đội</Text>
                            </View>
                            <Text style={styles.specVal}>{item.expected_teams || 8} Đội bóng</Text>
                        </View>
                    </View>

                    {/* Pitch & Time Slots */}
                    {(fieldsArr.length > 0 || item.time_slots_info) && (
                        <View style={styles.fieldTimeRow}>
                            {fieldsArr.length > 0 && (
                                <View style={styles.fieldTagWrap}>
                                    <Ionicons name="football-outline" size={13} color="#0284c7" />
                                    <Text style={styles.fieldTagText} numberOfLines={1}>
                                        {fieldsArr.join(', ')}
                                    </Text>
                                </View>
                            )}
                            {item.time_slots_info ? (
                                <View style={styles.timeTagWrap}>
                                    <Ionicons name="time-outline" size={13} color="#b45309" />
                                    <Text style={styles.timeTagText} numberOfLines={1}>
                                        {item.time_slots_info}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    )}

                    {/* Contact Person */}
                    <View style={styles.contactCard}>
                        <View style={styles.avatarCircle}>
                            <Text style={styles.avatarText}>{(item.contact_name || 'BTC').slice(0, 2).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.contactName}>{item.contact_name || 'Đại diện BTC'}</Text>
                            <Text style={styles.contactPhone}>{item.contact_phone || 'Chưa cập nhật SĐT'}</Text>
                        </View>
                    </View>

                    {/* Budget & Payment Status */}
                    <View style={styles.budgetCard}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.budgetLabel}>Ngân sách dự toán:</Text>
                            <Text style={styles.budgetAmount}>
                                {item.estimated_budget ? formatVND(item.estimated_budget) : 'Chưa báo giá'}
                            </Text>
                        </View>

                        {isFullPaid ? (
                            <View style={[styles.payBadge, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                                <Ionicons name="checkmark-circle" size={13} color="#059669" />
                                <Text style={[styles.payBadgeText, { color: '#059669' }]}>Đã trả 100%</Text>
                            </View>
                        ) : isDepositPaid ? (
                            <View style={{ alignItems: 'flex-end' }}>
                                <View style={[styles.payBadge, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                                    <Ionicons name="flash" size={12} color="#1d4ed8" />
                                    <Text style={[styles.payBadgeText, { color: '#1d4ed8' }]}>Đã cọc 50%</Text>
                                </View>
                                {Number(item.remaining_amount || 0) > 0 && (
                                    <Text style={styles.remainingText}>
                                        Còn: {formatVND(item.remaining_amount)}
                                    </Text>
                                )}
                            </View>
                        ) : (
                            <View style={[styles.payBadge, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                                <Ionicons name="alert-circle-outline" size={13} color="#dc2626" />
                                <Text style={[styles.payBadgeText, { color: '#dc2626' }]}>Chưa thanh toán</Text>
                            </View>
                        )}
                    </View>

                    {/* Services Requested */}
                    {servicesArr.length > 0 ? (
                        <View style={styles.servicesPillsRow}>
                            {servicesArr.map((srv, idx) => (
                                <View key={idx} style={styles.servicePill}>
                                    <Ionicons name="sparkles-outline" size={11} color="#006b2c" />
                                    <Text style={styles.servicePillText}>{typeof srv === 'string' ? srv : (srv.name || 'Dịch vụ')}</Text>
                                </View>
                            ))}
                        </View>
                    ) : null}

                    {/* Customer Notes */}
                    {item.notes ? (
                        <View style={styles.noteBox}>
                            <Text style={styles.noteText}>
                                <Text style={{ fontWeight: '700', color: '#111827' }}>Yêu cầu: </Text>
                                {item.notes}
                            </Text>
                        </View>
                    ) : null}

                    {/* Admin Notes */}
                    {item.admin_notes ? (
                        <View style={[styles.noteBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                            <Text style={[styles.noteText, { color: '#166534' }]}>
                                <Text style={{ fontWeight: '700', color: '#166534' }}>Ghi chú BQL: </Text>
                                {item.admin_notes}
                            </Text>
                        </View>
                    ) : null}
                </View>

                {/* Footer Operations */}
                <View style={styles.cardFooter}>
                    {/* View Detail Button */}
                    <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => setSelectedDetail(item)}
                        title="Xem chi tiết"
                    >
                        <Ionicons name="eye-outline" size={16} color="#0284c7" />
                        <Text style={[styles.actionBtnText, { color: '#0284c7' }]}>Xem</Text>
                    </TouchableOpacity>

                    {/* Edit Button */}
                    <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => handleOpenEdit(item)}
                        title="Chỉnh sửa"
                    >
                        <Ionicons name="create-outline" size={16} color="#006b2c" />
                        <Text style={[styles.actionBtnText, { color: '#006b2c' }]}>Sửa</Text>
                    </TouchableOpacity>

                    {/* Quick Status Action Buttons */}
                    {(isPending || isContacted) && (
                        <TouchableOpacity
                            style={styles.approveBtn}
                            onPress={() => handleUpdateStatus(item.id, 'Approved')}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="checkmark-done" size={14} color="#ffffff" />
                            <Text style={styles.approveBtnText}>DUYỆT SÂN</Text>
                        </TouchableOpacity>
                    )}

                    {isPending && (
                        <TouchableOpacity
                            style={styles.contactActionBtn}
                            onPress={() => handleUpdateStatus(item.id, 'Contacted')}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="chatbubble-ellipses-outline" size={14} color="#1d4ed8" />
                            <Text style={styles.contactActionText}>Đã liên hệ</Text>
                        </TouchableOpacity>
                    )}

                    {!isApproved && item.status !== 'Rejected' && item.status !== 'Cancelled' && (
                        <TouchableOpacity
                            style={styles.rejectBtn}
                            onPress={() => handleUpdateStatus(item.id, 'Rejected')}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="close" size={14} color="#b91c1c" />
                            <Text style={styles.rejectBtnText}>Từ chối</Text>
                        </TouchableOpacity>
                    )}

                    {/* Delete Button */}
                    <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteRequest(item)}
                        title="Xóa hồ sơ"
                    >
                        <Ionicons name="trash-outline" size={15} color="#b91c1c" />
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
                            <Text style={styles.topBarTitle}>Điều Phối Giải Đấu</Text>
                            <View style={styles.proPill}>
                                <Text style={styles.proPillText}>DOANH NGHIỆP</Text>
                            </View>
                        </View>
                        <Text style={styles.topBarSubtitle}>TIẾP NHẬN & PHÊ DUYỆT GIẢI SỰ KIỆN</Text>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => setCreateModalVisible(true)}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="add" size={16} color="#ffffff" />
                        <Text style={styles.addBtnText}>Đặt giải mới</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* 2x2 Bento KPI Matrix */}
                <View style={styles.bentoGrid}>
                    <View style={styles.bentoCard}>
                        <View style={styles.bentoCardHeader}>
                            <Text style={styles.bentoLabel}>Tổng yêu cầu</Text>
                            <View style={[styles.bentoIconBox, { backgroundColor: '#f0fdf4' }]}>
                                <Ionicons name="trophy" size={15} color="#006b2c" />
                            </View>
                        </View>
                        <Text style={styles.bentoBigNum}>{kpis.total} <Text style={styles.bentoUnit}>Hồ sơ</Text></Text>
                        <Text style={styles.bentoSubText}>{kpis.approved} đã duyệt khóa sân</Text>
                    </View>

                    <View style={styles.bentoCard}>
                        <View style={styles.bentoCardHeader}>
                            <Text style={styles.bentoLabel}>Chờ xử lý</Text>
                            <View style={[styles.bentoIconBox, { backgroundColor: '#fef3c7' }]}>
                                <Ionicons name="time" size={15} color="#b45309" />
                            </View>
                        </View>
                        <Text style={[styles.bentoBigNum, { color: '#b45309' }]}>{kpis.pending} <Text style={styles.bentoUnit}>chờ duyệt</Text></Text>
                        <Text style={[styles.bentoSubText, { color: '#b45309', fontWeight: '700' }]}>Cần liên hệ khách</Text>
                    </View>

                    <View style={styles.bentoCard}>
                        <View style={styles.bentoCardHeader}>
                            <Text style={styles.bentoLabel}>Đang đàm phán</Text>
                            <View style={[styles.bentoIconBox, { backgroundColor: '#dbeafe' }]}>
                                <Ionicons name="chatbubbles" size={15} color="#1d4ed8" />
                            </View>
                        </View>
                        <Text style={[styles.bentoBigNum, { color: '#1d4ed8' }]}>{kpis.contacted} <Text style={styles.bentoUnit}>hồ sơ</Text></Text>
                        <Text style={styles.bentoSubText}>Thống nhất điều khoản</Text>
                    </View>

                    <View style={styles.bentoCard}>
                        <View style={styles.bentoCardHeader}>
                            <Text style={[styles.bentoLabel, { color: '#15803d' }]}>Đã chốt duyệt</Text>
                            <View style={[styles.bentoIconBox, { backgroundColor: '#dcfce7' }]}>
                                <Ionicons name="checkmark-done-circle" size={15} color="#15803d" />
                            </View>
                        </View>
                        <Text style={[styles.bentoBigNum, { color: '#15803d' }]}>{kpis.approved} <Text style={styles.bentoUnit}>giải đấu</Text></Text>
                        <Text style={styles.bentoSubText}>Đã khóa lịch sân</Text>
                    </View>
                </View>

                {/* Filter Pills: Wrap smoothly for Mobile */}
                <View style={styles.filterWrap}>
                    {[
                        { key: 'ALL', label: `Tất cả (${kpis.total})` },
                        { key: 'Pending', label: `Chờ xử lý (${kpis.pending})` },
                        { key: 'Contacted', label: `Đang liên hệ (${kpis.contacted})` },
                        { key: 'Approved', label: `Đã chốt (${kpis.approved})` },
                        { key: 'Rejected', label: `Từ chối (${kpis.rejected})` },
                        { key: 'Cancelled', label: `Đã hủy (${kpis.cancelled})` },
                    ].map(tab => {
                        const isSel = filterStatus === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                style={[styles.filterChip, isSel && styles.filterChipActive]}
                                onPress={() => setFilterStatus(tab.key)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.filterChipText, isSel && styles.filterChipTextActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Period Filter Chips */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingHorizontal: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', marginRight: 2 }}>Thời gian:</Text>
                    {[
                        { key: 'ALL', label: 'Tất cả' },
                        { key: 'TODAY', label: 'Hôm nay' },
                        { key: 'WEEK', label: 'Tuần này' },
                        { key: 'MONTH', label: 'Tháng này' },
                        { key: 'YEAR', label: 'Năm nay' },
                    ].map(p => {
                        const isSel = filterPeriod === p.key;
                        return (
                            <TouchableOpacity
                                key={p.key}
                                style={[styles.filterChip, isSel && styles.filterChipActive, { paddingHorizontal: 9, paddingVertical: 4 }]}
                                onPress={() => setFilterPeriod(p.key)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.filterChipText, isSel && styles.filterChipTextActive, { fontSize: 11 }]}>
                                    {p.label}
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
                            placeholder="Tìm kiếm mã giải, tên giải, công ty, SĐT..."
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

                {/* Requests List */}
                {loading ? (
                    <View style={styles.centerBox}>
                        <ActivityIndicator size="large" color="#006b2c" />
                        <Text style={{ marginTop: 10, color: '#6b7280', fontSize: 13 }}>Đang tải danh sách giải đấu...</Text>
                    </View>
                ) : filtered.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="trophy-outline" size={48} color="#94a3b8" />
                        <Text style={styles.emptyTitle}>Chưa có hồ sơ giải đấu nào</Text>
                        <Text style={styles.emptySub}>Các yêu cầu đặt giải từ doanh nghiệp sẽ hiển thị tại đây</Text>
                    </View>
                ) : (
                    <View style={styles.requestsGrid}>
                        {filtered.map(item => (
                            <View key={item.id}>
                                {renderItem({ item })}
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* ═══════════════════════════════════════════════════════════
                MODAL 1: XEM CHI TIẾT HỒ SƠ GIẢI ĐẤU (DETAIL MODAL)
               ═══════════════════════════════════════════════════════════ */}
            <Modal
                visible={Boolean(selectedDetail)}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedDetail(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCardWrapper}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    <View style={styles.codeBadge}>
                                        <Text style={styles.codeBadgeText}>
                                            {selectedDetail?.request_id_short || `#TR-${(selectedDetail?.id || '').slice(0, 8).toUpperCase()}`}
                                        </Text>
                                    </View>
                                    {selectedDetail && (
                                        <View style={[styles.statusBadge, { backgroundColor: STATUS_MAP[selectedDetail.status]?.bg, borderColor: STATUS_MAP[selectedDetail.status]?.border }]}>
                                            <Text style={[styles.statusBadgeText, { color: STATUS_MAP[selectedDetail.status]?.color }]}>
                                                {STATUS_MAP[selectedDetail.status]?.label || selectedDetail.status}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.modalMainHeader} numberOfLines={2}>
                                    {selectedDetail?.tournament_name || 'Chi Tiết Giải Đấu'}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedDetail(null)}>
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 440, marginTop: 10 }} showsVerticalScrollIndicator={false}>
                            {selectedDetail && (
                                <View style={{ gap: 12 }}>
                                    {/* Đơn vị & Người liên hệ */}
                                    <View style={styles.detailSectionBox}>
                                        <Text style={styles.detailSectionTitle}>ĐƠN VỊ & NGƯỜI ĐẠI DIỆN</Text>
                                        <Text style={styles.detailRowText}>
                                            <Text style={styles.detailLabel}>Đơn vị tổ chức: </Text>
                                            {selectedDetail.organization || 'Cá nhân / Đội bóng'}
                                        </Text>
                                        <Text style={styles.detailRowText}>
                                            <Text style={styles.detailLabel}>Người đại diện: </Text>
                                            {selectedDetail.contact_name}
                                        </Text>
                                        <Text style={styles.detailRowText}>
                                            <Text style={styles.detailLabel}>Số điện thoại: </Text>
                                            {selectedDetail.contact_phone}
                                        </Text>
                                        {selectedDetail.contact_email ? (
                                            <Text style={styles.detailRowText}>
                                                <Text style={styles.detailLabel}>Email: </Text>
                                                {selectedDetail.contact_email}
                                            </Text>
                                        ) : null}
                                    </View>

                                    {/* Lịch trình & Địa điểm */}
                                    <View style={styles.detailSectionBox}>
                                        <Text style={styles.detailSectionTitle}>LỊCH TRÌNH & ĐỊA ĐIỂM THI ĐẤU</Text>
                                        <Text style={styles.detailRowText}>
                                            <Text style={styles.detailLabel}>Thời gian: </Text>
                                            {formatDateVN(selectedDetail.start_date)} → {formatDateVN(selectedDetail.end_date || selectedDetail.start_date)}
                                        </Text>
                                        <Text style={styles.detailRowText}>
                                            <Text style={styles.detailLabel}>Khung giờ thi đấu: </Text>
                                            {selectedDetail.time_slots_info || '17:00 - 20:00'}
                                        </Text>
                                        <Text style={styles.detailRowText}>
                                            <Text style={styles.detailLabel}>Quy mô: </Text>
                                            {selectedDetail.expected_teams || 8} đội tham gia
                                        </Text>
                                        <Text style={styles.detailRowText}>
                                            <Text style={styles.detailLabel}>Sân đăng ký: </Text>
                                            {parseJsonSafe(selectedDetail.selected_fields_info).join(', ') || 'Chưa chỉ định sân'}
                                        </Text>
                                    </View>

                                    {/* Dự toán & Thanh toán */}
                                    <View style={styles.detailSectionBox}>
                                        <Text style={styles.detailSectionTitle}>DỰ TOÁN & THANH TOÁN</Text>
                                        <Text style={styles.detailRowText}>
                                            <Text style={styles.detailLabel}>Tổng ngân sách dự toán: </Text>
                                            <Text style={{ fontWeight: '800', color: '#006b2c' }}>
                                                {selectedDetail.estimated_budget ? formatVND(selectedDetail.estimated_budget) : 'Chưa báo giá'}
                                            </Text>
                                        </Text>
                                        <Text style={styles.detailRowText}>
                                            <Text style={styles.detailLabel}>Trạng thái thanh toán: </Text>
                                            {selectedDetail.payment_status === 'Paid' ? 'Đã thanh toán 100%' : (selectedDetail.payment_status === 'Deposit_Paid' ? 'Đã cọc 50%' : 'Chưa thanh toán')}
                                        </Text>
                                        <Text style={styles.detailRowText}>
                                            <Text style={styles.detailLabel}>Đã thanh toán: </Text>
                                            {formatVND(selectedDetail.paid_amount || 0)}
                                        </Text>
                                        <Text style={styles.detailRowText}>
                                            <Text style={styles.detailLabel}>Tiền cọc: </Text>
                                            {formatVND(selectedDetail.deposit_amount || 0)}
                                        </Text>
                                        <Text style={styles.detailRowText}>
                                            <Text style={styles.detailLabel}>Số tiền còn lại: </Text>
                                            {formatVND(selectedDetail.remaining_amount || 0)}
                                        </Text>
                                    </View>

                                    {/* Dịch vụ kèm theo */}
                                    {parseJsonSafe(selectedDetail.services_requested).length > 0 && (
                                        <View style={styles.detailSectionBox}>
                                            <Text style={styles.detailSectionTitle}>DỊCH VỤ TỔ CHỨC YÊU CẦU</Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                                {parseJsonSafe(selectedDetail.services_requested).map((s, idx) => (
                                                    <View key={idx} style={styles.servicePill}>
                                                        <Ionicons name="sparkles-outline" size={11} color="#006b2c" />
                                                        <Text style={styles.servicePillText}>{typeof s === 'string' ? s : (s.name || 'Dịch vụ')}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    )}

                                    {/* Ghi chú */}
                                    {selectedDetail.notes ? (
                                        <View style={styles.noteBox}>
                                            <Text style={styles.noteText}>
                                                <Text style={{ fontWeight: '700' }}>Ghi chú của khách: </Text>
                                                {selectedDetail.notes}
                                            </Text>
                                        </View>
                                    ) : null}

                                    {selectedDetail.admin_notes ? (
                                        <View style={[styles.noteBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                                            <Text style={[styles.noteText, { color: '#166534' }]}>
                                                <Text style={{ fontWeight: '700' }}>Ghi chú nội bộ BQL: </Text>
                                                {selectedDetail.admin_notes}
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                            )}
                        </ScrollView>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                            <TouchableOpacity
                                style={{ flex: 1, paddingVertical: 11, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' }}
                                onPress={() => setSelectedDetail(null)}
                            >
                                <Text style={{ color: '#475569', fontWeight: '700', fontSize: 13 }}>Đóng</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{ flex: 1.2, paddingVertical: 11, borderRadius: 8, backgroundColor: '#006b2c', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                                onPress={() => {
                                    const item = selectedDetail;
                                    setSelectedDetail(null);
                                    handleOpenEdit(item);
                                }}
                            >
                                <Ionicons name="create-outline" size={16} color="#ffffff" />
                                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>Chỉnh sửa hồ sơ</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal Chọn Khách hàng có sẵn */}
            <Modal
                visible={showUserPickerModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowUserPickerModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCardWrapper, { maxHeight: '80%' }]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalMainHeader}>Chọn Tài Khoản Khách Hàng</Text>
                                <Text style={styles.modalSubHeader}>Hệ thống tự động điền họ tên, số điện thoại & email</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowUserPickerModal(false)}>
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={[styles.modalInput, { marginVertical: 10 }]}
                            placeholder="🔍 Tìm theo tên hoặc SĐT..."
                            placeholderTextColor="#94a3b8"
                            value={userPickerSearch}
                            onChangeText={setUserPickerSearch}
                        />
                        <ScrollView style={{ flex: 1, minHeight: 0 }} showsVerticalScrollIndicator={true}>
                            {systemUsers
                                .filter((u) => {
                                    if (!userPickerSearch.trim()) return true;
                                    const q = userPickerSearch.toLowerCase();
                                    const n = (u.name || u.full_name || u.username || '').toLowerCase();
                                    const p = String(u.phone || '');
                                    return n.includes(q) || p.includes(q);
                                })
                                .map((u) => {
                                    const uName = u.name || u.full_name || u.username || 'Khách hàng';
                                    const isSel = selectedCustomerMode === String(u.id);
                                    return (
                                        <TouchableOpacity
                                            key={u.id}
                                            style={[styles.userListItem, isSel && styles.userListItemActive]}
                                            onPress={() => {
                                                handleSelectCustomer(String(u.id));
                                                setShowUserPickerModal(false);
                                            }}
                                        >
                                            <View style={[styles.userListAvatar, isSel && { backgroundColor: '#059669' }]}>
                                                <Ionicons name="person" size={16} color={isSel ? '#ffffff' : '#059669'} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.userListName, isSel && { color: '#059669', fontWeight: '800' }]}>
                                                    {uName}
                                                </Text>
                                                <Text style={styles.userListPhone}>
                                                    SĐT: {u.phone || 'Chưa cập nhật'} {u.email ? `• ${u.email}` : ''}
                                                </Text>
                                            </View>
                                            {isSel && <Ionicons name="checkmark-circle" size={18} color="#059669" />}
                                        </TouchableOpacity>
                                    );
                                })}
                        </ScrollView>
                        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                            <TouchableOpacity
                                style={styles.modalSecondaryBtn}
                                onPress={() => setShowUserPickerModal(false)}
                            >
                                <Text style={styles.modalSecondaryBtnText}>Đóng</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════
                MODAL 2: CHỈNH SỬA HỒ SƠ GIẢI ĐẤU (EDIT MODAL)
               ═══════════════════════════════════════════════════════════ */}
            <Modal
                visible={Boolean(selectedEdit)}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedEdit(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCardWrapperLarge}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalSubHeader}>CHỈNH SỬA HỒ SƠ GIẢI ĐẤU</Text>
                                <Text style={styles.modalMainHeader} numberOfLines={1}>
                                    {selectedEdit?.tournament_name}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedEdit(null)}>
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={{ flex: 1, minHeight: 0, marginTop: 10 }}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            showsVerticalScrollIndicator={true}
                        >
                            <View style={{ gap: 14 }}>
                                {/* 1. Thông tin giải đấu */}
                                <View>
                                    <Text style={styles.formLabel}>
                                        Tên giải đấu <Text style={{ color: '#ef4444' }}>*</Text>
                                    </Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Tên giải đấu..."
                                        placeholderTextColor="#94a3b8"
                                        value={editTourName}
                                        onChangeText={setEditTourName}
                                    />
                                </View>

                                <View>
                                    <Text style={styles.formLabel}>Đơn vị / Doanh nghiệp tổ chức</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Công ty / Đơn vị tổ chức..."
                                        placeholderTextColor="#94a3b8"
                                        value={editOrgName}
                                        onChangeText={setEditOrgName}
                                    />
                                </View>

                                {/* 2. Thông tin liên hệ */}
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.formLabel}>
                                            Người liên hệ <Text style={{ color: '#ef4444' }}>*</Text>
                                        </Text>
                                        <TextInput
                                            style={styles.modalInput}
                                            placeholder="Họ tên người liên hệ"
                                            placeholderTextColor="#94a3b8"
                                            value={editContactName}
                                            onChangeText={setEditContactName}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.formLabel}>
                                            Số điện thoại <Text style={{ color: '#ef4444' }}>*</Text>
                                        </Text>
                                        <TextInput
                                            style={styles.modalInput}
                                            placeholder="SĐT liên hệ"
                                            placeholderTextColor="#94a3b8"
                                            keyboardType="phone-pad"
                                            value={editContactPhone}
                                            onChangeText={setEditContactPhone}
                                        />
                                    </View>
                                </View>

                                <View>
                                    <Text style={styles.formLabel}>Email nhận hợp đồng & báo giá</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Email người liên hệ"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="email-address"
                                        value={editContactEmail}
                                        onChangeText={setEditContactEmail}
                                    />
                                </View>

                                {/* 3. Thời gian thi đấu (Chuẩn Web) */}
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.formLabel}>
                                            Ngày bắt đầu <Text style={{ color: '#dc2626' }}>*</Text>
                                        </Text>
                                        <View style={styles.dateInputWrap}>
                                            <Ionicons name="calendar-outline" size={16} color="#059669" style={{ marginLeft: 10 }} />
                                            <TextInput
                                                style={[styles.modalInput, { flex: 1, borderWidth: 0, paddingLeft: 8 }]}
                                                placeholder="YYYY-MM-DD"
                                                placeholderTextColor="#94a3b8"
                                                value={editStartDate}
                                                {...(Platform.OS === 'web' ? { type: 'date', min: new Date().toISOString().slice(0, 10) } : {})}
                                                onChangeText={(text) => {
                                                    setEditStartDate(text);
                                                    if (editEndDate && editEndDate < text) {
                                                        setEditEndDate(text);
                                                    }
                                                }}
                                            />
                                        </View>
                                    </View>

                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.formLabel}>
                                            Ngày kết thúc <Text style={{ color: '#dc2626' }}>*</Text>
                                        </Text>
                                        <View style={styles.dateInputWrap}>
                                            <Ionicons name="calendar-outline" size={16} color="#059669" style={{ marginLeft: 10 }} />
                                            <TextInput
                                                style={[styles.modalInput, { flex: 1, borderWidth: 0, paddingLeft: 8 }]}
                                                placeholder="YYYY-MM-DD"
                                                placeholderTextColor="#94a3b8"
                                                value={editEndDate}
                                                {...(Platform.OS === 'web' ? { type: 'date', min: editStartDate || new Date().toISOString().slice(0, 10) } : {})}
                                                onChangeText={setEditEndDate}
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* 4. Số đội tham gia */}
                                <View>
                                    <Text style={styles.formLabel}>Số đội tham gia (2 - 64 đội)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Nhập số đội (VD: 8, 16)"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="numeric"
                                        value={editTeamsCount}
                                        onChangeText={setEditTeamsCount}
                                    />
                                </View>

                                {/* 5. Khung giờ thi đấu (Bấm mở modal chọn chuẩn Web) */}
                                <View>
                                    <Text style={styles.formLabel}>
                                        Khung giờ thi đấu <Text style={{ color: '#ef4444' }}>*</Text>
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.slotPickerTrigger}
                                        onPress={() => handleOpenSlotPicker('edit')}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="time" size={18} color="#059669" />
                                        <Text style={[styles.slotPickerTriggerText, !editTimeSlots && { color: '#94a3b8' }]} numberOfLines={2}>
                                            {editTimeSlots || 'Nhấn vào đây để thiết lập khung giờ thi đấu...'}
                                        </Text>
                                        <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                                    </TouchableOpacity>
                                </View>

                                {/* 6. Chọn cụm sân thi đấu */}
                                <View>
                                    <Text style={styles.formLabel}>Các sân mong muốn thi đấu (Chọn một hoặc nhiều sân)</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                        {fieldsList.map((f) => {
                                            const fName = f.field_name || f.name || String(f.id);
                                            const isSel = editSelectedFields.includes(fName);
                                            return (
                                                <TouchableOpacity
                                                    key={f.id}
                                                    style={[styles.fieldSelectChip, isSel && styles.fieldSelectChipActive]}
                                                    onPress={() => toggleEditFieldSelect(fName)}
                                                >
                                                    <Ionicons
                                                        name={isSel ? 'checkbox' : 'square-outline'}
                                                        size={14}
                                                        color={isSel ? '#ffffff' : '#64748b'}
                                                    />
                                                    <Text style={[styles.fieldSelectChipText, isSel && styles.fieldSelectChipTextActive]}>
                                                        {fName}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* 7. Gói dịch vụ sự kiện */}
                                <View>
                                    <Text style={styles.formLabel}>Gói dịch vụ sự kiện & Tiện ích đi kèm</Text>
                                    <View style={{ gap: 6 }}>
                                        {SERVICE_PACKAGES.map((pkg) => {
                                            const isSel = editSelectedServices.some(s => typeof s === 'string' && (s === pkg.fullName || s.includes(pkg.name) || s.includes(pkg.label)));
                                            return (
                                                <TouchableOpacity
                                                    key={pkg.id}
                                                    style={[styles.servicePackageItem, isSel && styles.servicePackageItemActive]}
                                                    onPress={() => toggleEditServicePackage(pkg.fullName)}
                                                    activeOpacity={0.8}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                                        <Ionicons
                                                            name={isSel ? 'checkbox' : 'square-outline'}
                                                            size={18}
                                                            color={isSel ? '#006b2c' : '#94a3b8'}
                                                        />
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={[styles.servicePackageTitle, isSel && styles.servicePackageTitleActive]}>
                                                                {pkg.label}
                                                            </Text>
                                                            <Text style={styles.servicePackageDesc}>{pkg.desc}</Text>
                                                        </View>
                                                    </View>
                                                    <View style={styles.includedBadge}>
                                                        <Text style={styles.includedBadgeText}>Trọn gói</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* 8. Trạng thái phê duyệt */}
                                <View>
                                    <Text style={styles.formLabel}>Trạng thái phê duyệt (*)</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                        {Object.keys(STATUS_MAP).map((k) => {
                                            const isSel = editStatus === k;
                                            const s = STATUS_MAP[k];
                                            return (
                                                <TouchableOpacity
                                                    key={k}
                                                    style={[
                                                        styles.statusOptionChip,
                                                        isSel && { backgroundColor: s.bg, borderColor: s.color }
                                                    ]}
                                                    onPress={() => setEditStatus(k)}
                                                >
                                                    <View style={[styles.statusDot, { backgroundColor: s.color }]} />
                                                    <Text style={[styles.statusOptionChipText, isSel && { color: s.color, fontWeight: '800' }]}>
                                                        {s.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* 9. Ngân sách & Thanh toán */}
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.formLabel}>Ngân sách dự toán (VNĐ)</Text>
                                        <TextInput
                                            style={styles.modalInput}
                                            placeholder="15000000"
                                            placeholderTextColor="#94a3b8"
                                            keyboardType="numeric"
                                            value={editBudget}
                                            onChangeText={handleEditBudgetChange}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.formLabel}>Số tiền đã thanh toán</Text>
                                        <TextInput
                                            style={styles.modalInput}
                                            placeholder="0"
                                            placeholderTextColor="#94a3b8"
                                            keyboardType="numeric"
                                            value={editPaidAmount}
                                            onChangeText={setEditPaidAmount}
                                        />
                                    </View>
                                </View>

                                <View>
                                    <Text style={styles.formLabel}>Hình thức / Trạng thái thanh toán</Text>
                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                        {[
                                            { key: 'Unpaid', label: 'Chưa thanh toán' },
                                            { key: 'Deposit_Paid', label: 'Đã cọc 50%' },
                                            { key: 'Paid', label: 'Đã trả 100%' },
                                        ].map((item) => {
                                            const isSel = editPaymentStatus === item.key;
                                            return (
                                                <TouchableOpacity
                                                    key={item.key}
                                                    style={[
                                                        styles.paymentOptionChip,
                                                        isSel && styles.paymentOptionChipActive
                                                    ]}
                                                    onPress={() => handleEditPaymentStatusChange(item.key)}
                                                >
                                                    <Text style={[styles.paymentOptionChipText, isSel && styles.paymentOptionChipTextActive]}>
                                                        {item.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* 10. Ghi chú khách & BQL */}
                                <View>
                                    <Text style={styles.formLabel}>Ghi chú khách hàng</Text>
                                    <TextInput
                                        style={[styles.modalInput, { minHeight: 45 }]}
                                        placeholder="Yêu cầu riêng từ khách..."
                                        placeholderTextColor="#94a3b8"
                                        multiline
                                        value={editTourNotes}
                                        onChangeText={setEditTourNotes}
                                    />
                                </View>

                                <View>
                                    <Text style={styles.formLabel}>Ghi chú nội bộ của Ban quản trị</Text>
                                    <TextInput
                                        style={[styles.modalInput, { minHeight: 65 }]}
                                        placeholder="Ghi chú đàm phán hợp đồng, yêu cầu đặc biệt..."
                                        placeholderTextColor="#94a3b8"
                                        multiline
                                        value={editAdminNotes}
                                        onChangeText={setEditAdminNotes}
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                            <TouchableOpacity
                                style={{ flex: 1, paddingVertical: 11, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' }}
                                onPress={() => setSelectedEdit(null)}
                            >
                                <Text style={{ color: '#475569', fontWeight: '700', fontSize: 13 }}>Hủy</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{ flex: 1.5, paddingVertical: 11, borderRadius: 8, backgroundColor: '#006b2c', alignItems: 'center' }}
                                onPress={handleSaveEdit}
                                disabled={savingEdit}
                            >
                                {savingEdit ? (
                                    <ActivityIndicator color="#ffffff" size="small" />
                                ) : (
                                    <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>Lưu Thay Đổi</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal Chọn Khách hàng có sẵn */}
            <Modal
                visible={showUserPickerModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowUserPickerModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCardWrapper, { maxHeight: '80%' }]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalMainHeader}>Chọn Tài Khoản Khách Hàng</Text>
                                <Text style={styles.modalSubHeader}>Hệ thống tự động điền họ tên, số điện thoại & email</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowUserPickerModal(false)}>
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={[styles.modalInput, { marginVertical: 10 }]}
                            placeholder="🔍 Tìm theo tên hoặc SĐT..."
                            placeholderTextColor="#94a3b8"
                            value={userPickerSearch}
                            onChangeText={setUserPickerSearch}
                        />
                        <ScrollView style={{ flex: 1, minHeight: 0 }} showsVerticalScrollIndicator={true}>
                            {systemUsers
                                .filter((u) => {
                                    if (!userPickerSearch.trim()) return true;
                                    const q = userPickerSearch.toLowerCase();
                                    const n = (u.name || u.full_name || u.username || '').toLowerCase();
                                    const p = String(u.phone || '');
                                    return n.includes(q) || p.includes(q);
                                })
                                .map((u) => {
                                    const uName = u.name || u.full_name || u.username || 'Khách hàng';
                                    const isSel = selectedCustomerMode === String(u.id);
                                    return (
                                        <TouchableOpacity
                                            key={u.id}
                                            style={[styles.userListItem, isSel && styles.userListItemActive]}
                                            onPress={() => {
                                                handleSelectCustomer(String(u.id));
                                                setShowUserPickerModal(false);
                                            }}
                                        >
                                            <View style={[styles.userListAvatar, isSel && { backgroundColor: '#059669' }]}>
                                                <Ionicons name="person" size={16} color={isSel ? '#ffffff' : '#059669'} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.userListName, isSel && { color: '#059669', fontWeight: '800' }]}>
                                                    {uName}
                                                </Text>
                                                <Text style={styles.userListPhone}>
                                                    SĐT: {u.phone || 'Chưa cập nhật'} {u.email ? `• ${u.email}` : ''}
                                                </Text>
                                            </View>
                                            {isSel && <Ionicons name="checkmark-circle" size={18} color="#059669" />}
                                        </TouchableOpacity>
                                    );
                                })}
                        </ScrollView>
                        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                            <TouchableOpacity
                                style={styles.modalSecondaryBtn}
                                onPress={() => setShowUserPickerModal(false)}
                            >
                                <Text style={styles.modalSecondaryBtnText}>Đóng</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ═══════════════════════════════════════════════════════════
                MODAL 3: TẠO HỒ SƠ GIẢI ĐẤU MỚI (CREATE MODAL)
               ═══════════════════════════════════════════════════════════ */}
            <Modal
                visible={createModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setCreateModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCardWrapperLarge}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                <View style={styles.modalIconBadge}>
                                    <Ionicons name="trophy" size={20} color="#059669" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalMainHeader}>Thêm Giải Đấu / Đặt Giải Mới</Text>
                                    <Text style={styles.modalSubHeader}>Tiếp nhận và lên lịch giải đấu trực tiếp từ Ban quản trị</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setCreateModalVisible(false)}>
                                <Ionicons name="close" size={22} color="#475569" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={{ flex: 1, minHeight: 0, marginTop: 10 }}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            showsVerticalScrollIndicator={true}
                        >
                            <View style={{ gap: 14 }}>
                                {/* 1. Tên giải đấu & Đơn vị tổ chức */}
                                <View>
                                    <Text style={styles.formLabel}>
                                        Tên giải đấu <Text style={{ color: '#ef4444' }}>*</Text>
                                    </Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="VD: Giải Bóng Đá Mùa Thu Doanh Nghiệp 2026"
                                        placeholderTextColor="#94a3b8"
                                        value={tourName}
                                        onChangeText={setTourName}
                                    />
                                </View>

                                <View>
                                    <Text style={styles.formLabel}>
                                        Đơn vị / Ban tổ chức
                                    </Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="VD: Công ty FPT, Hội Doanh nghiệp Đà Nẵng..."
                                        placeholderTextColor="#94a3b8"
                                        value={orgName}
                                        onChangeText={setOrgName}
                                    />
                                </View>

                                {/* 2. Chọn khách hàng có sẵn hoặc khách vãng lai (Chuẩn Web) */}
                                <View style={styles.customerSelectBox}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="person-circle" size={17} color="#059669" />
                                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#065f46' }}>
                                                Người liên hệ:
                                            </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                            <TouchableOpacity
                                                style={[styles.customerTabBtn, selectedCustomerMode === 'guest' && styles.customerTabBtnActive]}
                                                onPress={() => handleSelectCustomer('guest')}
                                            >
                                                <Text style={[styles.customerTabBtnText, selectedCustomerMode === 'guest' && styles.customerTabBtnTextActive]}>
                                                    Khách vãng lai
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.customerTabBtn, selectedCustomerMode !== 'guest' && styles.customerTabBtnActive]}
                                                onPress={() => setShowUserPickerModal(true)}
                                            >
                                                <Text style={[styles.customerTabBtnText, selectedCustomerMode !== 'guest' && styles.customerTabBtnTextActive]}>
                                                    Chọn tài khoản ({systemUsers.length})
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    {selectedCustomerMode !== 'guest' && (
                                        <View style={styles.selectedCustomerBadge}>
                                            <Ionicons name="checkmark-circle" size={14} color="#059669" />
                                            <Text style={{ fontSize: 11.5, color: '#065f46', fontWeight: '700', flex: 1 }} numberOfLines={1}>
                                                {contactName} • SĐT: {contactPhone || 'Chưa SĐT'} • {contactEmail || ''}
                                            </Text>
                                            <TouchableOpacity onPress={() => handleSelectCustomer('guest')}>
                                                <Ionicons name="close-circle" size={15} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>

                                {/* 3. Thông tin liên hệ chi tiết */}
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.formLabel}>
                                            Người liên hệ <Text style={{ color: '#ef4444' }}>*</Text>
                                        </Text>
                                        <TextInput
                                            style={styles.modalInput}
                                            placeholder="VD: Nguyễn Văn A"
                                            placeholderTextColor="#94a3b8"
                                            value={contactName}
                                            onChangeText={setContactName}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.formLabel}>
                                            Số điện thoại <Text style={{ color: '#ef4444' }}>*</Text>
                                        </Text>
                                        <TextInput
                                            style={styles.modalInput}
                                            placeholder="VD: 0912345678"
                                            placeholderTextColor="#94a3b8"
                                            keyboardType="phone-pad"
                                            value={contactPhone}
                                            onChangeText={setContactPhone}
                                        />
                                    </View>
                                </View>

                                <View>
                                    <Text style={styles.formLabel}>Email liên hệ</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="VD: contact@company.vn"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="email-address"
                                        value={contactEmail}
                                        onChangeText={setContactEmail}
                                    />
                                </View>

                                {/* 4. Thời gian (Chuẩn Web) */}
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.formLabel}>
                                            Ngày bắt đầu <Text style={{ color: '#dc2626' }}>*</Text>
                                        </Text>
                                        <View style={styles.dateInputWrap}>
                                            <Ionicons name="calendar-outline" size={16} color="#059669" style={{ marginLeft: 10 }} />
                                            <TextInput
                                                style={[styles.modalInput, { flex: 1, borderWidth: 0, paddingLeft: 8 }]}
                                                placeholder="YYYY-MM-DD"
                                                placeholderTextColor="#94a3b8"
                                                value={startDate}
                                                {...(Platform.OS === 'web' ? { type: 'date', min: new Date().toISOString().slice(0, 10) } : {})}
                                                onChangeText={(text) => {
                                                    setStartDate(text);
                                                    if (endDate && endDate < text) {
                                                        setEndDate(text);
                                                    }
                                                }}
                                            />
                                        </View>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.formLabel}>
                                            Ngày kết thúc <Text style={{ color: '#dc2626' }}>*</Text>
                                        </Text>
                                        <View style={styles.dateInputWrap}>
                                            <Ionicons name="calendar-outline" size={16} color="#059669" style={{ marginLeft: 10 }} />
                                            <TextInput
                                                style={[styles.modalInput, { flex: 1, borderWidth: 0, paddingLeft: 8 }]}
                                                placeholder="YYYY-MM-DD"
                                                placeholderTextColor="#94a3b8"
                                                value={endDate}
                                                {...(Platform.OS === 'web' ? { type: 'date', min: startDate || new Date().toISOString().slice(0, 10) } : {})}
                                                onChangeText={setEndDate}
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* 5. Số đội tham gia */}
                                <View>
                                    <Text style={styles.formLabel}>Số đội tham gia (2 - 64 đội)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="VD: 8"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="numeric"
                                        value={teamsCount}
                                        onChangeText={setTeamsCount}
                                    />
                                </View>

                                {/* 6. Khung giờ thi đấu (Bấm mở modal chọn chuẩn Web) */}
                                <View>
                                    <Text style={styles.formLabel}>
                                        Khung giờ thi đấu <Text style={{ color: '#ef4444' }}>*</Text>
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.slotPickerTrigger}
                                        onPress={() => handleOpenSlotPicker('create')}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="time" size={18} color="#059669" />
                                        <Text style={[styles.slotPickerTriggerText, !timeSlotsInfo && { color: '#94a3b8' }]} numberOfLines={2}>
                                            {timeSlotsInfo || 'Nhấn vào đây để thiết lập khung giờ thi đấu...'}
                                        </Text>
                                        <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                                    </TouchableOpacity>
                                </View>

                                <View>
                                    <Text style={styles.formLabel}>Trạng thái ban đầu</Text>
                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                        {[
                                            { key: 'Pending', label: '⏳ Chờ xử lý' },
                                            { key: 'Contacted', label: '📞 Đã liên hệ' },
                                            { key: 'Approved', label: '✅ Đã chốt duyệt' }
                                        ].map(item => {
                                            const isSel = createStatus === item.key;
                                            return (
                                                <TouchableOpacity
                                                    key={item.key}
                                                    style={[styles.statusSelectChip, isSel && styles.statusSelectChipActive]}
                                                    onPress={() => setCreateStatus(item.key)}
                                                >
                                                    <Text style={[styles.statusSelectChipText, isSel && styles.statusSelectChipTextActive]}>
                                                        {item.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* 7. Dự toán ngân sách & Thanh toán ban đầu (Đồng bộ chuẩn Web) */}
                                <View style={styles.paymentSectionBox}>
                                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a', marginBottom: 10 }}>
                                        💰 Dự toán ngân sách & Thanh toán ban đầu
                                    </Text>
                                    <View style={{ marginBottom: 10 }}>
                                        <Text style={styles.formLabel}>Dự toán ngân sách (VNĐ)</Text>
                                        <TextInput
                                            style={styles.modalInput}
                                            placeholder="VD: 15000000"
                                            placeholderTextColor="#94a3b8"
                                            keyboardType="numeric"
                                            value={estimatedBudget}
                                            onChangeText={handleBudgetChange}
                                        />
                                        {Number(estimatedBudget) > 0 && (
                                            <Text style={{ fontSize: 11, color: '#059669', fontWeight: '700', marginTop: 3 }}>
                                                Bằng chữ: {formatVND(estimatedBudget)}
                                            </Text>
                                        )}
                                    </View>

                                    <View style={{ marginBottom: 10 }}>
                                        <Text style={styles.formLabel}>Trạng thái thanh toán ban đầu</Text>
                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                            {[
                                                { key: 'Unpaid', label: '⏳ Chưa cọc' },
                                                { key: 'Deposit_Paid', label: '⚡ Đã cọc 50%' },
                                                { key: 'Paid', label: '✓ Đã trả 100%' }
                                            ].map(opt => {
                                                const isSel = paymentStatus === opt.key;
                                                return (
                                                    <TouchableOpacity
                                                        key={opt.key}
                                                        style={[styles.payStatusChip, isSel && styles.payStatusChipActive]}
                                                        onPress={() => handlePaymentStatusChange(opt.key)}
                                                    >
                                                        <Text style={[styles.payStatusChipText, isSel && styles.payStatusChipTextActive]}>
                                                            {opt.label}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.formLabel}>Đã thu (VNĐ)</Text>
                                            <TextInput
                                                style={styles.modalInput}
                                                placeholder="0"
                                                placeholderTextColor="#94a3b8"
                                                keyboardType="numeric"
                                                value={paidAmount}
                                                onChangeText={(val) => {
                                                    const raw = val.replace(/[^0-9]/g, '');
                                                    setPaidAmount(raw);
                                                    const b = Number(estimatedBudget) || 0;
                                                    setRemainingAmount(String(Math.max(0, b - (Number(raw) || 0))));
                                                }}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.formLabel}>Còn lại cần thu (VNĐ)</Text>
                                            <TextInput
                                                style={[styles.modalInput, { backgroundColor: '#f1f5f9' }]}
                                                placeholder="0"
                                                placeholderTextColor="#94a3b8"
                                                keyboardType="numeric"
                                                value={remainingAmount}
                                                onChangeText={(val) => setRemainingAmount(val.replace(/[^0-9]/g, ''))}
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* 8. Chọn cụm sân thi đấu (Hỗ trợ Multi-select như Web) */}
                                <View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="football" size={15} color="#006b2c" />
                                            <Text style={[styles.formLabel, { marginBottom: 0 }]}>
                                                Chọn cụm sân thi đấu ({selectedFields.length} sân đã chọn):
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                        {fieldsList.map((f) => {
                                            const fName = f.field_name || f.name;
                                            const isSel = selectedFields.includes(fName);
                                            return (
                                                <TouchableOpacity
                                                    key={f.id}
                                                    style={[
                                                        styles.fieldSelectChip,
                                                        isSel && styles.fieldSelectChipActive
                                                    ]}
                                                    onPress={() => toggleFieldSelect(fName)}
                                                >
                                                    <Ionicons
                                                        name={isSel ? "checkbox" : "square-outline"}
                                                        size={14}
                                                        color={isSel ? '#ffffff' : '#006b2c'}
                                                    />
                                                    <Text style={[styles.fieldSelectChipText, isSel && styles.fieldSelectChipTextActive]}>
                                                        {fName}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* 9. Gói tiện ích sự kiện trọn gói sẵn có (Chuẩn Web) */}
                                <View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                        <Ionicons name="gift-outline" size={15} color="#059669" />
                                        <Text style={[styles.formLabel, { marginBottom: 0 }]}>
                                            Gói tiện ích sự kiện trọn gói:
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                        {STANDARD_EVENT_PACKAGES.map((pkg) => {
                                            const fullLabel = pkg.fullName || `${pkg.name} (Trọn gói sẵn có)`;
                                            const isSel = selectedServices.some(s => typeof s === 'string' && (s === fullLabel || s.includes(pkg.name)));
                                            return (
                                                <TouchableOpacity
                                                    key={pkg.id}
                                                    style={[
                                                        styles.serviceChip,
                                                        isSel && styles.serviceChipActive
                                                    ]}
                                                    onPress={() => toggleServicePackage(fullLabel)}
                                                >
                                                    <Ionicons
                                                        name={isSel ? "checkmark-circle" : pkg.icon}
                                                        size={13}
                                                        color={isSel ? '#ffffff' : '#047857'}
                                                    />
                                                    <Text style={[styles.serviceChipText, isSel && styles.serviceChipTextActive]}>
                                                        {pkg.name}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* 10. Ghi chú yêu cầu của BTC & Ghi chú nội bộ BQT */}
                                <View>
                                    <Text style={styles.formLabel}>Ghi chú yêu cầu của Ban tổ chức</Text>
                                    <TextInput
                                        style={[styles.modalInput, { minHeight: 50 }]}
                                        placeholder="Yêu cầu riêng về phòng thay đồ, chỗ để xe, nước uống..."
                                        placeholderTextColor="#94a3b8"
                                        multiline
                                        value={tourNotes}
                                        onChangeText={setTourNotes}
                                    />
                                </View>

                                <View>
                                    <Text style={styles.formLabel}>Ghi chú nội bộ Ban quản trị (BQT)</Text>
                                    <TextInput
                                        style={[styles.modalInput, { minHeight: 50 }]}
                                        placeholder="Ghi chú nhân sự trực, số bàn giao, lịch thỏa thuận..."
                                        placeholderTextColor="#94a3b8"
                                        multiline
                                        value={adminNotes}
                                        onChangeText={setAdminNotes}
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        {/* Modal Action Buttons */}
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setCreateModalVisible(false)}
                            >
                                <Text style={styles.modalCancelBtnText}>Hủy bỏ</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.modalSubmitBtn}
                                onPress={handleCreateTournament}
                                disabled={submittingTour}
                            >
                                {submittingTour ? (
                                    <ActivityIndicator color="#ffffff" size="small" />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
                                        <Text style={styles.modalSubmitBtnText}>Lưu hồ sơ giải đấu</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal Thiết lập khung giờ thi đấu chuẩn Web */}
            <Modal
                visible={slotPickerModal.isOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setSlotPickerModal((prev) => ({ ...prev, isOpen: false }))}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.slotPickerModalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                <View style={styles.modalIconBadge}>
                                    <Ionicons name="time" size={20} color="#059669" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalMainHeader}>Thiết Lập Khung Giờ Thi Đấu</Text>
                                    <Text style={styles.modalSubHeader}>
                                        {slotPickerModal.target === 'create' ? 'Áp dụng cho phiếu Thêm mới' : 'Áp dụng cho phiếu Chỉnh sửa'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.modalCloseBtn}
                                onPress={() => setSlotPickerModal((prev) => ({ ...prev, isOpen: false }))}
                            >
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ flex: 1, minHeight: 0, marginTop: 10 }} showsVerticalScrollIndicator={true}>
                            {/* 1. Chọn chế độ áp dụng */}
                            <Text style={styles.slotPickerSectionLabel}>1. Chế độ áp dụng</Text>
                            <View style={styles.slotModeRow}>
                                {[
                                    { key: 'all_days', label: '⚡ Tất cả các ngày' },
                                    { key: 'weekends', label: '📅 Chỉ Thứ 7 & CN' },
                                    { key: 'custom_days', label: '🛠️ Từng ngày cụ thể' },
                                ].map((m) => {
                                    const isSel = slotPickerModal.mode === m.key;
                                    return (
                                        <TouchableOpacity
                                            key={m.key}
                                            style={[styles.slotModeBtn, isSel && styles.slotModeBtnActive]}
                                            onPress={() => setSlotPickerModal((prev) => ({ ...prev, mode: m.key }))}
                                        >
                                            <Text style={[styles.slotModeBtnText, isSel && styles.slotModeBtnTextActive]}>
                                                {m.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* 2. Nếu là chế độ từng ngày */}
                            {slotPickerModal.mode === 'custom_days' && (() => {
                                const sDate = slotPickerModal.target === 'create' ? startDate : editStartDate;
                                const eDate = slotPickerModal.target === 'create' ? endDate : editEndDate;
                                const daysList = getTournamentDaysList(sDate, eDate);
                                if (daysList.length === 0) {
                                    return (
                                        <View style={styles.slotWarningBox}>
                                            <Text style={styles.slotWarningText}>
                                                ⚠️ Vui lòng chọn ngày bắt đầu & kết thúc trước để dùng chế độ từng ngày!
                                            </Text>
                                        </View>
                                    );
                                }
                                return (
                                    <View style={{ marginBottom: 12 }}>
                                        <Text style={[styles.slotPickerSectionLabel, { marginBottom: 6 }]}>Chọn ngày để cài đặt:</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                            {daysList.map((d, idx) => {
                                                const slotCount = (slotPickerModal.selectedDaySlots[d.dateStr] || []).length;
                                                const isSelDay = slotPickerModal.activeDayIndex === idx;
                                                return (
                                                    <TouchableOpacity
                                                        key={d.dateStr}
                                                        style={[styles.slotDayPill, isSelDay && styles.slotDayPillActive]}
                                                        onPress={() => setSlotPickerModal((prev) => ({ ...prev, activeDayIndex: idx }))}
                                                    >
                                                        <Text style={[styles.slotDayW, isSelDay && styles.slotDayWActive]}>{d.weekdayName}</Text>
                                                        <Text style={[styles.slotDayD, isSelDay && styles.slotDayDActive]}>{d.displayDate}</Text>
                                                        <Text style={[styles.slotDayCount, isSelDay && styles.slotDayCountActive]}>
                                                            {slotCount > 0 ? `${slotCount} slot` : 'Trống'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                );
                            })()}

                            {/* 3. Nút chọn nhanh */}
                            <View style={styles.slotQuickRow}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b' }}>Chọn nhanh:</Text>
                                <TouchableOpacity
                                    style={styles.slotQuickBtn}
                                    onPress={() => {
                                        const quick = ['17:00 - 18:00', '18:00 - 19:00', '19:00 - 20:00'];
                                        if (slotPickerModal.mode === 'custom_days') {
                                            const sDate = slotPickerModal.target === 'create' ? startDate : editStartDate;
                                            const eDate = slotPickerModal.target === 'create' ? endDate : editEndDate;
                                            const daysList = getTournamentDaysList(sDate, eDate);
                                            const activeDate = daysList[slotPickerModal.activeDayIndex]?.dateStr;
                                            if (activeDate) {
                                                setSlotPickerModal((prev) => ({
                                                    ...prev,
                                                    selectedDaySlots: { ...prev.selectedDaySlots, [activeDate]: quick },
                                                }));
                                            }
                                        } else {
                                            setSlotPickerModal((prev) => ({ ...prev, selectedCommonSlots: quick }));
                                        }
                                    }}
                                >
                                    <Text style={styles.slotQuickBtnText}>Ca Tối (17h-20h)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.slotQuickBtn}
                                    onPress={() => {
                                        const quick = ['18:00 - 19:00', '19:00 - 20:00', '20:00 - 21:00'];
                                        if (slotPickerModal.mode === 'custom_days') {
                                            const sDate = slotPickerModal.target === 'create' ? startDate : editStartDate;
                                            const eDate = slotPickerModal.target === 'create' ? endDate : editEndDate;
                                            const daysList = getTournamentDaysList(sDate, eDate);
                                            const activeDate = daysList[slotPickerModal.activeDayIndex]?.dateStr;
                                            if (activeDate) {
                                                setSlotPickerModal((prev) => ({
                                                    ...prev,
                                                    selectedDaySlots: { ...prev.selectedDaySlots, [activeDate]: quick },
                                                }));
                                            }
                                        } else {
                                            setSlotPickerModal((prev) => ({ ...prev, selectedCommonSlots: quick }));
                                        }
                                    }}
                                >
                                    <Text style={styles.slotQuickBtnText}>Ca Muộn (18h-21h)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.slotQuickBtn}
                                    onPress={() => {
                                        if (slotPickerModal.mode === 'custom_days') {
                                            const sDate = slotPickerModal.target === 'create' ? startDate : editStartDate;
                                            const eDate = slotPickerModal.target === 'create' ? endDate : editEndDate;
                                            const daysList = getTournamentDaysList(sDate, eDate);
                                            const activeDate = daysList[slotPickerModal.activeDayIndex]?.dateStr;
                                            if (activeDate) {
                                                setSlotPickerModal((prev) => ({
                                                    ...prev,
                                                    selectedDaySlots: { ...prev.selectedDaySlots, [activeDate]: [] },
                                                }));
                                            }
                                        } else {
                                            setSlotPickerModal((prev) => ({ ...prev, selectedCommonSlots: [] }));
                                        }
                                    }}
                                >
                                    <Text style={[styles.slotQuickBtnText, { color: '#ef4444' }]}>Bỏ chọn</Text>
                                </TouchableOpacity>
                            </View>

                            {/* 4. Ca sáng */}
                            <Text style={styles.slotSectionHeader}>🌅 Ca Sáng (06:00 - 12:00)</Text>
                            <View style={styles.slotGridWrap}>
                                {MORNING_SLOTS.map((slot) => {
                                    let isSel = false;
                                    if (slotPickerModal.mode === 'custom_days') {
                                        const sDate = slotPickerModal.target === 'create' ? startDate : editStartDate;
                                        const eDate = slotPickerModal.target === 'create' ? endDate : editEndDate;
                                        const daysList = getTournamentDaysList(sDate, eDate);
                                        const activeDate = daysList[slotPickerModal.activeDayIndex]?.dateStr;
                                        isSel = Boolean(activeDate && (slotPickerModal.selectedDaySlots[activeDate] || []).includes(slot));
                                    } else {
                                        isSel = slotPickerModal.selectedCommonSlots.includes(slot);
                                    }
                                    return (
                                        <TouchableOpacity
                                            key={slot}
                                            style={[styles.slotChipItem, isSel && styles.slotChipItemActive]}
                                            onPress={() => handleTogglePickerSlot(slot)}
                                        >
                                            <Ionicons
                                                name={isSel ? 'checkmark-circle' : 'time-outline'}
                                                size={13}
                                                color={isSel ? '#ffffff' : '#059669'}
                                            />
                                            <Text style={[styles.slotChipItemText, isSel && styles.slotChipItemTextActive]}>
                                                {slot}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* 5. Ca Chiều - Tối */}
                            <Text style={styles.slotSectionHeader}>🌇 Ca Chiều - Tối (14:00 - 22:00)</Text>
                            <View style={styles.slotGridWrap}>
                                {AFTERNOON_EVENING_SLOTS.map((slot) => {
                                    let isSel = false;
                                    if (slotPickerModal.mode === 'custom_days') {
                                        const sDate = slotPickerModal.target === 'create' ? startDate : editStartDate;
                                        const eDate = slotPickerModal.target === 'create' ? endDate : editEndDate;
                                        const daysList = getTournamentDaysList(sDate, eDate);
                                        const activeDate = daysList[slotPickerModal.activeDayIndex]?.dateStr;
                                        isSel = Boolean(activeDate && (slotPickerModal.selectedDaySlots[activeDate] || []).includes(slot));
                                    } else {
                                        isSel = slotPickerModal.selectedCommonSlots.includes(slot);
                                    }
                                    return (
                                        <TouchableOpacity
                                            key={slot}
                                            style={[styles.slotChipItem, isSel && styles.slotChipItemActive]}
                                            onPress={() => handleTogglePickerSlot(slot)}
                                        >
                                            <Ionicons
                                                name={isSel ? 'checkmark-circle' : 'time-outline'}
                                                size={13}
                                                color={isSel ? '#ffffff' : '#059669'}
                                            />
                                            <Text style={[styles.slotChipItemText, isSel && styles.slotChipItemTextActive]}>
                                                {slot}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* 6. Ghi chú khung giờ */}
                            <View style={{ marginTop: 12 }}>
                                <Text style={styles.formLabel}>Ghi chú thêm về lịch & khung giờ</Text>
                                <TextInput
                                    style={[styles.modalInput, { minHeight: 45 }]}
                                    placeholder="VD: Khai mạc 17h, chung kết đá 19h..."
                                    placeholderTextColor="#94a3b8"
                                    value={slotPickerModal.slotNote}
                                    onChangeText={(txt) => setSlotPickerModal((prev) => ({ ...prev, slotNote: txt }))}
                                />
                            </View>
                        </ScrollView>

                        {/* Footer Nút bấm */}
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                            <TouchableOpacity
                                style={styles.modalSecondaryBtn}
                                onPress={() => setSlotPickerModal((prev) => ({ ...prev, isOpen: false }))}
                            >
                                <Text style={styles.modalSecondaryBtnText}>Đóng</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalPrimaryBtn}
                                onPress={handleConfirmSlotPicker}
                            >
                                <Ionicons name="checkmark-done" size={17} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={styles.modalPrimaryBtnText}>Xác nhận khung giờ</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal Chọn Khách hàng có sẵn */}
            <Modal
                visible={showUserPickerModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowUserPickerModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCardWrapper, { maxHeight: '80%' }]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalMainHeader}>Chọn Tài Khoản Khách Hàng</Text>
                                <Text style={styles.modalSubHeader}>Hệ thống tự động điền họ tên, số điện thoại & email</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowUserPickerModal(false)}>
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={[styles.modalInput, { marginVertical: 10 }]}
                            placeholder="🔍 Tìm theo tên hoặc SĐT..."
                            placeholderTextColor="#94a3b8"
                            value={userPickerSearch}
                            onChangeText={setUserPickerSearch}
                        />
                        <ScrollView style={{ flex: 1, minHeight: 0 }} showsVerticalScrollIndicator={true}>
                            {systemUsers
                                .filter((u) => {
                                    if (!userPickerSearch.trim()) return true;
                                    const q = userPickerSearch.toLowerCase();
                                    const n = (u.name || u.full_name || u.username || '').toLowerCase();
                                    const p = String(u.phone || '');
                                    return n.includes(q) || p.includes(q);
                                })
                                .map((u) => {
                                    const uName = u.name || u.full_name || u.username || 'Khách hàng';
                                    const isSel = selectedCustomerMode === String(u.id);
                                    return (
                                        <TouchableOpacity
                                            key={u.id}
                                            style={[styles.userListItem, isSel && styles.userListItemActive]}
                                            onPress={() => {
                                                handleSelectCustomer(String(u.id));
                                                setShowUserPickerModal(false);
                                            }}
                                        >
                                            <View style={[styles.userListAvatar, isSel && { backgroundColor: '#059669' }]}>
                                                <Ionicons name="person" size={16} color={isSel ? '#ffffff' : '#059669'} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.userListName, isSel && { color: '#059669', fontWeight: '800' }]}>
                                                    {uName}
                                                </Text>
                                                <Text style={styles.userListPhone}>
                                                    SĐT: {u.phone || 'Chưa cập nhật'} {u.email ? `• ${u.email}` : ''}
                                                </Text>
                                            </View>
                                            {isSel && <Ionicons name="checkmark-circle" size={18} color="#059669" />}
                                        </TouchableOpacity>
                                    );
                                })}
                        </ScrollView>
                        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                            <TouchableOpacity
                                style={styles.modalSecondaryBtn}
                                onPress={() => setShowUserPickerModal(false)}
                            >
                                <Text style={styles.modalSecondaryBtnText}>Đóng</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* In-screen Alert/Dialog */}
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
        flex: 1,
        minWidth: 0,
        marginRight: 6,
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
        flexShrink: 0,
        gap: 4,
        backgroundColor: '#006b2c',
        paddingHorizontal: 11,
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
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    bentoLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6b7280',
    },
    bentoIconBox: {
        width: 26,
        height: 26,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bentoBigNum: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
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
    filterChip: {
        paddingHorizontal: 12,
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
    requestsGrid: {
        gap: 12,
    },
    tournamentCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 10,
        marginBottom: 10,
    },
    codeBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    codeBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#475569',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    categoryBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#006b2c',
    },
    tournamentName: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f172a',
        marginTop: 2,
    },
    orgName: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    specsContainer: {
        gap: 8,
    },
    specRow: {
        flexDirection: 'row',
        gap: 8,
    },
    specBox: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    specLabel: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
    },
    specVal: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f172a',
        marginTop: 2,
    },
    fieldTimeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    fieldTagWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f0f9ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#bae6fd',
    },
    fieldTagText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0369a1',
    },
    timeTagWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#fffbeb',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#fde68a',
    },
    timeTagText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#b45309',
    },
    contactCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    avatarCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#dcfce7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#006b2c',
    },
    contactName: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f172a',
    },
    contactPhone: {
        fontSize: 11,
        color: '#64748b',
    },
    budgetCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    budgetLabel: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
    },
    budgetAmount: {
        fontSize: 13,
        fontWeight: '800',
        color: '#006b2c',
    },
    payBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
    },
    payBadgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    remainingText: {
        fontSize: 10,
        color: '#64748b',
        marginTop: 2,
    },
    servicesPillsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    servicePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#dcfce7',
    },
    servicePillText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#15803d',
    },
    noteBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    noteText: {
        fontSize: 11,
        color: '#334155',
        lineHeight: 16,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    actionIconBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    actionBtnText: {
        fontSize: 11,
        fontWeight: '700',
    },
    approveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#006b2c',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    approveBtnText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '800',
    },
    contactActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#eff6ff',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    contactActionText: {
        color: '#1d4ed8',
        fontSize: 11,
        fontWeight: '700',
    },
    rejectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#fef2f2',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    rejectBtnText: {
        color: '#b91c1c',
        fontSize: 11,
        fontWeight: '700',
    },
    deleteBtn: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: '#fee2e2',
        borderWidth: 1,
        borderColor: '#fca5a5',
        marginLeft: 'auto',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalCardWrapper: {
        width: '100%',
        maxWidth: 580,
        height: '90%',
        maxHeight: '90%',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        elevation: 10,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 10,
        display: 'flex',
        flexDirection: 'column',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 10,
    },
    modalSubHeader: {
        fontSize: 11,
        fontWeight: '800',
        color: '#006b2c',
        letterSpacing: 0.5,
    },
    modalMainHeader: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
        marginTop: 2,
    },
    modalCloseBtn: {
        padding: 4,
    },
    detailSectionBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    detailSectionTitle: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748b',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    detailRowText: {
        fontSize: 12,
        color: '#0f172a',
        lineHeight: 18,
    },
    detailLabel: {
        color: '#64748b',
        fontWeight: '600',
    },
    formLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
    },
    modalInput: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 9,
        fontSize: 13,
        color: '#0f172a',
    },
    statusOptionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#ffffff',
    },
    statusOptionChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#334155',
    },
    paymentOptionChip: {
        flex: 1,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
    },
    paymentOptionChipActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    paymentOptionChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569',
    },
    paymentOptionChipTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    fieldSelectChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    fieldSelectChipActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    fieldSelectChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#006b2c',
    },
    fieldSelectChipTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    payMethodChip: {
        flex: 1,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
    },
    payMethodChipActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    payMethodChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569',
    },
    payMethodChipTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    modalCardWrapperLarge: {
        width: '100%',
        maxWidth: 580,
        height: '90%',
        maxHeight: '90%',
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 16,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 14,
        display: 'flex',
        flexDirection: 'column',
    },
    slotPickerModalCard: {
        width: '100%',
        maxWidth: 540,
        height: '88%',
        maxHeight: '88%',
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 16,
        elevation: 14,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 14,
        display: 'flex',
        flexDirection: 'column',
    },
    slotPickerSectionLabel: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 8,
    },
    slotModeRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 12,
    },
    slotModeBtn: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    slotModeBtnActive: {
        borderColor: '#059669',
        backgroundColor: '#ecfdf5',
    },
    slotModeBtnText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#475569',
        textAlign: 'center',
    },
    slotModeBtnTextActive: {
        color: '#059669',
        fontWeight: '800',
    },
    slotWarningBox: {
        backgroundColor: '#fef3c7',
        padding: 8,
        borderRadius: 8,
        marginBottom: 10,
    },
    slotWarningText: {
        fontSize: 11.5,
        color: '#b45309',
        fontWeight: '600',
    },
    slotDayPill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        alignItems: 'center',
        minWidth: 54,
    },
    slotDayPillActive: {
        borderColor: '#059669',
        backgroundColor: '#ecfdf5',
    },
    slotDayW: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
    },
    slotDayWActive: {
        color: '#059669',
    },
    slotDayD: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#0f172a',
    },
    slotDayDActive: {
        color: '#059669',
    },
    slotDayCount: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 2,
    },
    slotDayCountActive: {
        color: '#059669',
        fontWeight: '700',
    },
    slotQuickRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
        flexWrap: 'wrap',
    },
    slotQuickBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    slotQuickBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#334155',
    },
    slotSectionHeader: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0f172a',
        marginTop: 6,
        marginBottom: 8,
    },
    slotGridWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
    },
    slotChipItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#ffffff',
    },
    slotChipItemActive: {
        backgroundColor: '#059669',
        borderColor: '#059669',
    },
    slotChipItemText: {
        fontSize: 11.5,
        fontWeight: '600',
        color: '#334155',
    },
    slotChipItemTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    slotPickerTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 10,
        backgroundColor: '#ffffff',
    },
    slotPickerTriggerText: {
        flex: 1,
        fontSize: 12.5,
        color: '#0f172a',
        fontWeight: '600',
    },
    customerTabBtn: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: '#e2e8f0',
    },
    customerTabBtnActive: {
        backgroundColor: '#059669',
    },
    customerTabBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
    },
    customerTabBtnTextActive: {
        color: '#ffffff',
    },
    selectedCustomerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#ffffff',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#86efac',
        marginTop: 4,
    },
    dateInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        backgroundColor: '#ffffff',
    },
    userListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    userListItemActive: {
        backgroundColor: '#f0fdf4',
    },
    userListAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#ecfdf5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    userListName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    userListPhone: {
        fontSize: 11.5,
        color: '#64748b',
        marginTop: 2,
    },
    modalIconBadge: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#ecfdf5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    customerSelectBox: {
        backgroundColor: '#f0fdf4',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    userChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#ffffff',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#86efac',
    },
    userChipActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    userChipText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#065f46',
    },
    userChipTextActive: {
        color: '#ffffff',
    },
    presetChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    presetChipActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    presetChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#334155',
    },
    presetChipTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    statusSelectChip: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
    },
    statusSelectChipActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    statusSelectChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
    },
    statusSelectChipTextActive: {
        color: '#ffffff',
    },
    paymentSectionBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    payStatusChip: {
        flex: 1,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
    },
    payStatusChipActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    payStatusChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
    },
    payStatusChipTextActive: {
        color: '#ffffff',
    },
    serviceChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    serviceChipActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    serviceChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#065f46',
    },
    serviceChipTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCancelBtnText: {
        color: '#475569',
        fontWeight: '700',
        fontSize: 13,
    },
    modalSubmitBtn: {
        flex: 1.6,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#006b2c',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#006b2c',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 3,
    },
    modalSubmitBtnText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 13,
    },
    modalSecondaryBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalSecondaryBtnText: {
        color: '#475569',
        fontWeight: '700',
        fontSize: 13,
    },
    modalPrimaryBtn: {
        flex: 1.6,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#006b2c',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#006b2c',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 3,
    },
    modalPrimaryBtnText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 13,
    },
});
