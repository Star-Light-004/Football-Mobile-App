import axiosClient from './axiosClient';

export const getUsersApi = async () => {
    const res = await axiosClient.get('/users/');
    return res.data;
};

export const getUserProfileApi = async () => {
    const res = await axiosClient.get('/users/profile/');
    return res.data;
};

export const createUserApi = async (data) => {
    const res = await axiosClient.post('/users/register/', data);
    return res.data;
};

export const createGuestCustomerApi = async (data) => {
    const res = await axiosClient.post('/users/create-guest/', data);
    return res.data;
};

export const updateUserApi = async (userId, data) => {
    const res = await axiosClient.put(`/users/${userId}/update/`, data);
    return res.data;
};

export const toggleUserStatusApi = async (userId) => {
    const res = await axiosClient.patch(`/users/${userId}/toggle-status/`);
    return res.data;
};

export const deleteUserApi = async (userId) => {
    const res = await axiosClient.delete(`/users/${userId}/delete/`);
    return res.data;
};

export const getRolePermissionsApi = async () => {
    const res = await axiosClient.get('/users/roles/permissions/');
    return res.data;
};

export const updateRolePermissionsApi = async (data) => {
    const res = await axiosClient.put('/users/roles/permissions/', data);
    return res.data;
};

export const resetRolePermissionsApi = async () => {
    const res = await axiosClient.post('/users/roles/permissions/reset/');
    return res.data;
};


