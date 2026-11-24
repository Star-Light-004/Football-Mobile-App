import axiosClient from './axiosClient';

export const loginApi = async (identifier, password) => {
    const res = await axiosClient.post('/users/login/', { identifier, password });
    return res.data;
};

export const registerApi = async (userData) => {
    const res = await axiosClient.post('/users/register/', userData);
    return res.data;
};

export const checkExistsApi = async (params) => {
    const res = await axiosClient.get('/users/check-exists/', { params });
    return res.data;
};

export const socialAuthApi = async (socialData) => {
    const res = await axiosClient.post('/users/social-auth/', socialData);
    return res.data;
};
