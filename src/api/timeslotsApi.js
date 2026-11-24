import axiosClient from './axiosClient';

export const getTimeslotsByFieldApi = async (fieldId, date) => {
    try {
        const res = await axiosClient.get('/timeslots/get-by-field/', {
            params: {
                field_id: fieldId,
                date: date
            }
        });
        return res.data;
    } catch (e) {
        console.warn('Lỗi lấy khung giờ:', e.message);
        return [];
    }
};

export const createTimeslotApi = async (data) => {
    const res = await axiosClient.post('/timeslots/', data);
    return res.data;
};

export const updateTimeslotApi = async (id, data) => {
    const res = await axiosClient.put(`/timeslots/${id}/`, data);
    return res.data;
};

export const deleteTimeslotApi = async (id) => {
    const res = await axiosClient.delete(`/timeslots/${id}/`);
    return res.data;
};

export const generateSlotsApi = async (payload = { days: 30 }) => {
    const res = await axiosClient.post('/timeslots/generate-slots/', payload);
    return res.data;
};

export const deleteAllSlotsApi = async () => {
    const res = await axiosClient.delete('/timeslots/delete-all/');
    return res.data;
};
