import axios from 'axios';

export const apiClient = axios.create({
  baseURL: 'http://localhost:8787',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
