import { apiClient } from '../../../lib/apiClient';

export async function getProfile(userId) {
  const { data } = await apiClient.get(`/users/${userId}/profile`);
  return data;
}

export async function updateProfile(userId, updates) {
  const { data } = await apiClient.put(`/users/${userId}/profile`, updates);
  return data;
}

export async function deleteAccount(userId) {
  const { data } = await apiClient.delete(`/users/${userId}`);
  return data;
}

export async function suggestUsername() {
  const { data } = await apiClient.get('/users/suggest-username');
  return data;
}

export async function changePassword(payload) {
  const { data } = await apiClient.post('/auth/change-password', payload);
  return data;
}