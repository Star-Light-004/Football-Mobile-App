import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal,
    TextInput,
    RefreshControl,
    SafeAreaView,
    Linking,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../context/AuthContext';
import { getFieldsApi } from '../api/fieldsApi';
import { getBookingsApi } from '../api/bookingsApi';
import {
    getCleaningLogsApi,
    createCleaningLogApi,
    getLostFoundItemsApi,
    createLostFoundItemApi,
    updateLostFoundStatusApi,
    deleteLostFoundItemApi,
    toggleLostFoundStatusApi,
    createMaintenanceIssueApi
} from '../api/facilityApi';

// Đồng bộ chính xác tên khóa Storage với bản Web
const STORAGE_KEY = 'pitch_cleaning_status';
const LOGS_KEY = 'pitch_cleaning_logs';
const LOST_KEY = 'pitch_lost_found_items';
const ISSUES_KEY = 'pitch_maintenance_issues';
const HISTORY_KEY = 'pitch_cleaning_history';

// Helper lấy số phút bắt đầu của ca để sắp xếp từ sớm đến muộn (chuẩn theo bản Web)
const getSlotStartMinutes = (timeStr) => {
    if (!timeStr) return 9999;
    const match = String(timeStr).match(/(\d{1,2}):(\d{2})/);
    if (match) {
        return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    }
    return 9999;
};

export default function CleaningScreen({ navigation }) {
    const { user } = useContext(AuthContext);
    const [fields, setFields] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [cleaningStatus, setCleaningStatus] = useState({});
    const [cleaningLogs, setCleaningLogs] = useState([]);
    const [lostFoundItems, setLostFoundItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'urgent' | 'lost_found' | 'stats'

    // Sub-filter trong Tab Đồ khách bỏ quên
    const [lostFilterStatus, setLostFilterStatus] = useState('all'); // 'all' | 'pending' | 'returned'
    const [lostSearchQuery, setLostSearchQuery] = useState('');

    // Modal 1: Xem chi tiết sân (Detail Modal)
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailField, setDetailField] = useState(null);

    // Modal 2: Báo hỏng thiết bị cho Kỹ thuật
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportingField, setReportingField] = useState(null);
    const [issueData, setIssueData] = useState({
        category: 'Lưới khung thành & Cột',
        priority: 'Khẩn cấp',
        description: '',
    });

    // Modal 3: Ghi nhận đồ khách bỏ quên mới
    const [showLostModal, setShowLostModal] = useState(false);
    const [reportingLostField, setReportingLostField] = useState(null);
    const [lostData, setLostData] = useState({
        itemType: 'Áo khoác / Trang phục thi đấu',
        location: 'Băng ghế chờ khán đài',
        description: '',
        guestInfo: '',
        customerPhone: '',
        bookingDate: new Date().toLocaleDateString('en-CA'),
    });

    // Modal 4: Chỉnh sửa đồ thất lạc (Edit Lost Item Modal)
    const [showEditLostModal, setShowEditLostModal] = useState(false);
    const [editingLostItem, setEditingLostItem] = useState(null);

    const formatDateVN = (dateStr) => {
        if (!dateStr) return new Date().toLocaleDateString('vi-VN');
        try {
            const parts = String(dateStr).slice(0, 10).split('-');
            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
            return dateStr;
        } catch {
            return dateStr;
        }
    };

    // Kiểm tra ca dọn có diễn ra trong ngày hôm nay hay không (đồng bộ chuẩn với bản Web)
    const isSessionToday = (s, todayStr, todayFormatted) => {
        if (!s) return false;
        if (s.rawDate && s.rawDate === todayStr) return true;
        if (s.date) {
            const dStr = String(s.date).trim();
            if (dStr === todayFormatted || dStr === todayStr) return true;
            const parts = dStr.split('/');
            if (parts.length === 3) {
                const standardDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                if (standardDate === todayStr) return true;
            }
            return false;
        }
        if (typeof s.id === 'number' && s.id > 1000000000000) {
            const itemDateStr = new Date(s.id).toLocaleDateString('en-CA');
            return itemDateStr === todayStr;
        }
        return false;
    };

    // Helper chuẩn hóa hiển thị tiêu đề ca không bị lặp chữ "Ca"
    const formatSessionTitle = (timeStr) => {
        const clean = String(timeStr || '').trim();
        if (!clean) return 'Ca thi đấu';
        if (clean.toLowerCase().startsWith('ca ')) return clean;
        if (clean.toLowerCase().startsWith('ca')) return `Ca ${clean.slice(2).trim()}`;
        return `Ca ${clean}`;
    };

    // Helper chuẩn hóa hiển thị thời gian hoàn thành (không để text 'Hôm nay' thô)
    const formatCompletedAt = (timeStr, itemTime) => {
        const clean = String(timeStr || '').trim();
        if (clean && clean !== 'Hôm nay' && clean !== 'hôm nay') {
            return clean;
        }
        if (itemTime && String(itemTime).includes('-')) {
            const parts = String(itemTime).split('-');
            if (parts.length > 1 && parts[1].trim()) {
                return parts[1].trim();
            }
        }
        return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    const loadAllData = async () => {
        try {
            const todayStr = new Date().toLocaleDateString('en-CA');

            // 100% LẤY DỮ LIỆU TỪ CƠ SỞ DỮ LIỆU BACKEND API - KHÔNG TỰ TẠO DỮ LIỆU ẢO
            const [
                fieldsRes,
                bookingsRes,
                cleaningApiRes,
                lostApiRes,
                savedStatusStr,
                savedLogsStr,
                savedLostStr,
            ] = await Promise.allSettled([
                getFieldsApi({ show_all: 'true' }),
                getBookingsApi(),
                getCleaningLogsApi(),
                getLostFoundItemsApi(),
                AsyncStorage.getItem(STORAGE_KEY),
                AsyncStorage.getItem(LOGS_KEY),
                AsyncStorage.getItem(LOST_KEY),
            ]);

            // 1. Sân bóng từ DB
            let fieldList = [];
            if (fieldsRes.status === 'fulfilled') {
                const fData = fieldsRes.value;
                fieldList = fData?.fields || fData?.results || (Array.isArray(fData) ? fData : []);
            }
            setFields(fieldList);

            // 2. Lịch đặt sân từ DB
            let bookingList = [];
            if (bookingsRes.status === 'fulfilled') {
                const bData = bookingsRes.value;
                bookingList = bData?.bookings || bData?.results || (Array.isArray(bData) ? bData : []);
            }
            setBookings(bookingList);

            const todayBookings = bookingList.filter((b) => {
                const bDate = String(b.date || b.booking_date || '').slice(0, 10);
                return bDate === todayStr || !bDate;
            });

            // 3. Nhật ký dọn dẹp vệ sinh thực tế từ DB hôm nay (100% CSDL)
            let allLogs = [];
            if (cleaningApiRes.status === 'fulfilled' && Array.isArray(cleaningApiRes.value)) {
                allLogs = cleaningApiRes.value;
            }
            // Chỉ lấy các ca dọn dẹp thực sự diễn ra trong ngày hôm nay từ CSDL
            const todayLogs = allLogs.filter((l) => {
                if (!l.created_at) return false;
                return String(l.created_at).slice(0, 10) === todayStr;
            }).map((l, idx) => ({
                id: l.id || `log_${idx}`,
                time: l.created_at ? new Date(l.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '',
                fieldName: l.field_name || l.field?.name || 'Sân bóng',
                fieldId: l.field || l.field_id,
                statusText: l.status_text || (l.status === 'clean' ? 'Đã dọn xong sau ca' : 'Cần dọn sau ca'),
                cleaner: l.cleaner_name || 'Nhân viên vệ sinh',
                rawDate: todayStr,
            }));

            // Luôn bám sát CSDL thực tế hôm nay
            setCleaningLogs(todayLogs);

            // 4. Trạng thái vệ sinh & các ca đã dọn hôm nay của từng sân từ DB & local storage (chuẩn hóa dữ liệu với bản Web)
            let savedStatusObj = {};
            if (savedStatusStr.status === 'fulfilled' && savedStatusStr.value) {
                try {
                    savedStatusObj = JSON.parse(savedStatusStr.value) || {};
                } catch { }
            }

            const todayFormatted = formatDateVN(todayStr);
            const statusObj = {};

            // 100% CSDL LÀ NGUỒN CHUẨN: Lấy toàn bộ log dọn dẹp hôm nay từ CSDL backend
            const todayBackendLogs = allLogs.filter((log) => {
                if (!log || !log.created_at) return false;
                return String(log.created_at).slice(0, 10) === todayStr;
            });

            fieldList.forEach((f) => {
                const fId = f.id;
                const fName = f.field_name;

                // Lọc tất cả log hôm nay của sân này trong CSDL
                const fieldLogs = todayBackendLogs.filter((log) =>
                    String(log.field || '') === String(fId) ||
                    String(log.field_name || log.fieldName || '').toLowerCase().trim() === String(fName).toLowerCase().trim()
                );

                // Sắp xếp theo created_at tăng dần để log mới nhất ghi đè
                fieldLogs.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

                // Danh sách các ca ĐÃ DỌN XONG THỰC TẾ TRONG CSDL HÔM NAY
                const cleanLogs = fieldLogs.filter((l) => l.status === 'clean');
                const cleanedSessions = [];
                const cleanedTimes = [];

                cleanLogs.forEach((log) => {
                    let slotTime = log.cleaned_match_time || '';
                    if (!slotTime && log.status_text) {
                        const m = log.status_text.match(/(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})/);
                        if (m) slotTime = m[1];
                    }
                    if (!slotTime && log.start_time) slotTime = log.start_time;

                    if (slotTime && !cleanedTimes.includes(slotTime)) {
                        cleanedTimes.push(slotTime);
                        const completedTimeStr = log.end_time || log.start_time || (log.created_at ? new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Hôm nay');
                        const isUrgent = Boolean(
                            (log.status_text && (log.status_text.includes('khẩn cấp') || log.status_text.includes('gấp'))) ||
                            (log.notes && (log.notes.includes('khẩn cấp') || log.notes.includes('gấp'))) ||
                            log.type === 'urgent'
                        );
                        cleanedSessions.push({
                            id: log.id || `cl_${Date.now()}`,
                            time: slotTime,
                            name: log.cleaned_match_customer || 'Khách đặt sân',
                            phone: '',
                            date: todayFormatted,
                            rawDate: todayStr,
                            completedAt: completedTimeStr,
                            type: isUrgent ? 'urgent' : 'match',
                            reportedBy: log.cleaner_name || 'Nhân viên vệ sinh',
                            reason: log.notes || log.status_text || 'Đã hoàn tất dọn dẹp',
                        });
                    }
                });

                // Trạng thái mới nhất của sân từ CSDL backend (nếu có log)
                const latestLog = fieldLogs.length > 0 ? fieldLogs[fieldLogs.length - 1] : null;

                let pitchStatus = 'clean';
                let cleaningReason = null;
                let completedMatch = null;
                let reportedTime = null;
                let reportedBy = null;
                let reportedNotes = null;
                let lastCleaned = cleanedSessions.length > 0
                    ? `Đã dọn xong (${cleanedSessions[cleanedSessions.length - 1].completedAt})`
                    : 'Sẵn sàng đón khách';

                if (latestLog) {
                    pitchStatus = latestLog.status || 'clean';
                    if (latestLog.status === 'needs_clean') {
                        cleaningReason = 'urgent';
                        completedMatch = {
                            time: latestLog.cleaned_match_time || '',
                            name: latestLog.cleaned_match_customer || 'Khách đặt sân',
                            reason: latestLog.notes || latestLog.status_text || 'Ca đá hoàn thành - Cần dọn gấp',
                        };
                        lastCleaned = latestLog.status_text || 'Cần dọn dẹp';
                        reportedTime = latestLog.start_time || (latestLog.created_at ? new Date(latestLog.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong');
                        reportedBy = latestLog.cleaner_name || 'Quản lý đặt sân';
                        reportedNotes = latestLog.notes || latestLog.status_text || 'Cần dọn dẹp khẩn cấp';
                    } else if (latestLog.status === 'clean') {
                        cleaningReason = null;
                        lastCleaned = latestLog.status_text || `Đã dọn xong lúc ${latestLog.start_time || ''}`.trim();
                    }
                }

                const fieldStatusObj = {
                    status: pitchStatus,
                    cleaningReason,
                    completedMatch,
                    cleanedBookingKey: cleanedTimes.length > 0 ? cleanedTimes.join(',') : null,
                    cleanedSessions,
                    lastCleaned,
                    reportedTime,
                    reportedBy,
                    notes: reportedNotes,
                    cleanerName: latestLog?.cleaner_name || 'Nhân viên vệ sinh',
                    isCleanedToday: cleanedSessions.length > 0,
                };

                statusObj[fId] = fieldStatusObj;
                if (fName) statusObj[fName] = fieldStatusObj;
            });

            // Tự động phát hiện các ca đá trong ngày đã hoàn thành hoặc hết giờ thi đấu để chuyển sang CẦN DỌN GẤP
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();

            todayBookings.forEach((b) => {
                const statusLower = String(b.status || '').toLowerCase();
                const bTime = b.time || (b.start_time && b.end_time ? `${b.start_time.slice(0, 5)} - ${b.end_time.slice(0, 5)}` : '');
                const timeParts = String(bTime).split('-');
                if (timeParts.length >= 2) {
                    const endTimeStr = timeParts[1].trim();
                    const m = endTimeStr.match(/^(\d{1,2}):(\d{2})/);
                    if (m) {
                        const endH = parseInt(m[1], 10);
                        const endM = parseInt(m[2], 10);
                        const isTimeEnded = currentHour > endH || (currentHour === endH && currentMinute >= endM);
                        const isEnded = isTimeEnded || statusLower === 'completed';

                        if (isEnded) {
                            const matchField = fieldList.find((f) => f.field_name === (b.field || b.field_name) || String(f.id) === String(b.field_id || b.field));
                            const fKey = matchField?.id || b.field_id || b.field;
                            const fName = matchField?.field_name || b.field || b.field_name;

                            const curSessions = (statusObj[fKey]?.cleanedSessions || statusObj[fName]?.cleanedSessions || []);
                            const isCleaned = curSessions.some((s) => s.time === bTime) ||
                                              Boolean(statusObj[fKey]?.cleanedBookingKey?.includes(bTime)) ||
                                              Boolean(statusObj[fName]?.cleanedBookingKey?.includes(bTime));

                            if (!isCleaned) {
                                const updateObj = {
                                    ...(statusObj[fKey] || statusObj[fName] || {}),
                                    status: 'needs_clean',
                                    cleaningReason: 'urgent',
                                    lastCleaned: `Ca ${bTime} hoàn thành - Cần dọn gấp`,
                                    cleanerName: 'Chờ dọn dẹp',
                                    notes: `Ca đá ${bTime} của ${b.name || b.customer_name || 'khách'} vừa hoàn thành. Cần dọn dẹp gấp!`,
                                    completedMatch: {
                                        time: bTime,
                                        name: b.name || b.customer_name || 'Khách đặt sân',
                                        phone: b.phone || b.customer_phone || '',
                                        reason: 'Ca đá vừa hoàn thành - Cần dọn gấp',
                                    },
                                    cleanedSessions: curSessions,
                                };
                                if (fKey) statusObj[fKey] = updateObj;
                                if (fName) statusObj[fName] = updateObj;
                            }
                        }
                    }
                }
            });

            setCleaningStatus(statusObj);
            try {
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(statusObj));
            } catch { }

            // 5. Đồ khách bỏ quên trực tiếp từ CSDL backend (LostFoundItemViewSet) đồng bộ với bản Web
            let lostList = [];
            if (lostApiRes.status === 'fulfilled' && Array.isArray(lostApiRes.value)) {
                lostList = lostApiRes.value;
            } else if (savedLostStr.status === 'fulfilled' && savedLostStr.value) {
                try {
                    const parsed = JSON.parse(savedLostStr.value);
                    if (Array.isArray(parsed)) lostList = parsed;
                } catch { }
            }
            setLostFoundItems(lostList);
        } catch (err) {
            console.warn('Lỗi tải dữ liệu vệ sinh sân:', err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadAllData();

        // 1. Lắng nghe sự kiện đồng bộ realtime cross-tab giữa các tab (khi chạy trên Web browser)
        const handleStorage = (e) => {
            if (e.key === 'football_booking_sync_event' || e.key === STORAGE_KEY || e.key === 'pitch_cleaning_status') {
                loadAllData();
            }
        };
        const handleCustomSync = () => {
            loadAllData();
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('storage', handleStorage);
            window.addEventListener('football_sync', handleCustomSync);
        }

        // 2. Smart Polling tự động làm mới từ CSDL mỗi 3 giây (đảm bảo đồng bộ tức thì khi xóa/sửa đơn đặt sân ở tab khác)
        const pollTimer = setInterval(() => {
            loadAllData();
        }, 3000);

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('storage', handleStorage);
                window.removeEventListener('football_sync', handleCustomSync);
            }
            clearInterval(pollTimer);
        };
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadAllData();
    };

    // Tính thông tin ca đá tiếp theo từ DB bookings (đồng bộ logic chuẩn của Web Cleaning.jsx)
    const getFieldScheduleInfo = (field) => {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const todayFormatted = formatDateVN(todayStr);
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();

        const fieldCleaningStatus = cleaningStatus[field?.id] || cleaningStatus[field?.field_name] || {};
        const isFieldClean = !fieldCleaningStatus.status || fieldCleaningStatus.status === 'clean';

        const fieldBookings = bookings.filter((b) => {
            const bDate = String(b.date || b.booking_date || '').slice(0, 10);
            const isToday = bDate === todayStr || !bDate;
            const matchName = String(b.field || b.field_name || '').toLowerCase().trim() === String(field?.field_name || '').toLowerCase().trim();
            const matchId = String(b.field_id || b.field || '') === String(field?.id || '');
            const statusLower = String(b.status || '').toLowerCase();
            const isActive = statusLower === 'confirmed' || statusLower === 'checked_in' || statusLower === 'completed';
            return isToday && (matchName || matchId) && isActive;
        });

        // Sắp xếp các ca đá hôm nay theo giờ bắt đầu tăng dần
        fieldBookings.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));

        // Parse matches
        const parsedBookings = fieldBookings.map((b) => {
            const statusLower = String(b.status || '').toLowerCase();
            const bTime = b.time || (b.start_time && b.end_time ? `${b.start_time.slice(0, 5)} - ${b.end_time.slice(0, 5)}` : '18:00 - 19:00');
            const parts = String(bTime).split('-');
            const guestName = b.name || b.customer_name || 'Khách đặt sân';
            const guestPhone = b.phone || b.customer_phone || '';
            const bookingDateRaw = String(b.date || b.booking_date || todayStr).slice(0, 10);

            let startMins = 0;
            let endMins = 1440;
            if (parts.length >= 2) {
                const sM = parts[0].trim().match(/^(\d{1,2}):(\d{2})/);
                const eM = parts[1].trim().match(/^(\d{1,2}):(\d{2})/);
                if (sM) startMins = parseInt(sM[1], 10) * 60 + parseInt(sM[2], 10);
                if (eM) endMins = parseInt(eM[1], 10) * 60 + parseInt(eM[2], 10);
            }

            // Kiểm tra ca này đã được dọn sạch sẽ chưa trong ngày hôm nay
            const isCleanedSession = isFieldClean && (
                Boolean(fieldCleaningStatus.cleanedBookingKey?.includes(bTime)) ||
                Boolean(fieldCleaningStatus.cleanedSessions?.some((s) => s.time === bTime))
            );

            const isEnded = currentMins >= endMins || statusLower === 'completed';
            const isOngoing = currentMins >= startMins && currentMins < endMins && statusLower !== 'completed';
            const diffToStart = startMins - currentMins;

            return {
                ...b,
                time: bTime,
                name: guestName,
                phone: guestPhone,
                rawDate: bookingDateRaw,
                formattedDate: formatDateVN(bookingDateRaw),
                startMins,
                endMins,
                isEnded,
                isOngoing,
                diffToStart,
                minutesLeft: Math.max(0, diffToStart),
                remainingOngoingMins: Math.max(0, endMins - currentMins),
                isCleaned: isCleanedSession,
            };
        });

        const endedBookings = parsedBookings.filter((b) => b.isEnded);
        const recentEndedBooking = endedBookings.length > 0 ? endedBookings[endedBookings.length - 1] : null;

        const activeBookings = parsedBookings.filter(
            (b) => !b.isEnded && String(b.status || '').toLowerCase() !== 'cancelled'
        );

        // Ca tiếp theo gần nhất theo thời gian hôm nay
        const nextBooking = activeBookings.length > 0 ? activeBookings[0] : null;
        const isNextBookingCleaned = isFieldClean;
        const hasActiveUncleanedBooking = !isFieldClean && Boolean(nextBooking);

        const cleanedSessionsList = fieldCleaningStatus.cleanedSessions || [];
        const isEndedBookingCleaned = recentEndedBooking ? (
            cleanedSessionsList.some((s) => s.time === recentEndedBooking.time) ||
            Boolean(fieldCleaningStatus.cleanedBookingKey?.includes(recentEndedBooking.time))
        ) : true;
        const needsCleanAfterMatch = fieldCleaningStatus.status === 'needs_clean' || (recentEndedBooking && !isEndedBookingCleaned);

        let urgencyLevel = 'free'; // 'urgent' | 'ready' | 'upcoming' | 'later' | 'free'
        let statusText = 'Đã dọn sạch sẽ - Sẵn sàng đón khách';

        if (needsCleanAfterMatch) {
            urgencyLevel = 'urgent';
            statusText = fieldCleaningStatus.cleaningReason === 'urgent'
                ? 'Cần dọn gấp (Quản lý đặt sân báo hoàn thành)'
                : `Ca ${recentEndedBooking?.time || ''} kết thúc - Cần dọn gấp!`;
        } else if (nextBooking) {
            urgencyLevel = 'ready';
            statusText = `Đã dọn sẵn sàng đón ca ${nextBooking.time}`;
        } else {
            urgencyLevel = 'ready';
            statusText = 'Đã dọn sạch sẽ - Sẵn sàng đón khách';
        }

        // Nút Đã dọn xong: CHỈ hiển thị khi ca đá hoàn thành cần dọn (needsCleanAfterMatch) hoặc đang dọn (in_progress).
        // Khi đang thời gian chờ tới ca tiếp theo (sân sạch, chờ khách vào) -> BỎ NÚT ĐÃ DỌN XONG!
        const showDoneButton = needsCleanAfterMatch || fieldCleaningStatus.status === 'in_progress';

        return {
            nextBooking,
            isNextBookingCleaned,
            hasActiveUncleanedBooking,
            showDoneButton,
            recentEndedBooking,
            activeEndedBooking: needsCleanAfterMatch ? recentEndedBooking : null,
            urgencyLevel,
            statusText,
            todayBookings: parsedBookings,
            todayFormatted,
            currentMins,
            needsCleanAfterMatch,
            isEndedBookingCleaned,
        };
    };

    // Trích xuất danh sách các ca/nhiệm vụ đã dọn thành công trong ngày của sân (chuẩn 100% bản Web Cleaning.jsx)
    const getFieldCleanedSessions = (field, currentEntry, schedule) => {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const todayFormatted = formatDateVN(todayStr);

        const entry = currentEntry || cleaningStatus[field?.id] || cleaningStatus[field?.field_name] || {};
        const sched = schedule || getFieldScheduleInfo(field);

        let list = [...(entry.cleanedSessions || [])];

        // Lọc bỏ triệt để các session ảo hoặc dữ liệu test cũ (như 'Ca gần nhất', 'done', hoặc giờ lẻ '16:28')
        list = list.filter((s) =>
            s && s.time && s.time !== 'Ca gần nhất' && s.time !== 'done' && s.time !== 'Ca hôm nay' &&
            (String(s.time).includes('-') || s.type === 'urgent') &&
            isSessionToday(s, todayStr, todayFormatted)
        );

        // ĐỐI VỚI CÁC CA ĐÁ (type === 'match'): Chỉ hiển thị nếu ca đó còn tồn tại trong đơn đặt sân hôm nay
        // Nếu người dùng xóa đơn đặt sân ở Quản lý đặt sân, ca đó sẽ lập tức biến mất hoàn toàn khớp với bản Web!
        const existingBookingTimes = new Set();
        (sched?.todayBookings || []).forEach((b) => {
            const bTime = b.time || `${b.start_time || ''} - ${b.end_time || ''}`;
            if (bTime) existingBookingTimes.add(bTime);
        });

        list = list.filter((s) => {
            if (s.type === 'urgent') return true;
            return existingBookingTimes.has(s.time);
        });

        // Sắp xếp các khung giờ từ sớm hơn trước rồi đến muộn hơn
        list.sort((a, b) => {
            const minsA = getSlotStartMinutes(a.time);
            const minsB = getSlotStartMinutes(b.time);
            if (minsA !== minsB) {
                return minsA - minsB;
            }
            return String(a.id || '').localeCompare(String(b.id || ''));
        });

        return list;
    };

    // Action: Bấm "Đã dọn xong" -> lưu trực tiếp vào CSDL backend & state
    const handleUpdateStatus = async (fieldId, fieldName, newStatus) => {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const todayFormatted = formatDateVN(todayStr);
        const currentEntry = cleaningStatus[fieldId] || cleaningStatus[fieldName] || {};
        const nowTimeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const sched = getFieldScheduleInfo({ id: fieldId, field_name: fieldName });

        const slotTime = sched.recentEndedBooking?.time || currentEntry.completedMatch?.time || sched.nextBooking?.time || 'Sau ca thi đấu';
        const relatedBooking = sched.recentEndedBooking || currentEntry.completedMatch || sched.nextBooking;
        const isUrgent = currentEntry.cleaningReason === 'urgent' || currentEntry.status === 'needs_clean';

        const sessionItem = {
            id: `session_${Date.now()}`,
            time: slotTime,
            name: relatedBooking?.name || currentEntry.completedMatch?.name || 'Khách đặt sân',
            phone: relatedBooking?.phone || currentEntry.completedMatch?.phone || '',
            date: relatedBooking?.formattedDate || todayFormatted,
            rawDate: todayStr,
            completedAt: nowTimeStr,
            type: isUrgent ? 'urgent' : 'match',
            reportedBy: currentEntry.reportedBy || user?.full_name || 'Nhân viên dọn dẹp',
            reason: currentEntry.notes || currentEntry.status_text || (isUrgent ? 'Báo dọn khẩn cấp' : (sched.recentEndedBooking ? `Dọn sau ca ${slotTime}` : (sched.nextBooking ? 'Dọn dẹp chuẩn bị đón ca tới' : 'Ca đá hoàn thành'))),
        };

        const cleanedBookingKey = `${slotTime}_${todayStr}`;
        const rawExisting = currentEntry.cleanedSessions || [];
        const existingSessions = rawExisting.filter(
            (s) => s && s.time && s.time !== 'done' && s.time !== 'Ca gần nhất' && s.time !== 'Ca hôm nay' &&
            (String(s.time).includes('-') || s.type === 'urgent')
        );
        const updatedSessions = [sessionItem, ...existingSessions.filter((s) => s.time !== slotTime)];

        // Sắp xếp các ca đã dọn từ sớm đến muộn
        updatedSessions.sort((a, b) => {
            const minsA = getSlotStartMinutes(a.time);
            const minsB = getSlotStartMinutes(b.time);
            if (minsA !== minsB) return minsA - minsB;
            return String(a.time || '').localeCompare(String(b.time || ''));
        });

        const updatedEntry = {
            ...currentEntry,
            status: newStatus,
            cleaningReason: newStatus === 'clean' ? null : currentEntry.cleaningReason,
            cleanedBookingKey: cleanedBookingKey,
            isCleanedToday: newStatus === 'clean' ? true : currentEntry.isCleanedToday,
            completedAt: nowTimeStr,
            lastCleaned: `Đã dọn xong lúc ${nowTimeStr}`,
            cleanerName: user?.full_name || 'Nhân viên vệ sinh',
            cleanedSessions: updatedSessions,
        };

        const updatedStatus = {
            ...cleaningStatus,
            [fieldName]: updatedEntry,
        };
        if (fieldId) updatedStatus[fieldId] = updatedEntry;
        setCleaningStatus(updatedStatus);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStatus));

        // Thêm log mới vào danh sách
        const newLog = {
            id: `log_${Date.now()}`,
            time: nowTimeStr,
            rawDate: todayStr,
            fieldName: fieldName,
            statusText: `Đã dọn xong chuẩn bị đón ca ${slotTime}`,
            cleaner: user?.full_name || 'Nhân viên vệ sinh',
        };
        setCleaningLogs([newLog, ...cleaningLogs]);
        await AsyncStorage.setItem(LOGS_KEY, JSON.stringify([newLog, ...cleaningLogs]));

        // 1. Dọn sân xong KHÔNG tự ý đổi trạng thái đơn đặt sân của khách sang 'Completed'
        // (Đơn chỉ hoàn thành khi khách đá xong hoặc do Quản lý/Lễ tân xác nhận)

        // 2. Lưu vào cơ sở dữ liệu backend facility qua API
        try {
            await createCleaningLogApi({
                field: typeof fieldId === 'string' && fieldId.length > 5 ? fieldId : null,
                field_name: fieldName,
                booking: relatedBooking?.id || null,
                status: newStatus,
                status_text: `Đã dọn xong lúc ${nowTimeStr}`,
                cleaner_name: user?.full_name || 'Nhân viên vệ sinh',
                cleaned_match_time: slotTime,
                cleaned_match_customer: relatedBooking?.name || currentEntry.completedMatch?.name || 'Khách đặt sân',
                start_time: currentEntry.reportedTime || currentEntry.start_time || nowTimeStr,
                end_time: nowTimeStr,
                notes: sessionItem.reason,
            });
        } catch { }

        // 3. Phát event đồng bộ cross-tab nếu trên môi trường web
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const syncData = {
                    type: 'pitch_cleaned',
                    payload: { fieldId, fieldName, time: slotTime },
                    timestamp: Date.now(),
                };
                window.localStorage.setItem('football_booking_sync_event', JSON.stringify(syncData));
                window.dispatchEvent(new CustomEvent('football_sync', { detail: syncData }));
            } catch { }
        }

        Alert.alert('Thành công', `Đã cập nhật ${fieldName}: Sạch sẽ, sẵn sàng đón ca ${slotTime}!`);
    };

    // Open Detail Modal
    const openDetailModal = (field) => {
        setDetailField(field);
        setShowDetailModal(true);
    };

    // Open Report Maintenance Modal
    const openReportModal = (field) => {
        setReportingField(field);
        setIssueData({
            category: 'Lưới khung thành & Cột',
            priority: 'Khẩn cấp',
            description: '',
        });
        setShowReportModal(true);
    };

    // Gửi báo hỏng sang module Bảo trì (lưu vào DB)
    const handleSubmitReport = async () => {
        if (!issueData.description.trim()) {
            Alert.alert('Thiếu thông tin', 'Vui lòng mô tả chi tiết vị trí hư hỏng.');
            return;
        }

        const fieldName = reportingField?.field_name || 'Sân bóng';

        try {
            await createMaintenanceIssueApi({
                field: reportingField?.id || null,
                field_name: fieldName,
                category: issueData.category,
                priority: issueData.priority,
                description: issueData.description.trim(),
                estimated_cost: 500000,
                reported_by_name: user?.full_name || 'Nhân viên dọn dẹp vệ sinh (sau ca)',
                status: 'pending',
            });

            const savedIssues = await AsyncStorage.getItem(ISSUES_KEY);
            let issueList = savedIssues ? JSON.parse(savedIssues) : [];
            issueList.unshift({
                id: `iss_${Date.now()}`,
                fieldName: fieldName,
                field_name: fieldName,
                category: issueData.category,
                priority: issueData.priority,
                description: issueData.description.trim(),
                estimatedCost: 500000,
                estimated_cost: 500000,
                cost: 0,
                reportedBy: user?.full_name || 'Nhân viên dọn dẹp vệ sinh (sau ca)',
                status: 'pending',
                createdAt: 'Vừa xong',
            });
            await AsyncStorage.setItem(ISSUES_KEY, JSON.stringify(issueList));

            if (typeof window !== 'undefined' && window.localStorage) {
                try {
                    const syncData = {
                        type: 'pitch_maintenance_reported',
                        fieldName,
                        timestamp: Date.now(),
                    };
                    window.localStorage.setItem('football_booking_sync_event', JSON.stringify(syncData));
                    window.dispatchEvent(new CustomEvent('football_sync', { detail: syncData }));
                } catch { }
            }

            setShowReportModal(false);
            Alert.alert('Đã gửi báo hỏng', `Đã chuyển phiếu báo hỏng tại ${fieldName} cho bộ phận Kỹ thuật!`);
        } catch (err) {
            Alert.alert('Lỗi', 'Không thể gửi phiếu báo hỏng: ' + err.message);
        }
    };

    // Open Ghi nhận đồ bỏ quên Modal
    const openLostModal = (field) => {
        const targetField = field || (fields.length > 0 ? fields[0] : null);
        setReportingLostField(targetField);
        const sched = targetField ? getFieldScheduleInfo(targetField) : null;
        const lastGuest = sched?.recentEndedBooking?.name
            ? `Khách: ${sched.recentEndedBooking.name} (${sched.recentEndedBooking.time || 'Ca gần nhất'})`
            : sched?.nextBooking?.name
                ? `Khách: ${sched.nextBooking.name} (${sched.nextBooking.time})`
                : 'Khách ca gần nhất';
        const guestPhone = sched?.recentEndedBooking?.phone || sched?.nextBooking?.phone || '';
        const bDate = sched?.recentEndedBooking?.date
            ? String(sched.recentEndedBooking.date).slice(0, 10)
            : new Date().toLocaleDateString('en-CA');

        setLostData({
            itemType: 'Áo khoác / Trang phục thi đấu',
            location: 'Băng ghế chờ khán đài',
            description: '',
            guestInfo: lastGuest,
            customerPhone: guestPhone,
            bookingDate: bDate,
        });
        setShowLostModal(true);
    };

    // Lưu đồ thất lạc mới vào CSDL backend
    const handleSubmitLostItem = async () => {
        if (!lostData.description.trim()) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập mô tả món đồ nhặt được.');
            return;
        }

        const fieldName = reportingLostField?.field_name || (fields[0]?.field_name || 'Sân bóng');
        const nowTime = `${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} Hôm nay`;

        try {
            const payload = {
                field: reportingLostField?.id || null,
                field_name: fieldName,
                fieldName: fieldName,
                item_type: lostData.itemType,
                itemType: lostData.itemType,
                location: lostData.location,
                description: lostData.description.trim(),
                guest_info: lostData.guestInfo || 'Chưa rõ',
                guestInfo: lostData.guestInfo || 'Chưa rõ',
                customer_phone: lostData.customerPhone || '',
                customerPhone: lostData.customerPhone || '',
                status: 'pending',
                reported_by: user?.full_name || 'Nhân viên dọn dẹp',
                reportedBy: user?.full_name || 'Nhân viên dọn dẹp',
                booking_date: lostData.bookingDate || new Date().toLocaleDateString('en-CA'),
                bookingDate: lostData.bookingDate || new Date().toLocaleDateString('en-CA'),
                time: nowTime,
            };

            const res = await createLostFoundItemApi(payload);

            const newItem = {
                id: res?.id || `lost_${Date.now()}`,
                fieldName: fieldName,
                field_name: fieldName,
                itemType: lostData.itemType,
                item_type: lostData.itemType,
                location: lostData.location,
                description: lostData.description.trim(),
                guestInfo: lostData.guestInfo || 'Chưa rõ',
                guest_info: lostData.guestInfo || 'Chưa rõ',
                customerPhone: lostData.customerPhone || '',
                customer_phone: lostData.customerPhone || '',
                bookingDate: lostData.bookingDate || new Date().toLocaleDateString('en-CA'),
                booking_date: lostData.bookingDate || new Date().toLocaleDateString('en-CA'),
                status: 'pending',
                time: nowTime,
                reportedBy: user?.full_name || 'Nhân viên dọn dẹp',
                reported_by: user?.full_name || 'Nhân viên dọn dẹp',
            };

            const updated = [newItem, ...lostFoundItems];
            setLostFoundItems(updated);
            await AsyncStorage.setItem(LOST_KEY, JSON.stringify(updated));

            if (typeof window !== 'undefined' && window.localStorage) {
                try {
                    const syncData = {
                        type: 'lost_item_reported',
                        payload: newItem,
                        timestamp: Date.now(),
                    };
                    window.localStorage.setItem('football_booking_sync_event', JSON.stringify(syncData));
                    window.dispatchEvent(new CustomEvent('football_sync', { detail: syncData }));
                } catch { }
            }

            setShowLostModal(false);
            Alert.alert('Thành công', `Đã lưu đồ bỏ quên tại ${fieldName}! Lễ tân và Quản lý đã nhận thông báo.`);
        } catch (e) {
            console.error('Lỗi khi lưu đồ thất lạc:', e);
            Alert.alert('Lỗi', 'Không thể lưu đồ thất lạc: ' + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
        }
    };

    // Toggle trạng thái bàn giao đồ thất lạc
    const handleToggleReturnLost = async (item) => {
        const nextStatus = item.status === 'returned' ? 'pending' : 'returned';
        const updated = lostFoundItems.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i));
        setLostFoundItems(updated);
        await AsyncStorage.setItem(LOST_KEY, JSON.stringify(updated));

        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const syncData = {
                    type: 'lost_item_status_changed',
                    payload: { id: item.id, status: nextStatus },
                    timestamp: Date.now(),
                };
                window.localStorage.setItem('football_booking_sync_event', JSON.stringify(syncData));
                window.dispatchEvent(new CustomEvent('football_sync', { detail: syncData }));
            } catch { }
        }

        try {
            await toggleLostFoundStatusApi(item.id, nextStatus);
        } catch { }

        Alert.alert('Thành công', nextStatus === 'returned' ? 'Đã xác nhận bàn giao đồ trả khách!' : 'Đã chuyển về trạng thái Chưa bàn giao.');
    };

    // Mở Modal Chỉnh sửa đồ thất lạc
    const handleOpenEditLostModal = (item) => {
        setEditingLostItem({
            ...item,
            returnNote: item.return_note || item.returnNote || '',
        });
        setShowEditLostModal(true);
    };

    // Lưu chỉnh sửa đồ thất lạc vào DB
    const handleSaveEditLostItem = async () => {
        if (!editingLostItem) return;
        const updated = lostFoundItems.map((i) => (i.id === editingLostItem.id ? editingLostItem : i));
        setLostFoundItems(updated);
        await AsyncStorage.setItem(LOST_KEY, JSON.stringify(updated));

        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const syncData = {
                    type: 'lost_item_status_changed',
                    payload: { id: editingLostItem.id, status: editingLostItem.status },
                    timestamp: Date.now(),
                };
                window.localStorage.setItem('football_booking_sync_event', JSON.stringify(syncData));
                window.dispatchEvent(new CustomEvent('football_sync', { detail: syncData }));
            } catch { }
        }

        try {
            if (editingLostItem.id && typeof editingLostItem.id === 'string' && editingLostItem.id.length > 10) {
                await updateLostFoundStatusApi(editingLostItem.id, {
                    status: editingLostItem.status,
                    item_type: editingLostItem.item_type || editingLostItem.itemType,
                    itemType: editingLostItem.item_type || editingLostItem.itemType,
                    location: editingLostItem.location,
                    description: editingLostItem.description,
                    return_note: editingLostItem.return_note || editingLostItem.returnNote,
                    returnNote: editingLostItem.return_note || editingLostItem.returnNote,
                });
            }
        } catch { }

        setShowEditLostModal(false);
        setEditingLostItem(null);
        Alert.alert('Thành công', 'Đã cập nhật thông tin đồ thất lạc!');
    };

    // Xóa bản ghi đồ thất lạc khỏi DB
    const handleDeleteLostItem = (item) => {
        const doDelete = async () => {
            const updated = lostFoundItems.filter((i) => i.id !== item.id);
            setLostFoundItems(updated);
            await AsyncStorage.setItem(LOST_KEY, JSON.stringify(updated));

            try {
                if (item.id && typeof item.id === 'string' && item.id.length > 10) {
                    await deleteLostFoundItemApi(item.id);
                }
            } catch { }

            if (typeof window !== 'undefined' && window.localStorage) {
                try {
                    const syncData = {
                        type: 'lost_item_deleted',
                        payload: { id: item.id },
                        timestamp: Date.now(),
                    };
                    window.localStorage.setItem('football_booking_sync_event', JSON.stringify(syncData));
                    window.localStorage.setItem(LOST_KEY, JSON.stringify(updated));
                    window.dispatchEvent(new CustomEvent('football_sync', { detail: syncData }));
                } catch { }
            }

            Alert.alert('Đã xóa', 'Đã xóa bản ghi đồ khách bỏ quên.');
        };

        Alert.alert('Xác nhận xóa', 'Bạn có chắc muốn xóa bản ghi này?', [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Xóa ngay', style: 'destructive', onPress: doDelete },
        ]);
    };

    // KPI Metrics
    const cleanCount = fields.filter((f) => {
        const s = cleaningStatus[f.id] || cleaningStatus[f.field_name];
        return !s || s.status === 'clean';
    }).length;

    const needsCleanCount = fields.filter((f) => {
        const s = cleaningStatus[f.id] || cleaningStatus[f.field_name];
        return s?.status === 'needs_clean';
    }).length;

    // Đếm số ca/sân đã hoàn tất dọn dẹp hôm nay (chuẩn 100% bản Web Cleaning.jsx)
    const cleanedMatchesTodayCount = fields.reduce((acc, f) => {
        const s = cleaningStatus[f.id] || cleaningStatus[f.field_name];
        const sched = getFieldScheduleInfo(f);
        const sessions = getFieldCleanedSessions(f, s, sched);
        const isFldClean = !s?.status || s.status === 'clean';
        if (isFldClean && (s?.completedAt || s?.cleanedBookingKey || sched.hasEndedBookingToday || sessions.length > 0)) {
            return acc + 1;
        }
        return acc;
    }, 0);

    const pendingLostCount = lostFoundItems.filter((i) => i.status === 'pending' || !i.status).length;
    const returnedLostCount = lostFoundItems.filter((i) => i.status === 'returned').length;

    // Filter fields by search
    const filteredFields = useMemo(() => {
        return fields.filter((f) => {
            const matchesSearch = (f.field_name || '').toLowerCase().includes(searchQuery.toLowerCase());
            if (!matchesSearch) return false;

            const s = cleaningStatus[f.id] || cleaningStatus[f.field_name];
            const status = s?.status || 'clean';

            if (activeTab === 'urgent') return status === 'needs_clean';
            return true;
        });
    }, [fields, cleaningStatus, searchQuery, activeTab]);

    // Filter Lost Items in tab 'lost_found'
    const filteredLostItems = useMemo(() => {
        return lostFoundItems.filter((item) => {
            const matchStatus =
                lostFilterStatus === 'all' ||
                (lostFilterStatus === 'pending' && (item.status === 'pending' || !item.status)) ||
                (lostFilterStatus === 'returned' && item.status === 'returned');

            const matchQuery =
                !lostSearchQuery.trim() ||
                String(item.itemType || item.item_type || '').toLowerCase().includes(lostSearchQuery.toLowerCase()) ||
                String(item.description || '').toLowerCase().includes(lostSearchQuery.toLowerCase()) ||
                String(item.fieldName || item.field_name || '').toLowerCase().includes(lostSearchQuery.toLowerCase()) ||
                String(item.guestInfo || '').toLowerCase().includes(lostSearchQuery.toLowerCase()) ||
                String(item.customerPhone || '').toLowerCase().includes(lostSearchQuery.toLowerCase()) ||
                String(item.location || '').toLowerCase().includes(lostSearchQuery.toLowerCase());

            return matchStatus && matchQuery;
        });
    }, [lostFoundItems, lostFilterStatus, lostSearchQuery]);

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Top Bar */}
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
                        <Text style={styles.dashboardEyebrow}>VẬN HÀNH CƠ SỞ › VỆ SINH & DỌN DẸP SÂN</Text>
                        <Text style={styles.topBarTitle}>Quản lý Vệ sinh Sân bãi</Text>
                    </View>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#006b2c']} />}
            >
                {/* 3 KPI STAT CARDS (Web lines 927-960) */}
                <View style={styles.statsGrid}>
                    {/* Thẻ 1: Sân sạch sẽ */}
                    <View style={styles.statCard}>
                        <View style={styles.statCardHeader}>
                            <View style={[styles.statIcon, { backgroundColor: '#dcfce7' }]}>
                                <Ionicons name="checkmark-circle" size={18} color="#15803d" />
                            </View>
                            <View style={styles.statBadgeGreen}>
                                <Text style={styles.statBadgeGreenText}>Sẵn sàng đón khách</Text>
                            </View>
                        </View>
                        <Text style={styles.statLabel}>Sân sạch sẽ</Text>
                        <Text style={styles.statValue}>
                            {cleanCount} <Text style={styles.statUnit}>/ {fields.length} sân</Text>
                        </Text>
                    </View>

                    {/* Thẻ 2: Ca đã dọn thành công trong ngày */}
                    <View style={styles.statCard}>
                        <View style={styles.statCardHeader}>
                            <View style={[styles.statIcon, { backgroundColor: '#dcfce7' }]}>
                                <Ionicons name="checkbox" size={18} color="#15803d" />
                            </View>
                            <View style={styles.statBadgeGreen}>
                                <Text style={styles.statBadgeGreenText}>Đã hoàn thành</Text>
                            </View>
                        </View>
                        <Text style={styles.statLabel}>Ca đã dọn thành công trong ngày</Text>
                        <Text style={styles.statValue}>
                            {cleanedMatchesTodayCount} <Text style={styles.statUnit}>ca</Text>
                        </Text>
                    </View>

                    {/* Thẻ 3: Chờ dọn sau ca */}
                    <View style={[styles.statCard, { width: '100%' }]}>
                        <View style={styles.statCardHeader}>
                            <View style={[styles.statIcon, { backgroundColor: '#fee2e2' }]}>
                                <Ionicons name="alert-circle" size={18} color="#b91c1c" />
                            </View>
                            <View style={styles.statBadgeRed}>
                                <Text style={styles.statBadgeRedText}>Cần dọn ngay</Text>
                            </View>
                        </View>
                        <Text style={styles.statLabel}>Chờ dọn sau ca</Text>
                        <Text style={styles.statValue}>
                            {needsCleanCount} <Text style={styles.statUnit}>sân</Text>
                        </Text>
                    </View>
                </View>

                {/* 4 TABS CHÍNH: WRAP FOR MOBILE */}
                <View style={styles.tabsWrap}>
                    {[
                        { key: 'all', label: `Tất cả sân (${fields.length})` },
                        { key: 'urgent', label: `Cần dọn gấp (${needsCleanCount})` },
                        { key: 'lost_found', label: `Đồ khách bỏ quên (${pendingLostCount})` },
                        { key: 'stats', label: 'Thống kê ca dọn' },
                    ].map((tab) => {
                        const isSel = activeTab === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                style={[styles.tabBtn, isSel && styles.tabBtnActive]}
                                onPress={() => setActiveTab(tab.key)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.tabBtnText, isSel && styles.tabBtnTextActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* SEARCH BAR (Khi ở tab sân) */}
                {activeTab !== 'stats' && activeTab !== 'lost_found' && (
                    <View style={styles.searchBox}>
                        <Ionicons name="search" size={16} color="#94a3b8" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Tìm kiếm sân bóng theo tên..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor="#94a3b8"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* LOADING */}
                {loading ? (
                    <View style={styles.centerBox}>
                        <ActivityIndicator size="large" color="#006b2c" />
                        <Text style={{ marginTop: 10, color: '#6b7280', fontSize: 13 }}>Đang tải trạng thái sân bóng...</Text>
                    </View>
                ) : activeTab === 'lost_found' ? (
                    /* ── TAB 3: ĐỒ KHÁCH BỎ QUÊN (LOST & FOUND - DỮ LIỆU THỰC TẾ CƠ SỞ DỮ LIỆU) ── */
                    <View style={styles.lostContainer}>
                        {/* Header Panel */}
                        <View style={styles.lostPanelHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.lostPanelTitle}>Danh sách đồ khách để quên trên sân bóng (Lost & Found)</Text>
                                <Text style={styles.lostPanelSub}>
                                    Ghi nhận từ nhân viên dọn dẹp sau ca đá. Lễ tân liên hệ người đặt sân để bàn giao lại đồ thất lạc.
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.addLostBtn}
                                onPress={() => openLostModal(fields[0])}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="add" size={16} color="#ffffff" />
                                <Text style={styles.addLostBtnText}>Ghi nhận đồ mới</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Search & Sub-Filter Bar */}
                        <View style={styles.lostSearchFilterBox}>
                            <View style={styles.lostSearchInner}>
                                <Ionicons name="search" size={15} color="#94a3b8" />
                                <TextInput
                                    style={styles.lostSearchInput}
                                    placeholder="Tìm theo tên đồ, vị trí, tên khách, ngày, sân..."
                                    value={lostSearchQuery}
                                    onChangeText={setLostSearchQuery}
                                    placeholderTextColor="#94a3b8"
                                />
                                {lostSearchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setLostSearchQuery('')}>
                                        <Ionicons name="close-circle" size={15} color="#94a3b8" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Sub-tabs: Tất cả / Chờ trả khách / Đã trả khách */}
                            <View style={styles.subTabsRow}>
                                {[
                                    { key: 'all', label: `Tất cả (${lostFoundItems.length})` },
                                    { key: 'pending', label: `Chờ trả khách (${pendingLostCount})` },
                                    { key: 'returned', label: `Đã trả khách (${returnedLostCount})` },
                                ].map((sub) => {
                                    const isSubSel = lostFilterStatus === sub.key;
                                    return (
                                        <TouchableOpacity
                                            key={sub.key}
                                            style={[styles.subTabItem, isSubSel && styles.subTabItemActive]}
                                            onPress={() => setLostFilterStatus(sub.key)}
                                        >
                                            <Text style={[styles.subTabText, isSubSel && styles.subTabTextActive]}>
                                                {sub.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Danh sách đồ thất lạc thực tế */}
                        {filteredLostItems.length === 0 ? (
                            <View style={styles.emptyCardBox}>
                                <Ionicons name="bag-check-outline" size={38} color="#94a3b8" />
                                <Text style={styles.emptyTitle}>Chưa có đồ đạc nào được ghi nhận</Text>
                                <Text style={styles.emptySub}>Bấm "+ Ghi nhận đồ mới" để thêm đồ khách bỏ quên</Text>
                            </View>
                        ) : (
                            filteredLostItems.map((item) => {
                                const isPending = item.status === 'pending' || !item.status;
                                return (
                                    <View key={item.id} style={styles.lostCard}>
                                        <View style={styles.lostHeader}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.lostItemTitle}>{item.item_type || item.itemType}</Text>
                                                <Text style={styles.lostSubtitle}>
                                                    Tại: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{item.field_name || item.fieldName}</Text> • {item.location}
                                                </Text>
                                            </View>
                                            <View style={[styles.lostBadge, isPending ? styles.lostBadgePending : styles.lostBadgeDone]}>
                                                <Text style={[styles.lostBadgeText, isPending ? { color: '#b91c1c' } : { color: '#15803d' }]}>
                                                    {isPending ? '⏳ Chờ trả khách' : '✅ Đã bàn giao'}
                                                </Text>
                                            </View>
                                        </View>

                                        <Text style={styles.lostDesc}>{item.description}</Text>

                                        {(item.return_note || item.returnNote) ? (
                                            <View style={styles.returnNoteBox}>
                                                <Text style={styles.returnNoteText}>Ghi chú bàn giao: {item.return_note || item.returnNote}</Text>
                                            </View>
                                        ) : null}

                                        <View style={styles.lostMetaRow}>
                                            <Text style={styles.lostMetaText}>
                                                Khách: <Text style={{ fontWeight: '600', color: '#0f172a' }}>{item.guest_info || item.guestInfo || 'Chưa rõ'}</Text>
                                            </Text>
                                            {(item.customer_phone || item.customerPhone) ? (
                                                <TouchableOpacity
                                                    onPress={() => Linking.openURL(`tel:${item.customer_phone || item.customerPhone}`)}
                                                    style={styles.phoneLink}
                                                >
                                                    <Ionicons name="call" size={12} color="#0284c7" />
                                                    <Text style={styles.phoneLinkText}>{item.customer_phone || item.customerPhone}</Text>
                                                </TouchableOpacity>
                                            ) : null}
                                        </View>

                                        {/* Actions: Bàn giao khách, Chỉnh sửa, Xóa */}
                                        <View style={styles.lostCardFooter}>
                                            <TouchableOpacity
                                                style={[styles.returnToggleBtn, isPending ? styles.returnBtnPending : styles.returnBtnDone]}
                                                onPress={() => handleToggleReturnLost(item)}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons
                                                    name={isPending ? 'checkmark-circle' : 'repeat-outline'}
                                                    size={15}
                                                    color={isPending ? '#15803d' : '#64748b'}
                                                />
                                                <Text style={[styles.returnToggleText, isPending ? { color: '#15803d' } : { color: '#64748b' }]}>
                                                    {isPending ? 'Bàn giao cho khách' : 'Chuyển về chưa bàn giao'}
                                                </Text>
                                            </TouchableOpacity>

                                            <View style={{ flexDirection: 'row', gap: 6 }}>
                                                <TouchableOpacity
                                                    style={styles.lostIconBtn}
                                                    onPress={() => handleOpenEditLostModal(item)}
                                                >
                                                    <Ionicons name="create-outline" size={15} color="#475569" />
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[styles.lostIconBtn, { backgroundColor: '#fee2e2' }]}
                                                    onPress={() => handleDeleteLostItem(item)}
                                                >
                                                    <Ionicons name="trash-outline" size={15} color="#b91c1c" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>
                ) : activeTab === 'stats' ? (
                    /* TAB 4: THỐNG KÊ CA DỌN */
                    <View style={styles.statsContainer}>
                        <View style={styles.statsCardBox}>
                            <Text style={styles.statsCardTitle}>TỔNG HỢP CA DỌN SÂN HÔM NAY</Text>
                            <View style={styles.statsRow}>
                                <Text style={styles.statsRowLabel}>Tổng số sân cơ sở</Text>
                                <Text style={styles.statsRowVal}>{fields.length} sân</Text>
                            </View>
                            <View style={styles.statsRow}>
                                <Text style={styles.statsRowLabel}>Sân sạch sẽ sẵn sàng đón khách</Text>
                                <Text style={[styles.statsRowVal, { color: '#15803d' }]}>{cleanCount} sân</Text>
                            </View>
                            <View style={styles.statsRow}>
                                <Text style={styles.statsRowLabel}>Tổng số ca đã hoàn thành dọn hôm nay</Text>
                                <Text style={[styles.statsRowVal, { color: '#006b2c' }]}>{cleanedMatchesTodayCount} ca</Text>
                            </View>
                            <View style={styles.statsRow}>
                                <Text style={styles.statsRowLabel}>Sân đang chờ dọn sau ca</Text>
                                <Text style={[styles.statsRowVal, { color: '#b91c1c' }]}>{needsCleanCount} sân</Text>
                            </View>
                            <View style={styles.statsRow}>
                                <Text style={styles.statsRowLabel}>Đồ khách bỏ quên đang lưu giữ</Text>
                                <Text style={[styles.statsRowVal, { color: '#0284c7' }]}>{pendingLostCount} món</Text>
                            </View>
                        </View>
                    </View>
                ) : (
                    /* ── MAIN LIST: DANH SÁCH SÂN VỆ SINH ── */
                    <View style={styles.pitchList}>
                        {filteredFields.map((field) => {
                            const current = cleaningStatus[field.id] || cleaningStatus[field.field_name] || { status: 'clean' };
                            const sched = getFieldScheduleInfo(field);
                            const isFieldNeedClean = current.status === 'needs_clean' || sched.needsCleanAfterMatch;
                            const isClean = !isFieldNeedClean && current.status !== 'in_progress';
                            const isInProgress = current.status === 'in_progress';
                            const cleanedSessions = getFieldCleanedSessions(field, current, sched);
                            const showDoneButton = sched.showDoneButton;

                            // NÚT ĐỒ QUÊN Ở TỪNG SÂN: HIỂN THỊ KHI ĐÃ DỌN XONG
                            const hasCleanedSession = cleanedSessions.length > 0 || Boolean(current.cleanedBookingKey) || Boolean(current.isCleanedToday);
                            const showLostButtonOnPitch = !showDoneButton && hasCleanedSession;

                            return (
                                <View key={field.id} style={styles.pitchCard}>
                                    {/* 1. Header thẻ sân */}
                                    <View style={styles.pitchHeader}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                            <View style={styles.soccerIconBox}>
                                                <Ionicons name="football" size={16} color="#006b2c" />
                                            </View>
                                            <View>
                                                <Text style={styles.pitchName}>{field.field_name}</Text>
                                                <Text style={styles.pitchType}>{field.field_type || 'Sân cỏ nhân tạo'}</Text>
                                            </View>
                                        </View>

                                        {/* Status badge */}
                                        <View
                                            style={[
                                                styles.statusBadge,
                                                isFieldNeedClean ? styles.badgeUrgent : isClean ? styles.badgeClean : styles.badgeProgress,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.statusBadgeText,
                                                    isFieldNeedClean ? styles.textUrgent : isClean ? styles.textClean : styles.textProgress,
                                                ]}
                                            >
                                                {isFieldNeedClean ? 'Cần dọn gấp' : isInProgress ? 'Đang dọn' : 'Sạch sẽ'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* 2. Banner Thông tin ca tiếp theo hoặc Trạng thái đã dọn sạch sẽ */}
                                    {isFieldNeedClean ? (
                                        <View style={[styles.countdownBanner, { backgroundColor: '#fff1f2', borderColor: '#fecdd3', padding: 10 }]}>
                                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                                                <Ionicons name="warning" size={18} color="#dc2626" style={{ marginTop: 2 }} />
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                                                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#991b1b' }}>
                                                            {sched.recentEndedBooking?.time || current.completedMatch?.time
                                                                ? `Ca ${sched.recentEndedBooking?.time || current.completedMatch?.time} — Báo dọn gấp!`
                                                                : 'Báo dọn vệ sinh khẩn cấp!'}
                                                        </Text>
                                                        <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 }}>
                                                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#991b1b' }}>
                                                                Giờ báo: {current.reportedTime || current.start_time || sched.recentEndedBooking?.end_time || 'Vừa xong'}
                                                            </Text>
                                                        </View>
                                                    </View>

                                                    <Text style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                                                        Người báo: <Text style={{ fontWeight: '700', color: '#1e293b' }}>{current.reportedBy || current.cleanerName || 'Quản lý đặt sân'}</Text>
                                                        {(sched.recentEndedBooking?.name || current.completedMatch?.name) ? (
                                                            <Text> • Khách: <Text style={{ fontWeight: '700', color: '#1e293b' }}>{sched.recentEndedBooking?.name || current.completedMatch?.name}</Text></Text>
                                                        ) : null}
                                                    </Text>

                                                    <View style={{ backgroundColor: '#fef2f2', padding: 6, borderRadius: 6, borderWidth: 1, borderColor: '#fca5a5', borderStyle: 'dashed', marginTop: 5 }}>
                                                        <Text style={{ fontSize: 12, color: '#b91c1c' }}>
                                                            Tình trạng: <Text style={{ fontWeight: '700' }}>{current.notes || current.status_text || current.completedMatch?.reason || 'Cần vệ sinh mặt sân & thu gom rác'}</Text>
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    ) : sched.nextBooking ? (
                                        <View style={styles.readyBanner}>
                                            <Ionicons name="checkmark-circle" size={16} color="#15803d" />
                                            <Text style={styles.readyBannerText}>
                                                Đã dọn sạch sẽ - Chờ ca tới: {sched.nextBooking.time}
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={styles.readyBanner}>
                                            <Ionicons name="checkmark-circle" size={16} color="#15803d" />
                                            <Text style={styles.readyBannerText}>Đã dọn sạch sẽ - Sẵn sàng đón khách</Text>
                                        </View>
                                    )}

                                    {/* 3. Footer Toolbar Buttons */}
                                    <View style={styles.pitchToolbar}>
                                        {/* Nút 1: Xem chi tiết */}
                                        <TouchableOpacity
                                            style={[styles.toolbarBtn, styles.btnDetail]}
                                            onPress={() => openDetailModal(field)}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="eye-outline" size={14} color="#0f172a" />
                                            <Text style={styles.btnDetailText}>Xem chi tiết</Text>
                                        </TouchableOpacity>

                                        {/* Nút 2: Đã dọn xong - Hiển thị khi sân cần dọn */}
                                        {showDoneButton && (
                                            <TouchableOpacity
                                                style={[styles.toolbarBtn, styles.btnDone]}
                                                onPress={() => handleUpdateStatus(field.id, field.field_name, 'clean')}
                                                activeOpacity={0.85}
                                            >
                                                <Ionicons name="checkmark-circle" size={14} color="#ffffff" />
                                                <Text style={styles.btnDoneText}>Đã dọn xong</Text>
                                            </TouchableOpacity>
                                        )}

                                        {/* Nút 3: Đồ quên - CHỈ KHI SÂN ĐÃ DỌN THÀNH CÔNG ÍT NHẤT 1 CA HÔM NAY MỚI HIỂN THỊ */}
                                        {showLostButtonOnPitch && (
                                            <TouchableOpacity
                                                style={[styles.toolbarBtn, styles.btnLost]}
                                                onPress={() => openLostModal(field)}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="briefcase-outline" size={14} color="#0284c7" />
                                                <Text style={styles.btnLostText}>Đồ quên</Text>
                                            </TouchableOpacity>
                                        )}

                                        {/* Nút 4: Báo hỏng */}
                                        <TouchableOpacity
                                            style={[styles.toolbarBtn, styles.btnReport]}
                                            onPress={() => openReportModal(field)}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="construct-outline" size={14} color="#b45309" />
                                            <Text style={styles.btnReportText}>Báo hỏng</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* 4. NHẬT KÝ VỆ SINH SÂN HÔM NAY (DỮ LIỆU THỰC TẾ TRONG NGÀY) */}
                {activeTab === 'all' && (
                    <View style={styles.logsCard}>
                        <View style={styles.logsHeader}>
                            <Text style={styles.logsTitle}>Nhật ký vệ sinh sân hôm nay</Text>
                            <Text style={styles.logsSubtitle}>Ghi nhận tự động</Text>
                        </View>

                        {cleaningLogs.length === 0 ? (
                            <View style={styles.emptyLogsBox}>
                                <Ionicons name="document-text-outline" size={24} color="#94a3b8" />
                                <Text style={styles.emptyLogsText}>Chưa có lượt dọn dẹp nào được ghi nhận hôm nay</Text>
                            </View>
                        ) : (
                            cleaningLogs.map((log) => (
                                <View key={log.id} style={styles.logRow}>
                                    <View style={{ width: 55 }}>
                                        <Text style={styles.logTime}>{log.time}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.logFieldName}>{log.fieldName}</Text>
                                        <Text style={styles.logStatusText}>{log.statusText}</Text>
                                    </View>
                                    <Text style={styles.logCleaner}>{log.cleaner}</Text>
                                </View>
                            ))
                        )}
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* MODAL 1: XEM CHI TIẾT SÂN */}
            <Modal
                visible={showDetailModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDetailModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCardWrapper}>
                        {detailField && (() => {
                            const current = cleaningStatus[detailField.id] || cleaningStatus[detailField.field_name] || { status: 'clean' };
                            const sched = getFieldScheduleInfo(detailField);
                            const isFieldNeedClean = current.status === 'needs_clean' || sched.needsCleanAfterMatch;
                            const isClean = !isFieldNeedClean && current.status !== 'in_progress';
                            const isInProgress = current.status === 'in_progress';
                            const detailCleanedSessions = getFieldCleanedSessions(detailField, current, sched);
                            const showDetailDoneButton = sched.showDoneButton;
                            const showDetailLostButton = !showDetailDoneButton && detailCleanedSessions.length > 0;

                            return (
                                <>
                                    <View style={styles.modalHeader}>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={styles.modalMainHeader}>{detailField.field_name}</Text>
                                                <View style={[styles.statusBadge, isFieldNeedClean ? styles.badgeUrgent : isClean ? styles.badgeClean : styles.badgeProgress]}>
                                                    <Text style={[styles.statusBadgeText, isFieldNeedClean ? styles.textUrgent : isClean ? styles.textClean : styles.textProgress]}>
                                                        {isFieldNeedClean ? 'Cần dọn gấp' : isInProgress ? 'Đang dọn' : 'Sạch sẽ'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={styles.modalSubHeader}>
                                                {detailField.field_type || 'Sân cỏ nhân tạo'} • {isFieldNeedClean ? 'Ca vừa kết thúc, cần dọn gấp' : isClean ? 'Sân sạch sẽ, sẵn sàng đón khách' : 'Đang dọn dẹp'}
                                            </Text>
                                        </View>
                                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowDetailModal(false)}>
                                            <Ionicons name="close" size={20} color="#111827" />
                                        </TouchableOpacity>
                                    </View>

                                    <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                                        {/* 1. Ngày đặt */}
                                        <View style={styles.detailDateRow}>
                                            <Ionicons name="calendar-outline" size={14} color="#64748b" />
                                            <Text style={styles.detailDateText}>
                                                Ngày đặt: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{sched.todayFormatted}</Text>
                                            </Text>
                                        </View>

                                        {/* 2. Hai khối song song: Ca tiếp theo / Ca vừa kết thúc & Thông tin các ca đã dọn xong */}
                                        <View style={styles.detailGridRow}>
                                            {/* Ô BÊN TRÁI: Ca thi đấu tiếp theo hoặc Ca vừa kết thúc cần dọn */}
                                            <View style={styles.detailMatchCard}>
                                                <View style={styles.detailCardHead}>
                                                    <Ionicons name={isFieldNeedClean ? "warning" : "alarm-outline"} size={14} color={isFieldNeedClean ? "#dc2626" : "#0284c7"} />
                                                    <Text style={[styles.detailCardHeadText, isFieldNeedClean && { color: "#dc2626" }]}>
                                                        {isFieldNeedClean ? "Ca vừa kết thúc (Cần dọn)" : "Ca thi đấu tiếp theo"}
                                                    </Text>
                                                </View>
                                                {isFieldNeedClean ? (
                                                    <View style={{ marginTop: 6 }}>
                                                        <Text style={[styles.detailMatchSlot, { color: "#991b1b" }]}>
                                                            {sched.recentEndedBooking?.time || current.completedMatch?.time || "Hoàn thành"}
                                                        </Text>
                                                        <View style={[styles.detailCountdownPill, { backgroundColor: "#fee2e2", borderColor: "#fca5a5" }]}>
                                                            <Ionicons name="trash-outline" size={12} color="#dc2626" />
                                                            <Text style={[styles.detailCountdownPillText, { color: "#dc2626", fontWeight: "700" }]}>
                                                                Cần dọn mặt sân &amp; nhặt rác
                                                            </Text>
                                                        </View>
                                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                                                                <Ionicons name="person" size={12} color="#64748b" />
                                                                <Text style={{ fontSize: 11, fontWeight: "700", color: "#0f172a" }}>
                                                                    {sched.recentEndedBooking?.name || current.completedMatch?.name || "Khách đặt sân"}
                                                                </Text>
                                                            </View>
                                                            {(sched.recentEndedBooking?.phone || current.completedMatch?.phone) ? (
                                                                <TouchableOpacity
                                                                    onPress={() => Linking.openURL(`tel:${sched.recentEndedBooking?.phone || current.completedMatch?.phone}`)}
                                                                    style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
                                                                >
                                                                    <Ionicons name="call" size={11} color="#0284c7" />
                                                                    <Text style={styles.detailMatchPhone}>
                                                                        {sched.recentEndedBooking?.phone || current.completedMatch?.phone}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            ) : null}
                                                        </View>
                                                        {sched.nextBooking && (
                                                            <Text style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>
                                                                Ca kế tiếp hôm nay: <Text style={{ fontWeight: "700" }}>{sched.nextBooking.time}</Text>
                                                            </Text>
                                                        )}
                                                    </View>
                                                ) : sched.nextBooking ? (
                                                    <View style={{ marginTop: 6 }}>
                                                        <Text style={styles.detailMatchSlot}>{sched.nextBooking.time}</Text>

                                                        <View style={[styles.detailCountdownPill, { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' }]}>
                                                            <Ionicons name="checkmark-circle" size={12} color="#15803d" />
                                                            <Text style={[styles.detailCountdownPillText, { color: '#15803d' }]}>
                                                                Đã dọn sạch sẽ {sched.nextBooking.minutesLeft > 0 ? `(Còn ${sched.nextBooking.minutesLeft} phút nữa vào sân)` : '(Sẵn sàng đón ca này)'}
                                                            </Text>
                                                        </View>

                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                                                <Ionicons name="person" size={12} color="#64748b" />
                                                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#0f172a' }}>
                                                                    {sched.nextBooking.name || 'Khách đặt sân'}
                                                                </Text>
                                                            </View>
                                                            {sched.nextBooking.phone ? (
                                                                <TouchableOpacity
                                                                    onPress={() => Linking.openURL(`tel:${sched.nextBooking.phone}`)}
                                                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                                                                >
                                                                    <Ionicons name="call" size={11} color="#0284c7" />
                                                                    <Text style={styles.detailMatchPhone}>{sched.nextBooking.phone}</Text>
                                                                </TouchableOpacity>
                                                            ) : null}
                                                        </View>
                                                    </View>
                                                ) : (
                                                    <View style={{ marginTop: 8 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                                            <Ionicons name="checkmark-circle" size={16} color="#059669" />
                                                            <Text style={{ fontSize: 12, color: '#059669', fontWeight: '700' }}>
                                                                Hôm nay không còn ca nào
                                                            </Text>
                                                        </View>
                                                        <Text style={{ fontSize: 11, color: '#475569', lineHeight: 15 }}>
                                                            Sân đã dọn dẹp sạch sẽ, sẵn sàng đón khách hoặc nhận ca mới.
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Ô BÊN PHẢI: Thông tin các ca đã dọn xong */}
                                            <View style={styles.detailMatchCard}>
                                                <View style={styles.detailCardHead}>
                                                    <Ionicons name="checkmark-done" size={14} color="#059669" />
                                                    <Text style={[styles.detailCardHeadText, { color: '#059669' }]}>Thông tin các ca đã dọn xong</Text>
                                                </View>

                                                {detailCleanedSessions.length > 0 ? (
                                                    <View style={{ marginTop: 6 }}>
                                                        {detailCleanedSessions.map((item, idx) => (
                                                            <View key={item.id || idx} style={[styles.cleanedSessionCard, item.type === 'urgent' && { borderColor: '#fca5a5', backgroundColor: '#fff1f2' }]}>
                                                                <View style={styles.cleanedSessionTop}>
                                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                                                                        <Ionicons
                                                                            name={item.type === 'urgent' ? "alert-circle" : "checkmark-circle"}
                                                                            size={14}
                                                                            color={item.type === 'urgent' ? "#dc2626" : "#15803d"}
                                                                        />
                                                                        <Text style={[styles.cleanedSessionTitle, item.type === 'urgent' && { color: '#991b1b' }]}>
                                                                            {formatSessionTitle(item.time)}
                                                                        </Text>
                                                                        {item.type === 'urgent' && (
                                                                            <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginLeft: 4 }}>
                                                                                <Text style={{ fontSize: 9, fontWeight: '700', color: '#b91c1c' }}>Ca khẩn cấp</Text>
                                                                            </View>
                                                                        )}
                                                                    </View>
                                                                    <View style={[styles.cleanedSessionTimeChip, item.type === 'urgent' && { backgroundColor: '#fee2e2' }]}>
                                                                        <Text style={[styles.cleanedSessionTimeChipText, item.type === 'urgent' && { color: '#991b1b' }]}>
                                                                            Xong lúc {formatCompletedAt(item.completedAt || current.completedAt, item.time)}
                                                                        </Text>
                                                                    </View>
                                                                </View>

                                                                <View style={styles.cleanedSessionBottom}>
                                                                    <Text style={styles.cleanedSessionCustomer}>
                                                                        Khách: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{item.name || 'Khách đặt sân'}</Text>
                                                                        {item.phone ? ` (${item.phone})` : ''}
                                                                        {item.reportedBy ? (
                                                                            <Text style={{ color: '#64748b' }}> • Xử lý: <Text style={{ fontWeight: '700' }}>{item.reportedBy}</Text></Text>
                                                                        ) : null}
                                                                    </Text>
                                                                </View>
                                                                {item.reason && item.reason !== 'Đã hoàn tất dọn dẹp' && (
                                                                    <Text style={{ fontSize: 10, color: item.type === 'urgent' ? '#b91c1c' : '#64748b', marginTop: 2 }}>
                                                                        Tình trạng: <Text style={{ fontWeight: '600' }}>{item.reason}</Text>
                                                                    </Text>
                                                                )}
                                                            </View>
                                                        ))}
                                                    </View>
                                                ) : (
                                                    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                        <Ionicons name="time-outline" size={14} color="#94a3b8" />
                                                        <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                                                            Chưa có ca nào dọn trong ngày
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>

                                        {/* 3. Checklist quy chuẩn vệ sinh sân cỏ (Quy chuẩn mặc định) */}
                                        <View style={styles.checklistSection}>
                                            <Text style={styles.checklistSectionTitle}>Checklist tiêu chuẩn vệ sinh sân cỏ (Quy chuẩn mặc định):</Text>
                                            {[
                                                { title: '1. Quét & gom rác, chai nước', desc: 'Dọn sạch vỏ chai, ly nhựa tại ghế chờ và đường biên' },
                                                { title: '2. Thu gom bóng & áo bib', desc: 'Kiểm tra thu hồi đủ bóng thuê và treo gọn áo tập' },
                                                { title: '3. Rà soát dị vật an toàn', desc: 'Rà soát đinh sắt, đá sỏi trên mặt cỏ nhân tạo' },
                                                { title: '4. Kiểm tra lưới & thùng rác', desc: 'Cố định lưới khung thành, dọn sạch thùng rác cạnh sân' },
                                            ].map((item, idx) => (
                                                <View key={idx} style={styles.staticCheckRow}>
                                                    <Ionicons name="checkmark-circle" size={16} color="#006b2c" />
                                                    <View style={{ flex: 1, marginLeft: 8 }}>
                                                        <Text style={styles.staticCheckTitle}>{item.title}</Text>
                                                        <Text style={styles.staticCheckDesc}>{item.desc}</Text>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>

                                        {/* 4. Lịch toàn bộ các ca hôm nay của sân này (chuẩn theo bản Web) */}
                                        {sched.todayBookings && sched.todayBookings.length > 0 && (
                                            <View style={styles.detailTimelineSection}>
                                                <View style={styles.detailSectionTitleRow}>
                                                    <Ionicons name="calendar" size={13} color="#059669" />
                                                    <Text style={styles.detailSectionTitle}>
                                                        Lịch thi đấu hôm nay ({sched.todayBookings.length} ca)
                                                    </Text>
                                                </View>
                                                <View style={styles.detailTimelineTable}>
                                                    {sched.todayBookings.map((b, idx) => {
                                                        const bTime = b.time || `${b.start_time || ''} - ${b.end_time || ''}`;
                                                        const isPast = b.isEnded;
                                                        const isNext = sched.nextBooking?.time === bTime;

                                                        return (
                                                            <View
                                                                key={b.id || idx}
                                                                style={[
                                                                    styles.timelineRow,
                                                                    isNext && styles.timelineRowNext,
                                                                    isPast && styles.timelineRowPast,
                                                                ]}
                                                            >
                                                                <View style={styles.timelineTimeCol}>
                                                                    <Ionicons name="time-outline" size={13} color="#059669" />
                                                                    <Text style={styles.timelineTimeText}>{bTime}</Text>
                                                                </View>
                                                                <View style={styles.timelineGuestCol}>
                                                                    <Text style={styles.timelineGuestName}>{b.name || b.customer_name || 'Khách đặt sân'}</Text>
                                                                    {b.phone ? <Text style={styles.timelineGuestPhone}>({b.phone})</Text> : null}
                                                                </View>
                                                                <View style={styles.timelineStatusCol}>
                                                                    {isNext ? (
                                                                        <View style={styles.badgeNext}>
                                                                            <Ionicons name="alarm-outline" size={10} color="#0369a1" />
                                                                            <Text style={styles.badgeNextText}>
                                                                                Ca tiếp theo {b.isCleaned ? '(Đã dọn)' : '(Chờ dọn)'}
                                                                            </Text>
                                                                        </View>
                                                                    ) : isPast ? (
                                                                        <View style={styles.badgeFinished}>
                                                                            <Text style={styles.badgeFinishedText}>Đã kết thúc</Text>
                                                                        </View>
                                                                    ) : b.isCleaned ? (
                                                                        <View style={styles.badgeReady}>
                                                                            <Text style={styles.badgeReadyText}>Đã dọn sạch</Text>
                                                                        </View>
                                                                    ) : (
                                                                        <View style={styles.badgeWait}>
                                                                            <Text style={styles.badgeWaitText}>Chờ đá</Text>
                                                                        </View>
                                                                    )}
                                                                </View>
                                                            </View>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                        )}
                                    </ScrollView>

                                    {/* Modal Footer */}
                                    <View style={styles.modalFooterDetail}>
                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                            {/* Nút Báo đồ quên: CHỈ hiển thị khi đã dọn xong ít nhất 1 ca và không chờ dọn */}
                                            {showDetailLostButton && (
                                                <TouchableOpacity
                                                    style={[styles.smallModalBtn, { borderColor: '#bae6fd' }]}
                                                    onPress={() => {
                                                        setShowDetailModal(false);
                                                        openLostModal(detailField);
                                                    }}
                                                >
                                                    <Ionicons name="briefcase-outline" size={13} color="#0284c7" />
                                                    <Text style={[styles.smallModalBtnText, { color: '#0284c7' }]}>Báo đồ quên</Text>
                                                </TouchableOpacity>
                                            )}

                                            <TouchableOpacity
                                                style={[styles.smallModalBtn, { borderColor: '#fde68a' }]}
                                                onPress={() => {
                                                    setShowDetailModal(false);
                                                    openReportModal(detailField);
                                                }}
                                            >
                                                <Ionicons name="construct-outline" size={13} color="#b45309" />
                                                <Text style={[styles.smallModalBtnText, { color: '#b45309' }]}>Báo hỏng</Text>
                                            </TouchableOpacity>
                                        </View>

                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                            <TouchableOpacity
                                                style={styles.modalCloseBtnAction}
                                                onPress={() => setShowDetailModal(false)}
                                            >
                                                <Text style={styles.modalCloseBtnActionText}>Đóng</Text>
                                            </TouchableOpacity>

                                            {showDetailDoneButton && (
                                                <TouchableOpacity
                                                    style={styles.modalFinishBtn}
                                                    onPress={() => {
                                                        handleUpdateStatus(detailField.id, detailField.field_name, 'clean');
                                                        setShowDetailModal(false);
                                                    }}
                                                >
                                                    <Ionicons name="checkmark" size={15} color="#ffffff" />
                                                    <Text style={styles.modalFinishBtnText}>Đã xong</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                </>
                            );
                        })()}
                    </View>
                </View>
            </Modal>

            {/* MODAL 2: BÁO HỎNG THIẾT BỊ CHO KỸ THUẬT */}
            <Modal
                visible={showReportModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowReportModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCardWrapper}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalMainHeader}>Báo hỏng thiết bị cho Kỹ thuật</Text>
                                <Text style={styles.modalSubHeader}>Phát hiện sự cố trong quá trình dọn dẹp sân bóng</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowReportModal(false)}>
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                            <Text style={styles.formLabel}>Sân bóng phát hiện sự cố</Text>
                            <TextInput
                                style={[styles.modalInput, { backgroundColor: '#f1f5f9', fontWeight: '700' }]}
                                value={reportingField?.field_name || ''}
                                editable={false}
                            />

                            <Text style={styles.formLabel}>Hạng mục hư hỏng phát hiện khi dọn dẹp *</Text>
                            <View style={styles.categoryWrap}>
                                {[
                                    'Lưới khung thành & Cột',
                                    'Đèn chiếu sáng cao áp',
                                    'Mặt cỏ nhân tạo',
                                    'Hệ thống thoát nước',
                                    'Khác (Ghế chờ, cửa ra vào)',
                                ].map((cat) => {
                                    const isSel = issueData.category === cat;
                                    return (
                                        <TouchableOpacity
                                            key={cat}
                                            style={[styles.catPill, isSel && styles.catPillActive]}
                                            onPress={() => setIssueData((prev) => ({ ...prev, category: cat }))}
                                        >
                                            <Text style={[styles.catPillText, isSel && styles.catPillTextActive]}>{cat}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.formLabel}>Mức độ khẩn cấp *</Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                {['Khẩn cấp', 'Bình thường'].map((pri) => {
                                    const isSel = issueData.priority === pri;
                                    return (
                                        <TouchableOpacity
                                            key={pri}
                                            style={[styles.priPill, isSel && (pri === 'Khẩn cấp' ? styles.priUrgentActive : styles.priNormalActive)]}
                                            onPress={() => setIssueData((prev) => ({ ...prev, priority: pri }))}
                                        >
                                            <Text style={[styles.priPillText, isSel && { color: '#ffffff', fontWeight: '700' }]}>{pri}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.formLabel}>Mô tả chi tiết vị trí hỏng *</Text>
                            <TextInput
                                style={[styles.modalInput, { height: 75 }]}
                                placeholder="Ví dụ: Khung thành bên phải bị rách góc dưới, bóng dễ lọt ra ngoài..."
                                value={issueData.description}
                                onChangeText={(val) => setIssueData((prev) => ({ ...prev, description: val }))}
                                multiline
                            />
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowReportModal(false)}>
                                <Text style={styles.modalCancelText}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalSubmitBtn, { backgroundColor: '#d97706' }]} onPress={handleSubmitReport}>
                                <Ionicons name="send" size={15} color="#ffffff" />
                                <Text style={styles.modalSubmitText}>Gửi cho Kỹ thuật</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* MODAL 3: GHI NHẬN ĐỒ KHÁCH BỎ QUÊN MỚI */}
            <Modal
                visible={showLostModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowLostModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCardWrapper}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalMainHeader}>Ghi nhận đồ khách bỏ quên</Text>
                                <Text style={styles.modalSubHeader}>Nhân viên dọn dẹp ghi nhận để chuyển Lễ tân liên hệ khách</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowLostModal(false)}>
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                            <Text style={styles.formLabel}>Sân bóng phát hiện</Text>
                            <TextInput
                                style={[styles.modalInput, { backgroundColor: '#f1f5f9', fontWeight: '700' }]}
                                value={reportingLostField?.field_name || (fields[0]?.field_name || 'Sân bóng')}
                                editable={false}
                            />

                            <Text style={styles.formLabel}>Loại đồ đạc nhặt được *</Text>
                            <View style={styles.categoryWrap}>
                                {[
                                    'Áo khoác / Trang phục thi đấu',
                                    'Ví tiền / Giấy tờ tùy thân',
                                    'Chìa khóa (xe, nhà)',
                                    'Bình giữ nhiệt / Chai nước cá nhân',
                                    'Giày / Tất / Bọc ống đồng',
                                    'Điện thoại / Thiết bị điện tử',
                                    'Khác',
                                ].map((type) => {
                                    const isSel = lostData.itemType === type;
                                    return (
                                        <TouchableOpacity
                                            key={type}
                                            style={[styles.catPill, isSel && styles.catPillActive]}
                                            onPress={() => setLostData((prev) => ({ ...prev, itemType: type }))}
                                        >
                                            <Text style={[styles.catPillText, isSel && styles.catPillTextActive]}>{type}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.formLabel}>Vị trí phát hiện *</Text>
                            <View style={styles.categoryWrap}>
                                {[
                                    'Băng ghế chờ khán đài',
                                    'Khu vực khung thành',
                                    'Giữa sân / Góc sân',
                                    'Khu vực thay đồ / Nhà vệ sinh',
                                    'Bãi đỗ xe',
                                ].map((loc) => {
                                    const isSel = lostData.location === loc;
                                    return (
                                        <TouchableOpacity
                                            key={loc}
                                            style={[styles.catPill, isSel && styles.catPillActive]}
                                            onPress={() => setLostData((prev) => ({ ...prev, location: loc }))}
                                        >
                                            <Text style={[styles.catPillText, isSel && styles.catPillTextActive]}>{loc}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            <TextInput
                                style={[styles.modalInput, { marginTop: 4 }]}
                                placeholder="Hoặc ghi rõ vị trí cụ thể..."
                                value={lostData.location}
                                onChangeText={(val) => setLostData((prev) => ({ ...prev, location: val }))}
                            />

                            <Text style={styles.formLabel}>Ngày phát hiện</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="YYYY-MM-DD (Ví dụ: 2026-11-16)"
                                value={lostData.bookingDate}
                                onChangeText={(val) => setLostData((prev) => ({ ...prev, bookingDate: val }))}
                            />

                            <Text style={styles.formLabel}>Mô tả chi tiết nhận dạng <Text style={{ color: '#ef4444' }}>*</Text></Text>
                            <TextInput
                                style={[styles.modalInput, { height: 60 }]}
                                placeholder="Ví dụ: Áo khoác nỉ Nike màu xám đen, có chìa khóa xe trong túi áo..."
                                value={lostData.description}
                                onChangeText={(val) => setLostData((prev) => ({ ...prev, description: val }))}
                                multiline
                            />

                            <Text style={styles.formLabel}>Thông tin ca đá / Khách nghi vấn</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Ví dụ: Khách vừa đá ca 19:00 - 20:00..."
                                value={lostData.guestInfo}
                                onChangeText={(val) => setLostData((prev) => ({ ...prev, guestInfo: val }))}
                            />

                            <Text style={styles.formLabel}>Số điện thoại khách (nếu biết)</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Ví dụ: 0912 345 678..."
                                keyboardType="phone-pad"
                                value={lostData.customerPhone}
                                onChangeText={(val) => setLostData((prev) => ({ ...prev, customerPhone: val }))}
                            />
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowLostModal(false)}>
                                <Text style={styles.modalCancelText}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalSubmitBtn, { backgroundColor: '#0284c7' }]} onPress={handleSubmitLostItem}>
                                <Ionicons name="save" size={15} color="#ffffff" />
                                <Text style={styles.modalSubmitText}>Lưu & Báo cho Lễ tân</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* MODAL 4: CHỈNH SỬA THÔNG TIN ĐỒ KHÁCH QUÊN */}
            <Modal
                visible={showEditLostModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowEditLostModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCardWrapper}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalMainHeader}>Chỉnh sửa đồ khách quên</Text>
                                <Text style={styles.modalSubHeader}>Cập nhật trạng thái xử lý và thông tin bàn giao đồ</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowEditLostModal(false)}>
                                <Ionicons name="close" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                            <Text style={styles.formLabel}>Trạng thái đồ thất lạc *</Text>
                            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                                {[
                                    { key: 'pending', label: '⏳ Chờ trả khách' },
                                    { key: 'returned', label: '✅ Đã bàn giao' },
                                ].map((st) => {
                                    const isSel = (editingLostItem?.status || 'pending') === st.key;
                                    return (
                                        <TouchableOpacity
                                            key={st.key}
                                            style={[styles.priPill, isSel && (st.key === 'returned' ? styles.priNormalActive : styles.priUrgentActive)]}
                                            onPress={() => setEditingLostItem((prev) => ({ ...prev, status: st.key }))}
                                        >
                                            <Text style={[styles.priPillText, isSel && { color: '#ffffff', fontWeight: '700' }]}>{st.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.formLabel}>Loại đồ đạc *</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={editingLostItem?.item_type || editingLostItem?.itemType || ''}
                                onChangeText={(val) => setEditingLostItem((prev) => ({ ...prev, item_type: val, itemType: val }))}
                            />

                            <Text style={styles.formLabel}>Vị trí phát hiện</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={editingLostItem?.location || ''}
                                onChangeText={(val) => setEditingLostItem((prev) => ({ ...prev, location: val }))}
                            />

                            <Text style={styles.formLabel}>Mô tả chi tiết đồ vật</Text>
                            <TextInput
                                style={[styles.modalInput, { height: 60 }]}
                                value={editingLostItem?.description || ''}
                                onChangeText={(val) => setEditingLostItem((prev) => ({ ...prev, description: val }))}
                                multiline
                            />

                            <Text style={styles.formLabel}>Thông tin người nhận / Ghi chú bàn giao</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Ví dụ: Đã bàn giao lại cho khách lúc 18h30..."
                                value={editingLostItem?.return_note || editingLostItem?.returnNote || ''}
                                onChangeText={(val) => setEditingLostItem((prev) => ({ ...prev, return_note: val, returnNote: val }))}
                            />
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowEditLostModal(false)}>
                                <Text style={styles.modalCancelText}>Hủy bỏ</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalSubmitBtn, { backgroundColor: '#006b2c' }]} onPress={handleSaveEditLostItem}>
                                <Ionicons name="checkmark" size={15} color="#ffffff" />
                                <Text style={styles.modalSubmitText}>Lưu thay đổi</Text>
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
        backgroundColor: '#f8fafc',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    topBarLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconCircleBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dashboardEyebrow: {
        fontSize: 9,
        fontWeight: '700',
        color: '#64748b',
        letterSpacing: 0.5,
    },
    topBarTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
        marginTop: 2,
    },
    refreshBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f0fdf4',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 14,
    },
    statCard: {
        width: '48.5%',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    statCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    statIcon: {
        width: 26,
        height: 26,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statBadgeGreen: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    statBadgeGreenText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#15803d',
    },
    statBadgeRed: {
        backgroundColor: '#fee2e2',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    statBadgeRedText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#b91c1c',
    },
    statLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
    },
    statValue: {
        fontSize: 17,
        fontWeight: '900',
        color: '#0f172a',
        marginTop: 2,
    },
    statUnit: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    tabsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
    },
    tabsBar: {
        marginBottom: 12,
    },
    tabBtn: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    tabBtnActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    tabBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    tabBtnTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 12,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
        padding: 0,
    },
    centerBox: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pitchList: {
        gap: 12,
    },
    pitchCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
        elevation: 1,
    },
    pitchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    soccerIconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pitchName: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0f172a',
    },
    pitchType: {
        fontSize: 11,
        color: '#64748b',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    badgeClean: {
        backgroundColor: '#dcfce7',
    },
    badgeProgress: {
        backgroundColor: '#fef3c7',
    },
    badgeUrgent: {
        backgroundColor: '#fee2e2',
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    textClean: {
        color: '#15803d',
    },
    textProgress: {
        color: '#b45309',
    },
    textUrgent: {
        color: '#b91c1c',
    },
    countdownBanner: {
        backgroundColor: '#f0f9ff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#bae6fd',
        padding: 10,
        marginBottom: 10,
    },
    countdownHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    countdownLabel: {
        fontSize: 11,
        color: '#0369a1',
        fontWeight: '600',
    },
    countdownSlot: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0c4a6e',
    },
    countdownChip: {
        backgroundColor: '#e0f2fe',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    countdownChipText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#0284c7',
    },
    countdownSub: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    countdownSubText: {
        fontSize: 11,
        color: '#475569',
    },
    phoneLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    phoneLinkText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#0284c7',
    },
    readyBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#bbf7d0',
        padding: 8,
        gap: 6,
        marginBottom: 10,
    },
    readyBannerText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#15803d',
    },
    pitchToolbar: {
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
        width: '100%',
    },
    toolbarBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        paddingVertical: 7,
        borderRadius: 6,
        gap: 3,
    },
    btnDetail: {
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    btnDetailText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0f172a',
    },
    btnDone: {
        backgroundColor: '#006b2c',
    },
    btnDoneText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
    },
    btnLost: {
        backgroundColor: '#f0f9ff',
        borderWidth: 1,
        borderColor: '#bae6fd',
    },
    btnLostText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#0284c7',
    },
    btnReport: {
        backgroundColor: '#fef3c7',
        borderWidth: 1,
        borderColor: '#fde68a',
    },
    btnReportText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#b45309',
    },
    logsCard: {
        marginTop: 14,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    logsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 8,
        marginBottom: 8,
    },
    logsTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0f172a',
    },
    logsSubtitle: {
        fontSize: 10,
        color: '#64748b',
    },
    logRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    logTime: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
    },
    logFieldName: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f172a',
    },
    logStatusText: {
        fontSize: 10,
        color: '#15803d',
    },
    logCleaner: {
        fontSize: 10,
        color: '#64748b',
    },
    emptyLogsBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        gap: 6,
    },
    emptyLogsText: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
    /* ── LOST & FOUND PANEL STYLES (ĐỒ KHÁCH BỎ QUÊN) ── */
    lostContainer: {
        gap: 12,
    },
    lostPanelHeader: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    lostPanelTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0f172a',
    },
    lostPanelSub: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 3,
        lineHeight: 16,
    },
    addLostBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginTop: 10,
        backgroundColor: '#006b2c',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        gap: 4,
    },
    addLostBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
    lostSearchFilterBox: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 8,
    },
    lostSearchInner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 6,
    },
    lostSearchInput: {
        flex: 1,
        fontSize: 12,
        color: '#0f172a',
        padding: 0,
    },
    subTabsRow: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        padding: 3,
        gap: 4,
    },
    subTabItem: {
        flex: 1,
        paddingVertical: 6,
        alignItems: 'center',
        borderRadius: 6,
    },
    subTabItemActive: {
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
    },
    subTabText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    subTabTextActive: {
        color: '#0f172a',
        fontWeight: '700',
    },
    emptyCardBox: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
        gap: 6,
    },
    emptyTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
    },
    emptySub: {
        fontSize: 11,
        color: '#94a3b8',
    },
    lostCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
        elevation: 1,
    },
    lostHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    lostItemTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0f172a',
    },
    lostSubtitle: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    lostBadge: {
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
    },
    lostBadgePending: {
        backgroundColor: '#fee2e2',
    },
    lostBadgeDone: {
        backgroundColor: '#dcfce7',
    },
    lostBadgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    lostDesc: {
        fontSize: 12,
        color: '#334155',
        lineHeight: 17,
        marginBottom: 6,
    },
    returnNoteBox: {
        backgroundColor: '#f0fdf4',
        padding: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#bbf7d0',
        marginBottom: 6,
    },
    returnNoteText: {
        fontSize: 11,
        color: '#15803d',
        fontWeight: '500',
    },
    lostMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderColor: '#f1f5f9',
        paddingTop: 6,
        marginBottom: 8,
    },
    lostMetaText: {
        fontSize: 11,
        color: '#64748b',
    },
    lostCardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    returnToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        gap: 5,
    },
    returnBtnPending: {
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#86efac',
    },
    returnBtnDone: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    returnToggleText: {
        fontSize: 11,
        fontWeight: '700',
    },
    lostIconBtn: {
        width: 30,
        height: 30,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    /* ── STATS PANEL STYLES ── */
    statsContainer: {
        gap: 10,
    },
    statsCardBox: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    statsCardTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748b',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    statsRowLabel: {
        fontSize: 12,
        color: '#334155',
    },
    statsRowVal: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    /* ── MODALS STYLES ── */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalCardWrapper: {
        width: '100%',
        maxWidth: 480,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 8,
        marginBottom: 10,
    },
    modalMainHeader: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
    },
    modalSubHeader: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    modalCloseBtn: {
        padding: 4,
    },
    detailDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f8fafc',
        padding: 8,
        borderRadius: 8,
        marginBottom: 10,
    },
    detailDateText: {
        fontSize: 12,
        color: '#64748b',
    },
    detailGridRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    detailMatchCard: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    detailCardHead: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 4,
    },
    detailCardHeadText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#334155',
    },
    detailMatchSlot: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0f172a',
    },
    detailMatchGuest: {
        fontSize: 11,
        color: '#475569',
        marginTop: 2,
    },
    detailMatchPhone: {
        fontSize: 10,
        color: '#0284c7',
        marginTop: 1,
    },
    detailCountdownPill: {
        marginTop: 6,
        backgroundColor: '#e0f2fe',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
    },
    detailCountdownPillText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#0369a1',
    },
    cleanedItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 3,
    },
    cleanedItemText: {
        fontSize: 11,
        color: '#334155',
    },
    cleanedSessionCard: {
        backgroundColor: '#f0fdf4',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#bbf7d0',
        padding: 8,
        marginBottom: 6,
    },
    cleanedSessionTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    cleanedSessionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#15803d',
    },
    cleanedSessionTimeChip: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#86efac',
    },
    cleanedSessionTimeChipText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#166534',
    },
    cleanedSessionBottom: {
        marginTop: 2,
    },
    cleanedSessionCustomer: {
        fontSize: 11,
        color: '#334155',
    },
    checklistSection: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 10,
    },
    checklistSectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
    },
    staticCheckRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 4,
    },
    staticCheckTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0f172a',
    },
    staticCheckDesc: {
        fontSize: 10,
        color: '#64748b',
    },
    /* ── Lịch thi đấu hôm nay trong modal chi tiết (Section 4) ── */
    detailTimelineSection: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 10,
    },
    detailSectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    detailSectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0f172a',
    },
    detailTimelineTable: {
        gap: 6,
    },
    timelineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        padding: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    timelineRowNext: {
        borderColor: '#bae6fd',
        backgroundColor: '#f0f9ff',
    },
    timelineRowPast: {
        opacity: 0.6,
    },
    timelineTimeCol: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    timelineTimeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0f172a',
    },
    timelineGuestCol: {
        flex: 1,
        marginLeft: 8,
    },
    timelineGuestName: {
        fontSize: 11,
        fontWeight: '600',
        color: '#334155',
    },
    timelineGuestPhone: {
        fontSize: 10,
        color: '#64748b',
    },
    timelineStatusCol: {
        alignItems: 'flex-end',
    },
    badgeNext: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#e0f2fe',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    badgeNextText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#0369a1',
    },
    badgeFinished: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    badgeFinishedText: {
        fontSize: 10,
        color: '#64748b',
    },
    badgeReady: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    badgeReadyText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#15803d',
    },
    badgeWait: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    badgeWaitText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#b45309',
    },
    modalFooterDetail: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 10,
        marginTop: 6,
    },
    smallModalBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        borderWidth: 1,
        gap: 3,
    },
    smallModalBtnText: {
        fontSize: 11,
        fontWeight: '700',
    },
    modalCloseBtnAction: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
    },
    modalCloseBtnActionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    modalFinishBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#006b2c',
        gap: 4,
    },
    modalFinishBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
    formLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 13,
        color: '#0f172a',
        backgroundColor: '#ffffff',
        marginBottom: 10,
    },
    categoryWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    catPill: {
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    catPillActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    catPillText: {
        fontSize: 11,
        color: '#475569',
        fontWeight: '500',
    },
    catPillTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    priPill: {
        flex: 1,
        paddingVertical: 7,
        alignItems: 'center',
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    priUrgentActive: {
        backgroundColor: '#b91c1c',
        borderColor: '#b91c1c',
    },
    priNormalActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    priPillText: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '600',
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 10,
    },
    modalCancelBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    modalCancelText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    modalSubmitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 6,
        gap: 5,
    },
    modalSubmitText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
});
