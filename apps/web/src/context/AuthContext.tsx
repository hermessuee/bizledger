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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [business, setBusiness] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = async () => {
    try {
      const token = api.getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const data = await api.get('/api/v1/auth/me');
      setUser(data.user);
      setBusiness(data.business);
    } catch (err) {
      api.setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const login = async (usernameOrEmail: string, password: string) => {
    const data = await api.post('/api/v1/auth/login', { usernameOrEmail, password });
    api.setToken(data.accessToken);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bizledger_refresh_token', data.refreshToken);
    }
    setUser(data.user);
    // Fetch business info
    const me = await api.get('/api/v1/auth/me');
    setBusiness(me.business);
  };

  const logout = async () => {
    try {
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('bizledger_refresh_token') : null;
      await api.post('/api/v1/auth/logout', { refreshToken });
    } catch {}
    api.setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bizledger_refresh_token');
    }
    setUser(null);
    setBusiness(null);
  };

  const hasPermission = (
    menuKey: MenuKey,
    action: 'view' | 'create' | 'edit' | 'delete' | 'export' = 'view'
  ): boolean => {
    if (!user) return false;
    if (user.role === 'owner') return true;

    const actionMap = {
      view: 'canView',
      create: 'canCreate',
      edit: 'canEdit',
      delete: 'canDelete',
      export: 'canExport',
    } as const;

    const perm = user.permissions?.[menuKey];
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
