import axios from 'axios';
import { API_CONFIG, STORAGE_KEYS } from '../config/api';

const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 8000, // Timeout for network requests
});

// Interceptor to add Authorization Bearer token to all requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
      } else if (error.response.status === 403) {
        console.warn('Forbidden: Permissions revoked or insufficient.');
        window.dispatchEvent(new Event('permissions_updated'));
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
