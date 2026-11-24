import axiosClient from './axiosClient';

export const createReviewApi = async (reviewData) => {
    const res = await axiosClient.post('/reviews/create/', reviewData);
    return res.data;
};

export const getFieldReviewsApi = async (fieldId) => {
    try {
        const res = await axiosClient.get(`/reviews/${fieldId}/`);
        return res.data;
    } catch (e) {
        return [];
    }
};

