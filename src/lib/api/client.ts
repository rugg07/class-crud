import type { User } from '@/server/db/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface LoginResponse {
  user: User;
  token: string;
}

interface GoogleAuthorizeResponse {
  url: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout(): Promise<void> {
    await this.request<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
    });
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me', {
      method: 'GET',
    });
  }

  async googleAuthorize(): Promise<string> {
    const response = await this.request<GoogleAuthorizeResponse>(
      '/auth/google/authorize',
      {
        method: 'GET',
      }
    );
    return response.url;
  }
}

export const apiClient = new ApiClient();
