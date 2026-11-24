import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config';
import apiCache from '../utils/apiCache';

const axiosClient = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 60000, // 60s để chờ server Render thức dậy (Cold Start) khi ở chế độ Production
});

// Các endpoint được lưu cache trong RAM để load tức thì trên mobile
const CACHEABLE_ENDPOINTS = [
    '/football-fields/',
    '/bookings/',
    '/services/',
    '/vouchers/',
    '/facility/cleaning/',
    '/facility/maintenance/',
    '/facility/lost-found/',
    '/payments/revenue-analytics/',
];

// Tự động gắn JWT Token, role và user id vào request headers đồng bộ chuẩn 100% với Backend Django
axiosClient.interceptors.request.use(
    async (config) => {
        try {
            const adminRaw = await AsyncStorage.getItem('admin_user');
            const userRaw = await AsyncStorage.getItem('user');
            const tokenRaw = await AsyncStorage.getItem('admin_access_token') || await AsyncStorage.getItem('access_token');
            const userObj = adminRaw ? JSON.parse(adminRaw) : (userRaw ? JSON.parse(userRaw) : null);

            // 1. Gắn JWT Bearer Token chuẩn Authorization
            const token = userObj?.token || tokenRaw;
            if (token) {
                config.headers['Authorization'] = `Bearer ${token}`;
            }

            // 2. Gắn X-User-Role và X-User-Id để phân quyền RBAC
            if (userObj?.role) {
                config.headers['X-User-Role'] = userObj.role;
            }
            if (userObj?.id) {
                config.headers['X-User-Id'] = userObj.id;
            }

            // 3. Tự động xử lý FormData khi upload hình ảnh sân bóng / sự cố
            if (config.data instanceof FormData) {
                delete config.headers['Content-Type'];
            }

            // 4. Kiểm tra SWR Cache cho các request GET
            const method = (config.method || 'get').toLowerCase();
            const isSkipCache = Boolean(config.skipCache || config.headers?.['X-Skip-Cache']);

            if (method === 'get' && !isSkipCache) {
                const url = config.url || '';
                const isCacheable = CACHEABLE_ENDPOINTS.some(ep => url.includes(ep)) || config.useCache;
                if (isCacheable) {
                    const cacheKey = apiCache.generateKey(url, config.params);
                    const cached = apiCache.get(cacheKey);
                    if (cached && !cached.isStale) {
                        config.adapter = () => Promise.resolve({
                            data: cached.data,
                            status: 200,
                            statusText: 'OK',
                            headers: {},
                            config,
                            request: {},
                            fromCache: true,
                        });
                    }
                }
            }
        } catch (e) {
            console.warn('Lỗi đọc phiên làm việc từ AsyncStorage:', e);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
    (response) => {
        try {
            const method = (response.config?.method || 'get').toLowerCase();
            const url = response.config?.url || '';

            if (method === 'get' && response.status === 200 && !response.fromCache) {
                const isCacheable = CACHEABLE_ENDPOINTS.some(ep => url.includes(ep)) || response.config?.useCache;
                if (isCacheable) {
                    const cacheKey = apiCache.generateKey(url, response.config?.params);
                    apiCache.set(cacheKey, response.data);
                }
            } else if (['post', 'put', 'patch', 'delete'].includes(method)) {
                // Tự động xóa cache khi có thao tác sửa đổi dữ liệu
                if (url.includes('/bookings')) {
                    apiCache.invalidate('/bookings');
                    apiCache.invalidate('/payments');
                } else if (url.includes('/football-fields')) {
                    apiCache.invalidate('/football-fields');
                } else if (url.includes('/services')) {
                    apiCache.invalidate('/services');
                } else if (url.includes('/facility')) {
                    apiCache.invalidate('/facility');
                } else {
                    apiCache.clear();
                }
            }
        } catch (e) {
            // bỏ qua lỗi cache
        }
        return response;
    },
    async (error) => {
        if (
            error.response &&
            (error.response.status === 401 ||
                (error.response.status === 403 &&
                    typeof error.response.data?.detail === 'string' &&
                    error.response.data.detail.toLowerCase().includes('token')))
        ) {
            try {
                await AsyncStorage.removeItem('access_token');
                await AsyncStorage.removeItem('admin_access_token');
            } catch (e) {}
        }
        return Promise.reject(error);
    }
);

export default axiosClient;
