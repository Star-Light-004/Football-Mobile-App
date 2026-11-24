/**
 * In-memory API Cache for React Native / Expo Mobile App.
 * Tăng tốc độ load của app tức thì (0ms) bằng cách lưu tạm dữ liệu trong bộ nhớ RAM,
 * đồng thời tự động xóa cache khi có bất kỳ thao tác Thêm / Sửa / Xóa nào.
 */

class ApiCache {
    constructor(defaultTTL = 30000) {
        this.cache = new Map();
        this.defaultTTL = defaultTTL;
    }

    generateKey(url, params = {}) {
        const cleanUrl = (url || '').split('?')[0];
        const queryParams = { ...(params || {}) };

        if ((url || '').includes('?')) {
            const qs = url.split('?')[1];
            const pairs = qs.split('&');
            for (const p of pairs) {
                const [k, v] = p.split('=');
                if (k) queryParams[decodeURIComponent(k)] = decodeURIComponent(v || '');
            }
        }

        const sortedKeys = Object.keys(queryParams).sort();
        const sortedObj = {};
        for (const k of sortedKeys) {
            sortedObj[k] = queryParams[k];
        }
        return `${cleanUrl}:${JSON.stringify(sortedObj)}`;
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const isExpired = Date.now() - entry.timestamp > entry.ttl;
        return {
            data: entry.data,
            isStale: isExpired,
            timestamp: entry.timestamp,
        };
    }

    set(key, data, ttl = this.defaultTTL) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
        });
    }

    invalidate(pattern) {
        if (!pattern) {
            this.cache.clear();
            return;
        }
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    clear() {
        this.cache.clear();
    }
}

export const apiCache = new ApiCache(30000);
export default apiCache;

