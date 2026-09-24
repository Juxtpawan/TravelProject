import { apiClient } from '../../../lib/apiClient'; // Fixed import syntax

export async function login(email, password) {
  const response = await apiClient.post('/auth/login', { email, password });
  return response.data; // Return just the payload
}

export async function signup(name, email, password) {
  const response = await apiClient.post('/auth/signup', { name, email, password });
  return response.data;
}

export async function googleAuth(idToken) {
  const response = await apiClient.post('/auth/google', { idToken });
  return response.data;
}

export async function logout() {
  const response = await apiClient.post('/auth/logout', {});
  return response.data;
}

export async function getMe() {
  const response = await apiClient.get('/auth/me');
  return response.data;
}
