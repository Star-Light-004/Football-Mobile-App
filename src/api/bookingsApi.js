import axiosClient from './axiosClient';

export const getBookingsApi = async () => {
    const res = await axiosClient.get('/bookings/');
    return res.data;
};

export const getStaffBookingsApi = async () => {
    const res = await axiosClient.get('/bookings/');
    return res.data;
};

export const getUserBookingsApi = async (userId) => {
    try {
        const res = await axiosClient.get(`/bookings/user/${userId}/`);
        return res.data;
    } catch (e) {
        console.warn('Lỗi lấy lịch sử đặt sân:', e.message);
        return [];
    }
};

export const getMyBookingsApi = getUserBookingsApi;

export const createBookingApi = async (bookingData) => {
    const res = await axiosClient.post('/bookings/create/', bookingData);
    return res.data;
};

export const lookupBookingApi = async (phoneOrCode) => {
    const raw = String(phoneOrCode || '').trim();
    const isPhone = /^(0|\+84)[0-9]{8,11}$/.test(raw.replace(/[\s.-]/g, ''));
    let params = {};
    if (isPhone) {
        params.phone = raw.replace(/[\s.-]/g, '');
    } else {
        // Backend lookup accepts booking_id and strips # and BK:
        // clean_id = booking_id.replace('#', '').replace('BK', '').strip()
        let clean = raw.replace(/^#/, '').replace(/^PP-?/i, '');
        params.booking_id = clean;
    }

    const res = await axiosClient.get('/bookings/lookup/', { params });
    return res.data;
};

export const updateBookingStatusApi = async (bookingId, status) => {
    const res = await axiosClient.put(`/bookings/${bookingId}/update/`, { status });
    return res.data;
};

export const updateBookingApi = async (bookingId, data) => {
    const res = await axiosClient.put(`/bookings/${bookingId}/update/`, data);
    return res.data;
};

export const deleteBookingApi = async (bookingId) => {
    const res = await axiosClient.delete(`/bookings/${bookingId}/delete/`);
    return res.data;
};

export const cancelBookingApi = async (bookingId, reason = 'Khách hủy trên ứng dụng') => {
    const res = await axiosClient.put(`/bookings/${bookingId}/update/`, {
        status: 'cancelled',
        notes: reason
    });
    return res.data;
};
