import { registerAs } from '@nestjs/config';

function parsePermissionCodes(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * Selçuk Üniversitesi merkezi API Gateway (apiservices.selcuk.edu.tr).
 * Web panel girişinde şifre doğrulaması ve HasPermission yetki kontrolü bu servis üzerinden yapılır.
 */
export default registerAs('selcukApi', () => ({
  baseUrl:
    process.env.SELUK_API_BASE_URL || 'https://apiservices.selcuk.edu.tr',
  locale: process.env.SELUK_API_LOCALE || 'tr-TR',
  channel: parseInt(process.env.SELUK_API_CHANNEL || '0', 10),
  deviceToken: process.env.SELUK_API_DEVICE_TOKEN || 'string',
  requestTimeoutMs: parseInt(process.env.SELUK_API_TIMEOUT_MS || '30000', 10),
  /** true ise TLS doğrulaması kapatılır (yalnızca acil durum) */
  tlsInsecure: process.env.SELUK_API_TLS_INSECURE === 'true',
  permissionOperation: parseInt(
    process.env.SELUK_API_PERMISSION_OPERATION || '0',
    10,
  ),
  /** POST /api/v1/Permission/HasPermission — admin panel erişimi */
  adminGroupCode: process.env.SELUK_API_ADMIN_GROUP_CODE || '',
  adminPermissionCodes: parsePermissionCodes(
    process.env.SELUK_API_ADMIN_PERMISSION_CODES,
  ),
  /** POST /api/v1/Permission/HasPermission — personel panel erişimi */
  staffGroupCode: process.env.SELUK_API_STAFF_GROUP_CODE || '',
  staffPermissionCodes: parsePermissionCodes(
    process.env.SELUK_API_STAFF_PERMISSION_CODES,
  ),
}));
