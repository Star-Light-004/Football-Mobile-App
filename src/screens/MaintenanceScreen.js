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
    Switch,
    Platform,
    Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../context/AuthContext';
import {
    getMaintenanceIssuesApi,
    createMaintenanceIssueApi,
    updateMaintenanceIssueApi,
    updateMaintenanceStatusApi,
    deleteMaintenanceIssueApi
} from '../api/facilityApi';
import { getFieldsApi, updateFieldApi } from '../api/fieldsApi';

const ISSUES_STORAGE_KEY = 'pitch_maintenance_issues';

// Format tiền tệ VNĐ chuẩn dấu chấm
const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('vi-VN');
};

// Định dạng số có dấu chấm phân cách hàng nghìn khi nhập liệu
const formatDotNumber = (val) => {
    if (val === null || val === undefined || val === '') return '';
    const cleaned = String(val).replace(/\D/g, '');
    if (!cleaned) return '';
    return Number(cleaned).toLocaleString('vi-VN');
};

// Chuyển chuỗi có dấu chấm về số thực
const parseDotNumber = (val) => {
    if (!val) return 0;
    const cleaned = String(val).replace(/\D/g, '');
    return parseFloat(cleaned) || 0;
};

// Format ngày giờ Việt Nam
const formatDateTime = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    if (!str.includes('T') && !str.includes('-') && (str.includes('/') || str.includes('Vừa') || str.includes('Hôm'))) {
        return str;
    }
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return str;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year}, ${hours}:${minutes}`;
    } catch {
        return str;
    }
};

// Trích xuất YYYY-MM-DD phục vụ thống kê
const parseDateToYMD = (item, fallbackTodayStr) => {
    if (!item) return fallbackTodayStr;
    const raw = item.date || item.created_at || item.createdAt || item.resolved_at || item.resolvedAt || '';
    if (!raw) return fallbackTodayStr;
    const str = String(raw).trim();

    if (str.toLowerCase().includes('hôm nay') || str.toLowerCase().includes('vừa xong')) {
        return fallbackTodayStr;
    }
    if (str.toLowerCase().includes('hôm qua')) {
        const y = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return y.toLocaleDateString('en-CA');
    }
    const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
    }
    const slashMatch = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
        return `${slashMatch[3]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[1].padStart(2, '0')}`;
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('en-CA');
    }
    return fallbackTodayStr;
};

const CATEGORIES = [
    'Đèn chiếu sáng cao áp',
    'Mặt cỏ nhân tạo',
    'Lưới khung thành',
    'Hệ thống thoát nước',
    'Khung thành & Cột gôn',
    'Lưới chắn bóng quanh sân',
    'Bảng tỉ số / Đồng hồ',
    'Hệ thống phun nước làm mát',
    'Khác'
];

const PRIORITIES = ['Khẩn cấp', 'Bình thường'];

export default function MaintenanceScreen({ navigation }) {
    const { user } = useContext(AuthContext);

    // State dữ liệu
    const [fields, setFields] = useState([]);
    const [issues, setIssues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Tab chính: "board" (Sân & Thiết bị) | "stats" (Thống kê)
    const [activeMainTab, setActiveMainTab] = useState('board');

    // Thống kê bộ lọc
    const [statsRange, setStatsRange] = useState('day'); // 'day' | 'week' | 'month' | 'all'
    const [statsFieldFilter, setStatsFieldFilter] = useState('all');

    // Modal Tạo mới
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({
        fieldName: '',
        category: CATEGORIES[0],
        priority: 'Khẩn cấp',
        description: '',
        estimatedCost: '',
        reportedBy: 'Bộ phận kỹ thuật (App)',
        lockFieldImmediately: false
    });

    // Modal Sửa phiếu
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingIssue, setEditingIssue] = useState(null);

    // Modal Chi tiết sân
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedPitch, setSelectedPitch] = useState(null);

    // Modal Xác nhận sửa xong (Xóa chấm đỏ / lưu chi phí thực tế)
    const [showRepairModal, setShowRepairModal] = useState(false);
    const [repairingField, setRepairingField] = useState(null);
    const [repairingIssue, setRepairingIssue] = useState(null);
    const [actualCostInput, setActualCostInput] = useState('');
    const [autoReopenField, setAutoReopenField] = useState(true);

    // Load dữ liệu hoàn toàn từ CSDL backend (dùng chung nguồn dữ liệu với Web)
    const fetchData = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        try {
            const fieldRes = await getFieldsApi({ show_all: 'true' });
            const fieldList = fieldRes?.fields || fieldRes?.results || (Array.isArray(fieldRes) ? fieldRes : []);
            setFields(fieldList);

            if (fieldList.length > 0 && !createForm.fieldName) {
                setCreateForm((prev) => ({ ...prev, fieldName: fieldList[0].field_name }));
            }

            const serverIssues = await getMaintenanceIssuesApi();
            if (Array.isArray(serverIssues)) {
                // Đồng bộ chính xác với CSDL backend, không sinh dữ liệu ảo
                setIssues(serverIssues);
                await AsyncStorage.setItem(ISSUES_STORAGE_KEY, JSON.stringify(serverIssues));
            } else {
                setIssues([]);
                await AsyncStorage.removeItem(ISSUES_STORAGE_KEY);
            }
        } catch (e) {
            console.warn('Lỗi tải dữ liệu bảo trì:', e.message);
            try {
                const local = await AsyncStorage.getItem(ISSUES_STORAGE_KEY);
                if (local) {
                    const parsed = JSON.parse(local);
                    if (Array.isArray(parsed)) setIssues(parsed);
                }
            } catch {}
        } finally {
            setLoading(false);
            if (isManual) setRefreshing(false);
        }
    };

    useEffect(() => {
        // Xóa sạch cache dữ liệu mẫu cũ nếu có trước đây
        AsyncStorage.getItem(ISSUES_STORAGE_KEY).then((data) => {
            if (data && (data.includes('Cột đèn') || data.includes('1500000') || data.includes('450000'))) {
                AsyncStorage.removeItem(ISSUES_STORAGE_KEY);
            }
        }).catch(() => {});

        fetchData();
        // Polling định kỳ mỗi 3 giây để đồng bộ tức thời với Web
        const timer = setInterval(() => {
            fetchData();
        }, 3000);
        return () => clearInterval(timer);
    }, []);

    // Helper danh sách phiếu của sân
    const getPitchIssues = (pitch) => {
        if (!pitch) return [];
        const pName = (pitch.field_name || '').trim().toLowerCase();
        const pId = String(pitch.id || '');
        return issues.filter((i) => {
            const matchId = i.field && String(i.field) === pId;
            const matchName = i.fieldName && (i.fieldName || '').trim().toLowerCase() === pName;
            const matchNameBackend = i.field_name && (i.field_name || '').trim().toLowerCase() === pName;
            return matchId || matchName || matchNameBackend;
        });
    };

    const getPitchActiveIssues = (pitch) => {
        return getPitchIssues(pitch).filter(
            (i) => i.status !== 'done' && i.status !== 'resolved'
        );
    };

    const getPitchEstimatedCost = (pitch) => {
        const active = getPitchActiveIssues(pitch);
        return active.reduce(
            (sum, i) => sum + (parseFloat(i.estimatedCost || i.estimated_cost) || 0),
            0
        );
    };

    // Khóa / Mở sân đón khách
    const handleTogglePitchLock = async (pitch) => {
        const isNowAvailable = pitch.is_available === false;
        try {
            await updateFieldApi(pitch.id, { is_available: isNowAvailable });
            setFields((prev) =>
                prev.map((f) => (f.id === pitch.id ? { ...f, is_available: isNowAvailable } : f))
            );
            Alert.alert(
                'Thành công',
                isNowAvailable
                    ? `Đã mở khóa sân ${pitch.field_name} sẵn sàng đón khách!`
                    : `Đã đưa ${pitch.field_name} vào trạng thái BẢO TRÌ (Khóa đặt sân)!`
            );
        } catch (error) {
            Alert.alert('Lỗi', 'Không thể cập nhật trạng thái bảo trì của sân');
        }
    };

    // Mở modal xác nhận sửa xong (cho 1 phiếu hoặc toàn bộ sân)
    const openRepairModal = (field, specificIssue = null) => {
        setRepairingField(field);
        setRepairingIssue(specificIssue);

        let defaultCost = 0;
        if (specificIssue) {
            defaultCost = parseFloat(specificIssue.estimatedCost || specificIssue.estimated_cost) || 0;
        } else {
            defaultCost = getPitchEstimatedCost(field);
        }
        setActualCostInput(defaultCost > 0 ? formatDotNumber(defaultCost) : '');
        setAutoReopenField(field?.is_available === false);
        setShowRepairModal(true);
    };

    // Xác nhận sửa xong -> Đổi trạng thái 'done', lưu chi phí thực tế, hết chấm đỏ
    const handleConfirmRepairDone = async () => {
        const actualCost = parseDotNumber(actualCostInput);
        const nowTimeStr = new Date().toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        if (repairingIssue) {
            // Sửa xong 1 phiếu cụ thể
            const updated = issues.map((item) => {
                if (item.id === repairingIssue.id) {
                    return {
                        ...item,
                        status: 'done',
                        cost: actualCost,
                        resolvedAt: nowTimeStr,
                        resolved_at: new Date().toISOString()
                    };
                }
                return item;
            });
            setIssues(updated);
            await AsyncStorage.setItem(ISSUES_STORAGE_KEY, JSON.stringify(updated));

            try {
                await updateMaintenanceStatusApi(repairingIssue.id, 'done', actualCost);
            } catch (e) {
                console.warn('API error update status:', e.message);
            }

            // Nếu tùy chọn mở lại sân được bật và sân đang bị khóa
            if (autoReopenField && repairingField && repairingField.is_available === false) {
                try {
                    await updateFieldApi(repairingField.id, { is_available: true });
                    setFields((prev) =>
                        prev.map((f) => (f.id === repairingField.id ? { ...f, is_available: true } : f))
                    );
                } catch {}
            }

            Alert.alert('Thành công', `Đã xác nhận sửa xong phiếu "${repairingIssue.category}"!`);
        } else if (repairingField) {
            // Sửa xong tất cả phiếu đang hỏng của sân này
            const targetIssues = getPitchActiveIssues(repairingField);
            if (targetIssues.length === 0) {
                Alert.alert('Thông báo', 'Sân này hiện không có phiếu bảo trì nào cần sửa.');
                setShowRepairModal(false);
                return;
            }

            const costPerIssue = actualCost > 0 ? actualCost / targetIssues.length : 0;
            const targetIds = new Set(targetIssues.map((i) => i.id));

            const updated = issues.map((item) => {
                if (targetIds.has(item.id)) {
                    return {
                        ...item,
                        status: 'done',
                        cost: costPerIssue,
                        resolvedAt: nowTimeStr,
                        resolved_at: new Date().toISOString()
                    };
                }
                return item;
            });
            setIssues(updated);
            await AsyncStorage.setItem(ISSUES_STORAGE_KEY, JSON.stringify(updated));

            // Cập nhật API cho từng issue
            for (const t of targetIssues) {
                try {
                    await updateMaintenanceStatusApi(t.id, 'done', costPerIssue);
                } catch {}
            }

            // Tự động mở lại sân đón khách nếu tùy chọn được bật
            if (autoReopenField && repairingField.is_available === false) {
                try {
                    await updateFieldApi(repairingField.id, { is_available: true });
                    setFields((prev) =>
                        prev.map((f) => (f.id === repairingField.id ? { ...f, is_available: true } : f))
                    );
                } catch {}
            }

            Alert.alert(
                'Thành công',
                `Đã sửa xong toàn bộ sự cố tại ${repairingField.field_name}! Chấm đỏ cảnh báo đã được gỡ bỏ.`
            );
        }

        setShowRepairModal(false);
        setRepairingField(null);
        setRepairingIssue(null);
        fetchData();
    };

    // Chuyển nhanh tiến độ (Đang sửa)
    const handleSetFixingStatus = async (issueId) => {
        const updated = issues.map((item) =>
            item.id === issueId ? { ...item, status: 'fixing' } : item
        );
        setIssues(updated);
        await AsyncStorage.setItem(ISSUES_STORAGE_KEY, JSON.stringify(updated));

        try {
            await updateMaintenanceStatusApi(issueId, 'fixing');
        } catch {}

        Alert.alert('Thành công', 'Đã chuyển phiếu sang trạng thái Đang sửa chữa');
    };

    // Xóa phiếu bảo trì (hỗ trợ chuẩn xác cả nền tảng Web browser và Mobile native)
    const handleDeleteIssue = (issueId) => {
        const doDelete = async () => {
            const updated = issues.filter((i) => String(i.id) !== String(issueId));
            setIssues(updated);
            await AsyncStorage.setItem(ISSUES_STORAGE_KEY, JSON.stringify(updated));
            try {
                await deleteMaintenanceIssueApi(issueId);
            } catch (err) {
                console.warn('Lỗi gọi API xóa phiếu bảo trì:', err.message);
            }
            fetchData();
            Alert.alert('Thành công', 'Đã xóa phiếu bảo trì');
        };

        Alert.alert(
            'Xác nhận xóa',
            'Bạn có chắc chắn muốn xóa phiếu bảo trì này không?',
            [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Xóa', style: 'destructive', onPress: doDelete }
            ]
        );
    };

    // Mở modal sửa phiếu
    const openEditModal = (issue) => {
        const rawEst = issue.estimatedCost || issue.estimated_cost || 0;
        const rawAct = issue.cost || 0;
        setEditingIssue({
            ...issue,
            fieldName: issue.fieldName || issue.field_name || '',
            category: issue.category || CATEGORIES[0],
            priority: issue.priority || 'Khẩn cấp',
            description: issue.description || '',
            estimatedCost: rawEst > 0 ? formatDotNumber(rawEst) : '',
            cost: rawAct > 0 ? formatDotNumber(rawAct) : '',
            status: issue.status || 'pending'
        });
        setShowEditModal(true);
    };

    // Lưu chỉnh sửa phiếu
    const handleSaveEditIssue = async () => {
        if (!editingIssue || !editingIssue.description.trim()) {
            Alert.alert('Thông báo', 'Vui lòng nhập mô tả sự cố');
            return;
        }

        const estCost = parseDotNumber(editingIssue.estimatedCost);
        const actCost = parseDotNumber(editingIssue.cost);

        const updated = issues.map((item) => {
            if (item.id === editingIssue.id) {
                return {
                    ...item,
                    fieldName: editingIssue.fieldName,
                    category: editingIssue.category,
                    priority: editingIssue.priority,
                    description: editingIssue.description,
                    estimatedCost: estCost,
                    cost: actCost,
                    status: editingIssue.status
                };
            }
            return item;
        });
        setIssues(updated);
        await AsyncStorage.setItem(ISSUES_STORAGE_KEY, JSON.stringify(updated));

        try {
            await updateMaintenanceIssueApi(editingIssue.id, {
                field_name: editingIssue.fieldName,
                category: editingIssue.category,
                priority: editingIssue.priority,
                description: editingIssue.description,
                estimated_cost: estCost,
                cost: actCost,
                status: editingIssue.status
            });
        } catch {}

        setShowEditModal(false);
        setEditingIssue(null);
        Alert.alert('Thành công', 'Đã cập nhật thông tin phiếu bảo trì');
        fetchData();
    };

    // Tạo phiếu mới
    const handleCreateIssue = async () => {
        if (!createForm.description.trim()) {
            Alert.alert('Thông báo', 'Vui lòng nhập mô tả sự cố');
            return;
        }

        const matchedField = fields.find(
            (f) => (f.field_name || '').toLowerCase() === (createForm.fieldName || '').toLowerCase()
        );
        const estCost = parseDotNumber(createForm.estimatedCost);

        const item = {
            id: Date.now(),
            field: matchedField?.id || null,
            fieldName: createForm.fieldName,
            category: createForm.category,
            description: createForm.description,
            priority: createForm.priority,
            estimatedCost: estCost,
            cost: 0,
            reportedBy: createForm.reportedBy || (user?.username || 'Bộ phận kỹ thuật (App)'),
            status: 'pending',
            createdAt: 'Vừa xong'
        };

        const updated = [item, ...issues];
        setIssues(updated);
        await AsyncStorage.setItem(ISSUES_STORAGE_KEY, JSON.stringify(updated));

        try {
            const res = await createMaintenanceIssueApi({
                field: matchedField?.id || null,
                field_name: createForm.fieldName,
                category: createForm.category,
                description: createForm.description,
                priority: createForm.priority,
                estimated_cost: estCost,
                status: 'pending',
                reported_by_name: item.reportedBy
            });
            if (res?.id) {
                item.id = res.id;
                await AsyncStorage.setItem(ISSUES_STORAGE_KEY, JSON.stringify([item, ...issues]));
            }
        } catch (e) {
            console.warn('Lỗi tạo issue backend:', e.message);
        }

        // Nếu bật khóa sân ngay
        if (createForm.lockFieldImmediately && matchedField && matchedField.is_available !== false) {
            try {
                await updateFieldApi(matchedField.id, { is_available: false });
                setFields((prev) =>
                    prev.map((f) => (f.id === matchedField.id ? { ...f, is_available: false } : f))
                );
            } catch {}
        }

        setShowCreateModal(false);
        setCreateForm((prev) => ({
            ...prev,
            description: '',
            estimatedCost: '',
            lockFieldImmediately: false
        }));
        Alert.alert('Thành công', 'Đã tạo phiếu bảo trì sân thành công!');
        fetchData();
    };

    // Thống kê tính toán
    const todayStr = useMemo(() => new Date().toLocaleDateString('en-CA'), []);

    const dateFilteredIssues = useMemo(() => {
        return issues.filter((item) => {
            if (statsRange === 'all') return true;
            const itemDateStr = parseDateToYMD(item, todayStr);
            if (statsRange === 'day') return itemDateStr === todayStr;
            if (statsRange === 'week') {
                const itemDate = new Date(itemDateStr + 'T00:00:00');
                const todayDate = new Date(todayStr + 'T00:00:00');
                const diffDays = Math.round((todayDate.getTime() - itemDate.getTime()) / (24 * 3600 * 1000));
                return diffDays >= 0 && diffDays <= 7;
            }
            if (statsRange === 'month') {
                return itemDateStr.slice(0, 7) === todayStr.slice(0, 7);
            }
            return true;
        });
    }, [issues, statsRange, todayStr]);

    const statsHistory = useMemo(() => {
        return dateFilteredIssues.filter((item) => {
            if (statsFieldFilter === 'all') return true;
            const pName = String(statsFieldFilter).toLowerCase().trim();
            const matchName = String(item.fieldName || item.field_name || '').toLowerCase().trim() === pName;
            const matchId = String(item.field || '') === String(statsFieldFilter);
            return matchName || matchId;
        });
    }, [dateFilteredIssues, statsFieldFilter]);

    const statsKPIs = useMemo(() => {
        const total = statsHistory.length;
        const done = statsHistory.filter((i) => i.status === 'done' || i.status === 'resolved').length;
        const pending = statsHistory.filter((i) => i.status !== 'done' && i.status !== 'resolved').length;
        const actualCost = statsHistory.reduce((sum, i) => sum + (parseFloat(i.cost) || 0), 0);
        const estCost = statsHistory.reduce((sum, i) => sum + (parseFloat(i.estimatedCost || i.estimated_cost) || 0), 0);
        const rate = total > 0 ? Math.round((done / total) * 100) : 100;
        return { total, done, pending, actualCost, estCost, rate };
    }, [statsHistory]);

    // Lọc sân theo tìm kiếm
    const filteredFields = useMemo(() => {
        if (!searchQuery.trim()) return fields;
        const q = searchQuery.toLowerCase().trim();
        return fields.filter(
            (f) =>
                (f.field_name || '').toLowerCase().includes(q) ||
                (f.field_type || '').toLowerCase().includes(q)
        );
    }, [fields, searchQuery]);

    // KPI tổng quan tab board
    const totalLockedPitches = useMemo(() => {
        return fields.filter((f) => f.is_available === false).length;
    }, [fields]);

    const totalActiveIssues = useMemo(() => {
        return issues.filter((i) => i.status !== 'done' && i.status !== 'resolved').length;
    }, [issues]);

    const totalActiveEstCost = useMemo(() => {
        return issues
            .filter((i) => i.status !== 'done' && i.status !== 'resolved')
            .reduce((sum, i) => sum + (parseFloat(i.estimatedCost || i.estimated_cost) || 0), 0);
    }, [issues]);

    // Chia sẻ báo cáo thống kê
    const handleShareStats = async () => {
        const report = `📊 BÁO CÁO BẢO TRÌ SÂN BÓNG (${statsRange.toUpperCase()})
Tổng số ca: ${statsKPIs.total} ca
Đã sửa xong: ${statsKPIs.done} ca
Đang xử lý: ${statsKPIs.pending} ca
Chi phí thực tế: ${formatCurrency(statsKPIs.actualCost)} VNĐ
Chi phí dự kiến: ${formatCurrency(statsKPIs.estCost)} VNĐ
Tỷ lệ hoàn thành: ${statsKPIs.rate}%`;
        try {
            await Share.share({ message: report, title: 'Báo cáo bảo trì sân bóng' });
        } catch {}
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Top Bar: Chuẩn hóa 100% theo phong cách chung của các màn hình trong App */}
            <View style={styles.topBar}>
                <View style={styles.topBarLeft}>
                    <TouchableOpacity
                        style={styles.iconCircleBtn}
                        onPress={() => {
                            if (navigation && navigation.canGoBack()) navigation.goBack();
                            else if (navigation) navigation.navigate('AdminDashboard');
                        }}
                    >
                        <Ionicons name="arrow-back" size={20} color="#111827" />
                    </TouchableOpacity>
                    <View style={{ marginLeft: 10 }}>
                        <Text style={styles.dashboardEyebrow}>VẬN HÀNH CƠ SỞ › BẢO TRÌ & SỰ CỐ</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.topBarTitle}>Quản lý Bảo Trì Sân</Text>
                            <View style={styles.proPill}>
                                <Text style={styles.proPillText}>PRO</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.topBarRight}>
                    <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => setShowCreateModal(true)}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="add" size={16} color="#ffffff" />
                        <Text style={styles.addBtnText}>Báo sự cố</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Main Tabs Segmented Control */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tabButton, activeMainTab === 'board' && styles.tabButtonActive]}
                    onPress={() => setActiveMainTab('board')}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name="grid-outline"
                        size={17}
                        color={activeMainTab === 'board' ? '#006b2c' : '#64748b'}
                    />
                    <Text
                        style={[
                            styles.tabButtonText,
                            activeMainTab === 'board' && styles.tabButtonTextActive
                        ]}
                    >
                        Sân & Thiết Bị
                    </Text>
                    {totalActiveIssues > 0 && (
                        <View style={styles.tabBadge}>
                            <Text style={styles.tabBadgeText}>{totalActiveIssues}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabButton, activeMainTab === 'stats' && styles.tabButtonActive]}
                    onPress={() => setActiveMainTab('stats')}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name="bar-chart-outline"
                        size={17}
                        color={activeMainTab === 'stats' ? '#006b2c' : '#64748b'}
                    />
                    <Text
                        style={[
                            styles.tabButtonText,
                            activeMainTab === 'stats' && styles.tabButtonTextActive
                        ]}
                    >
                        Thống Kê Ca Bảo Trì
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Nội dung theo Tab */}
            {activeMainTab === 'board' ? (
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => fetchData(true)}
                            colors={['#006b2c']}
                        />
                    }
                >
                    {/* Thanh tìm kiếm */}
                    <View style={styles.searchBox}>
                        <Ionicons name="search" size={18} color="#94a3b8" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Tìm kiếm sân bóng hoặc thiết bị..."
                            placeholderTextColor="#94a3b8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={18} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* 3 KPI Cards */}
                    <View style={styles.kpiRow}>
                        <View style={[styles.kpiCard, { borderColor: '#fca5a5' }]}>
                            <View style={styles.kpiTop}>
                                <Text style={styles.kpiLabel}>Sân đang khóa</Text>
                                <Ionicons name="lock-closed" size={16} color="#dc2626" />
                            </View>
                            <Text style={[styles.kpiValue, { color: '#dc2626' }]}>
                                {totalLockedPitches}
                            </Text>
                            <Text style={styles.kpiSub}>Cần bảo trì</Text>
                        </View>

                        <View style={[styles.kpiCard, { borderColor: '#fde047' }]}>
                            <View style={styles.kpiTop}>
                                <Text style={styles.kpiLabel}>Sự cố đang xử lý</Text>
                                <Ionicons name="alert-circle" size={16} color="#d97706" />
                            </View>
                            <Text style={[styles.kpiValue, { color: '#d97706' }]}>
                                {totalActiveIssues}
                            </Text>
                            <Text style={styles.kpiSub}>Đang hỏng</Text>
                        </View>

                        <View style={[styles.kpiCard, { borderColor: '#a7f3d0' }]}>
                            <View style={styles.kpiTop}>
                                <Text style={styles.kpiLabel}>Chi phí dự kiến</Text>
                                <Ionicons name="cash-outline" size={16} color="#006b2c" />
                            </View>
                            <Text style={[styles.kpiValue, { color: '#006b2c', fontSize: 15 }]}>
                                {formatCurrency(totalActiveEstCost)} đ
                            </Text>
                            <Text style={styles.kpiSub}>Tổng chi</Text>
                        </View>
                    </View>

                    {/* Danh sách thẻ sân */}
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Danh sách sân bóng</Text>
                        <Text style={styles.sectionCount}>{filteredFields.length} sân</Text>
                    </View>

                    {loading && !refreshing ? (
                        <ActivityIndicator size="large" color="#006b2c" style={{ marginTop: 30 }} />
                    ) : filteredFields.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="football-outline" size={48} color="#cbd5e1" />
                            <Text style={styles.emptyText}>Không tìm thấy sân bóng nào</Text>
                        </View>
                    ) : (
                        filteredFields.map((field) => {
                            const isLocked = field.is_available === false;
                            const pitchIssues = getPitchIssues(field);
                            const activeIssues = getPitchActiveIssues(field);
                            const hasActiveIssue = activeIssues.length > 0;
                            const firstIssue = activeIssues[0];
                            const estimatedCost = getPitchEstimatedCost(field);

                            return (
                                <View
                                    key={field.id}
                                    style={[
                                        styles.pitchCard,
                                        hasActiveIssue ? styles.pitchCardWarning : styles.pitchCardNormal
                                    ]}
                                >
                                    {/* Card Header */}
                                    <View style={styles.pitchHeader}>
                                        <View style={styles.pitchNameWrap}>
                                            <View
                                                style={[
                                                    styles.pitchIconBox,
                                                    hasActiveIssue && styles.pitchIconBoxWarning
                                                ]}
                                            >
                                                <Ionicons
                                                    name="football"
                                                    size={20}
                                                    color={hasActiveIssue ? '#dc2626' : '#006b2c'}
                                                />
                                            </View>
                                            <View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={styles.pitchName}>{field.field_name}</Text>
                                                    {/* Chấm đỏ cảnh báo khi có sự cố */}
                                                    {hasActiveIssue && <View style={styles.pulseDot} />}
                                                </View>
                                                <Text style={styles.pitchType}>
                                                    {field.field_type || 'Sân cỏ nhân tạo'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Badge Trạng thái Khóa / Hoạt động */}
                                        <View
                                            style={[
                                                styles.statusBadge,
                                                isLocked ? styles.statusBadgeLocked : styles.statusBadgeActive
                                            ]}
                                        >
                                            <Ionicons
                                                name={isLocked ? 'lock-closed' : 'checkmark-circle'}
                                                size={13}
                                                color={isLocked ? '#dc2626' : '#15803d'}
                                            />
                                            <Text
                                                style={[
                                                    styles.statusBadgeText,
                                                    isLocked ? styles.statusBadgeTextLocked : styles.statusBadgeTextActive
                                                ]}
                                            >
                                                {isLocked ? 'Đang bảo trì' : 'Hoạt động'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Technical Condition / Warning Box */}
                                    {hasActiveIssue ? (
                                        <View style={styles.issueBanner}>
                                            <View style={styles.issueBannerHeader}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                                    <Ionicons name="warning" size={17} color="#dc2626" />
                                                    <Text style={styles.issueCategory} numberOfLines={1}>
                                                        {firstIssue.category || 'Cơ sở vật chất'}
                                                    </Text>
                                                </View>
                                                <View
                                                    style={[
                                                        styles.priorityTag,
                                                        firstIssue.priority === 'Khẩn cấp'
                                                            ? styles.priorityTagUrgent
                                                            : styles.priorityTagNormal
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.priorityTagText,
                                                            firstIssue.priority === 'Khẩn cấp'
                                                                ? styles.priorityTagTextUrgent
                                                                : styles.priorityTagTextNormal
                                                        ]}
                                                    >
                                                        {firstIssue.priority || 'Khẩn cấp'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={styles.issueDesc} numberOfLines={2}>
                                                {firstIssue.description}
                                            </Text>
                                            <View style={styles.issueMetaRow}>
                                                <Text style={styles.issueReporter}>
                                                    Báo: {firstIssue.reportedBy || firstIssue.reported_by_name || 'Kỹ thuật'}
                                                </Text>
                                                <Text style={styles.issueEstCost}>
                                                    Dự kiến: {formatCurrency(estimatedCost)} đ
                                                </Text>
                                            </View>
                                        </View>
                                    ) : (
                                        <View style={styles.goodConditionBox}>
                                            <Ionicons name="shield-checkmark" size={16} color="#16a34a" />
                                            <Text style={styles.goodConditionText}>
                                                Tình trạng: Hoạt động tốt • Đầy đủ thiết bị
                                            </Text>
                                        </View>
                                    )}

                                    {/* 3 Action Buttons trên 1 hàng chuẩn như Web */}
                                    <View style={styles.pitchActionsRow}>
                                        {/* Nút 1: Xem chi tiết (có số lượng phiếu) */}
                                        <TouchableOpacity
                                            style={[styles.actionBtn, styles.btnDetail]}
                                            onPress={() => {
                                                setSelectedPitch(field);
                                                setShowDetailModal(true);
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="eye-outline" size={15} color="#475569" />
                                            <Text style={styles.btnDetailText}>
                                                Chi tiết ({pitchIssues.length})
                                            </Text>
                                        </TouchableOpacity>

                                        {/* Nút 2: Sửa xong (chỉ hiện khi có sự cố đang hỏng) */}
                                        {hasActiveIssue && (
                                            <TouchableOpacity
                                                style={[styles.actionBtn, styles.btnRepairDone]}
                                                onPress={() => openRepairModal(field)}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons name="checkmark-done" size={15} color="#15803d" />
                                                <Text style={styles.btnRepairDoneText}>Sửa xong</Text>
                                            </TouchableOpacity>
                                        )}

                                        {/* Nút 3: Khóa sân / Mở sân */}
                                        <TouchableOpacity
                                            style={[
                                                styles.actionBtn,
                                                isLocked ? styles.btnUnlock : styles.btnLock
                                            ]}
                                            onPress={() => handleTogglePitchLock(field)}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons
                                                name={isLocked ? 'lock-open-outline' : 'lock-closed-outline'}
                                                size={15}
                                                color={isLocked ? '#006b2c' : '#dc2626'}
                                            />
                                            <Text
                                                style={[
                                                    styles.actionBtnText,
                                                    isLocked ? styles.btnUnlockText : styles.btnLockText
                                                ]}
                                            >
                                                {isLocked ? 'Mở khóa' : 'Khóa'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })
                    )}
                    <View style={{ height: 40 }} />
                </ScrollView>
            ) : (
                /* Tab Thống Kê Ca Bảo Trì */
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => fetchData(true)}
                            colors={['#006b2c']}
                        />
                    }
                >
                    {/* Bộ lọc thời gian */}
                    <View style={styles.filterGroup}>
                        <Text style={styles.filterGroupLabel}>Khoảng thời gian:</Text>
                        <View style={styles.rangePillRow}>
                            {[
                                { key: 'day', label: 'Hôm nay' },
                                { key: 'week', label: 'Tuần này' },
                                { key: 'month', label: 'Tháng này' },
                                { key: 'all', label: 'Tất cả' }
                            ].map((tab) => (
                                <TouchableOpacity
                                    key={tab.key}
                                    style={[
                                        styles.rangePill,
                                        statsRange === tab.key && styles.rangePillActive
                                    ]}
                                    onPress={() => setStatsRange(tab.key)}
                                    activeOpacity={0.8}
                                >
                                    <Text
                                        style={[
                                            styles.rangePillText,
                                            statsRange === tab.key && styles.rangePillTextActive
                                        ]}
                                    >
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Bộ lọc sân */}
                    <View style={styles.filterGroup}>
                        <Text style={styles.filterGroupLabel}>Lọc theo sân:</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                            <TouchableOpacity
                                style={[
                                    styles.fieldPill,
                                    statsFieldFilter === 'all' && styles.fieldPillActive
                                ]}
                                onPress={() => setStatsFieldFilter('all')}
                            >
                                <Text
                                    style={[
                                        styles.fieldPillText,
                                        statsFieldFilter === 'all' && styles.fieldPillTextActive
                                    ]}
                                >
                                    Tất cả sân ({issues.length})
                                </Text>
                            </TouchableOpacity>
                            {fields.map((f) => {
                                const cnt = getPitchIssues(f).length;
                                const isSel = statsFieldFilter === f.field_name || statsFieldFilter === String(f.id);
                                return (
                                    <TouchableOpacity
                                        key={f.id}
                                        style={[styles.fieldPill, isSel && styles.fieldPillActive]}
                                        onPress={() => setStatsFieldFilter(f.field_name)}
                                    >
                                        <Text
                                            style={[
                                                styles.fieldPillText,
                                                isSel && styles.fieldPillTextActive
                                            ]}
                                        >
                                            {f.field_name} ({cnt})
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* 4 KPI Cards Thống Kê */}
                    <View style={styles.statsKpiGrid}>
                        <View style={[styles.statsKpiCard, { borderColor: '#a7f3d0' }]}>
                            <Text style={styles.statsKpiLabel}>Chi phí thực tế</Text>
                            <Text style={[styles.statsKpiValue, { color: '#006b2c' }]}>
                                {formatCurrency(statsKPIs.actualCost)} đ
                            </Text>
                            <Text style={styles.statsKpiSub}>Đã chi hoàn tất</Text>
                        </View>

                        <View style={[styles.statsKpiCard, { borderColor: '#fed7aa' }]}>
                            <Text style={styles.statsKpiLabel}>Chi phí dự kiến</Text>
                            <Text style={[styles.statsKpiValue, { color: '#ea580c' }]}>
                                {formatCurrency(statsKPIs.estCost)} đ
                            </Text>
                            <Text style={styles.statsKpiSub}>Kế hoạch bảo trì</Text>
                        </View>

                        <View style={[styles.statsKpiCard, { borderColor: '#bae6fd' }]}>
                            <Text style={styles.statsKpiLabel}>Đã sửa / Tổng</Text>
                            <Text style={[styles.statsKpiValue, { color: '#0284c7' }]}>
                                {statsKPIs.done} / {statsKPIs.total}
                            </Text>
                            <Text style={styles.statsKpiSub}>Phiếu hoàn thành</Text>
                        </View>

                        <View style={[styles.statsKpiCard, { borderColor: '#bbf7d0' }]}>
                            <Text style={styles.statsKpiLabel}>Tỷ lệ thành công</Text>
                            <Text style={[styles.statsKpiValue, { color: '#16a34a' }]}>
                                {statsKPIs.rate}%
                            </Text>
                            <Text style={styles.statsKpiSub}>Đúng tiến độ</Text>
                        </View>
                    </View>

                    {/* Nút chia sẻ báo cáo */}
                    <TouchableOpacity
                        style={styles.shareReportBtn}
                        onPress={handleShareStats}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="share-social-outline" size={17} color="#ffffff" />
                        <Text style={styles.shareReportBtnText}>Chia sẻ báo cáo thống kê</Text>
                    </TouchableOpacity>

                    {/* Danh sách nhật ký phiếu bảo trì trong kỳ */}
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Lịch sử ca bảo trì ({statsHistory.length})</Text>
                    </View>

                    {statsHistory.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="calendar-outline" size={44} color="#cbd5e1" />
                            <Text style={styles.emptyText}>Không có ca bảo trì nào trong kỳ này</Text>
                        </View>
                    ) : (
                        statsHistory.map((item) => {
                            const isDone = item.status === 'done' || item.status === 'resolved';
                            return (
                                <View key={item.id} style={styles.historyCard}>
                                    <View style={styles.historyHeader}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.historyField}>{item.fieldName || item.field_name}</Text>
                                            <Text style={styles.historyCategory}>{item.category}</Text>
                                        </View>
                                        <View
                                            style={[
                                                styles.statusBadge,
                                                isDone ? styles.statusBadgeActive : styles.statusBadgeLocked
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.statusBadgeText,
                                                    isDone ? styles.statusBadgeTextActive : styles.statusBadgeTextLocked
                                                ]}
                                            >
                                                {isDone ? 'Đã sửa xong' : 'Đang xử lý'}
                                            </Text>
                                        </View>
                                    </View>

                                    <Text style={styles.historyDesc}>{item.description}</Text>

                                    <View style={styles.historyFooter}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.historyMeta}>
                                                Ngày: {formatDateTime(item.resolved_at || item.created_at || item.createdAt)}
                                            </Text>
                                            <Text style={styles.historyMeta}>
                                                Người báo: {item.reportedBy || item.reported_by_name || 'Kỹ thuật'}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            {isDone ? (
                                                <Text style={styles.historyCostDone}>
                                                    Thực chi: {formatCurrency(item.cost)} đ
                                                </Text>
                                            ) : (
                                                <Text style={styles.historyCostEst}>
                                                    Dự kiến: {formatCurrency(item.estimatedCost || item.estimated_cost)} đ
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            );
                        })
                    )}
                    <View style={{ height: 40 }} />
                </ScrollView>
            )}

            {/* ================= MODAL 1: TẠO PHIẾU BẢO TRÌ MỚI ================= */}
            <Modal
                visible={showCreateModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowCreateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                <Ionicons name="construct" size={20} color="#006b2c" />
                                <Text style={styles.modalTitle}>Báo sự cố & Lập phiếu bảo trì</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowCreateModal(false)}>
                                <Ionicons name="close" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Chọn sân bóng: Wrap for mobile */}
                            <Text style={styles.formLabel}>Sân bóng cần bảo trì *</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                {fields.map((f) => {
                                    const isSel = createForm.fieldName === f.field_name;
                                    return (
                                        <TouchableOpacity
                                            key={f.id}
                                            style={[styles.chip, isSel && styles.chipActive]}
                                            onPress={() => setCreateForm((prev) => ({ ...prev, fieldName: f.field_name }))}
                                        >
                                            <Text style={[styles.chipText, isSel && styles.chipTextActive]}>
                                                {f.field_name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Hạng mục sự cố: Wrap for mobile */}
                            <Text style={styles.formLabel}>Hạng mục sự cố *</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                {CATEGORIES.map((cat) => {
                                    const isSel = createForm.category === cat;
                                    return (
                                        <TouchableOpacity
                                            key={cat}
                                            style={[styles.chip, isSel && styles.chipActive]}
                                            onPress={() => setCreateForm((prev) => ({ ...prev, category: cat }))}
                                        >
                                            <Text style={[styles.chipText, isSel && styles.chipTextActive]}>
                                                {cat}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Mức độ ưu tiên */}
                            <Text style={styles.formLabel}>Mức độ ưu tiên *</Text>
                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                                {PRIORITIES.map((p) => {
                                    const isSel = createForm.priority === p;
                                    return (
                                        <TouchableOpacity
                                            key={p}
                                            style={[
                                                styles.prioritySelectBtn,
                                                isSel && (p === 'Khẩn cấp' ? styles.prioritySelectBtnUrgent : styles.prioritySelectBtnNormal)
                                            ]}
                                            onPress={() => setCreateForm((prev) => ({ ...prev, priority: p }))}
                                        >
                                            <Text
                                                style={[
                                                    styles.prioritySelectText,
                                                    isSel && { color: '#ffffff', fontWeight: '700' }
                                                ]}
                                            >
                                                {p}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Chi phí ước tính (nhập dấu chấm) */}
                            <Text style={styles.formLabel}>Chi phí dự kiến (VNĐ)</Text>
                            <TextInput
                                style={styles.formInput}
                                keyboardType="numeric"
                                placeholder="Ví dụ: 1.500.000"
                                placeholderTextColor="#94a3b8"
                                value={createForm.estimatedCost}
                                onChangeText={(val) =>
                                    setCreateForm((prev) => ({ ...prev, estimatedCost: formatDotNumber(val) }))
                                }
                            />

                            {/* Người báo */}
                            <Text style={styles.formLabel}>Người báo cáo</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Tên bộ phận hoặc người báo"
                                placeholderTextColor="#94a3b8"
                                value={createForm.reportedBy}
                                onChangeText={(val) => setCreateForm((prev) => ({ ...prev, reportedBy: val }))}
                            />

                            {/* Mô tả chi tiết */}
                            <Text style={styles.formLabel}>Mô tả chi tiết sự cố *</Text>
                            <TextInput
                                style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
                                multiline
                                placeholder="Ghi rõ vị trí, biểu hiện hư hỏng, thiết bị cần thay thế..."
                                placeholderTextColor="#94a3b8"
                                value={createForm.description}
                                onChangeText={(val) => setCreateForm((prev) => ({ ...prev, description: val }))}
                            />

                            {/* Toggle khóa sân ngay */}
                            <View style={styles.switchRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.switchTitle}>Khóa sân bóng ngay lập tức</Text>
                                    <Text style={styles.switchSub}>Tạm dừng nhận khách cho đến khi khắc phục xong</Text>
                                </View>
                                <Switch
                                    value={createForm.lockFieldImmediately}
                                    onValueChange={(val) =>
                                        setCreateForm((prev) => ({ ...prev, lockFieldImmediately: val }))
                                    }
                                    trackColor={{ false: '#cbd5e1', true: '#fca5a5' }}
                                    thumbColor={createForm.lockFieldImmediately ? '#dc2626' : '#f8fafc'}
                                />
                            </View>

                            {/* Nút hành động */}
                            <View style={styles.modalActionsRow}>
                                <TouchableOpacity
                                    style={styles.modalCancelBtn}
                                    onPress={() => setShowCreateModal(false)}
                                >
                                    <Text style={styles.modalCancelText}>Hủy bỏ</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.modalSubmitBtn}
                                    onPress={handleCreateIssue}
                                >
                                    <Text style={styles.modalSubmitText}>Tạo phiếu bảo trì</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ================= MODAL 2: SỬA PHIẾU BẢO TRÌ ================= */}
            <Modal
                visible={showEditModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowEditModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                <Ionicons name="create" size={20} color="#0284c7" />
                                <Text style={styles.modalTitle}>Chỉnh sửa phiếu bảo trì</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowEditModal(false)}>
                                <Ionicons name="close" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        {editingIssue && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <Text style={styles.formLabel}>Sân bóng</Text>
                                <TextInput
                                    style={[styles.formInput, { backgroundColor: '#f1f5f9' }]}
                                    editable={false}
                                    value={editingIssue.fieldName}
                                />

                                <Text style={styles.formLabel}>Hạng mục sự cố</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                    {CATEGORIES.map((cat) => {
                                        const isSel = editingIssue.category === cat;
                                        return (
                                            <TouchableOpacity
                                                key={cat}
                                                style={[styles.chip, isSel && styles.chipActive]}
                                                onPress={() => setEditingIssue((prev) => ({ ...prev, category: cat }))}
                                            >
                                                <Text style={[styles.chipText, isSel && styles.chipTextActive]}>
                                                    {cat}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                <Text style={styles.formLabel}>Trạng thái tiến độ</Text>
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                    {[
                                        { key: 'pending', label: 'Chờ sửa' },
                                        { key: 'fixing', label: 'Đang sửa' },
                                        { key: 'done', label: 'Đã xong' }
                                    ].map((st) => {
                                        const isSel = editingIssue.status === st.key;
                                        return (
                                            <TouchableOpacity
                                                key={st.key}
                                                style={[styles.chip, isSel && styles.chipActive]}
                                                onPress={() => setEditingIssue((prev) => ({ ...prev, status: st.key }))}
                                            >
                                                <Text style={[styles.chipText, isSel && styles.chipTextActive]}>
                                                    {st.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                <Text style={styles.formLabel}>Chi phí dự kiến (VNĐ)</Text>
                                <TextInput
                                    style={styles.formInput}
                                    keyboardType="numeric"
                                    value={editingIssue.estimatedCost}
                                    onChangeText={(val) =>
                                        setEditingIssue((prev) => ({ ...prev, estimatedCost: formatDotNumber(val) }))
                                    }
                                />

                                <Text style={styles.formLabel}>Chi phí thực tế (VNĐ)</Text>
                                <TextInput
                                    style={styles.formInput}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    value={editingIssue.cost}
                                    onChangeText={(val) =>
                                        setEditingIssue((prev) => ({ ...prev, cost: formatDotNumber(val) }))
                                    }
                                />

                                <Text style={styles.formLabel}>Mô tả sự cố *</Text>
                                <TextInput
                                    style={[styles.formInput, { height: 75, textAlignVertical: 'top' }]}
                                    multiline
                                    value={editingIssue.description}
                                    onChangeText={(val) =>
                                        setEditingIssue((prev) => ({ ...prev, description: val }))
                                    }
                                />

                                <View style={styles.modalActionsRow}>
                                    <TouchableOpacity
                                        style={styles.modalCancelBtn}
                                        onPress={() => setShowEditModal(false)}
                                    >
                                        <Text style={styles.modalCancelText}>Hủy</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.modalSubmitBtn, { backgroundColor: '#0284c7' }]}
                                        onPress={handleSaveEditIssue}
                                    >
                                        <Text style={styles.modalSubmitText}>Lưu thay đổi</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ================= MODAL 3: XÁC NHẬN SỬA XONG (XÓA CHẤM ĐỎ) ================= */}
            <Modal
                visible={showRepairModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowRepairModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                <Ionicons name="checkmark-done-circle" size={22} color="#15803d" />
                                <Text style={styles.modalTitle}>Xác nhận sửa xong sự cố</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowRepairModal(false)}>
                                <Ionicons name="close" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.repairConfirmText}>
                            {repairingIssue
                                ? `Bạn đang xác nhận sửa xong phiếu "${repairingIssue.category}" tại ${repairingIssue.fieldName || repairingIssue.field_name}.`
                                : `Bạn đang xác nhận sửa xong TOÀN BỘ sự cố tại ${repairingField?.field_name}. Chấm đỏ cảnh báo sự cố sẽ được gỡ bỏ.`}
                        </Text>

                        {/* Chi phí thực tế đã sửa */}
                        <Text style={styles.formLabel}>Chi phí thực tế hoàn thành (VNĐ)</Text>
                        <TextInput
                            style={[styles.formInput, { fontSize: 16, fontWeight: '700', color: '#15803d' }]}
                            keyboardType="numeric"
                            placeholder="Nhập số tiền thực tế..."
                            placeholderTextColor="#94a3b8"
                            value={actualCostInput}
                            onChangeText={(val) => setActualCostInput(formatDotNumber(val))}
                        />
                        <Text style={styles.inputHelper}>
                            * Mặc định điền theo chi phí ước tính, bạn có thể chỉnh sửa theo hóa đơn thực tế.
                        </Text>

                        {/* Tùy chọn mở lại sân */}
                        {repairingField?.is_available === false && (
                            <View style={styles.switchRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.switchTitle}>Mở khóa sân bóng đón khách</Text>
                                    <Text style={styles.switchSub}>Chuyển sân từ BẢO TRÌ sang SẴN SÀNG ĐÓN KHÁCH</Text>
                                </View>
                                <Switch
                                    value={autoReopenField}
                                    onValueChange={setAutoReopenField}
                                    trackColor={{ false: '#cbd5e1', true: '#a7f3d0' }}
                                    thumbColor={autoReopenField ? '#006b2c' : '#f8fafc'}
                                />
                            </View>
                        )}

                        <View style={styles.modalActionsRow}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setShowRepairModal(false)}
                            >
                                <Text style={styles.modalCancelText}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalSubmitBtn, { backgroundColor: '#15803d' }]}
                                onPress={handleConfirmRepairDone}
                            >
                                <Text style={styles.modalSubmitText}>Hoàn tất sửa xong</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ================= MODAL 4: XEM CHI TIẾT SÂN BÓNG ================= */}
            <Modal
                visible={showDetailModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowDetailModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '90%' }]}>
                        {selectedPitch && (
                            <>
                                <View style={styles.modalHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.modalTitle}>{selectedPitch.field_name}</Text>
                                        <Text style={styles.modalSubtitle}>
                                            {selectedPitch.field_type || 'Sân cỏ nhân tạo'} •{' '}
                                            {selectedPitch.is_available === false ? 'Đang khóa' : 'Sẵn sàng đón khách'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowDetailModal(false)}>
                                        <Ionicons name="close" size={20} color="#64748b" />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {/* 4 Mini KPI stats */}
                                    {(() => {
                                        const pIssues = getPitchIssues(selectedPitch);
                                        const pActive = getPitchActiveIssues(selectedPitch);
                                        const pDone = pIssues.filter((i) => i.status === 'done' || i.status === 'resolved');
                                        const pEstCost = getPitchEstimatedCost(selectedPitch);

                                        return (
                                            <View style={styles.detailKpiGrid}>
                                                <View style={styles.detailKpiBox}>
                                                    <Text style={styles.detailKpiNum}>{pIssues.length}</Text>
                                                    <Text style={styles.detailKpiLabel}>Tổng phiếu</Text>
                                                </View>
                                                <View style={styles.detailKpiBox}>
                                                    <Text style={[styles.detailKpiNum, { color: '#dc2626' }]}>
                                                        {pActive.length}
                                                    </Text>
                                                    <Text style={styles.detailKpiLabel}>Chưa sửa</Text>
                                                </View>
                                                <View style={styles.detailKpiBox}>
                                                    <Text style={[styles.detailKpiNum, { color: '#16a34a' }]}>
                                                        {pDone.length}
                                                    </Text>
                                                    <Text style={styles.detailKpiLabel}>Đã sửa</Text>
                                                </View>
                                                <View style={styles.detailKpiBox}>
                                                    <Text style={[styles.detailKpiNum, { color: '#006b2c', fontSize: 13 }]}>
                                                        {formatCurrency(pEstCost)} đ
                                                    </Text>
                                                    <Text style={styles.detailKpiLabel}>Dự kiến</Text>
                                                </View>
                                            </View>
                                        );
                                    })()}

                                    {/* Danh sách phiếu của sân */}
                                    <Text style={[styles.sectionTitle, { marginTop: 12, marginBottom: 8 }]}>
                                        Danh sách phiếu bảo trì sân
                                    </Text>

                                    {getPitchIssues(selectedPitch).length === 0 ? (
                                        <View style={styles.emptyContainer}>
                                            <Ionicons name="checkmark-circle-outline" size={38} color="#10b981" />
                                            <Text style={styles.emptyText}>Sân hoạt động hoàn hảo, chưa có sự cố nào</Text>
                                        </View>
                                    ) : (
                                        getPitchIssues(selectedPitch).map((issue) => {
                                            const isDone = issue.status === 'done' || issue.status === 'resolved';
                                            const isFixing = issue.status === 'fixing';

                                            return (
                                                <View key={issue.id} style={styles.ticketCard}>
                                                    <View style={styles.ticketHeader}>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.ticketCategory}>{issue.category}</Text>
                                                            <Text style={styles.ticketMeta}>
                                                                {issue.createdAt || formatDateTime(issue.created_at)} •{' '}
                                                                {issue.reportedBy || issue.reported_by_name || 'Kỹ thuật'}
                                                            </Text>
                                                        </View>
                                                        <View
                                                            style={[
                                                                styles.statusBadge,
                                                                isDone
                                                                    ? styles.statusBadgeActive
                                                                    : isFixing
                                                                    ? { backgroundColor: '#fef3c7', borderColor: '#fde047' }
                                                                    : styles.statusBadgeLocked
                                                            ]}
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.statusBadgeText,
                                                                    isDone
                                                                        ? styles.statusBadgeTextActive
                                                                        : isFixing
                                                                        ? { color: '#b45309' }
                                                                        : styles.statusBadgeTextLocked
                                                                ]}
                                                            >
                                                                {isDone ? 'Đã sửa xong' : isFixing ? 'Đang sửa' : 'Chờ sửa'}
                                                            </Text>
                                                        </View>
                                                    </View>

                                                    <Text style={styles.ticketDesc}>{issue.description}</Text>

                                                    <View style={styles.ticketCostRow}>
                                                        <Text style={styles.ticketCostText}>
                                                            {isDone
                                                                ? `Thực chi: ${formatCurrency(issue.cost)} đ`
                                                                : `Dự kiến: ${formatCurrency(issue.estimatedCost || issue.estimated_cost)} đ`}
                                                        </Text>
                                                    </View>

                                                    {/* Hàng nút hành động của phiếu */}
                                                    <View style={styles.ticketActionsRow}>
                                                        {!isDone && (
                                                            <>
                                                                {!isFixing && (
                                                                    <TouchableOpacity
                                                                        style={[styles.ticketBtn, { backgroundColor: '#fef3c7' }]}
                                                                        onPress={() => handleSetFixingStatus(issue.id)}
                                                                    >
                                                                        <Ionicons name="hammer-outline" size={13} color="#b45309" />
                                                                        <Text style={{ fontSize: 11, color: '#b45309', fontWeight: '600' }}>
                                                                            Đang sửa
                                                                        </Text>
                                                                    </TouchableOpacity>
                                                                )}
                                                                <TouchableOpacity
                                                                    style={[styles.ticketBtn, { backgroundColor: '#dcfce7' }]}
                                                                    onPress={() => {
                                                                        setShowDetailModal(false);
                                                                        openRepairModal(selectedPitch, issue);
                                                                    }}
                                                                >
                                                                    <Ionicons name="checkmark-done" size={13} color="#15803d" />
                                                                    <Text style={{ fontSize: 11, color: '#15803d', fontWeight: '700' }}>
                                                                        Sửa xong
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            </>
                                                        )}

                                                        <TouchableOpacity
                                                            style={[styles.ticketBtn, { backgroundColor: '#f1f5f9' }]}
                                                            onPress={() => {
                                                                setShowDetailModal(false);
                                                                openEditModal(issue);
                                                            }}
                                                        >
                                                            <Ionicons name="pencil-outline" size={13} color="#475569" />
                                                            <Text style={{ fontSize: 11, color: '#475569' }}>Sửa</Text>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={[styles.ticketBtn, { backgroundColor: '#fee2e2' }]}
                                                            onPress={() => handleDeleteIssue(issue.id)}
                                                        >
                                                            <Ionicons name="trash-outline" size={13} color="#dc2626" />
                                                            <Text style={{ fontSize: 11, color: '#dc2626' }}>Xóa</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            );
                                        })
                                    )}
                                </ScrollView>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f7f9fb'
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? 12 : 10,
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
        flex: 1
    },
    iconCircleBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f2f4f6',
        alignItems: 'center',
        justifyContent: 'center',
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
        color: '#111827',
        marginTop: 2,
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
    topBarRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
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
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        gap: 10
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 9,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        gap: 6
    },
    tabButtonActive: {
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0'
    },
    tabButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b'
    },
    tabButtonTextActive: {
        color: '#006b2c',
        fontWeight: '700'
    },
    tabBadge: {
        backgroundColor: '#dc2626',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 1
    },
    tabBadgeText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '700'
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 12
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 12,
        gap: 8
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
        padding: 0
    },
    kpiRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14
    },
    kpiCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1
    },
    kpiTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4
    },
    kpiLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500'
    },
    kpiValue: {
        fontSize: 18,
        fontWeight: '800'
    },
    kpiSub: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 2
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b'
    },
    sectionCount: {
        fontSize: 12,
        fontWeight: '600',
        color: '#006b2c',
        backgroundColor: '#ecfdf5',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10
    },
    pitchCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1
    },
    pitchCardNormal: {
        borderColor: '#e2e8f0'
    },
    pitchCardWarning: {
        borderColor: '#fca5a5',
        borderLeftWidth: 4,
        borderLeftColor: '#dc2626'
    },
    pitchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    pitchNameWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    pitchIconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#ecfdf5',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#a7f3d0'
    },
    pitchIconBoxWarning: {
        backgroundColor: '#fef2f2',
        borderColor: '#fca5a5'
    },
    pitchName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a'
    },
    pitchType: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 1
    },
    pulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#dc2626'
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1
    },
    statusBadgeActive: {
        backgroundColor: '#dcfce7',
        borderColor: '#86efac'
    },
    statusBadgeLocked: {
        backgroundColor: '#fee2e2',
        borderColor: '#fca5a5'
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '700'
    },
    statusBadgeTextActive: {
        color: '#15803d'
    },
    statusBadgeTextLocked: {
        color: '#dc2626'
    },
    issueBanner: {
        backgroundColor: '#fff1f2',
        borderRadius: 10,
        padding: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#fecdd3'
    },
    issueBannerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4
    },
    issueCategory: {
        fontSize: 13,
        fontWeight: '700',
        color: '#991b1b'
    },
    priorityTag: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6
    },
    priorityTagUrgent: {
        backgroundColor: '#dc2626'
    },
    priorityTagNormal: {
        backgroundColor: '#f59e0b'
    },
    priorityTagText: {
        fontSize: 10,
        color: '#ffffff',
        fontWeight: '700'
    },
    issueDesc: {
        fontSize: 12,
        color: '#7f1d1d',
        marginBottom: 6
    },
    issueMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#fecdd3',
        paddingTop: 5
    },
    issueReporter: {
        fontSize: 10,
        color: '#991b1b'
    },
    issueEstCost: {
        fontSize: 11,
        fontWeight: '700',
        color: '#b91c1c'
    },
    goodConditionBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f0fdf4',
        padding: 9,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#bbf7d0',
        marginBottom: 10
    },
    goodConditionText: {
        fontSize: 12,
        color: '#15803d',
        fontWeight: '600'
    },
    pitchActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 10
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1
    },
    btnDetail: {
        backgroundColor: '#f8fafc',
        borderColor: '#cbd5e1'
    },
    btnDetailText: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '600'
    },
    btnRepairDone: {
        backgroundColor: '#ecfdf5',
        borderColor: '#86efac'
    },
    btnRepairDoneText: {
        fontSize: 12,
        color: '#15803d',
        fontWeight: '700'
    },
    btnLock: {
        backgroundColor: '#fff1f2',
        borderColor: '#fca5a5'
    },
    btnLockText: {
        color: '#dc2626'
    },
    btnUnlock: {
        backgroundColor: '#f0fdf4',
        borderColor: '#86efac'
    },
    btnUnlockText: {
        color: '#006b2c'
    },
    actionBtnText: {
        fontSize: 12,
        fontWeight: '700'
    },
    filterGroup: {
        marginBottom: 12
    },
    filterGroupLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 6
    },
    rangePillRow: {
        flexDirection: 'row',
        gap: 8
    },
    rangePill: {
        flex: 1,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        alignItems: 'center'
    },
    rangePillActive: {
        backgroundColor: '#006b2c'
    },
    rangePillText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600'
    },
    rangePillTextActive: {
        color: '#ffffff',
        fontWeight: '700'
    },
    fieldPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        marginRight: 6
    },
    fieldPillActive: {
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#006b2c'
    },
    fieldPillText: {
        fontSize: 12,
        color: '#64748b'
    },
    fieldPillTextActive: {
        color: '#006b2c',
        fontWeight: '700'
    },
    statsKpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 14
    },
    statsKpiCard: {
        width: '48.5%',
        backgroundColor: '#ffffff',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1
    },
    statsKpiLabel: {
        fontSize: 11,
        color: '#64748b'
    },
    statsKpiValue: {
        fontSize: 16,
        fontWeight: '800',
        marginTop: 4
    },
    statsKpiSub: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 2
    },
    shareReportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#006b2c',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 6,
        marginBottom: 16
    },
    shareReportBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700'
    },
    historyCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6
    },
    historyField: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a'
    },
    historyCategory: {
        fontSize: 12,
        color: '#64748b'
    },
    historyDesc: {
        fontSize: 12,
        color: '#334155',
        marginBottom: 8
    },
    historyFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 6
    },
    historyMeta: {
        fontSize: 10,
        color: '#94a3b8'
    },
    historyCostDone: {
        fontSize: 12,
        fontWeight: '700',
        color: '#15803d'
    },
    historyCostEst: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ea580c'
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 30
    },
    emptyText: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 8
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 18,
        width: '100%',
        maxWidth: 580,
        maxHeight: '88%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 10,
        marginBottom: 12
    },
    modalCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a'
    },
    modalSubtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2
    },
    formLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6
    },
    formInput: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 9,
        fontSize: 13,
        color: '#0f172a',
        marginBottom: 12,
        backgroundColor: '#ffffff'
    },
    inputHelper: {
        fontSize: 11,
        color: '#64748b',
        fontStyle: 'italic',
        marginBottom: 12
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    chipActive: {
        backgroundColor: '#ecfdf5',
        borderColor: '#006b2c'
    },
    chipText: {
        fontSize: 12,
        color: '#475569'
    },
    chipTextActive: {
        color: '#006b2c',
        fontWeight: '700'
    },
    prioritySelectBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        alignItems: 'center'
    },
    prioritySelectBtnUrgent: {
        backgroundColor: '#dc2626'
    },
    prioritySelectBtnNormal: {
        backgroundColor: '#f59e0b'
    },
    prioritySelectText: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '600'
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 10,
        borderRadius: 10,
        marginBottom: 14
    },
    switchTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b'
    },
    switchSub: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 1
    },
    modalActionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
        marginBottom: 16
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 11,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        alignItems: 'center'
    },
    modalCancelText: {
        fontSize: 13,
        color: '#475569',
        fontWeight: '700'
    },
    modalSubmitBtn: {
        flex: 2,
        paddingVertical: 11,
        borderRadius: 10,
        backgroundColor: '#006b2c',
        alignItems: 'center'
    },
    modalSubmitText: {
        fontSize: 13,
        color: '#ffffff',
        fontWeight: '700'
    },
    repairConfirmText: {
        fontSize: 13,
        color: '#334155',
        lineHeight: 18,
        marginBottom: 12
    },
    detailKpiGrid: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12
    },
    detailKpiBox: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    detailKpiNum: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a'
    },
    detailKpiLabel: {
        fontSize: 10,
        color: '#64748b',
        marginTop: 2
    },
    ticketCard: {
        backgroundColor: '#ffffff',
        borderRadius: 10,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    ticketHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4
    },
    ticketCategory: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b'
    },
    ticketMeta: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 1
    },
    ticketDesc: {
        fontSize: 12,
        color: '#475569',
        marginBottom: 6
    },
    ticketCostRow: {
        marginBottom: 8
    },
    ticketCostText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#006b2c'
    },
    ticketActionsRow: {
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'flex-end',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 6
    },
    ticketBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6
    }
});
