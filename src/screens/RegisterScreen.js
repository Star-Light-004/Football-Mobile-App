import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerApi } from '../api/authApi';

const DISTRICTS = [
    'Quận Hải Châu (Sân Chuyên Việt, Đầm Sen...)',
    'Quận Sơn Trà (Sân Mỹ Khê, Tuyên Sơn...)',
    'Quận Thanh Khê (Sân Duy Tân, Thể Thao...)',
    'Quận Cẩm Lệ & Ngũ Hành Sơn'
];

export default function RegisterScreen({ navigation }) {
    const [fullname, setFullname] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [selectedDistrict, setSelectedDistrict] = useState(DISTRICTS[0]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleRegister = async () => {
        setErrorMessage('');
        setSuccessMessage('');

        if (!fullname.trim() || !phone.trim() || !password) {
            setErrorMessage('Vui lòng điền đầy đủ các thông tin bắt buộc (*).');
            return;
        }

        if (fullname.trim().length < 2) {
            setErrorMessage('Họ và tên phải có tối thiểu 2 ký tự.');
            return;
        }

        const cleanPhone = phone.replace(/[\s\.\-\(\)]/g, '');
        if (!/^(0[35789])[0-9]{8}$/.test(cleanPhone)) {
            setErrorMessage('Số điện thoại không hợp lệ (gồm 10 số, bắt đầu bằng 03, 05, 07, 08, 09).');
            return;
        }

        if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setErrorMessage('Email không đúng định dạng.');
            return;
        }

        if (password.length < 8) {
            setErrorMessage('Mật khẩu phải có tối thiểu 8 ký tự.');
            return;
        }

        if (confirmPassword && password !== confirmPassword) {
            setErrorMessage('Xác nhận mật khẩu không trùng khớp.');
            return;
        }

        setLoading(true);
        try {
            await registerApi({
                username: cleanPhone,
                fullname: fullname.trim(),
                phone: cleanPhone,
                email: email.trim().toLowerCase() || `${cleanPhone}@pulse.vn`,
                password: password,
            });

            setSuccessMessage('Đăng ký tài khoản thành công! Đang chuyển đến màn hình Đăng nhập...');
            setTimeout(() => {
                navigation.replace('Login');
            }, 1000);
        } catch (error) {
            const message = error.response?.data?.error 
                || error.response?.data?.message 
                || error.message 
                || 'Không thể đăng ký tài khoản. Vui lòng thử lại sau.';
            setErrorMessage(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
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

                    <View style={styles.topHeaderBrand}>
                        <View style={styles.topLogoIcon}>
                            <Ionicons name="football" size={16} color="#ffffff" />
                        </View>
                        <Text style={styles.topBrandName}>Sân Bóng Hải Châu</Text>
                    </View>

                    <View style={{ width: 36 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Hero Branding & Identity */}
                    <View style={styles.heroBrandWrap}>
                        <View style={styles.heroLogoOuter}>
                            <View style={styles.heroLogoGrad}>
                                <Ionicons name="football" size={32} color="#ffffff" />
                            </View>
                            <View style={styles.pulseHeartBadge}>
                                <Ionicons name="heart" size={13} color="#006b2c" />
                            </View>
                        </View>

                        <View style={styles.brandTitleRow}>
                            <Text style={styles.heroBrandTitle}>Sân Bóng Hải Châu</Text>
                            <View style={styles.cityPill}>
                                <Text style={styles.cityPillText}>Đà Nẵng</Text>
                            </View>
                        </View>
                        <Text style={styles.heroBrandSlogan}>
                            Đam mê trên từng đường chuyền • Đặt sân siêu tốc tại Đà Nẵng
                        </Text>
                    </View>

                    {/* Segmented Tab Switcher */}
                    <View style={styles.segmentedContainer}>
                        <TouchableOpacity
                            style={styles.segmentBtn}
                            onPress={() => navigation.navigate('Login')}
                        >
                            <Text style={styles.segmentText}>Đăng nhập</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.segmentBtn, styles.segmentBtnActive]}>
                            <Text style={[styles.segmentText, styles.segmentTextActive]}>Đăng ký tài khoản</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Main Form Panel */}
                    <View style={styles.formCard}>
                        {errorMessage ? (
                            <View style={styles.errorAlert}>
                                <Ionicons name="alert-circle" size={16} color="#b91c1c" style={{ marginRight: 6 }} />
                                <Text style={styles.errorAlertText}>{errorMessage}</Text>
                            </View>
                        ) : null}

                        {successMessage ? (
                            <View style={styles.successAlert}>
                                <Ionicons name="checkmark-circle" size={16} color="#15803d" style={{ marginRight: 6 }} />
                                <Text style={styles.successAlertText}>{successMessage}</Text>
                            </View>
                        ) : null}

                        {/* Fullname */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>
                                Họ và tên cầu thủ <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <View style={styles.inputFieldWrapper}>
                                <Ionicons name="person-outline" size={18} color="#6b7280" style={styles.inputLeftIcon} />
                                <TextInput
                                    style={styles.inputField}
                                    placeholder="Nguyễn Văn A"
                                    placeholderTextColor="#9ca3af"
                                    value={fullname}
                                    onChangeText={setFullname}
                                />
                            </View>
                        </View>

                        {/* Phone */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>
                                Số điện thoại nhận mã sân <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <View style={styles.inputFieldWrapper}>
                                <Ionicons name="call-outline" size={18} color="#6b7280" style={styles.inputLeftIcon} />
                                <TextInput
                                    style={styles.inputField}
                                    placeholder="0905 123 456"
                                    placeholderTextColor="#9ca3af"
                                    keyboardType="phone-pad"
                                    value={phone}
                                    onChangeText={setPhone}
                                />
                            </View>
                        </View>

                        {/* Email */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Email (nhận hóa đơn & vé QR)</Text>
                            <View style={styles.inputFieldWrapper}>
                                <Ionicons name="mail-outline" size={18} color="#6b7280" style={styles.inputLeftIcon} />
                                <TextInput
                                    style={styles.inputField}
                                    placeholder="name@gmail.com"
                                    placeholderTextColor="#9ca3af"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>
                        </View>

                        {/* Password */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>
                                Mật khẩu mới <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <View style={styles.inputFieldWrapper}>
                                <Ionicons name="lock-closed-outline" size={18} color="#6b7280" style={styles.inputLeftIcon} />
                                <TextInput
                                    style={[styles.inputField, { paddingRight: 40 }]}
                                    placeholder="Tối thiểu 6 ký tự"
                                    placeholderTextColor="#9ca3af"
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <TouchableOpacity
                                    style={styles.eyeBtn}
                                    onPress={() => setShowPassword(!showPassword)}
                                >
                                    <Ionicons
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={18}
                                        color="#6b7280"
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Preferred District */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Khu vực ưa thích (Đà Nẵng)</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
                                {DISTRICTS.map((d, i) => {
                                    const isSel = selectedDistrict === d;
                                    return (
                                        <TouchableOpacity
                                            key={i}
                                            style={[styles.districtChip, isSel && styles.districtChipActive]}
                                            onPress={() => setSelectedDistrict(d)}
                                        >
                                            <Ionicons
                                                name="location"
                                                size={13}
                                                color={isSel ? '#ffffff' : '#006b2c'}
                                                style={{ marginRight: 4 }}
                                            />
                                            <Text style={[styles.districtChipText, isSel && styles.districtChipTextActive]}>
                                                {d.split(' (')[0]}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        {/* Primary CTA Button */}
                        <TouchableOpacity
                            style={styles.ctaSubmitBtn}
                            onPress={handleRegister}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <>
                                    <Text style={styles.ctaSubmitBtnText}>Đăng ký & Nhận 50K ưu đãi</Text>
                                    <Ionicons name="football" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Member Perks Card (Moments of Delight) */}
                    <View style={styles.perksCard}>
                        <View style={styles.perksHeader}>
                            <Ionicons name="medal" size={20} color="#006b2c" style={{ marginRight: 6 }} />
                            <Text style={styles.perksHeaderText}>ĐẶC QUYỀN HỘI VIÊN SÂN BÓNG HẢI CHÂU</Text>
                        </View>

                        <View style={styles.perksList}>
                            <View style={styles.perkItem}>
                                <View style={[styles.perkIconBox, { backgroundColor: '#fef3c7' }]}>
                                    <Ionicons name="star" size={14} color="#b45309" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.perkTitle}>Tích trận thăng hạng 'Cầu thủ Vàng'</Text>
                                    <Text style={styles.perkDesc}>Nhận ưu đãi 15% giờ vàng và áo thi đấu độc quyền.</Text>
                                </View>
                            </View>

                            <View style={styles.perkItem}>
                                <View style={[styles.perkIconBox, { backgroundColor: '#dcfce7' }]}>
                                    <Ionicons name="shield-checkmark" size={14} color="#15803d" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.perkTitle}>Hoàn cọc 50% linh hoạt</Text>
                                    <Text style={styles.perkDesc}>Huỷ sân trước 12 tiếng không mất cọc, bảo lưu tín dụng trận sau.</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>
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
    topHeaderBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    topLogoIcon: {
        width: 26,
        height: 26,
        borderRadius: 8,
        backgroundColor: '#006b2c',
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBrandName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    scrollContent: {
        padding: 16,
        gap: 16,
    },

    /* Hero Brand */
    heroBrandWrap: {
        alignItems: 'center',
        paddingVertical: 10,
        gap: 8,
    },
    heroLogoOuter: {
        position: 'relative',
        marginBottom: 4,
    },
    heroLogoGrad: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: '#006b2c',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#006b2c',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 4,
    },
    pulseHeartBadge: {
        position: 'absolute',
        right: -4,
        bottom: -4,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    brandTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    heroBrandTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: -0.3,
    },
    cityPill: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    cityPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#15803d',
    },
    heroBrandSlogan: {
        fontSize: 13,
        color: '#6b7280',
        textAlign: 'center',
        maxWidth: 280,
        lineHeight: 18,
    },

    /* Segmented Tab Switcher */
    segmentedContainer: {
        flexDirection: 'row',
        backgroundColor: '#e2e8f0',
        borderRadius: 14,
        padding: 4,
    },
    segmentBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentBtnActive: {
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    segmentText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6b7280',
    },
    segmentTextActive: {
        color: '#006b2c',
        fontWeight: '700',
    },

    /* Main Form Panel */
    formCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 18,
        gap: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    errorAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fee2e2',
        padding: 10,
        borderRadius: 10,
    },
    errorAlertText: {
        flex: 1,
        fontSize: 12,
        color: '#b91c1c',
    },
    successAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        padding: 10,
        borderRadius: 10,
    },
    successAlertText: {
        flex: 1,
        fontSize: 12,
        color: '#15803d',
    },
    inputGroup: {
        gap: 6,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
    },
    requiredStar: {
        color: '#dc2626',
    },
    inputFieldWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 12,
        height: 48,
    },
    inputLeftIcon: {
        marginRight: 8,
    },
    inputField: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
    },
    eyeBtn: {
        padding: 6,
    },
    districtChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
    },
    districtChipActive: {
        backgroundColor: '#006b2c',
    },
    districtChipText: {
        fontSize: 12,
        color: '#374151',
    },
    districtChipTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    ctaSubmitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#006b2c',
        paddingVertical: 14,
        borderRadius: 14,
        marginTop: 6,
        shadowColor: '#006b2c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 3,
    },
    ctaSubmitBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },

    /* Perks Card */
    perksCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 16,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
    },
    perksHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    perksHeaderText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: 0.5,
    },
    perksList: {
        gap: 10,
    },
    perkItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    perkIconBox: {
        width: 26,
        height: 26,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    perkTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
    },
    perkDesc: {
        fontSize: 11,
        color: '#6b7280',
        marginTop: 1,
        lineHeight: 16,
    },
});
