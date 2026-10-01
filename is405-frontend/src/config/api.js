// API Microservices Configuration
// Each microservice can be configured independently via environment variables or default local paths

export const API_CONFIG = {
  // Base API URL for backend dotnet service
  // Automatically detects Render cloud domain, Vite proxy on localhost, or environment variable
  BASE_URL: import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com') ? 'https://is405-backend.onrender.com/api' : '/api'),

  
  // Microservices Endpoints mapping
  ENDPOINTS: {
    // Auth Microservice
    AUTH: {
      LOGIN: '/auth/login',
      REGISTER: '/auth/register',
      VALIDATE_INVITATION: '/auth/validate-invitation',
      SET_PASSWORD: '/auth/set-password',
      SETUP_2FA: '/auth/2fa/setup',
      ENABLE_2FA: '/auth/2fa/enable',
      VERIFY_2FA_LOGIN: '/auth/2fa/verify-login',
      DISABLE_2FA: '/auth/2fa/disable',
    },
    // Stock Management Microservice
    STOCK: {
      ITEMS: '/stock/items',
      ITEM_BY_ID: (id) => `/stock/items/${id}`,
      ADJUST: (id) => `/stock/items/${id}/adjust`,
      CATEGORIES: '/stock/categories',
    },
    // User Access Control Microservice
    USERS: {
      BASE: '/users',
      USER_BY_ID: (id) => `/users/${id}`,
      ROLES: (id) => `/users/${id}/roles`,
      STATUS: (id) => `/users/${id}/status`,
      RESEND_INVITATION: (id) => `/users/${id}/resend-invitation`,
    },
    // Roles & Permissions Microservice
    ROLES: {
      BASE: '/roles',
      ROLE_BY_ID: (id) => `/roles/${id}`,
    },
    PERMISSIONS: {
      BASE: '/permissions',
    },
    // Navigation Microservice
    NAVIGATION: {
      ME: '/navigation/me',
    }
  }
};

// Storage keys for Auth Token & User Context
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'is405_access_token',
  USER_INFO: 'is405_user_info',
  CHALLENGE_TOKEN: 'is405_challenge_token',
  TWO_FACTOR_PENDING: 'is405_2fa_pending'
};
