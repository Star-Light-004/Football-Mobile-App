import axiosClient from './axiosClient';

// Vệ sinh sân (Pitch Cleaning)
export const getCleaningLogsApi = async (params = {}) => {
    try {
        const res = await axiosClient.get('/facility/cleaning/', { params });
        return res.data?.results || res.data || [];
    } catch (e) {
        console.warn('Lỗi lấy danh sách vệ sinh sân:', e.message);
        return [];
    }
};

export const updateCleaningStatusApi = async (id, data) => {
    const res = await axiosClient.patch(`/facility/cleaning/${id}/`, data);
    return res.data;
};

export const createCleaningLogApi = async (data) => {
    const res = await axiosClient.post('/facility/cleaning/', data);
    return res.data;
};

// Bảo trì sự cố (Maintenance Issues)
export const getMaintenanceIssuesApi = async (params = {}) => {
    try {
        const res = await axiosClient.get('/facility/maintenance/', { params });
        return res.data?.results || res.data || [];
    } catch (e) {
        console.warn('Lỗi lấy danh sách bảo trì:', e.message);
        return [];
    }
};

export const createMaintenanceIssueApi = async (data) => {
    const res = await axiosClient.post('/facility/maintenance/', data);
    return res.data;
};

export const updateMaintenanceIssueApi = async (id, data) => {
    const res = await axiosClient.patch(`/facility/maintenance/${id}/`, data);
    return res.data;
};

export const updateMaintenanceStatusApi = async (id, status, cost = null, estimatedCost = null) => {
    const payload = { status };
    if (cost !== null && cost !== undefined) payload.cost = cost;
    if (estimatedCost !== null && estimatedCost !== undefined) {
        payload.estimated_cost = estimatedCost;
        payload.estimatedCost = estimatedCost;
    }
    const res = await axiosClient.patch(`/facility/maintenance/${id}/update_status/`, payload);
    return res.data;
};

export const deleteMaintenanceIssueApi = async (id) => {
    const res = await axiosClient.delete(`/facility/maintenance/${id}/`);
    return res.data;
};

// Đồ thất lạc (Lost & Found)
export const getLostFoundItemsApi = async (params = {}) => {
    try {
        const res = await axiosClient.get('/facility/lost-found/', { params });
        return res.data?.results || res.data || [];
    } catch (e) {
        console.warn('Lỗi lấy danh sách đồ thất lạc:', e.message);
        return [];
    }
};

export const updateLostFoundStatusApi = async (id, data) => {
    const res = await axiosClient.patch(`/facility/lost-found/${id}/`, data);
    return res.data;
};

export const createLostFoundItemApi = async (data) => {
    const res = await axiosClient.post('/facility/lost-found/', data);
    return res.data;
};

export const deleteLostFoundItemApi = async (id) => {
    const res = await axiosClient.delete(`/facility/lost-found/${id}/`);
    return res.data;
};

export const toggleLostFoundStatusApi = async (id, status = null, returnNote = '') => {
    const res = await axiosClient.post(`/facility/lost-found/${id}/toggle_status/`, { status, returnNote });
    return res.data;
};

