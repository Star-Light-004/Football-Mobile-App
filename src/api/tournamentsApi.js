import axiosClient from './axiosClient';

export const createTournamentRequestApi = async (data) => {
    const res = await axiosClient.post('/bookings/tournaments/request/', data);
    return res.data;
};

export const getTournamentRequestsApi = async () => {
    const res = await axiosClient.get('/bookings/tournaments/requests/');
    return res.data;
};

export const updateTournamentRequestApi = async (id, data) => {
    const res = await axiosClient.put(`/bookings/tournaments/requests/${id}/`, data);
    return res.data;
};

export const cancelTournamentRequestApi = async (id) => {
    const res = await axiosClient.post(`/bookings/tournaments/requests/${id}/cancel/`);
    return res.data;
};

export const deleteTournamentRequestApi = async (id) => {
    const res = await axiosClient.delete(`/bookings/tournaments/requests/${id}/delete/`);
    return res.data;
};


