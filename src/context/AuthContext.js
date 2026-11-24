import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginApi } from '../api/authApi';

export const ADMIN_ROLES = [
    'admin',
    'field_owner',
    'field_manager',
    'receptionist',
    'cashier',
    'cleaner',
    'service_staff',
    'maintenance'
];

export const ROLE_INFO_MAP = {
    admin: { title: 'Quản Trị Viên (Super Admin)', email: 'admin@sanbonghaichau.vn', phone: '0988 123 456' },
    field_owner: { title: 'Chủ Sân Bóng Đối Tác', email: 'chusan@sanbonghaichau.vn', phone: '0912 345 678' },
    field_manager: { title: 'Người Quản Lý Cụm Sân', email: 'quanly@sanbonghaichau.vn', phone: '0934 567 890' },
    receptionist: { title: 'Lễ Tân Tiếp Đón Quầy', email: 'letan@sanbonghaichau.vn', phone: '0945 678 901' },
    cashier: { title: 'Nhân Viên Thu Ngân', email: 'thungan@sanbonghaichau.vn', phone: '0956 789 012' },
    service_staff: { title: 'Nhân Viên Kho & Dịch Vụ', email: 'dichvu@sanbonghaichau.vn', phone: '0967 890 123' },
    cleaner: { title: 'Nhân Viên Vệ Sinh 5S', email: 'vesinh@sanbonghaichau.vn', phone: '0978 901 234' },
    maintenance: { title: 'Kỹ Thuật & Bảo Trì Sân', email: 'kythuat@sanbonghaichau.vn', phone: '0989 012 345' },
};

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const isStaff = user?.role ? ADMIN_ROLES.includes(user.role.toLowerCase()) : false;
    const isAdmin = user?.role?.toLowerCase() === 'admin';

    useEffect(() => {
        const loadUser = async () => {
            try {
                const adminRaw = await AsyncStorage.getItem('admin_user');
                const userRaw = await AsyncStorage.getItem('user');
                const storedUser = adminRaw ? JSON.parse(adminRaw) : (userRaw ? JSON.parse(userRaw) : null);
                
                if (storedUser && ADMIN_ROLES.includes(String(storedUser.role || '').toLowerCase())) {
                    setUser(storedUser);
                } else {
                    setUser(null);
                }
            } catch (e) {
                console.error('Lỗi nạp user từ storage:', e);
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };
        loadUser();
    }, []);

    const login = async (identifier, password) => {
        const response = await loginApi(identifier, password);
        if (response && response.user) {
            const userData = response.user;
            const token = response.token || response.access_token || userData.token;
            const role = String(userData.role || 'customer').toLowerCase();
            
            // Chỉ cho phép các role quản lý đăng nhập vào App
            if (!ADMIN_ROLES.includes(role)) {
                throw new Error('Tài khoản khách hàng không có quyền truy cập ứng dụng Quản lý. Vui lòng đăng nhập trên giao diện Web.');
            }

            if (token) {
                userData.token = token;
                await AsyncStorage.setItem('admin_access_token', token);
                await AsyncStorage.setItem('access_token', token);
            }

            await AsyncStorage.setItem('admin_user', JSON.stringify(userData));
            await AsyncStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);
            return userData;
        }
        throw new Error(response?.error || 'Đăng nhập không thành công');
    };

    // Đăng nhập nhanh theo vai trò quản lý
    const loginDemoRole = async (roleKey) => {
        const info = ROLE_INFO_MAP[roleKey] || ROLE_INFO_MAP.admin;
        const demoUser = {
            id: roleKey === 'admin' ? 1 : 99,
            username: roleKey,
            full_name: info.title,
            fullname: info.title,
            name: info.title,
            email: info.email,
            phone: info.phone,
            role: roleKey,
        };
        await AsyncStorage.setItem('admin_user', JSON.stringify(demoUser));
        await AsyncStorage.setItem('user', JSON.stringify(demoUser));
        setUser(demoUser);
        return demoUser;
    };

    const switchRole = async (newRole, customTitle) => {
        const info = ROLE_INFO_MAP[newRole] || {};
        const updated = {
            ...(user || {}),
            role: newRole,
            role_title: customTitle || info.title || newRole,
        };
        setUser(updated);
        try {
            await AsyncStorage.setItem('admin_user', JSON.stringify(updated));
            await AsyncStorage.setItem('user', JSON.stringify(updated));
        } catch (e) {}
        return updated;
    };

    const logout = async () => {
        try {
            await AsyncStorage.removeItem('admin_user');
            await AsyncStorage.removeItem('user');
            await AsyncStorage.removeItem('admin_access_token');
            await AsyncStorage.removeItem('access_token');
        } catch (e) {}
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, isStaff, isAdmin, login, loginDemoRole, logout, switchRole }}>
            {children}
        </AuthContext.Provider>
    );
};
