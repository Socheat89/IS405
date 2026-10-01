import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { STORAGE_KEYS } from '../config/api';
import { authService } from '../services/auth/authService';
import { permissionService } from '../services/settings/permissionService';

const AuthContext = createContext(null);

function decodeJwt(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const jsonStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

function extractRolesFromJwt(payload) {
  if (!payload) return [];
  const roleClaim =
    payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
    payload['role'] ||
    payload['roles'];
  if (Array.isArray(roleClaim)) return roleClaim;
  if (typeof roleClaim === 'string') return [roleClaim];
  return [];
}


export const AuthProvider = ({ children }) => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [token, setToken] = useState(
    () => localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || null
  );
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_INFO);
    return saved ? JSON.parse(saved) : null;
  });
  const [permissions, setPermissions] = useState(() => {
    try {
      const saved = localStorage.getItem('is405_user_permissions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [pendingTwoFactor, setPendingTwoFactor] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TWO_FACTOR_PENDING);
    return saved ? JSON.parse(saved) : null;
  });
  const [authStep, setAuthStep] = useState(() => {
    if (localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)) return 'AUTHENTICATED';
    const pending = localStorage.getItem(STORAGE_KEYS.TWO_FACTOR_PENDING);
    if (pending) {
      const parsed = JSON.parse(pending);
      return parsed.requiresSetup ? 'SETUP_2FA' : 'VERIFY_2FA';
    }
    return 'LOGIN';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Refs (always hold latest values — no stale closures) ──────────────────
  // Declared AFTER all useState so values are initialized
  const userRef     = useRef(user);
  const tokenRef    = useRef(token);
  const authStepRef = useRef(authStep);
  useEffect(() => { userRef.current     = user;     }, [user]);
  useEffect(() => { tokenRef.current    = token;    }, [token]);
  useEffect(() => { authStepRef.current = authStep; }, [authStep]);

  // ── Persist to localStorage ───────────────────────────────────────────────
  useEffect(() => {
    if (token) localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
    else       localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(user));
    else      localStorage.removeItem(STORAGE_KEYS.USER_INFO);
  }, [user]);

  useEffect(() => {
    if (permissions && permissions.length > 0)
      localStorage.setItem('is405_user_permissions', JSON.stringify(permissions));
    else
      localStorage.removeItem('is405_user_permissions');
  }, [permissions]);

  useEffect(() => {
    if (pendingTwoFactor)
      localStorage.setItem(STORAGE_KEYS.TWO_FACTOR_PENDING, JSON.stringify(pendingTwoFactor));
    else
      localStorage.removeItem(STORAGE_KEYS.TWO_FACTOR_PENDING);
  }, [pendingTwoFactor]);

  // ── Real-time Permission Sync (API-driven) ───────────────────────────────
  const refreshPermissions = useCallback(async () => {
    const currentToken    = tokenRef.current;
    const currentAuthStep = authStepRef.current;
    if (!currentToken || currentAuthStep !== 'AUTHENTICATED') return;

    try {
      // Primary source: /api/permissions/me — backend computes effective permissions from DB
      const res = await permissionService.getMyPermissions();
      if (Array.isArray(res) && res.length > 0) {
        if (res.includes('*')) {
          setPermissions(['*']);
          setUser(prev => prev ? { ...prev, isAdmin: true } : prev);
        } else {
          _applyPerms(res);
          setUser(prev => {
            if (!prev || !prev.isAdmin) return prev;
            return { ...prev, isAdmin: false };
          });
        }
      }
    } catch (err) {
      // Network offline — retain current permissions in state (do not clear)
      console.warn('[AuthContext] refreshPermissions error:', err?.message);
    }
  }, []); // stable reference — no deps needed

  // Helper: only update permissions state if actually changed
  function _applyPerms(newPerms) {
    setPermissions(prev => {
      const a = JSON.stringify([...(prev || [])].sort());
      const b = JSON.stringify([...newPerms].sort());
      return a !== b ? newPerms : prev;
    });
  }

  // ── Polling + Event listeners ─────────────────────────────────────────────
  useEffect(() => {
    if (!token || authStep !== 'AUTHENTICATED') return;

    // Run immediately on mount / when auth state changes
    refreshPermissions();

    // Poll every 2 seconds for real-time updates
    const intervalId = setInterval(refreshPermissions, 2000);

    // Also sync on: window focus, cross-tab storage changes, explicit events
    window.addEventListener('focus',               refreshPermissions);
    window.addEventListener('storage',             refreshPermissions);
    window.addEventListener('permissions_updated', refreshPermissions);
    window.addEventListener('roles_updated',       refreshPermissions);
    window.addEventListener('users_updated',       refreshPermissions);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus',               refreshPermissions);
      window.removeEventListener('storage',             refreshPermissions);
      window.removeEventListener('permissions_updated', refreshPermissions);
      window.removeEventListener('roles_updated',       refreshPermissions);
      window.removeEventListener('users_updated',       refreshPermissions);
    };
  }, [token, authStep, refreshPermissions]);

  // ── Auth Flow Handlers ────────────────────────────────────────────────────
  const handleLogin = async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authService.login(username, password);

      if (response.requiresTwoFactor) {
        const pendingData = {
          username,
          requiresSetup: response.requiresSetup !== false,
          challengeToken: response.challengeToken,
          tempAccessToken: response.accessToken,
          secret: response.secret || 'JBSWY3DPEHPK3PXP',
          qrCodeDataUrl: response.qrCodeDataUrl,
        };
        setPendingTwoFactor(pendingData);
        setAuthStep(pendingData.requiresSetup ? 'SETUP_2FA' : 'VERIFY_2FA');
        return { requiresTwoFactor: true, requiresSetup: pendingData.requiresSetup };
      }

      completeAuthentication(response.accessToken, { username, email: `${username}@company.com` });
      return { requiresTwoFactor: false };
    } catch (err) {
      const msg = typeof err === 'string' ? err : err?.message || 'Login failed';
      setError(msg);
      throw msg;
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm2FA = async (totpCode) => {
    setLoading(true);
    setError(null);
    try {
      if (!pendingTwoFactor?.challengeToken) {
        throw new Error('2FA session expired. Please log in again.');
      }
      const verifyRes = await authService.verifyTwoFactorLogin(pendingTwoFactor.challengeToken, totpCode);
      if (!verifyRes?.accessToken) {
        throw new Error('Failed to obtain access token.');
      }
      completeAuthentication(verifyRes.accessToken, {
        username: pendingTwoFactor.username,
        email: `${pendingTwoFactor.username}@company.com`,
        twoFactorEnabled: true
      });
      setPendingTwoFactor(null);
      setAuthStep('AUTHENTICATED');
    } catch (err) {
      const msg = typeof err === 'string' ? err : err?.response?.data?.message || err?.message || 'Invalid 2FA code';
      if (String(msg).toLowerCase().includes('challenge token') || String(msg).toLowerCase().includes('expired')) {
        setError('2FA Session expired. Redirecting to Login...');
        setTimeout(() => logout(), 1200);
      } else {
        setError(msg);
      }
      throw msg;
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (totpCode) => {
    setLoading(true);
    setError(null);
    try {
      if (!pendingTwoFactor?.challengeToken) {
        throw new Error('2FA session expired. Please log in again.');
      }
      const verifyRes = await authService.verifyTwoFactorLogin(pendingTwoFactor.challengeToken, totpCode);
      if (!verifyRes?.accessToken) {
        throw new Error('Failed to obtain access token.');
      }
      completeAuthentication(verifyRes.accessToken, {
        username: pendingTwoFactor?.username || '',
        email: pendingTwoFactor?.email || `${pendingTwoFactor?.username || ''}@company.com`,
        twoFactorEnabled: true
      });
      setPendingTwoFactor(null);
      setAuthStep('AUTHENTICATED');
    } catch (err) {
      const msg = typeof err === 'string' ? err : err?.response?.data?.message || err?.message || 'Invalid 2FA code';
      if (String(msg).toLowerCase().includes('challenge token') || String(msg).toLowerCase().includes('expired')) {
        setError('2FA Session expired. Redirecting to Login...');
        setTimeout(() => logout(), 1200);
      } else {
        setError(msg);
      }
      throw msg;
    } finally {
      setLoading(false);
    }
  };

  const completeAuthentication = (accessToken, baseUser) => {
    const payload  = decodeJwt(accessToken);
    const jwtRoles = extractRolesFromJwt(payload);

    const isSuperAdminAccount = jwtRoles.map(r => r.toUpperCase()).includes('ADMIN')
      || jwtRoles.map(r => r.toUpperCase()).includes('ADMINISTRATOR');

    const enrichedUser = {
      ...baseUser,
      roles:    jwtRoles.length > 0 ? jwtRoles : (baseUser.roles || []),
      isAdmin:  isSuperAdminAccount,
      roleName: jwtRoles[0] || 'User'
    };

    setToken(accessToken);
    setUser(enrichedUser);
    setAuthStep('AUTHENTICATED');
    setPendingTwoFactor(null);

    // Immediately set super admin permissions if root admin
    if (isSuperAdminAccount) setPermissions(['*']);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setPermissions([]);
    setPendingTwoFactor(null);
    setAuthStep('LOGIN');
    // Remove only auth/session keys — do NOT use localStorage.clear() to avoid removing unrelated browser data
    const AUTH_KEYS = [
      'is405_access_token',
      'is405_user_info',
      'is405_2fa_pending',
      'is405_challenge_token',
      'is405_user_permissions',
      // Remove stale local-cache keys if they exist
      'is405_local_users_list',
      'is405_local_roles_list',
      'is405_local_stock_items',
      'is405_local_stock_in_records',
      'is405_local_stock_out_records',
      'is405_local_sales_orders',
      'is405_local_purchase_orders',
      'is405_system_settings',
    ];
    AUTH_KEYS.forEach(key => localStorage.removeItem(key));
  };

  // ── Permission Helpers ────────────────────────────────────────────────────
  const hasRole = (roleName) => {
    if (!user?.roles) return false;
    if (user.isAdmin) return true;
    return user.roles.some(r => String(r).toUpperCase() === roleName.toUpperCase());
  };

  const hasPermission = (permCode) => {
    if (user?.isAdmin) return true;
    if (!permCode) return true;
    if (permissions.includes('*')) return true;
    return permissions.some(p => p.toLowerCase() === permCode.toLowerCase());
  };

  const canAccessApp = (appId) => {
    if (!user) return false;
    if (user.isAdmin || permissions.includes('*')) return true;

    const userPermsLower = (permissions || []).map(p => String(p).toLowerCase());
    if (userPermsLower.length === 0) {
      if (appId === 'dashboard' || appId === 'security') return true;
      return false;
    }

    switch (appId) {
      case 'dashboard': return true;
      case 'security':  return true;
      case 'stock':
        return hasPermission('stock.view') || hasPermission('stock-items.view') ||
          hasPermission('stock-in.view') || hasPermission('stock-out.view') ||
          hasPermission('stock-adjustments.view') ||
          userPermsLower.some(p => p.startsWith('stock') || p.startsWith('warehouse') || p.startsWith('transfer'));
      case 'po':
        return hasPermission('purchases.view') || hasPermission('purchase-orders.view') ||
          hasPermission('purchase-returns.view') ||
          userPermsLower.some(p => p.startsWith('purchase') || p.startsWith('supplier'));
      case 'sales':
        return hasPermission('sales.view') || hasPermission('sales-orders.view') ||
          hasPermission('sales-returns.view') ||
          userPermsLower.some(p => p.startsWith('sales') || p.startsWith('customer'));
      case 'users':
        return hasPermission('users.view') || userPermsLower.some(p => p.startsWith('users'));
      case 'roles':
        return hasPermission('roles.view') || hasPermission('permissions.view') ||
          userPermsLower.some(p => p.startsWith('roles') || p.startsWith('permissions'));
      case 'settings':
        return hasPermission('settings.view') ||
          userPermsLower.some(p => p.startsWith('settings') || p.startsWith('units'));
      default:
        return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        permissions,
        authStep,
        pendingTwoFactor,
        loading,
        error,
        setError,
        login: handleLogin,
        confirm2FA: handleConfirm2FA,
        verify2FA: handleVerify2FA,
        logout,
        setAuthStep,
        refreshPermissions,
        hasRole,
        hasPermission,
        canAccessApp
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
