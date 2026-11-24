import axiosClient from './axiosClient';

export const getFieldsApi = async (params = {}) => {
    const res = await axiosClient.get('/football-fields/', { params });
    return res.data;
};

export const getFieldDetailApi = async (id) => {
    const res = await axiosClient.get(`/football-fields/${id}/`);
    return res.data;
};

export const getFieldTypesApi = async () => {
    const res = await axiosClient.get('/seed-field-types/');
    return res.data;
};

export const createFieldApi = async (data) => {
    let payload = data;
    if (!(data instanceof FormData)) {
        payload = new FormData();
        Object.keys(data).forEach(key => {
            if (data[key] !== undefined && data[key] !== null) {
                payload.append(key, data[key]);
            }
        });
    }
    const res = await axiosClient.post('/football-fields/create/', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
};

export const updateFieldApi = async (id, data) => {
    const res = await axiosClient.put(`/football-fields/${id}/update/`, data);
    return res.data;
};

export const deleteFieldApi = async (id) => {
    const res = await axiosClient.delete(`/football-fields/${id}/delete/`);
    return res.data;
};
