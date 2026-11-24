import React, { useState, useContext } from 'react';
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
import { AuthContext, ADMIN_ROLES } from '../context/AuthContext';

export default function LoginScreen({ navigation }) {
    const { login } = useContext(AuthContext);
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleLogin = async () => {
        setErrorMessage('');

        if (!identifier.trim() || !password) {
            setErrorMessage('Vui lòng nhập số điện thoại hoặc email và mật khẩu.');
            return;
        }

        setLoading(true);
        try {
            await login(identifier.trim(), password);
        } catch (error) {
            const message = error.response?.data?.error 
                || error.response?.data?.message 
                || error.message 
                || 'Tài khoản hoặc mật khẩu không chính xác.';
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
                {/* Top Header */}
                <View style={styles.topHeader}>
                    <View style={styles.topHeaderBrand}>
                        <View style={styles.topLogoIcon}>
                            <Ionicons name="shield-checkmark" size={18} color="#ffffff" />
                        </View>
                        <Text style={styles.topBrandName}>Sân Bóng Hải Châu • Console</Text>
                    </View>
                    <View style={styles.headerTag}>
                        <Text style={styles.headerTagText}>NỘI BỘ QUẢN LÝ</Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Hero Identity */}
                    <View style={styles.heroBrandWrap}>
                        <View style={styles.heroLogoOuter}>
                            <Ionicons name="shield-checkmark" size={32} color="#ffffff" />
                        </View>
                        <Text style={styles.heroBrandTitle}>Cổng Quản Trị & Vận Hành</Text>
                        <Text style={styles.heroBrandSlogan}>
                            Dành riêng cho Ban Quản Lý Cụm Sân, Chủ Sân & Nhân Viên Vận Hành Ca Trực
                        </Text>
                    </View>

                    {/* Main Form Panel */}
                    <View style={styles.formCard}>
                        <Text style={styles.formCardTitle}>Đăng Nhập Tài Khoản Quản Lý</Text>

                        {errorMessage ? (
                            <View style={styles.errorAlert}>
                                <Ionicons name="alert-circle" size={16} color="#b91c1c" style={{ marginRight: 6 }} />
                                <Text style={styles.errorAlertText}>{errorMessage}</Text>
                            </View>
                        ) : null}

                        {/* Input Identifier */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Tài khoản (Email / Số điện thoại)</Text>
                            <View style={styles.inputFieldWrapper}>
                                <Ionicons name="person-outline" size={18} color="#64748b" style={styles.inputLeftIcon} />
                                <TextInput
                                    style={styles.inputField}
                                    placeholder="admin@sanbonghaichau.vn hoặc SĐT nhân viên"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={identifier}
                                    onChangeText={setIdentifier}
                                />
                            </View>
                        </View>

                        {/* Input Password */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Mật khẩu bảo mật</Text>
                            <View style={styles.inputFieldWrapper}>
                                <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={styles.inputLeftIcon} />
                                <TextInput
                                    style={[styles.inputField, { paddingRight: 40 }]}
                                    placeholder="Nhập mật khẩu quản trị"
                                    placeholderTextColor="#94a3b8"
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
                                        color="#64748b"
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Primary Submit Button */}
                        <TouchableOpacity
                            style={styles.ctaSubmitBtn}
                            onPress={handleLogin}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <>
                                    <Ionicons name="log-in-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                                    <Text style={styles.ctaSubmitBtnText}>Đăng nhập vào hệ thống</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Security Notice Footer */}
                    <View style={styles.securityNotice}>
                        <Ionicons name="shield-outline" size={14} color="#64748b" />
                        <Text style={styles.securityNoticeText}>
                            Ứng dụng phân quyền RBAC đa cấp độ • Dữ liệu mã hóa đồng bộ thời gian thực
                        </Text>
                    </View>

                    <View style={{ height: 30 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    topHeader: {
        height: 54,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    topHeaderBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    topLogoIcon: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#006b2c',
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBrandName: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f172a',
    },
    headerTag: {
        backgroundColor: '#ecfdf5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    headerTagText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#006b2c',
        letterSpacing: 0.5,
    },
    scrollContent: {
        padding: 16,
        gap: 16,
    },
    heroBrandWrap: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    heroLogoOuter: {
        width: 60,
        height: 60,
        borderRadius: 18,
        backgroundColor: '#006b2c',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        shadowColor: '#006b2c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 6,
    },
    heroBrandTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 4,
    },
    heroBrandSlogan: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
        paddingHorizontal: 12,
        lineHeight: 18,
    },
    formCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    formCardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 14,
    },
    errorAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
    },
    errorAlertText: {
        fontSize: 12,
        color: '#b91c1c',
        flex: 1,
        fontWeight: '600',
    },
    inputGroup: {
        marginBottom: 12,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 6,
    },
    inputFieldWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        paddingHorizontal: 12,
        height: 44,
    },
    inputLeftIcon: {
        marginRight: 8,
    },
    inputField: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
        padding: 0,
    },
    eyeBtn: {
        padding: 6,
    },
    ctaSubmitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#006b2c',
        borderRadius: 10,
        height: 46,
        marginTop: 6,
    },
    ctaSubmitBtnText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
    },
    securityNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 6,
    },
    securityNoticeText: {
        fontSize: 11,
        color: '#64748b',
        textAlign: 'center',
    },
});
