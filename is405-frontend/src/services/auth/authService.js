import apiClient from '../apiClient';
import { API_CONFIG } from '../../config/api';

export const authService = {
  // Login method - Authenticates user credentials against the Database
  async login(username, password) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.LOGIN, {
        username,
        password,
      });
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || (error.code === 'ERR_NETWORK' 
        ? 'Cannot connect to backend server. Please make sure the backend API is running.'
        : error.message || 'Login failed');
      throw message;
    }
  },

  // Validate invitation token
  async validateInvitation(token, email) {
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.AUTH.VALIDATE_INVITATION, {
        params: { token, email }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || error.message || 'Invitation validation failed';
    }
  },

  // Set user password from invitation
  async setPassword(token, email, password, confirmPassword) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.SET_PASSWORD, {
        token,
        email,
        password,
        confirmPassword
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || error.message || 'Failed to set password';
    }
  },

  // Register method
  async register(username, email, password) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.REGISTER, {
        username,
        email,
        password,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || error.message || 'Registration failed';
    }
  },

  // Initial 2FA setup request (generates secret and QR code from DB user)
  async setupTwoFactor() {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.SETUP_2FA);
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || error.message || '2FA setup failed';
    }
  },

  // Confirm/Enable 2FA with 6-digit TOTP code verified on DB
  async enableTwoFactor(twoFactorCode) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.ENABLE_2FA, {
        twoFactorCode,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || error.message || 'Enabling 2FA failed';
    }
  },

  // Verify 2FA code during login process on backend
  async verifyTwoFactorLogin(challengeToken, twoFactorCode) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.VERIFY_2FA_LOGIN, {
        challengeToken,
        twoFactorCode,
      });
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || (error.code === 'ERR_NETWORK'
        ? 'Cannot connect to backend server. Please check backend connection.'
        : error.message || '2FA verification failed');
      throw message;
    }
  },

  // Disable 2FA
  async disableTwoFactor(twoFactorCode) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.DISABLE_2FA, {
        twoFactorCode,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || error.message || 'Disabling 2FA failed';
    }
  }
};
