import { UserSession } from '@bizledger/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://br-purple-night-bep8owab-api.compute.c-9.us-east-2.aws.neon.tech';

interface CacheEntry {
  data: any;
  timestamp: number;
}

class ApiClient {
  private accessToken: string | null = null;
  // High-performance client-side response cache (TTL in milliseconds)
  private cache = new Map<string, CacheEntry>();
  private defaultCacheTtl = 8000; // 8 seconds TTL for ultra-fast instant menu/page transitions

  constructor() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('bizledger_access_token');
    }
  }

  setToken(token: string | null) {
    this.accessToken = token;
    this.clearCache(); // clear cache on user change/logout
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('bizledger_access_token', token);
      else localStorage.removeItem('bizledger_access_token');
    }
  }

  getToken(): string | null {
    if (!this.accessToken && typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('bizledger_access_token');
    }
    return this.accessToken;
  }

  clearCache() {
    this.cache.clear();
  }

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    bypassCache = false
  ): Promise<T> {
    const method = options.method || 'GET';
    const cacheKey = `${method}:${endpoint}`;

    // 1. Fast Cache Read for GET requests (Instant 0ms UI load)
    if (method === 'GET' && !bypassCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.defaultCacheTtl) {
        return cached.data as T;
      }
    }

    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err: any) {
      throw new Error(
        'Unable to connect to the Hermes ERP server. Please check your internet connection or verify the backend service.'
      );
    }

    // Auto-refresh token on 401 if refresh token is available
    if (response.status === 401 && typeof window !== 'undefined' && !endpoint.includes('/auth/login')) {
      const refreshToken = localStorage.getItem('bizledger_refresh_token');
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            this.setToken(data.accessToken);
            headers['Authorization'] = `Bearer ${data.accessToken}`;
            const retryRes = await fetch(url, { ...options, headers });
            const retryData = await retryRes.json();
            if (method === 'GET') {
              this.cache.set(cacheKey, { data: retryData, timestamp: Date.now() });
            }
            return retryData;
          }
        } catch {}
      }
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data.error?.message || response.statusText || 'An error occurred';
      const error: any = new Error(msg);
      error.code = data.error?.code;
      error.details = data.error?.details;
      error.status = response.status;
      throw error;
    }

    // 2. Cache successful GET responses for instant reuse
    if (method === 'GET') {
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
    } else {
      // 3. Clear cache on mutations (POST, PUT, DELETE) so modified data is instantly fresh
      this.clearCache();
    }

    return data;
  }

  // Convenience methods
  get<T = any>(endpoint: string, bypassCache = false) {
    return this.request<T>(endpoint, { method: 'GET' }, bypassCache);
  }

  post<T = any>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T = any>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
