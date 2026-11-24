import axiosClient from './axiosClient';

export const createQRPaymentApi = async (data) => {
    const res = await axiosClient.post('/payments/qr/create/', data);
    return res.data;
};

export const checkPaymentStatusApi = async (bookingId) => {
    try {
        const res = await axiosClient.get(`/payments/status/${bookingId}/`);
        return res.data;
    } catch (e) {
        console.warn('Lỗi kiểm tra thanh toán:', e.message);
        return { status: 'pending' };
    }
};

export const simulatePaymentTestApi = async (bookingId) => {
    const res = await axiosClient.post('/payments/simulate/', { booking_id: bookingId });
    return res.data;
};

export const getRevenueAnalyticsApi = async (params = {}) => {
    const res = await axiosClient.get('/payments/revenue-analytics/', { params });
    return res.data;
};
