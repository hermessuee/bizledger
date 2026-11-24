import { UserSession } from '@bizledger/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

class ApiClient {
  private accessToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('bizledger_access_token');
    }
  }

  setToken(token: string | null) {
    this.accessToken = token;
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

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
      // Friendly fallback message if server is sleeping or unavailable
      throw new Error(
        'Unable to connect to the BizLedger server. Please check your internet connection or verify the backend service.'
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
            return (await fetch(url, { ...options, headers })).json();
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

    return data;
  }

  // Convenience methods
  get<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
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
