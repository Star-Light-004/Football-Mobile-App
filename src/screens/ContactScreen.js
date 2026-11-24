import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Linking,
    SafeAreaView,
    Alert,
    Image,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { getMyBookingsApi } from '../api/bookingsApi';
import { getFieldsApi } from '../api/fieldsApi';
import { MEDIA_URL } from '../config';

export default function ContactScreen({ navigation }) {
    const { user } = useContext(AuthContext);
    const [name, setName] = useState(user?.full_name || user?.fullname || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [details, setDetails] = useState('');
    const [bookings, setBookings] = useState([]);
    const [selectedBooking, setSelectedBooking] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [venues, setVenues] = useState([]);

    useEffect(() => {
        getFieldsApi()
            .then(res => {
                const list = res?.fields || res?.results || (Array.isArray(res) ? res : []);
                setVenues(list);
            })
            .catch(() => {});

        if (user?.id) {
            getMyBookingsApi(user.id)
                .then(data => {
                    const list = Array.isArray(data) ? data : (data?.results || []);
                    setBookings(list);
                })
                .catch(err => console.warn('Lỗi lấy danh sách đơn:', err));
        }
    }, [user]);

    const handleCallHotline = (phoneNumber = '1900889922') => {
        const clean = phoneNumber.replace(/\s+/g, '');
        Linking.openURL(`tel:${clean}`).catch(() => {
            Alert.alert('Thông báo', 'Không thể khởi chạy cuộc gọi trên thiết bị này');
        });
    };

    const handleOpenMap = (address) => {
        const query = encodeURIComponent(address || 'Đà Nẵng');
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(() => {
            Alert.alert('Thông báo', 'Không thể mở bản đồ');
        });
    };

    const handleOpenZalo = () => {
        Linking.openURL('https://zalo.me/').catch(() => {
            Alert.alert('Thông báo', 'Không thể mở liên kết Zalo');
        });
    };

    const handleOpenMessenger = () => {
        Linking.openURL('https://m.me/').catch(() => {
            Alert.alert('Thông báo', 'Không thể mở Messenger');
        });
    };

    const handleSendEmail = () => {
        Linking.openURL('mailto:hotro@sanbonghaichau.vn').catch(() => {
            Alert.alert('Thông báo', 'Không thể mở ứng dụng Email');
        });
    };

    const handleSubmitTicket = () => {
        if (!name.trim()) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ và tên của bạn');
            return;
        }
        if (!phone.trim()) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập số điện thoại liên hệ');
            return;
        }
        if (!details.trim()) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập nội dung yêu cầu hỗ trợ');
            return;
        }

        setSubmitted(true);
        Alert.alert(
            'Đã gửi yêu cầu thành công',
            'Bộ phận CSKH & Cứu hộ sân sẽ gọi lại hỗ trợ bạn trong vòng 5 phút!'
        );
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
                    <Text style={styles.topHeaderTitle}>Liên Hệ & Cứu Hộ Sân 24/7</Text>
                </View>

                <TouchableOpacity
                    style={styles.dangerHotlinePill}
                    onPress={() => handleCallHotline('1900889922')}
                >
                    <Ionicons name="call" size={13} color="#b91c1c" style={{ marginRight: 4 }} />
                    <Text style={styles.dangerHotlineText}>Hotline</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* 1. HERO BANNER: CỨU HỘ KHẨN CẤP 24/7 */}
                <View style={styles.heroRescueCard}>
                    {/* Glowing ambient lights */}
                    <View style={styles.glowTopRight} />
                    <View style={styles.glowBottomLeft} />

                    <View style={styles.heroRescueTopRow}>
                        <View style={styles.liveStatusPill}>
                            <View style={styles.livePulseDot} />
                            <Text style={styles.liveStatusText}>TRỰC TUYẾN 24/7 • TIẾP NHẬN NGAY</Text>
                        </View>
                        <Ionicons name="shield-checkmark" size={22} color="#7ffc97" />
                    </View>

                    <Text style={styles.heroRescueTitle}>Tổng Đài Cứu Hộ Sân & Hỗ Trợ 24/7</Text>
                    <Text style={styles.heroRescueSub}>Kịp thời can thiệp mọi tình huống khẩn cấp tại sân thi đấu</Text>

                    {/* Hotline Call Action Card */}
                    <View style={styles.hotlineActionCard}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.hotlineActionLabel}>ĐƯỜNG DÂY NÓNG CẤP TỐC</Text>
                            <Text style={styles.hotlineActionNumber}>1900 88 99 22</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.hotlineRoundCallBtn}
                            onPress={() => handleCallHotline('1900889922')}
                        >
                            <Ionicons name="call" size={26} color="#ffffff" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.hotlineGuaranteeRow}>
                        <Ionicons name="checkmark-circle" size={15} color="#7ffc97" style={{ marginRight: 5 }} />
                        <Text style={styles.hotlineGuaranteeText}>Miễn cước toàn mạng • Đội cứu hộ túc trực tại sân</Text>
                    </View>

                    {/* Emergency 3 Quick Scenarios */}
                    <View style={styles.scenariosGrid}>
                        <TouchableOpacity
                            style={styles.scenarioItem}
                            onPress={() => Alert.alert('Mưa ngập đổi ca', 'Nếu trời mưa lớn trước trận đấu, ban quản lý hỗ trợ đổi giờ thi đấu hoặc hoàn 100% cọc.')}
                        >
                            <Ionicons name="cloud" size={22} color="#60a5fa" />
                            <Text style={styles.scenarioTitle}>Mưa ngập</Text>
                            <Text style={styles.scenarioSub}>Đổi ca gấp</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.scenarioItem}
                            onPress={() => Alert.alert('Đồ thất lạc', 'Vui lòng liên hệ hotline để trích xuất camera an ninh và bàn giao đồ tại quầy lễ tân.')}
                        >
                            <Ionicons name="cube" size={22} color="#fbbf24" />
                            <Text style={styles.scenarioTitle}>Đồ thất lạc</Text>
                            <Text style={styles.scenarioSub}>Check camera</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.scenarioItem}
                            onPress={() => Alert.alert('Sơ cứu chấn thương', 'Tủ thuốc cấp cứu luôn có bình xịt lạnh Magicode, băng keo thể thao và túi đá chườm miễn phí.')}
                        >
                            <Ionicons name="medkit" size={22} color="#f87171" />
                            <Text style={styles.scenarioTitle}>Chấn thương</Text>
                            <Text style={styles.scenarioSub}>Xịt lạnh & băng</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 2. KÊNH HỖ TRỢ TRỰC TIẾP */}
                <View style={styles.sectionWrap}>
                    <View style={styles.sectionTitleRow}>
                        <View>
                            <Text style={styles.sectionMainTitle}>Kênh Hỗ Trợ Trực Tiếp</Text>
                            <Text style={styles.sectionSubTitle}>Nhận phản hồi kỹ thuật và chứng từ nhanh</Text>
                        </View>
                        <View style={styles.channelCountBadge}>
                            <Text style={styles.channelCountText}>3 kênh số</Text>
                        </View>
                    </View>

                    <View style={styles.channelCardsList}>
                        {/* Zalo OA */}
                        <TouchableOpacity style={styles.channelRowCard} onPress={handleOpenZalo} activeOpacity={0.8}>
                            <View style={[styles.channelIconBox, { backgroundColor: '#dbeafe' }]}>
                                <Ionicons name="chatbubbles" size={22} color="#1d4ed8" />
                            </View>
                            <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.channelName}>Zalo OA: Sân Bóng Hải Châu</Text>
                                    <View style={styles.responseSpeedBadge}>
                                        <Text style={styles.responseSpeedText}>1 phút</Text>
                                    </View>
                                </View>
                                <Text style={styles.channelDetail} numberOfLines={1}>
                                    Nhắn trực tiếp quản lý sân & kiểm tra camera
                                </Text>
                            </View>
                            <View style={styles.arrowCircle}>
                                <Ionicons name="arrow-forward" size={16} color="#6b7280" />
                            </View>
                        </TouchableOpacity>

                        {/* Messenger Fanpage */}
                        <TouchableOpacity style={styles.channelRowCard} onPress={handleOpenMessenger} activeOpacity={0.8}>
                            <View style={[styles.channelIconBox, { backgroundColor: '#f0fdf4' }]}>
                                <Ionicons name="paper-plane" size={22} color="#006b2c" />
                            </View>
                            <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.channelName}>Messenger Cụm Sân</Text>
                                    <View style={[styles.responseSpeedBadge, { backgroundColor: '#dcfce7' }]}>
                                        <Text style={[styles.responseSpeedText, { color: '#15803d' }]}>Cộng đồng</Text>
                                    </View>
                                </View>
                                <Text style={styles.channelDetail} numberOfLines={1}>
                                    Fanpage giải đấu, tìm kèo giao hữu thể thao
                                </Text>
                            </View>
                            <View style={styles.arrowCircle}>
                                <Ionicons name="arrow-forward" size={16} color="#6b7280" />
                            </View>
                        </TouchableOpacity>

                        {/* Email VAT */}
                        <TouchableOpacity style={styles.channelRowCard} onPress={handleSendEmail} activeOpacity={0.8}>
                            <View style={[styles.channelIconBox, { backgroundColor: '#fef3c7' }]}>
                                <Ionicons name="mail" size={22} color="#b45309" />
                            </View>
                            <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.channelName}>hotro@sanbonghaichau.vn</Text>
                                    <View style={[styles.responseSpeedBadge, { backgroundColor: '#fef3c7' }]}>
                                        <Text style={[styles.responseSpeedText, { color: '#b45309' }]}>Hóa đơn VAT</Text>
                                    </View>
                                </View>
                                <Text style={styles.channelDetail} numberOfLines={1}>
                                    Hồ sơ công ty, đối soát giải và xuất VAT
                                </Text>
                            </View>
                            <View style={styles.arrowCircle}>
                                <Ionicons name="arrow-forward" size={16} color="#6b7280" />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 3. DANH SÁCH CỤM SÂN TRỰC THUỘC ĐÀ NẴNG */}
                <View style={styles.sectionWrap}>
                    <View style={styles.sectionTitleRow}>
                        <View>
                            <Text style={styles.sectionMainTitle}>Cụm Sân Trực Thuộc Đà Nẵng</Text>
                            <Text style={styles.sectionSubTitle}>Bảo trì liên tục • Trạm cứu hộ y tế tại chỗ</Text>
                        </View>
                        <Ionicons name="football" size={22} color="#006b2c" />
                    </View>

                    <View style={{ gap: 14 }}>
                        {venues.map((v) => {
                            const rawImg = v.image;
                            const imgUri = rawImg
                                ? (rawImg.startsWith('http') ? rawImg : `${MEDIA_URL}${rawImg}`)
                                : 'https://images.unsplash.com/photo-1529900245534-47fbf867b1cb?w=800&q=80';
                            const vName = v.name || v.field_name || 'Sân bóng';
                            const clusterName = v.field_type_name || v.field_type?.name || 'Sân bóng';
                            const statusStr = v.is_available !== false ? 'Mở cửa' : 'Bảo trì';
                            const vAddr = v.address || v.location || '';
                            const vHotline = v.phone || v.manager_phone || '1900889922';

                            return (
                                <View key={v.id} style={styles.venueCard}>
                                    <View style={styles.venueImgWrapper}>
                                        <Image source={{ uri: imgUri }} style={styles.venueImg} />
                                        <View style={styles.venueImgOverlay} />
                                        <View style={styles.venueTopBadges}>
                                            <View style={styles.clusterPill}>
                                                <Ionicons name="football" size={12} color="#ffffff" style={{ marginRight: 4 }} />
                                                <Text style={styles.clusterText}>{clusterName}</Text>
                                            </View>
                                            <View style={styles.openPill}>
                                                <Text style={styles.openText}>{statusStr}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.venueImageTitle}>{vName}</Text>
                                    </View>

                                    <View style={styles.venueCardBody}>
                                        {vAddr ? (
                                            <View style={styles.venueAddressRow}>
                                                <Ionicons name="location-outline" size={16} color="#6b7280" style={{ marginTop: 2 }} />
                                                <Text style={styles.venueAddressText}>{vAddr}</Text>
                                            </View>
                                        ) : null}

                                        <View style={styles.venueCardFooter}>
                                            <TouchableOpacity
                                                style={styles.venuePhoneBtn}
                                                onPress={() => handleCallHotline(vHotline)}
                                            >
                                                <Ionicons name="call" size={16} color="#006b2c" style={{ marginRight: 6 }} />
                                                <Text style={styles.venuePhoneText}>
                                                    {vHotline}
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.venueMapBtn}
                                                onPress={() => handleOpenMap(vAddr)}
                                            >
                                                <Ionicons name="navigate" size={15} color="#006b2c" style={{ marginRight: 4 }} />
                                                <Text style={styles.venueMapText}>Chỉ đường</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* 4. FORM GỬI PHẢN HỒI / KHIẾU NẠI */}
                <View style={styles.ticketFormCard}>
                    <Text style={styles.formHeading}>Gửi Phản Hồi & Yêu Cầu Cứu Hộ</Text>
                    <Text style={styles.formSub}>
                        Bạn có vấn đề về cọc, đổi lịch hay chất lượng sân? Hãy gửi thông tin để chúng tôi hỗ trợ ngay.
                    </Text>

                    <View style={styles.formInputs}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Họ và tên của bạn</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="VD: Nguyễn Văn Tuấn"
                                placeholderTextColor="#9ca3af"
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Số điện thoại</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="VD: 0905 8899 22"
                                placeholderTextColor="#9ca3af"
                                keyboardType="phone-pad"
                                value={phone}
                                onChangeText={setPhone}
                            />
                        </View>

                        {/* Booking selector from DB if available */}
                        {bookings && bookings.length > 0 && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Đơn đặt sân liên quan (nếu có)</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                    {bookings.map((b) => {
                                        const isSel = selectedBooking === b.id;
                                        const label = `#BK-${b.id?.slice(0, 6)?.toUpperCase()} • ${b.fieldName || 'Sân bóng'}`;
                                        return (
                                            <TouchableOpacity
                                                key={b.id}
                                                style={[styles.bookingChip, isSel && styles.bookingChipActive]}
                                                onPress={() => setSelectedBooking(isSel ? '' : b.id)}
                                            >
                                                <Text style={[styles.bookingChipText, isSel && styles.bookingChipTextActive]}>
                                                    {label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        )}

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Chi tiết phản hồi / Sự cố sân bãi</Text>
                            <TextInput
                                style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                                placeholder="Mô tả cụ thể sự cố cần cứu hộ hoặc góp ý..."
                                placeholderTextColor="#9ca3af"
                                multiline
                                numberOfLines={3}
                                value={details}
                                onChangeText={setDetails}
                            />
                        </View>

                        <TouchableOpacity style={styles.formSubmitBtn} onPress={handleSubmitTicket}>
                            <Ionicons name="send" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                            <Text style={styles.formSubmitBtnText}>Gửi Tin Tới Ban Quản Lý</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
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
    dangerHotlinePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fee2e2',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    dangerHotlineText: {
        color: '#b91c1c',
        fontSize: 12,
        fontWeight: '700',
    },
    scrollContent: {
        padding: 16,
        gap: 20,
    },

    /* Hero Rescue Card */
    heroRescueCard: {
        backgroundColor: '#0f172a',
        borderRadius: 20,
        padding: 18,
        position: 'relative',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
        gap: 12,
    },
    glowTopRight: {
        position: 'absolute',
        top: -40,
        right: -40,
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(0, 107, 44, 0.25)',
    },
    glowBottomLeft: {
        position: 'absolute',
        bottom: -30,
        left: -30,
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: 'rgba(185, 28, 28, 0.18)',
    },
    heroRescueTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    liveStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    livePulseDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#7ffc97',
        marginRight: 6,
    },
    liveStatusText: {
        color: '#7ffc97',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    heroRescueTitle: {
        fontSize: 19,
        fontWeight: '800',
        color: '#ffffff',
        lineHeight: 25,
    },
    heroRescueSub: {
        fontSize: 12,
        color: '#cbd5e1',
        lineHeight: 18,
    },
    hotlineActionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        padding: 14,
        marginTop: 4,
    },
    hotlineActionLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94a3b8',
        letterSpacing: 0.6,
    },
    hotlineActionNumber: {
        fontSize: 24,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: 0.5,
        marginTop: 2,
    },
    hotlineRoundCallBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#006b2c',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#006b2c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 3,
    },
    hotlineGuaranteeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    hotlineGuaranteeText: {
        fontSize: 11,
        color: '#7ffc97',
        fontWeight: '600',
    },
    scenariosGrid: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    scenarioItem: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
        gap: 4,
    },
    scenarioTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
    scenarioSub: {
        fontSize: 10,
        color: '#94a3b8',
    },

    /* Section Wraps */
    sectionWrap: {
        gap: 12,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionMainTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    sectionSubTitle: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 2,
    },
    channelCountBadge: {
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 14,
    },
    channelCountText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#006b2c',
    },
    channelCardsList: {
        gap: 10,
    },
    channelRowCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
    },
    channelIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    channelName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    responseSpeedBadge: {
        backgroundColor: '#dbeafe',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    responseSpeedText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#1d4ed8',
    },
    channelDetail: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 2,
    },
    arrowCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },

    /* Venue Cards */
    venueCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    venueImgWrapper: {
        height: 120,
        position: 'relative',
        justifyContent: 'space-between',
        padding: 12,
    },
    venueImg: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    venueImgOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
    },
    venueTopBadges: {
        flexDirection: 'row',
        gap: 8,
    },
    clusterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#006b2c',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    clusterText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
    },
    openPill: {
        backgroundColor: '#ccfbf1',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    openText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0f766e',
    },
    venueImageTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#ffffff',
    },
    venueCardBody: {
        padding: 14,
        gap: 10,
    },
    venueAddressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
    },
    venueAddressText: {
        flex: 1,
        fontSize: 12,
        color: '#6b7280',
        lineHeight: 17,
    },
    venueTagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    venueTagPill: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    venueTagText: {
        fontSize: 11,
        color: '#374151',
        fontWeight: '500',
    },
    venueCardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    venuePhoneBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    venuePhoneText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#006b2c',
    },
    venueMapBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },
    venueMapText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#006b2c',
    },

    /* Ticket Form Card */
    ticketFormCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        gap: 12,
    },
    formHeading: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    formSub: {
        fontSize: 12,
        color: '#6b7280',
        lineHeight: 18,
    },
    formInputs: {
        gap: 12,
    },
    inputGroup: {
        gap: 6,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
    },
    textInput: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    bookingChip: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    bookingChipActive: {
        backgroundColor: '#f0fdf4',
        borderColor: '#006b2c',
    },
    bookingChipText: {
        fontSize: 11,
        color: '#374151',
    },
    bookingChipTextActive: {
        color: '#006b2c',
        fontWeight: '700',
    },
    formSubmitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#006b2c',
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 4,
    },
    formSubmitBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },
});
