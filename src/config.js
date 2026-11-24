import { Platform } from 'react-native';

// ── CẤU HÌNH MÁY CHỦ BACKEND DJANGO REST API ──────────────────────────────────
// - PRODUCTION: Server cloud Render đã deploy (kết nối trực tiếp với Database Web)
// - LOCAL: Máy trạm phát triển nội bộ

export const IS_PRODUCTION = true; // 👉 Đặt true để kết nối live với Web Render đã deploy, false để chạy Localhost

const PRODUCTION_SERVER = 'https://football-booking-system-8m77.onrender.com';
const LOCAL_HOST = Platform.OS === 'web' ? '127.0.0.1:8000' : '192.168.89.235:8000';

export const SERVER_URL = IS_PRODUCTION ? PRODUCTION_SERVER : `http://${LOCAL_HOST}`;
export const BASE_URL = `${SERVER_URL}/api`;
export const MEDIA_URL = SERVER_URL;

/**
 * Chuẩn hóa URL ảnh trả về từ Django DRF Backend:
 * - Tự động thay thế '127.0.0.1:8000' hoặc 'localhost:8000' bằng SERVER_URL đang active
 * - Tự động ghép tiền tố SERVER_URL cho các đường dẫn tương đối (/media/...)
 */
export const getFullImageUrl = (path) => {
    if (!path || typeof path !== 'string') return '';

    // Nếu đã là link cloud/external hoàn chỉnh (https://...)
    if (path.startsWith('http://') || path.startsWith('https://')) {
        // Nếu ảnh chứa localhost:8000 do server gán nhầm, đổi về SERVER_URL
        if (path.includes('localhost:8000') || path.includes('127.0.0.1:8000')) {
            return path.replace(/^https?:\/\/(localhost|127\.0\.0\.1):8000/, SERVER_URL);
        }
        return path;
    }

    if (path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('file:')) {
        return path;
    }

    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${SERVER_URL}${cleanPath}`;
};
