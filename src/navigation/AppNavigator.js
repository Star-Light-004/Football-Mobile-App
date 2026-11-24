import React, { useContext } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';

// Auth Screen (Management & Staff Portal)
import LoginScreen from '../screens/LoginScreen';

// Tabs & Common
import ProfileScreen from '../screens/ProfileScreen';
import StaffOperationsScreen from '../screens/StaffOperationsScreen';

// Staff & Admin Screens
import StaffBookingsScreen from '../screens/StaffBookingsScreen';
import CleaningScreen from '../screens/CleaningScreen';
import MaintenanceScreen from '../screens/MaintenanceScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AdminFieldsScreen from '../screens/AdminFieldsScreen';
import AdminTimeslotsScreen from '../screens/AdminTimeslotsScreen';
import AdminServicesScreen from '../screens/AdminServicesScreen';
import AdminVouchersScreen from '../screens/AdminVouchersScreen';
import AdminRevenueScreen from '../screens/AdminRevenueScreen';
import AdminTournamentsScreen from '../screens/AdminTournamentsScreen';
import AdminUsersScreen from '../screens/AdminUsersScreen';
import BookingDetailScreen from '../screens/BookingDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
    const { user } = useContext(AuthContext);
    const role = String(user?.role || 'admin').toLowerCase();

    // 1. Nhân viên Vệ sinh sân (cleaner)
    if (role === 'cleaner') {
        return (
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    headerShown: false,
                    tabBarActiveTintColor: '#006b2c',
                    tabBarInactiveTintColor: '#64748b',
                    tabBarStyle: {
                        height: Platform.OS === 'ios' ? 84 : 64,
                        paddingBottom: Platform.OS === 'ios' ? 24 : 8,
                        paddingTop: 8,
                        backgroundColor: '#ffffff',
                        borderTopWidth: 1,
                        borderTopColor: '#e2e8f0',
                    },
                    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
                    tabBarIcon: ({ color, focused }) => {
                        let iconName = 'sparkles-outline';
                        if (route.name === 'CleaningTab') iconName = focused ? 'sparkles' : 'sparkles-outline';
                        else if (route.name === 'MaintenanceTab') iconName = focused ? 'construct' : 'construct-outline';
                        else if (route.name === 'ProfileTab') iconName = focused ? 'person' : 'person-outline';
                        return <Ionicons name={iconName} size={22} color={color} />;
                    },
                })}
            >
                <Tab.Screen
                    name="CleaningTab"
                    component={CleaningScreen}
                    options={{ tabBarLabel: 'Vệ sinh 5S' }}
                />
                <Tab.Screen
                    name="MaintenanceTab"
                    component={MaintenanceScreen}
                    options={{ tabBarLabel: 'Báo hỏng' }}
                />
                <Tab.Screen
                    name="ProfileTab"
                    component={ProfileScreen}
                    options={{ tabBarLabel: 'Cá nhân' }}
                />
            </Tab.Navigator>
        );
    }

    // 2. Nhân viên Kỹ thuật bảo trì sân (maintenance)
    if (role === 'maintenance') {
        return (
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    headerShown: false,
                    tabBarActiveTintColor: '#b91c1c',
                    tabBarInactiveTintColor: '#64748b',
                    tabBarStyle: {
                        height: Platform.OS === 'ios' ? 84 : 64,
                        paddingBottom: Platform.OS === 'ios' ? 24 : 8,
                        paddingTop: 8,
                        backgroundColor: '#ffffff',
                        borderTopWidth: 1,
                        borderTopColor: '#e2e8f0',
                    },
                    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
                    tabBarIcon: ({ color, focused }) => {
                        let iconName = 'construct-outline';
                        if (route.name === 'MaintenanceTab') iconName = focused ? 'construct' : 'construct-outline';
                        else if (route.name === 'CleaningTab') iconName = focused ? 'sparkles' : 'sparkles-outline';
                        else if (route.name === 'ProfileTab') iconName = focused ? 'person' : 'person-outline';
                        return <Ionicons name={iconName} size={22} color={color} />;
                    },
                })}
            >
                <Tab.Screen
                    name="MaintenanceTab"
                    component={MaintenanceScreen}
                    options={{ tabBarLabel: 'Bảo trì sự cố' }}
                />
                <Tab.Screen
                    name="CleaningTab"
                    component={CleaningScreen}
                    options={{ tabBarLabel: 'Vệ sinh' }}
                />
                <Tab.Screen
                    name="ProfileTab"
                    component={ProfileScreen}
                    options={{ tabBarLabel: 'Cá nhân' }}
                />
            </Tab.Navigator>
        );
    }

    // 3. Nhân viên Dịch vụ & Kho F&B / Giày (service_staff)
    if (role === 'service_staff') {
        return (
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    headerShown: false,
                    tabBarActiveTintColor: '#c2410c',
                    tabBarInactiveTintColor: '#64748b',
                    tabBarStyle: {
                        height: Platform.OS === 'ios' ? 84 : 64,
                        paddingBottom: Platform.OS === 'ios' ? 24 : 8,
                        paddingTop: 8,
                        backgroundColor: '#ffffff',
                        borderTopWidth: 1,
                        borderTopColor: '#e2e8f0',
                    },
                    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
                    tabBarIcon: ({ color, focused }) => {
                        let iconName = 'cube-outline';
                        if (route.name === 'ServicesTab') iconName = focused ? 'cube' : 'cube-outline';
                        else if (route.name === 'StaffBookingsTab') iconName = focused ? 'calendar' : 'calendar-outline';
                        else if (route.name === 'ProfileTab') iconName = focused ? 'person' : 'person-outline';
                        return <Ionicons name={iconName} size={22} color={color} />;
                    },
                })}
            >
                <Tab.Screen
                    name="ServicesTab"
                    component={AdminServicesScreen}
                    options={{ tabBarLabel: 'Kho & Dịch vụ' }}
                />
                <Tab.Screen
                    name="StaffBookingsTab"
                    component={StaffBookingsScreen}
                    options={{ tabBarLabel: 'Lịch ca đấu' }}
                />
                <Tab.Screen
                    name="ProfileTab"
                    component={ProfileScreen}
                    options={{ tabBarLabel: 'Cá nhân' }}
                />
            </Tab.Navigator>
        );
    }

    // 4. Lễ tân (receptionist) & Thu ngân (cashier)
    if (['receptionist', 'cashier'].includes(role)) {
        return (
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    headerShown: false,
                    tabBarActiveTintColor: '#006b2c',
                    tabBarInactiveTintColor: '#64748b',
                    tabBarStyle: {
                        height: Platform.OS === 'ios' ? 84 : 64,
                        paddingBottom: Platform.OS === 'ios' ? 24 : 8,
                        paddingTop: 8,
                        backgroundColor: '#ffffff',
                        borderTopWidth: 1,
                        borderTopColor: '#e2e8f0',
                        elevation: 10,
                        shadowColor: '#000',
                        shadowOpacity: 0.05,
                        shadowRadius: 8,
                    },
                    tabBarLabelStyle: {
                        fontSize: 11,
                        fontWeight: '700',
                    },
                    tabBarIcon: ({ color, focused, size }) => {
                        let iconName;
                        if (route.name === 'StaffBookingsTab') {
                            iconName = focused ? 'calendar' : 'calendar-outline';
                        } else if (route.name === 'OperationsTab') {
                            iconName = focused ? 'briefcase' : 'briefcase-outline';
                        } else if (route.name === 'ProfileTab') {
                            iconName = focused ? 'person' : 'person-outline';
                        }
                        return <Ionicons name={iconName} size={22} color={color} />;
                    },
                })}
            >
                <Tab.Screen
                    name="StaffBookingsTab"
                    component={StaffBookingsScreen}
                    options={{ tabBarLabel: 'Lịch đặt sân' }}
                />
                <Tab.Screen
                    name="OperationsTab"
                    component={StaffOperationsScreen}
                    options={{ tabBarLabel: 'Vận hành quầy' }}
                />
                <Tab.Screen
                    name="ProfileTab"
                    component={ProfileScreen}
                    options={{ tabBarLabel: 'Cá nhân' }}
                />
            </Tab.Navigator>
        );
    }

    // 5. Mặc định toàn diện cho Quản trị viên, Chủ sân, Quản lý cụm sân (Admin / Field Owner / Field Manager)
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: { display: 'none' },
            }}
        >
            <Tab.Screen
                name="AdminDashboardTab"
                component={AdminDashboardScreen}
                options={{ tabBarLabel: 'Tổng quan' }}
            />
            <Tab.Screen
                name="StaffBookingsTab"
                component={StaffBookingsScreen}
                options={{ tabBarLabel: 'Lịch ca' }}
            />
            <Tab.Screen
                name="AdminFieldsTab"
                component={AdminFieldsScreen}
                options={{ tabBarLabel: 'Sân bãi' }}
            />
            <Tab.Screen
                name="AdminRevenueTab"
                component={AdminRevenueScreen}
                options={{ tabBarLabel: 'Doanh thu' }}
            />
            <Tab.Screen
                name="AdminOperationsTab"
                component={StaffOperationsScreen}
                options={{ tabBarLabel: 'Vận hành' }}
            />
        </Tab.Navigator>
    );
}

export default function AppNavigator() {
    const { user, isLoading } = useContext(AuthContext);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                <ActivityIndicator size="large" color="#006b2c" />
            </View>
        );
    }

    return (
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f8fafc' } }}>
            {!user ? (
                // Luồng Đăng nhập Quản Trị & Nhân Sự
                <Stack.Screen name="Login" component={LoginScreen} />
            ) : (
                // Phân hệ Quản Trị & Vận Hành sau khi đăng nhập thành công
                <>
                    <Stack.Screen name="Main" component={MainTabs} />

                    {/* Màn hình Quản trị viên & Nhân sự */}
                    <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
                    <Stack.Screen name="StaffBookings" component={StaffBookingsScreen} />
                    <Stack.Screen name="AdminFields" component={AdminFieldsScreen} />
                    <Stack.Screen name="AdminTimeslots" component={AdminTimeslotsScreen} />
                    <Stack.Screen name="AdminServices" component={AdminServicesScreen} />
                    <Stack.Screen name="AdminVouchers" component={AdminVouchersScreen} />
                    <Stack.Screen name="AdminRevenue" component={AdminRevenueScreen} />
                    <Stack.Screen name="AdminTournaments" component={AdminTournamentsScreen} />
                    <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
                    <Stack.Screen name="StaffOperations" component={StaffOperationsScreen} />
                    <Stack.Screen name="Cleaning" component={CleaningScreen} />
                    <Stack.Screen name="Maintenance" component={MaintenanceScreen} />
                    <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
                    <Stack.Screen name="Profile" component={ProfileScreen} />
                    <Stack.Screen name="ProfileTab" component={ProfileScreen} />
                    <Stack.Screen name="OperationsTab" component={StaffOperationsScreen} />

                    {/* Safe Aliases */}
                    <Stack.Screen name="Home" component={AdminDashboardScreen} />
                    <Stack.Screen name="HomeTab" component={AdminDashboardScreen} />
                    <Stack.Screen name="Fields" component={AdminFieldsScreen} />
                    <Stack.Screen name="FieldsTab" component={AdminFieldsScreen} />
                    <Stack.Screen name="Bookings" component={StaffBookingsScreen} />
                    <Stack.Screen name="BookingsTab" component={StaffBookingsScreen} />
                    <Stack.Screen name="FieldDetail" component={AdminFieldsScreen} />
                    <Stack.Screen name="Booking" component={StaffBookingsScreen} />
                    <Stack.Screen name="Payment" component={AdminRevenueScreen} />
                    <Stack.Screen name="Lookup" component={StaffBookingsScreen} />
                    <Stack.Screen name="LookupTab" component={StaffBookingsScreen} />
                    <Stack.Screen name="TournamentRequest" component={AdminTournamentsScreen} />
                    <Stack.Screen name="Contact" component={StaffOperationsScreen} />
                </>
            )}
        </Stack.Navigator>
    );
}
