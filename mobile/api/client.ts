import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getBaseUrl(): string {
  const configuredApiUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (configuredApiUrl) {
    return configuredApiUrl;
  }

  if (Platform.OS === 'web') {
    return 'http://localhost:8081/api/v1';
  }

  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:8081/api/v1';
    }
    return 'http://localhost:8081/api/v1';
  }

  const hostUri =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost;
  const host = typeof hostUri === 'string' ? hostUri.split(':')[0] : '';

  if (host) {
    return `http://${host}:8081/api/v1`;
  }

  console.warn(
    '[apiClient] Could not infer device host IP. Falling back to localhost; set expo extra.apiUrl for real devices.',
  );
  return 'http://localhost:8081/api/v1';
}

const API_BASE_URL = getBaseUrl();

// Basit API hata tipi: status bilgisini de taşır
export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const token = await AsyncStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /**
   * Merkezi istek yöneticisi. Tüm HTTP metodları bunu kullanır.
   * 401 durumunda token'ları temizler, UNAUTHORIZED event yayınlar ve ApiError fırlatır.
   */
  private async request<T>(method: string, endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: await this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let error: { message?: string | string[]; status?: number };
      try {
        error = errorText ? JSON.parse(errorText) : { message: 'Bir hata oluştu', status: response.status };
      } catch {
        error = { message: errorText || 'Bir hata oluştu', status: response.status };
      }

      if (response.status === 401) {
        const path = endpoint.split('?')[0];
        const isLoginRequest = path === '/auth/login';

        if (isLoginRequest) {
          const raw = error?.message;
          const backendMsg =
            typeof raw === 'string'
              ? raw
              : Array.isArray(raw) && raw.length
                ? raw.join(' ')
                : undefined;
          throw new ApiError(
            backendMsg ||
              'Öğrenci numarası veya şifreniz hatalı. Lütfen bilgilerinizi kontrol edip tekrar deneyin.',
            401,
          );
        }

        // Korumalı uçlar: oturum düştü veya token geçersiz
        await AsyncStorage.removeItem('authToken');
        await AsyncStorage.removeItem('authUser');

        try {
          const { emitEvent, AppEvents } = require('../utils/events');
          emitEvent(AppEvents.UNAUTHORIZED);
        } catch {
          // events modülü yüklenemezse sessizce devam et
        }

        throw new ApiError('Oturum süreniz sona erdi. Lütfen tekrar giriş yapın.', 401);
      }

      const rawMsg = error?.message;
      const msg =
        typeof rawMsg === 'string'
          ? rawMsg
          : Array.isArray(rawMsg) && rawMsg.length
            ? rawMsg.join(' ')
            : `HTTP ${response.status}`;
      throw new ApiError(msg, response.status);
    }

    const okText = await response.text();
    if (!okText.trim()) {
      return undefined as T;
    }
    try {
      return JSON.parse(okText) as T;
    } catch {
      return undefined as T;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>('GET', endpoint);
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('POST', endpoint, data);
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('PUT', endpoint, data);
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('PATCH', endpoint, data);
  }

  async delete<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('DELETE', endpoint, data);
  }

  // Base URL'i değiştir (development vs production)
  setBaseUrl(url: string) {
    this.baseUrl = url;
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;

