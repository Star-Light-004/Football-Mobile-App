import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AdminBottomNav({ activeTab = 'dashboard', navigation }) {
    const navItems = [
        {
            key: 'dashboard',
            label: 'Tổng quan',
            iconActive: 'grid',
            iconInactive: 'grid-outline',
            screen: 'AdminDashboard',
            tabScreen: 'AdminDashboardTab'
        },
        {
            key: 'bookings',
            label: 'Lịch ca',
            iconActive: 'calendar',
            iconInactive: 'calendar-outline',
            screen: 'StaffBookings',
            tabScreen: 'StaffBookingsTab'
        },
        {
            key: 'fields',
            label: 'Sân bãi',
            iconActive: 'football',
            iconInactive: 'football-outline',
            screen: 'AdminFields',
            tabScreen: 'AdminFieldsTab'
        },
        {
            key: 'revenue',
            label: 'Doanh thu',
            iconActive: 'cash',
            iconInactive: 'cash-outline',
            screen: 'AdminRevenue',
            tabScreen: 'AdminRevenueTab'
        },
        {
            key: 'operations',
            label: 'Vận hành',
            iconActive: 'options',
            iconInactive: 'options-outline',
            screen: 'StaffOperations',
            tabScreen: 'AdminOperationsTab'
        },
    ];

    const handleNavigate = (item) => {
        if (activeTab === item.key) return;
        try {
            navigation.navigate(item.screen);
        } catch (e) {
            navigation.navigate(item.tabScreen);
        }
    };

    return (
        <View style={styles.navContainer}>
            <View style={styles.navBar}>
                {navItems.map((item) => {
                    const isActive = activeTab === item.key;
                    return (
                        <TouchableOpacity
                            key={item.key}
                            style={styles.navItem}
                            onPress={() => handleNavigate(item)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                                <Ionicons
                                    name={isActive ? item.iconActive : item.iconInactive}
                                    size={20}
                                    color={isActive ? '#006b2c' : '#64748b'}
                                />
                            </View>
                            <Text style={[styles.navText, isActive && styles.navTextActive]} numberOfLines={1}>
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    navContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        zIndex: 9999,
        elevation: 20,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
    },
    navBar: {
        height: Platform.OS === 'ios' ? 82 : 68,
        paddingBottom: Platform.OS === 'ios' ? 22 : 8,
        paddingTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        maxWidth: 768,
        width: '100%',
        alignSelf: 'center',
        paddingHorizontal: 8,
    },
    navItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 2,
    },
    iconWrap: {
        width: 44,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapActive: {
        backgroundColor: '#dcfce7',
    },
    navText: {
        fontSize: 10.5,
        fontWeight: '600',
        color: '#64748b',
        marginTop: 2,
        letterSpacing: -0.2,
    },
    navTextActive: {
        color: '#006b2c',
        fontWeight: '800',
    },
});

