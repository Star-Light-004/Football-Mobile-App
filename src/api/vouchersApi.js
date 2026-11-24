import axiosClient from './axiosClient';

export const getPublicVouchersApi = async () => {
    try {
        const res = await axiosClient.get('/vouchers/');
        return res.data;
    } catch (e) {
        console.warn('Lỗi lấy danh sách voucher:', e.message);
        return [];
    }
};

export const validateVoucherApi = async (voucherCode, totalAmount) => {
    try {
        const res = await axiosClient.post('/vouchers/validate/', {
            code: voucherCode,
            total_price: totalAmount,
            field_price: totalAmount
        });
        return res.data;
    } catch (e) {
        throw e.response?.data || { error: 'Mã giảm giá không hợp lệ' };
    }
};

export const adminGetVouchersApi = async () => {
    const res = await axiosClient.get('/vouchers/admin/');
    return res.data;
};

export const adminCreateVoucherApi = async (data) => {
    const res = await axiosClient.post('/vouchers/admin/create/', data);
    return res.data;
};

export const adminUpdateVoucherApi = async (id, data) => {
    const res = await axiosClient.put(`/vouchers/admin/${id}/update/`, data);
    return res.data;
};

export const adminDeleteVoucherApi = async (id) => {
    const res = await axiosClient.delete(`/vouchers/admin/${id}/delete/`);
    return res.data;
};

export const adminGetCustomerVouchersHistoryApi = async (params = {}) => {
    const res = await axiosClient.get('/vouchers/admin/issued-history/', { params });
    return res.data;
};

