import axios from 'axios';
import { API_CONFIG, STORAGE_KEYS } from '../config/api';

const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 45000, // 45s timeout to support Render free-tier cold starts
});

// Interceptor to add Authorization Bearer token to all requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token && token !== 'undefined' && token !== 'null' && token.trim() !== '') {
      config.headers.Authorization = `Bearer ${token.trim()}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor for handling global errors (e.g., 401 Unauthorized, 403 Forbidden)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        console.warn('Unauthorized access or invalid token.');
        window.dispatchEvent(new Event('auth_unauthorized'));
      } else if (error.response.status === 403) {
        console.warn('Forbidden: Permissions revoked or insufficient.');
        window.dispatchEvent(new Event('permissions_updated'));
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
