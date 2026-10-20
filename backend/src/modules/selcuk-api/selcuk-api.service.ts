import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../../database/entities';
import { selcukHttpRequest } from './selcuk-http.client';
import {
  buildLoginUserNameCandidates,
  panelUserTypesToTry,
  type SelcukUserType,
} from './selcuk-login.util';
import { SelcukAuthException } from './selcuk-auth.exception';
import type {
  SelcukHasPermissionRequest,
  SelcukLoginValue,
  SelcukProfileValue,
  SelcukRefreshRequest,
  SelcukServiceResponse,
} from './selcuk-api.types';

export interface SelcukLoginParams {
  userName: string;
  password: string;
  /** 0 personel, 1 öğrenci, 2 enstitü */
  userType?: SelcukUserType;
  deviceToken?: string;
  channel?: number;
}

const ERROR_MESSAGES: Record<string, string> = {
  PASSWORD_INCORRECT: 'Kullanıcı adı veya şifre hatalı.',
  USER_NOT_FOUND: 'Kullanıcı adı üniversite sisteminde bulunamadı.',
  USER_INACTIVE: 'Hesabınız devre dışı bırakılmış.',
};

/**
 * Üniversite merkezi auth API istemcisi.
 *
 * Web panel şifresini burada doğrular; dönen accessToken üniversite JWT'sidir.
 * Bu token web tarayıcısına gönderilmez — yalnızca backend içinde kullanılır.
 */
@Injectable()
export class SelcukApiService {
  private readonly logger = new Logger(SelcukApiService.name);

  constructor(private readonly config: ConfigService) {}

  /** POST /api/v1/Auth/Login */
  async login(params: SelcukLoginParams): Promise<SelcukLoginValue> {
    const candidates = buildLoginUserNameCandidates(
      params.userName,
      params.userType ?? 1,
    );

    let lastError: SelcukAuthException | null = null;

    for (const userName of candidates) {
      try {
        return await this.loginWithUserName(userName, params);
      } catch (error) {
        if (!(error instanceof SelcukAuthException)) {
          throw error;
        }
        lastError = error;
        if (error.errorCode === 'PASSWORD_INCORRECT') {
          this.logger.debug(
            `Auth/Login PASSWORD_INCORRECT (userName=${userName}), sonraki aday deneniyor`,
          );
          continue;
        }
        if (error.errorCode === 'USER_NOT_FOUND') {
          this.logger.debug(
            `Auth/Login USER_NOT_FOUND userName=${userName}, sonraki aday deneniyor`,
          );
          continue;
        }
        throw error;
      }
    }

    throw (
      lastError ??
      new SelcukAuthException(
        'Kullanıcı adı veya şifre hatalı.',
        'USER_NOT_FOUND',
      )
    );
  }

  /**
   * Web panel girişi:
   * 1) Swagger ile aynı istek (girilen userName birebir)
   * 2) Gerekirse e-posta son ekleri ve userType denemeleri
   */
  async loginForPanel(
    params: Omit<SelcukLoginParams, 'userType'>,
  ): Promise<SelcukLoginValue> {
    const userName = params.userName.trim();
    const base = { ...params, userName };
    let lastError: SelcukAuthException | null = null;

    try {
      return await this.loginWithUserName(userName, base);
    } catch (error) {
      if (!(error instanceof SelcukAuthException)) {
        throw error;
      }
      lastError = error;
      if (
        error.errorCode !== 'PASSWORD_INCORRECT' &&
        error.errorCode !== 'USER_NOT_FOUND'
      ) {
        throw error;
      }
      this.logger.warn(
        `Panel login exact userName başarısız (${error.errorCode}, userName=${userName}), alternatifler deneniyor`,
      );
    }

    for (const userType of panelUserTypesToTry(userName)) {
      try {
        return await this.login({ ...base, userType });
      } catch (error) {
        if (!(error instanceof SelcukAuthException)) {
          throw error;
        }
        lastError = error;
        if (error.errorCode === 'PASSWORD_INCORRECT') {
          this.logger.debug(
            `Panel login PASSWORD_INCORRECT (userType=${userType}), sonraki tip deneniyor`,
          );
          continue;
        }
        throw error;
      }
    }

    throw (
      lastError ??
      new SelcukAuthException(
        'Kullanıcı adı veya şifre hatalı.',
        'PASSWORD_INCORRECT',
      )
    );
  }

  private async loginWithUserName(
    userName: string,
    params: SelcukLoginParams,
  ): Promise<SelcukLoginValue> {
    const body = {
      userName,
      password: params.password,
      deviceToken:
        params.deviceToken ??
        this.config.get<string>('selcukApi.deviceToken'),
      channel: params.channel ?? this.config.get<number>('selcukApi.channel'),
    };

    this.logger.debug(
      `Auth/Login denemesi userName=${userName} deviceToken=${body.deviceToken} channel=${body.channel}` +
        (process.env.NODE_ENV === 'development'
          ? ` passwordLen=${params.password.length}`
          : ''),
    );

    const response = await this.post<SelcukServiceResponse<SelcukLoginValue>>(
      '/api/v1/Auth/Login',
      body,
    );

    this.assertSucceeded(response, 'Giriş başarısız.');

    if (!response.value?.accessToken?.trim()) {
      throw new SelcukAuthException(
        'Giriş başarısız: üniversite oturum tokenı alınamadı.',
        'TOKEN_MISSING',
      );
    }

    return response.value;
  }

  /** POST /api/v1/Auth/Refresh */
  async refresh(params: SelcukRefreshRequest): Promise<SelcukLoginValue> {
    const response = await this.post<SelcukServiceResponse<SelcukLoginValue>>(
      '/api/v1/Auth/Refresh',
      {
        refreshToken: params.refreshToken,
        fcmToken: params.fcmToken ?? '',
      },
    );

    this.assertSucceeded(response, 'Oturum yenilenemedi.');

    if (!response.value?.accessToken?.trim()) {
      throw new UnauthorizedException('Oturum yenilenemedi: token alınamadı.');
    }

    return response.value;
  }

  /**
   * Web panel girişi: AuthCheck/IsAuthenticate + Permission/HasPermission ile rol belirler.
   * Admin yetkisi staff'tan önce kontrol edilir.
   */
  async resolvePanelRoleFromPermissions(
    accessToken: string,
    options?: { trustFreshLogin?: boolean },
  ): Promise<UserRole.ADMIN | UserRole.STAFF> {
    const authenticated = await this.isAuthenticate(accessToken);
    if (!authenticated) {
      if (options?.trustFreshLogin) {
        this.logger.warn(
          'AuthCheck/IsAuthenticate olumsuz; Auth/Login başarılı olduğu için HasPermission deneniyor.',
        );
      } else {
        throw new UnauthorizedException(
          'Üniversite oturumu doğrulanamadı. Lütfen tekrar deneyin.',
        );
      }
    }

    if (await this.hasPanelTierPermission(accessToken, 'admin')) {
      return UserRole.ADMIN;
    }

    if (await this.hasPanelTierPermission(accessToken, 'staff')) {
      return UserRole.STAFF;
    }

    throw new ForbiddenException(
      'Kütüphane yönetim paneline erişim yetkiniz bulunmuyor (Permission/HasPermission).',
    );
  }

  /**
   * Korumalı panel istekleri: IsAuthenticate + rol bazlı HasPermission.
   */
  async assertUniversityAccessForRole(
    accessToken: string,
    role: UserRole.ADMIN | UserRole.STAFF,
  ): Promise<void> {
    const authenticated = await this.isAuthenticate(accessToken);
    if (!authenticated) {
      throw new UnauthorizedException(
        'Üniversite oturumu geçersiz. Lütfen tekrar giriş yapın.',
      );
    }

    const tier = role === UserRole.ADMIN ? 'admin' : 'staff';
    const allowed = await this.hasPanelTierPermission(accessToken, tier);
    if (!allowed) {
      throw new ForbiddenException(
        'Üniversite yetki kontrolü başarısız (Permission/HasPermission).',
      );
    }
  }

  private async hasPanelTierPermission(
    accessToken: string,
    tier: 'admin' | 'staff',
  ): Promise<boolean> {
    const groupCodeKey =
      tier === 'admin' ? 'selcukApi.adminGroupCode' : 'selcukApi.staffGroupCode';
    const codesKey =
      tier === 'admin'
        ? 'selcukApi.adminPermissionCodes'
        : 'selcukApi.staffPermissionCodes';

    const groupCode = this.config.get<string>(groupCodeKey)?.trim() ?? '';
    if (!groupCode) {
      throw new ServiceUnavailableException(
        `Panel ${tier} yetkisi için ${tier === 'admin' ? 'SELUK_API_ADMIN_GROUP_CODE' : 'SELUK_API_STAFF_GROUP_CODE'} tanımlanmalıdır.`,
      );
    }

    const codes = this.config.get<string[]>(codesKey) ?? [];
    const operation =
      this.config.get<number>('selcukApi.permissionOperation') ?? 0;

    this.logger.debug(
      `Permission/HasPermission (${tier}) groupCode=${groupCode} codes=${codes.join(',') || '(boş)'} operation=${operation}`,
    );

    return this.hasPermission(accessToken, {
      groupCode,
      codes,
      operation,
    });
  }

  /** GET /api/v1/AuthCheck/IsAuthenticate
   * Üniversite accessToken'ının hâlâ geçerli olup olmadığını kontrol eder.
   * Gerçek sonuç çoğu zaman `value: true|false` alanındadır (HasPermission ile aynı zarf).
   */
  async isAuthenticate(accessToken: string): Promise<boolean> {
    try {
      const response = await this.get<unknown>(
        '/api/v1/AuthCheck/IsAuthenticate',
        accessToken,
        { softEnvelope: true },
      );

      const ok = this.readServiceBooleanValue(
        response,
        'AuthCheck/IsAuthenticate',
        { truthyWhenSucceededWithoutValue: true },
      );

      if (!ok) {
        this.logger.warn(
          `AuthCheck/IsAuthenticate olumsuz: ${JSON.stringify(response).slice(0, 400)}`,
        );
      }

      return ok;
    } catch (error) {
      this.logger.warn(
        `AuthCheck/IsAuthenticate başarısız: ${(error as Error).message}`,
      );
      return false;
    }
  }

  /**
   * GET /api/v1/Auth/GetProfile — alanlar `value` altındadır.
   * Fail-closed: doğrulanamayan / boş profil null döner.
   */
  async getProfile(accessToken: string): Promise<SelcukProfileValue | null> {
    try {
      const response = await this.get<SelcukServiceResponse<SelcukProfileValue>>(
        '/api/v1/Auth/GetProfile',
        accessToken,
        { softEnvelope: true },
      );

      if (!response || typeof response !== 'object') {
        return null;
      }

      if (response.isSucceeded !== true || !response.value) {
        this.logger.warn(
          `Auth/GetProfile olumsuz: ${JSON.stringify(response).slice(0, 400)}`,
        );
        return null;
      }

      return response.value;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      this.logger.warn(
        `Auth/GetProfile başarısız: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /** POST /api/v1/Permission/HasPermission */
  async hasPermission(
    accessToken: string,
    body: SelcukHasPermissionRequest,
  ): Promise<boolean> {
    try {
      const response = await this.post<unknown>(
        '/api/v1/Permission/HasPermission',
        body,
        accessToken,
        { softEnvelope: true },
      );

      const allowed = this.readServiceBooleanValue(
        response,
        'Permission/HasPermission',
        { truthyWhenSucceededWithoutValue: false },
      );

      if (!allowed) {
        this.logger.warn(
          `Permission/HasPermission red groupCode=${body.groupCode} codes=${body.codes.join(',')}: ` +
            `${JSON.stringify(response).slice(0, 400)}`,
        );
      }

      return allowed;
    } catch (error) {
      this.logger.warn(
        `Permission/HasPermission başarısız: ${(error as Error).message}`,
      );
      return false;
    }
  }

  /**
   * apiservices bazen ham boolean (`true`), bazen `{ isSucceeded, value }` döner.
   */
  private readServiceBooleanValue(
    response: unknown,
    context: string,
    options: { truthyWhenSucceededWithoutValue: boolean },
  ): boolean {
    if (typeof response === 'boolean') {
      return response;
    }

    if (typeof response !== 'object' || response === null) {
      this.logger.warn(
        `${context} beklenmeyen yanıt: ${JSON.stringify(response)}`,
      );
      return false;
    }

    const envelope = response as SelcukServiceResponse<unknown>;

    if (!('isSucceeded' in envelope)) {
      return this.coerceToBoolean(envelope, false);
    }

    if (envelope.isSucceeded !== true) {
      return false;
    }

    if (envelope.value === null || envelope.value === undefined) {
      return options.truthyWhenSucceededWithoutValue;
    }

    return this.coerceToBoolean(envelope.value, false);
  }

  private coerceToBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1') return true;
    if (value === 0 || value === '0') return false;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true') return true;
      if (lower === 'false') return false;
    }
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      if ('hasPermission' in obj) {
        return this.coerceToBoolean(obj.hasPermission, fallback);
      }
      if ('value' in obj) {
        return this.coerceToBoolean(obj.value, fallback);
      }
    }
    return fallback;
  }

  private assertSucceeded<T>(
    response: SelcukServiceResponse<T>,
    fallbackMessage: string,
  ): void {
    if (response.isSucceeded) return;

    const code = response.error?.errorCode ?? '';
    const message =
      ERROR_MESSAGES[code] ??
      response.error?.errorMessage ??
      response.message ??
      fallbackMessage;

    throw new SelcukAuthException(message, code || undefined);
  }

  private mapTransportError(status: number, body: string): never {
    if (status === 401) {
      throw new UnauthorizedException('Üniversite oturumu geçersiz.');
    }

    if (status === 400) {
      let detail = 'İstek üniversite API tarafından reddedildi.';
      try {
        const parsed = JSON.parse(body) as {
          title?: string;
          errors?: Record<string, string[]>;
        };
        const firstError = parsed.errors
          ? Object.values(parsed.errors).flat()[0]
          : undefined;
        detail = firstError ?? parsed.title ?? detail;
      } catch {
        // ignore parse errors
      }
      throw new BadRequestException(detail);
    }

    this.logger.error(`Selçuk API HTTP ${status}: ${body.slice(0, 500)}`);

    if (status === 502 || status === 503 || status === 504) {
      throw new ServiceUnavailableException(
        `Üniversite kimlik servisi şu an yanıt vermiyor (HTTP ${status}). ` +
          'apiservices.selcuk.edu.tr adresine backend sunucusundan erişilebildiğini kontrol edin.',
      );
    }

    throw new ServiceUnavailableException(
      `Üniversite kimlik servisi beklenmeyen yanıt döndü (HTTP ${status}).`,
    );
  }

  private async get<T>(
    path: string,
    bearerToken?: string,
    options?: SelcukRequestOptions,
  ): Promise<T> {
    return this.request<T>('GET', path, undefined, bearerToken, options);
  }

  private async post<T>(
    path: string,
    body: unknown,
    bearerToken?: string,
    options?: SelcukRequestOptions,
  ): Promise<T> {
    return this.request<T>('POST', path, body, bearerToken, options);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    bearerToken?: string,
    options?: SelcukRequestOptions,
  ): Promise<T> {
    const baseUrl = this.config.get<string>('selcukApi.baseUrl');
    const locale = this.config.get<string>('selcukApi.locale');

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Locale: locale ?? 'tr-TR',
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`;
    }

    const url = `${baseUrl}${path}`;
    const timeoutMs = this.config.get<number>('selcukApi.requestTimeoutMs') ?? 30_000;
    const tlsInsecure = this.config.get<boolean>('selcukApi.tlsInsecure') === true;

    this.logger.debug(`${method} ${url}`);

    try {
      const response = await selcukHttpRequest(url, {
        method,
        headers: {
          ...headers,
          'User-Agent': 'kutuphane-backend/1.0',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        timeoutMs,
        tlsInsecure,
      });

      const text = response.text;
      let parsed: T;
      try {
        parsed = JSON.parse(text) as T;
      } catch {
        this.mapTransportError(response.status, text);
      }

      const envelope = parsed as unknown as SelcukServiceResponse<unknown>;
      if (
        !options?.softEnvelope &&
        typeof parsed === 'object' &&
        parsed !== null &&
        'isSucceeded' in parsed &&
        envelope.isSucceeded === false
      ) {
        this.assertSucceeded(envelope, 'Üniversite API isteği başarısız.');
      }

      if (response.status < 200 || response.status >= 300) {
        this.mapTransportError(response.status, text);
      }

      return parsed;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      if ((error as Error).message === 'Request timeout') {
        throw new ServiceUnavailableException(
          'Üniversite kimlik servisi zaman aşımına uğradı (30 sn). Ağ / VPN bağlantınızı kontrol edin.',
        );
      }
      const cause =
        (error as Error & { cause?: Error }).cause?.message ??
        (error as Error).message;
      this.logger.error(`Selçuk API bağlantı hatası [${method} ${url}]: ${cause}`);
      throw new ServiceUnavailableException(
        `Üniversite kimlik servisine bağlanılamadı: ${cause}`,
      );
    }
  }
}

interface SelcukRequestOptions {
  /** isSucceeded:false için exception fırlatma (AuthCheck/IsAuthenticate gibi) */
  softEnvelope?: boolean;
}
