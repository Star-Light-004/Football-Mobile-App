import axiosClient from './axiosClient';

export const getServicesApi = async (admin = true) => {
    try {
        const res = await axiosClient.get(`/services/list/${admin ? '?admin=true' : ''}`);
        return res.data;
    } catch (e) {
        console.warn('Lỗi lấy danh sách dịch vụ:', e.message);
        return [];
    }
};

export const createServiceApi = async (data) => {
    let payload = data;
    if (!(data instanceof FormData)) {
        payload = new FormData();
        Object.keys(data).forEach(key => {
            if (key === 'field_ids' && Array.isArray(data[key])) {
                data[key].forEach(id => payload.append('field_ids', String(id)));
            } else if (key === 'image' && data[key] && typeof data[key] === 'object' && data[key].uri) {
                payload.append('image', data[key]);
            } else if (data[key] !== undefined && data[key] !== null) {
                payload.append(key, String(data[key]));
            }
        });
    }
    const res = await axiosClient.post('/services/list/', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
};

export const updateServiceApi = async (id, data) => {
    let payload = data;
    if (!(data instanceof FormData)) {
        payload = new FormData();
        Object.keys(data).forEach(key => {
            if (key === 'field_ids' && Array.isArray(data[key])) {
                data[key].forEach(id => payload.append('field_ids', String(id)));
            } else if (key === 'image' && data[key] && typeof data[key] === 'object' && data[key].uri) {
                payload.append('image', data[key]);
            } else if (data[key] !== undefined && data[key] !== null) {
                payload.append(key, String(data[key]));
            }
        });
    }
    const res = await axiosClient.put(`/services/list/${id}/`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
};

export const deleteServiceApi = async (id) => {
    const res = await axiosClient.delete(`/services/list/${id}/`);
    return res.data;
};

export const getBookingServicesApi = async (bookingId) => {
    try {
        const res = await axiosClient.get(`/services/booking-services/${bookingId}/`);
        return res.data;
    } catch (e) {
        return [];
    }
};

export const getServicesStatsApi = async () => {
    try {
        const res = await axiosClient.get('/services/stats/');
        return res.data;
    } catch (e) {
        console.warn('Lỗi lấy thống kê dịch vụ:', e.message);
        return null;
    }
};
