import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    SafeAreaView,
    Alert,
    Image,
    Modal,
    Linking,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFieldsApi } from '../api/fieldsApi';
import { createTournamentRequestApi } from '../api/tournamentsApi';
import AppConfirmDialog from '../components/AppConfirmDialog';

export default function TournamentRequestScreen({ navigation }) {
    const [fields, setFields] = useState([]);
    const [loadingFields, setLoadingFields] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [successData, setSuccessData] = useState(null);

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
    });

    const showDialog = (title, message, isError = true) => {
        setDialogConfig({
            visible: true,
            title,
            message,
            confirmText: 'Đã hiểu',
            confirmColor: isError ? '#dc2626' : '#006b2c',
            iconName: isError ? 'alert-circle' : 'checkmark-circle',
            iconColor: isError ? '#dc2626' : '#006b2c',
            isAlert: true,
            onConfirm: () => setDialogConfig((prev) => ({ ...prev, visible: false })),
        });
    };

    // Form data
    const [tournamentName, setTournamentName] = useState('');
    const [organizationName, setOrganizationName] = useState('');
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [selectedField, setSelectedField] = useState(null);

    // Format & Teams
    const [format, setFormat] = useState('cup'); // 'cup', 'round-robin', 'knockout'
    const [teamsCount, setTeamsCount] = useState(8);
    const [pitchType, setPitchType] = useState('7'); // '7' or '5'
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

    // Packages (Mặc định tick chọn hết, người dùng có thể chạm để bỏ chọn)
    const [services, setServices] = useState({
        referee: true,
        livestream: true,
        trophy: true,
        medical: true,
        sound_lights: true,
        coordinator: true,
    });

    const [notes, setNotes] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const res = await getFieldsApi();
                const list = res?.fields || res?.results || (Array.isArray(res) ? res : []);
                setFields(list);
                if (list.length > 0) setSelectedField(list[0].id);
            } catch (e) {
                console.warn('Lỗi lấy danh sách sân:', e.message);
            } finally {
                setLoadingFields(false);
            }
        })();
    }, []);

    const toggleService = (key) => {
        setServices(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Calculate matches count
    const getEstimatedMatches = () => {
        if (format === 'knockout') return teamsCount - 1;
        if (format === 'round-robin') return (teamsCount * (teamsCount - 1)) / 2;
        // Cup (groups + playoffs)
        return teamsCount === 4 ? 6 : (teamsCount === 8 ? 16 : 32);
    };

    // Calculate dynamic cost
    const getEstimatedCost = () => {
        const matches = getEstimatedMatches();
        let basePitch = matches * 400000;
        let refereeCost = services.referee ? matches * 300000 : 0;
        let livestreamCost = services.livestream ? matches * 500000 : 0;
        let trophyCost = services.trophy ? 2500000 : 0;
        let medicalCost = services.medical ? 4 * 400000 : 0;

        const totalMin = basePitch + refereeCost + livestreamCost + trophyCost + medicalCost;
        const totalMax = Math.round(totalMin * 1.3);

        const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n);
        return `${fmt(totalMin)}đ - ${fmt(totalMax)}đ`;
    };

    const handleSubmit = async () => {
        setErrorMsg('');
        if (!tournamentName.trim()) {
            setErrorMsg('Vui lòng nhập tên giải đấu');
            showDialog('Thiếu thông tin', 'Vui lòng nhập tên giải đấu');
            return;
        }
        if (!contactName.trim()) {
            setErrorMsg('Vui lòng nhập họ tên người đại diện phụ trách');
            showDialog('Thiếu thông tin', 'Vui lòng nhập họ tên người đại diện phụ trách');
            return;
        }
        if (!contactPhone.trim() || !/^[0-9]{10}$/.test(contactPhone.trim())) {
            setErrorMsg('Số điện thoại liên hệ phải đúng 10 chữ số');
            showDialog('Lỗi', 'Số điện thoại liên hệ phải đúng 10 chữ số');
            return;
        }
        if (!selectedField) {
            setErrorMsg('Vui lòng chọn sân bóng tổ chức');
            showDialog('Thiếu thông tin', 'Vui lòng chọn cụm sân bóng tổ chức');
            return;
        }

        const sDate = startDate ? startDate.trim() : '';
        const eDate = endDate ? endDate.trim() : '';
        if (!sDate || !eDate) {
            setErrorMsg('Vui lòng chọn ngày khai mạc và ngày bế mạc giải đấu');
            showDialog('Thiếu thời gian', 'Vui lòng chọn đầy đủ ngày khai mạc và ngày bế mạc giải đấu');
            return;
        }
        const todayStr = new Date().toISOString().slice(0, 10);
        if (sDate < todayStr) {
            setErrorMsg('Ngày khai mạc không được là ngày đã qua trong quá khứ');
            showDialog('Ngày không hợp lệ', 'Ngày khai mạc giải đấu không được chọn ngày đã qua trong quá khứ!');
            return;
        }
        if (eDate < sDate) {
            setErrorMsg('Ngày bế mạc phải bằng hoặc sau ngày khai mạc');
            showDialog('Ngày không hợp lệ', 'Ngày bế mạc giải đấu phải bằng hoặc sau ngày khai mạc!');
            return;
        }

        setSubmitting(true);
        try {
            const packageLabelsMap = {
                referee: 'Tổ trọng tài chuẩn VFF (Trọn gói sẵn có)',
                livestream: 'Bình luận viên & Livestream HD (Trọn gói sẵn có)',
                trophy: 'Cúp vô địch, Huy chương & Cờ lưu niệm (Trọn gói sẵn có)',
                medical: 'Túi y tế sơ cứu & Xịt giảm đau (Trọn gói sẵn có)',
                sound_lights: 'Hệ thống âm thanh & Đèn LED đêm (Trọn gói sẵn có)',
                coordinator: 'Điều phối viên & Lễ tân đón tiếp (Trọn gói sẵn có)',
            };
            const selectedPkgs = Object.keys(services).filter(k => services[k]).map(k => packageLabelsMap[k] || k);
            const payload = {
                tournament_name: tournamentName.trim(),
                organization: organizationName.trim(),
                organization_name: organizationName.trim(),
                contact_name: contactName.trim(),
                contact_phone: contactPhone.trim(),
                contact_email: contactEmail.trim(),
                field_id: selectedField,
                selected_fields_info: selectedField ? [selectedField] : [],
                start_date: startDate.trim(),
                end_date: endDate.trim() || startDate.trim(),
                expected_teams: teamsCount,
                teams_count: teamsCount,
                format: format,
                pitch_type: pitchType,
                services_requested: selectedPkgs,
                selected_packages: selectedPkgs,
                notes: notes.trim(),
            };

            const res = await createTournamentRequestApi(payload);
            setSuccessData(res || { id: `TRN-DN-${Date.now().toString().slice(-4)}` });
        } catch (error) {
            const msg = error.response?.data?.error || error.response?.data?.message || error.message || 'Lỗi gửi yêu cầu giải đấu';
            setErrorMsg(msg);
            Alert.alert('Lỗi', msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCallHotline = () => {
        Linking.openURL('tel:1900889922').catch(() => {
            Alert.alert('Thông báo', 'Không thể khởi chạy cuộc gọi trên thiết bị này');
        });
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Top Bar */}
            <View style={styles.topHeader}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                        if (navigation.canGoBack()) navigation.goBack();
                        else navigation.navigate('Main');
                    }}
                >
                    <Ionicons name="chevron-back" size={22} color="#111827" />
                </TouchableOpacity>

                <View style={styles.topHeaderCenter}>
                    <Text style={styles.topHeaderTitle}>Đăng Ký Tổ Chức Giải Đấu</Text>
                </View>

                <TouchableOpacity
                    style={styles.shareButton}
                    onPress={() => Alert.alert('Chia sẻ', 'Chia sẻ gói tổ chức giải đấu thể thao chuyên nghiệp.')}
                >
                    <Ionicons name="share-outline" size={20} color="#374151" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* 1. HERO INTRO CARD: CORPORATE & LEAGUE SERVICES */}
                <View style={styles.heroCard}>
                    <Image
                        source={{ uri: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80' }}
                        style={styles.heroBgImg}
                    />
                    <View style={styles.heroOverlay} />

                    <View style={styles.heroContent}>
                        <View style={styles.heroTopRow}>
                            <View style={styles.leagueBadge}>
                                <Ionicons name="star" size={12} color="#b45309" style={{ marginRight: 4 }} />
                                <Text style={styles.leagueBadgeText}>GIẢI ĐẤU SÂN BÓNG HẢI CHÂU</Text>
                            </View>
                            <View style={styles.cityPill}>
                                <View style={styles.cityDot} />
                                <Text style={styles.cityText}>Đà Nẵng</Text>
                            </View>
                        </View>

                        <Text style={styles.heroTitle}>Tổ Chức Giải Đấu Chuyên Nghiệp Trọn Gói</Text>
                        <Text style={styles.heroSub}>
                            Chuẩn quốc tế • Trọn gói từ tổ trọng tài VFF, cúp cờ sang trọng đến Livestream đa góc & BLV nhiệt huyết.
                        </Text>

                        {/* Trust Badge Stats */}
                        <View style={styles.trustGrid}>
                            <View style={styles.trustItem}>
                                <Text style={styles.trustNumber}>120+</Text>
                                <Text style={styles.trustLabel}>GIẢI DOANH NGHIỆP</Text>
                            </View>
                            <View style={styles.trustDivider} />
                            <View style={styles.trustItem}>
                                <Text style={styles.trustNumber}>100%</Text>
                                <Text style={styles.trustLabel}>TRỌNG TÀI VFF</Text>
                            </View>
                            <View style={styles.trustDivider} />
                            <View style={styles.trustItem}>
                                <Text style={styles.trustNumber}>2 Giờ</Text>
                                <Text style={styles.trustLabel}>PHẢN HỒI MẪU</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 2. SECTION 1: BTC INFORMATION */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionIconBox}>
                            <Ionicons name="business" size={18} color="#006b2c" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.sectionTitle}>1. Thông tin Ban tổ chức</Text>
                            <Text style={styles.sectionSubtitle}>Đơn vị chủ trì & đầu mối phụ trách giải đấu</Text>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>
                            Tên giải đấu dự kiến <Text style={styles.requiredStar}>*</Text>
                        </Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="VD: Cúp Tứ Hùng FPT Software 2026..."
                            placeholderTextColor="#9ca3af"
                            value={tournamentName}
                            onChangeText={setTournamentName}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Đơn vị / Doanh nghiệp / CLB</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="VD: FPT Software Da Nang, Techcombank..."
                            placeholderTextColor="#9ca3af"
                            value={organizationName}
                            onChangeText={setOrganizationName}
                        />
                    </View>

                    <View style={styles.twoColumnInputs}>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>
                                Người đại diện <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Nguyễn Văn A"
                                placeholderTextColor="#9ca3af"
                                value={contactName}
                                onChangeText={setContactName}
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>
                                Hotline SĐT <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="0905 123 456"
                                placeholderTextColor="#9ca3af"
                                keyboardType="phone-pad"
                                value={contactPhone}
                                onChangeText={setContactPhone}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Email nhận báo giá chi tiết</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="contact@doanhnghiep.vn"
                            placeholderTextColor="#9ca3af"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={contactEmail}
                            onChangeText={setContactEmail}
                        />
                    </View>

                    {/* Field Selection from DB */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>
                            Địa điểm / Cụm sân tổ chức <Text style={styles.requiredStar}>*</Text>
                        </Text>
                        {loadingFields ? (
                            <ActivityIndicator size="small" color="#006b2c" style={{ paddingVertical: 10 }} />
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                                {fields.map((f) => {
                                    const isSel = selectedField === f.id;
                                    return (
                                        <TouchableOpacity
                                            key={f.id}
                                            style={[styles.fieldChoiceChip, isSel && styles.fieldChoiceChipActive]}
                                            onPress={() => setSelectedField(f.id)}
                                        >
                                            <Ionicons
                                                name="football"
                                                size={14}
                                                color={isSel ? '#ffffff' : '#006b2c'}
                                                style={{ marginRight: 6 }}
                                            />
                                            <Text style={[styles.fieldChoiceText, isSel && styles.fieldChoiceTextActive]}>
                                                {f.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        )}
                    </View>
                </View>

                {/* 3. SECTION 2: SCALE & FORMAT */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionIconBox}>
                            <Ionicons name="trophy" size={18} color="#006b2c" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.sectionTitle}>2. Quy mô & Thể thức giải</Text>
                            <Text style={styles.sectionSubtitle}>Cấu hình khung thi đấu và kế hoạch tổ chức</Text>
                        </View>
                    </View>

                    {/* Tournament Format Selector */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Thể thức thi đấu</Text>
                        <View style={styles.formatSelectorRow}>
                            <TouchableOpacity
                                style={[styles.formatBtn, format === 'cup' && styles.formatBtnActive]}
                                onPress={() => setFormat('cup')}
                            >
                                <Ionicons name="trophy-outline" size={18} color={format === 'cup' ? '#006b2c' : '#374151'} />
                                <Text style={[styles.formatBtnText, format === 'cup' && styles.formatBtnTextActive]}>
                                    Chia bảng đá Cúp
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.formatBtn, format === 'round-robin' && styles.formatBtnActive]}
                                onPress={() => setFormat('round-robin')}
                            >
                                <Ionicons name="repeat-outline" size={18} color={format === 'round-robin' ? '#006b2c' : '#374151'} />
                                <Text style={[styles.formatBtnText, format === 'round-robin' && styles.formatBtnTextActive]}>
                                    Vòng tròn tính điểm
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.formatBtn, format === 'knockout' && styles.formatBtnActive]}
                                onPress={() => setFormat('knockout')}
                            >
                                <Ionicons name="flash-outline" size={18} color={format === 'knockout' ? '#006b2c' : '#374151'} />
                                <Text style={[styles.formatBtnText, format === 'knockout' && styles.formatBtnTextActive]}>
                                    Loại trực tiếp
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Team Count Selector */}
                    <View style={styles.inputGroup}>
                        <View style={styles.teamCountHeader}>
                            <Text style={styles.inputLabel}>Số lượng đội tham gia</Text>
                            <Text style={styles.estimatedMatchesText}>{getEstimatedMatches()} trận thi đấu</Text>
                        </View>
                        <View style={styles.teamCountGrid}>
                            {[4, 8, 16, 32].map((cnt) => (
                                <TouchableOpacity
                                    key={cnt}
                                    style={[styles.teamCntBtn, teamsCount === cnt && styles.teamCntBtnActive]}
                                    onPress={() => setTeamsCount(cnt)}
                                >
                                    <Text style={[styles.teamCntBtnText, teamsCount === cnt && styles.teamCntBtnTextActive]}>
                                        {cnt} đội
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Pitch Type */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Loại sân thi đấu tiêu chuẩn</Text>
                        <View style={styles.pitchTypeGrid}>
                            <TouchableOpacity
                                style={[styles.pitchTypeBtn, pitchType === '7' && styles.pitchTypeBtnActive]}
                                onPress={() => setPitchType('7')}
                            >
                                <Ionicons name="football-outline" size={20} color={pitchType === '7' ? '#006b2c' : '#374151'} />
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={[styles.pitchTypeTitle, pitchType === '7' && styles.pitchTypeTitleActive]}>
                                        Sân 7 người
                                    </Text>
                                    <Text style={styles.pitchTypeSub}>Khuyên dùng phong trào</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.pitchTypeBtn, pitchType === '5' && styles.pitchTypeBtnActive]}
                                onPress={() => setPitchType('5')}
                            >
                                <Ionicons name="grid-outline" size={20} color={pitchType === '5' ? '#006b2c' : '#374151'} />
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={[styles.pitchTypeTitle, pitchType === '5' && styles.pitchTypeTitleActive]}>
                                        Sân 5 người
                                    </Text>
                                    <Text style={styles.pitchTypeSub}>Futsal / Mini turf</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Dates */}
                    <View style={styles.twoColumnInputs}>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>Ngày khai mạc <Text style={{ color: '#dc2626' }}>*</Text></Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor="#9ca3af"
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
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>Ngày bế mạc <Text style={{ color: '#dc2626' }}>*</Text></Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor="#9ca3af"
                                value={endDate}
                                {...(Platform.OS === 'web' ? { type: 'date', min: startDate || new Date().toISOString().slice(0, 10) } : {})}
                                onChangeText={setEndDate}
                            />
                        </View>
                    </View>
                </View>

                {/* 4. SECTION 3: PREMIUM UTILITY CHECKLIST */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionIconBox}>
                            <Ionicons name="shield-checkmark" size={18} color="#006b2c" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.sectionTitle}>3. Gói tiện ích dịch vụ cao cấp</Text>
                            <Text style={styles.sectionSubtitle}>Chọn các hạng mục cần ban quản lý hỗ trợ</Text>
                        </View>
                    </View>

                    <View style={styles.serviceList}>
                        {/* Service 1: Referees */}
                        <TouchableOpacity
                            style={[styles.serviceItem, services.referee && styles.serviceItemActive]}
                            onPress={() => toggleService('referee')}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name={services.referee ? 'checkbox' : 'square-outline'}
                                size={22}
                                color={services.referee ? '#006b2c' : '#9ca3af'}
                                style={{ marginTop: 2 }}
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <View style={styles.serviceTitleRow}>
                                    <Text style={styles.serviceTitle}>Tổ Trọng tài cấp VFF</Text>
                                    <Text style={styles.servicePrice}>+300.000đ/trận</Text>
                                </View>
                                <Text style={styles.serviceDesc}>
                                    Trọng tài chính quy, điều hành nghiêm minh, thẻ phạt & biên bản chuẩn Liên đoàn.
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Service 2: Livestream */}
                        <TouchableOpacity
                            style={[styles.serviceItem, services.livestream && styles.serviceItemActive]}
                            onPress={() => toggleService('livestream')}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name={services.livestream ? 'checkbox' : 'square-outline'}
                                size={22}
                                color={services.livestream ? '#006b2c' : '#9ca3af'}
                                style={{ marginTop: 2 }}
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <View style={styles.serviceTitleRow}>
                                    <Text style={styles.serviceTitle}>Livestream Full HD & BLV</Text>
                                    <Text style={styles.servicePrice}>+500.000đ/trận</Text>
                                </View>
                                <Text style={styles.serviceDesc}>
                                    Phát trực tiếp Facebook/YouTube, bảng điểm thời gian thực, bình luận viên nhiệt huyết.
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Service 3: Trophies */}
                        <TouchableOpacity
                            style={[styles.serviceItem, services.trophy && styles.serviceItemActive]}
                            onPress={() => toggleService('trophy')}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name={services.trophy ? 'checkbox' : 'square-outline'}
                                size={22}
                                color={services.trophy ? '#006b2c' : '#9ca3af'}
                                style={{ marginTop: 2 }}
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <View style={styles.serviceTitleRow}>
                                    <Text style={styles.serviceTitle}>Bộ Cúp Vàng & Khen Thưởng</Text>
                                    <Text style={styles.servicePrice}>+2.500.000đ</Text>
                                </View>
                                <Text style={styles.serviceDesc}>
                                    Cúp kim loại mạ vàng sang trọng, huy chương Vàng/Bạc/Đồng, cờ lưu niệm & backdrop.
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Service 4: Medical */}
                        <TouchableOpacity
                            style={[styles.serviceItem, services.medical && styles.serviceItemActive]}
                            onPress={() => toggleService('medical')}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name={services.medical ? 'checkbox' : 'square-outline'}
                                size={22}
                                color={services.medical ? '#006b2c' : '#9ca3af'}
                                style={{ marginTop: 2 }}
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <View style={styles.serviceTitleRow}>
                                    <Text style={styles.serviceTitle}>Y tế & Nước uống khoáng</Text>
                                    <Text style={styles.servicePrice}>Trọn gói sẵn có</Text>
                                </View>
                                <Text style={styles.serviceDesc}>
                                    Bình xịt lạnh giảm đau tức thì, băng gạc sơ cứu, thùng nước ion khoáng ướp lạnh.
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Service 5: Sound & Lights */}
                        <TouchableOpacity
                            style={[styles.serviceItem, services.sound_lights && styles.serviceItemActive]}
                            onPress={() => toggleService('sound_lights')}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name={services.sound_lights ? 'checkbox' : 'square-outline'}
                                size={22}
                                color={services.sound_lights ? '#006b2c' : '#9ca3af'}
                                style={{ marginTop: 2 }}
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <View style={styles.serviceTitleRow}>
                                    <Text style={styles.serviceTitle}>Âm thanh & Đèn LED đêm</Text>
                                    <Text style={styles.servicePrice}>Trọn gói sẵn có</Text>
                                </View>
                                <Text style={styles.serviceDesc}>
                                    Dàn loa công suất lớn, micro khai mạc, dàn chiếu sáng LED chuẩn thi đấu ban đêm.
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Service 6: Coordinator */}
                        <TouchableOpacity
                            style={[styles.serviceItem, services.coordinator && styles.serviceItemActive]}
                            onPress={() => toggleService('coordinator')}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name={services.coordinator ? 'checkbox' : 'square-outline'}
                                size={22}
                                color={services.coordinator ? '#006b2c' : '#9ca3af'}
                                style={{ marginTop: 2 }}
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <View style={styles.serviceTitleRow}>
                                    <Text style={styles.serviceTitle}>Điều phối viên & Lễ tân đón tiếp</Text>
                                    <Text style={styles.servicePrice}>Trọn gói sẵn có</Text>
                                </View>
                                <Text style={styles.serviceDesc}>
                                    Ban thư ký ghi nhận tỉ số, bảng điểm điện tử, nhân sự hướng dẫn & hỗ trợ check-in.
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 5. SECTION 4: DYNAMIC BUDGET ESTIMATE & SLA GUARANTEE */}
                <View style={styles.budgetCard}>
                    <View style={styles.budgetTopRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="calculator-outline" size={16} color="#fbbf24" style={{ marginRight: 6 }} />
                            <Text style={styles.budgetTopLabel}>BÁO GIÁ ƯỚC TÍNH SƠ BỘ</Text>
                        </View>
                        <View style={styles.autoCalcBadge}>
                            <Text style={styles.autoCalcText}>Tự động tính toán</Text>
                        </View>
                    </View>

                    <Text style={styles.budgetDisplay}>{getEstimatedCost()}</Text>
                    <Text style={styles.budgetDesc}>
                        Đã bao gồm: Thuê cụm sân theo khung giờ vàng, trọng tài VFF, phát sóng trực tiếp, trọn bộ cúp trao giải và dịch vụ y tế.
                    </Text>

                    {/* SLA Guarantee Pill */}
                    <View style={styles.slaDivider} />
                    <View style={styles.slaRow}>
                        <Ionicons name="shield-checkmark" size={18} color="#7ffc97" style={{ marginTop: 2 }} />
                        <Text style={styles.slaText}>
                            <Text style={{ fontWeight: '700', color: '#7ffc97' }}>Cam kết hỗ trợ doanh nghiệp: </Text>
                            Ban quản lý cụm sân sẽ liên hệ tư vấn chuyên sâu, khảo sát thực địa và gửi hợp đồng mẫu chi tiết trong vòng <Text style={{ color: '#fef3c7', fontWeight: '700' }}>2 giờ làm việc</Text>.
                        </Text>
                    </View>
                </View>

                {/* Additional notes */}
                <View style={styles.sectionCard}>
                    <Text style={styles.inputLabel}>Ghi chú yêu cầu đặc biệt khác (Tùy chọn)</Text>
                    <TextInput
                        style={[styles.textInput, { height: 72, textAlignVertical: 'top' }]}
                        placeholder="VD: Yêu cầu tiệc finger food bế mạc, in ấn áo thi đấu riêng, MC lễ khai mạc..."
                        placeholderTextColor="#9ca3af"
                        multiline
                        numberOfLines={3}
                        value={notes}
                        onChangeText={setNotes}
                    />
                </View>

                {/* CTA SUBMISSION BUTTON */}
                <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <>
                            <Text style={styles.submitBtnText}>Gửi Yêu Cầu Tư Vấn Giải Đấu</Text>
                            <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
                        </>
                    )}
                </TouchableOpacity>

                {/* DIRECT HOTLINE BUTTON */}
                <TouchableOpacity style={styles.hotlineBtn} onPress={handleCallHotline}>
                    <Ionicons name="call" size={18} color="#006b2c" style={{ marginRight: 6 }} />
                    <Text style={styles.hotlineBtnText}>
                        Hotline Giải đấu: <Text style={{ fontWeight: '700', color: '#111827' }}>1900 88 99 22</Text> (Miễn phí 24/7)
                    </Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* SUCCESS MODAL */}
            <Modal
                visible={!!successData}
                transparent
                animationType="fade"
                onRequestClose={() => setSuccessData(null)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalSuccessIcon}>
                            <Ionicons name="checkmark-circle" size={44} color="#15803d" />
                        </View>
                        <Text style={styles.modalTitle}>Đã Tiếp Nhận Yêu Cầu!</Text>
                        <Text style={styles.modalDesc}>
                            Cảm ơn quý đơn vị! Chuyên viên giải đấu của <Text style={{ fontWeight: '700', color: '#006b2c' }}>Sân Bóng Hải Châu</Text> sẽ trực tiếp gọi điện tư vấn và gửi bảng dự toán qua Email trong vòng <Text style={{ fontWeight: '700', color: '#111827' }}>2 giờ</Text>.
                        </Text>

                        <View style={styles.modalMetaBox}>
                            <Text style={styles.modalMetaLine}>• Mã yêu cầu: <Text style={{ fontWeight: '700', color: '#111827' }}>{successData?.id || 'TRN-DANANG-2026'}</Text></Text>
                            <Text style={styles.modalMetaLine}>• Bộ phận phụ trách: Khối Sự Kiện & Thể Thao Doanh Nghiệp</Text>
                        </View>

                        <TouchableOpacity
                            style={styles.modalConfirmBtn}
                            onPress={() => {
                                setSuccessData(null);
                                if (navigation.canGoBack()) navigation.goBack();
                                else navigation.navigate('Main');
                            }}
                        >
                            <Text style={styles.modalConfirmText}>Hoàn tất</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* In-screen Alert/Notice Dialog */}
            <AppConfirmDialog {...dialogConfig} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f7f9fb',
    },
    topHeader: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
    },
    topHeaderCenter: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    topHeaderTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    shareButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
    },
    scrollContent: {
        padding: 16,
        gap: 16,
    },

    /* Hero Card */
    heroCard: {
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#0f172a',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
    },
    heroBgImg: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
        opacity: 0.35,
    },
    heroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
    },
    heroContent: {
        padding: 18,
        gap: 10,
    },
    heroTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    leagueBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef3c7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    leagueBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#b45309',
    },
    cityPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 14,
        gap: 5,
    },
    cityDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#7ffc97',
    },
    cityText: {
        fontSize: 11,
        color: '#7ffc97',
        fontWeight: '600',
    },
    heroTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#ffffff',
        lineHeight: 26,
    },
    heroSub: {
        fontSize: 12,
        color: '#e2e8f0',
        lineHeight: 18,
    },
    trustGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 14,
        padding: 12,
        marginTop: 6,
    },
    trustItem: {
        flex: 1,
        alignItems: 'center',
    },
    trustNumber: {
        fontSize: 16,
        fontWeight: '800',
        color: '#7ffc97',
    },
    trustLabel: {
        fontSize: 9,
        color: '#e2e8f0',
        fontWeight: '600',
        marginTop: 2,
    },
    trustDivider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },

    /* Section Cards */
    sectionCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 16,
        gap: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    sectionIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#f0fdf4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    sectionSubtitle: {
        fontSize: 11,
        color: '#6b7280',
        marginTop: 1,
    },
    inputGroup: {
        gap: 6,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
    },
    requiredStar: {
        color: '#dc2626',
    },
    textInput: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    twoColumnInputs: {
        flexDirection: 'row',
        gap: 10,
    },

    /* Field Chips */
    fieldChoiceChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    fieldChoiceChipActive: {
        backgroundColor: '#006b2c',
        borderColor: '#006b2c',
    },
    fieldChoiceText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
    },
    fieldChoiceTextActive: {
        color: '#ffffff',
    },

    /* Format Buttons */
    formatSelectorRow: {
        flexDirection: 'row',
        gap: 8,
    },
    formatBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 6,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 4,
    },
    formatBtnActive: {
        backgroundColor: '#f0fdf4',
        borderColor: '#006b2c',
    },
    formatBtnText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#374151',
        textAlign: 'center',
    },
    formatBtnTextActive: {
        color: '#006b2c',
        fontWeight: '700',
    },

    /* Teams Grid */
    teamCountHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    estimatedMatchesText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#006b2c',
    },
    teamCountGrid: {
        flexDirection: 'row',
        gap: 8,
    },
    teamCntBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    teamCntBtnActive: {
        backgroundColor: '#f0fdf4',
        borderColor: '#006b2c',
    },
    teamCntBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    teamCntBtnTextActive: {
        color: '#006b2c',
        fontWeight: '700',
    },

    /* Pitch Type Grid */
    pitchTypeGrid: {
        flexDirection: 'row',
        gap: 8,
    },
    pitchTypeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    pitchTypeBtnActive: {
        backgroundColor: '#f0fdf4',
        borderColor: '#006b2c',
    },
    pitchTypeTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
    },
    pitchTypeTitleActive: {
        color: '#006b2c',
        fontWeight: '700',
    },
    pitchTypeSub: {
        fontSize: 10,
        color: '#6b7280',
        marginTop: 1,
    },

    /* Services Checklist */
    serviceList: {
        gap: 10,
    },
    serviceItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 12,
        borderRadius: 14,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    serviceItemActive: {
        backgroundColor: '#f0fdf4',
        borderColor: '#bbf7d0',
    },
    serviceTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    serviceTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    servicePrice: {
        fontSize: 12,
        fontWeight: '700',
        color: '#006b2c',
    },
    serviceDesc: {
        fontSize: 11,
        color: '#6b7280',
        marginTop: 3,
        lineHeight: 16,
    },

    /* Budget Card */
    budgetCard: {
        borderRadius: 18,
        backgroundColor: '#0f172a',
        padding: 18,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 3,
    },
    budgetTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    budgetTopLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94a3b8',
        letterSpacing: 0.5,
    },
    autoCalcBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    autoCalcText: {
        fontSize: 10,
        color: '#7ffc97',
        fontWeight: '600',
    },
    budgetDisplay: {
        fontSize: 24,
        fontWeight: '800',
        color: '#7ffc97',
        letterSpacing: -0.5,
    },
    budgetDesc: {
        fontSize: 11,
        color: '#cbd5e1',
        lineHeight: 16,
    },
    slaDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        marginVertical: 4,
    },
    slaRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    slaText: {
        flex: 1,
        fontSize: 11,
        color: '#e2e8f0',
        lineHeight: 16,
    },

    /* CTA Buttons */
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#006b2c',
        paddingVertical: 15,
        borderRadius: 14,
        shadowColor: '#006b2c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 3,
    },
    submitBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
    hotlineBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        paddingVertical: 14,
        borderRadius: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 1,
    },
    hotlineBtnText: {
        fontSize: 13,
        color: '#374151',
    },

    /* Modal */
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        textAlign: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 5,
    },
    modalSuccessIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#dcfce7',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 8,
    },
    modalDesc: {
        fontSize: 13,
        color: '#4b5563',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 16,
    },
    modalMetaBox: {
        width: '100%',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        gap: 4,
        marginBottom: 18,
    },
    modalMetaLine: {
        fontSize: 12,
        color: '#6b7280',
    },
    modalConfirmBtn: {
        width: '100%',
        backgroundColor: '#006b2c',
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalConfirmText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
    },
});
