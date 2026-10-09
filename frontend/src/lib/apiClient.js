import axios from 'axios';
import { ENV } from '../config/env';

export const apiClient = axios.create({
  baseURL: ENV.API_URL,
  withCredentials: true,
  timeout: 10000, // 10s timeout to prevent infinite loading state
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  response => response,
  error => {
    const isExpiredSession = error.response?.status === 401
      && !String(error.config?.url || '').startsWith('/auth/');
    if (isExpiredSession) window.dispatchEvent(new Event('auth:session-expired'));
    return Promise.reject(error);
  },
);

export default apiClient;
