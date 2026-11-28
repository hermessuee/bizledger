'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserSession, MenuKey } from '@bizledger/shared';
import { api } from '@/lib/api';

interface AuthContextType {
  user: UserSession | null;
  business: any | null;
  loading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (menuKey: MenuKey, action?: 'view' | 'create' | 'edit' | 'delete' | 'export') => boolean;
  refreshUser: () => Promise<void>;
  switchBusiness: (businessId: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Synchronously initialize from localStorage cache for instant 0ms render
  const [user, setUser] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('hermes_user_session');
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [business, setBusiness] = useState<any | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('hermes_business_session');
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  // Only consider loading true if we have a token but NO cached user in memory
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('bizledger_access_token');
      const cached = localStorage.getItem('hermes_user_session');
      return Boolean(token && !cached);
    }
    return false;
  });

  const fetchSession = async () => {
    try {
      const token = api.getToken();
      if (!token) {
        setLoading(false);
        setUser(null);
        setBusiness(null);
        return;
      }
      const data = await api.get('/api/v1/auth/me');
      setUser(data.user);
      setBusiness(data.business);
      if (typeof window !== 'undefined') {
        localStorage.setItem('hermes_user_session', JSON.stringify(data.user));
        localStorage.setItem('hermes_business_session', JSON.stringify(data.business));
      }
    } catch (err: any) {
      console.warn('fetchSession warning:', err);
      // ONLY log out if backend returns 401 Unauthorized (token invalid / expired)
      if (err?.status === 401) {
        api.setToken(null);
        setUser(null);
        setBusiness(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('hermes_user_session');
          localStorage.removeItem('hermes_business_session');
          localStorage.removeItem('hermes_active_business_id');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const login = async (usernameOrEmail: string, password: string) => {
    // Clear any previous switched context before fresh login
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hermes_active_business_id');
    }
    api.clearCache();
    const data = await api.post('/api/v1/auth/login', { usernameOrEmail, password });
    api.setToken(data.accessToken);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bizledger_refresh_token', data.refreshToken);
      localStorage.setItem('hermes_user_session', JSON.stringify(data.user));
      localStorage.setItem('hermes_business_session', JSON.stringify(data.business));
      if (data.user?.role !== 'super_admin' && data.user?.username !== 'anoopsue') {
        localStorage.removeItem('hermes_active_business_id');
      }
    }
    setUser(data.user);
    setBusiness(data.business);
    setLoading(false);
  };

  const logout = async () => {
    try {
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('bizledger_refresh_token') : null;
      await api.post('/api/v1/auth/logout', { refreshToken });
    } catch {}
    api.setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bizledger_refresh_token');
      localStorage.removeItem('hermes_user_session');
      localStorage.removeItem('hermes_business_session');
      localStorage.removeItem('hermes_active_business_id');
      sessionStorage.removeItem('bizledger_alerts_shown_session');
    }
    setUser(null);
    setBusiness(null);
  };

  const switchBusiness = async (businessId: string | null) => {
    if (typeof window !== 'undefined') {
      if (businessId && businessId !== 'all' && businessId !== '00000000-0000-0000-0000-000000000000') {
        localStorage.setItem('hermes_active_business_id', businessId);
      } else {
        localStorage.removeItem('hermes_active_business_id');
      }
    }
    api.clearCache();
    await fetchSession();
  };

  const hasPermission = (
    menuKey: MenuKey,
    action: 'view' | 'create' | 'edit' | 'delete' | 'export' = 'view'
  ): boolean => {
    if (!user) return false;
    // Super Administrator and Owner roles have 100% full unrestricted permission across all features
    if (user.role === 'super_admin' || user.role === 'owner') return true;

    const actionMap = {
      view: 'canView',
      create: 'canCreate',
      edit: 'canEdit',
      delete: 'canDelete',
      export: 'canExport',
    } as const;

    const perm = user.permissions?.[menuKey] ||
      (menuKey === 'invoice_print' ? user.permissions?.['sales_invoices'] : undefined) ||
      (menuKey === 'returns' ? user.permissions?.['sales_invoices'] : undefined);
    if (!perm) return false;
    return Boolean(perm[actionMap[action]]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        business,
        loading,
        login,
        logout,
        hasPermission,
        refreshUser: fetchSession,
        switchBusiness,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
