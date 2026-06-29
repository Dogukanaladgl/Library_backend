/**
 * Üretim konfigürasyonu — .env.example ile aynı anahtarlar, prod değerleri gömülü.
 * Docker imajı ve sunucu deploy için harici .env gerekmez.
 * Lokal geliştirmede process.env veya .env ile override edilebilir.
 */
export const config = {
  // Uygulama
  NODE_ENV: 'production',
  PORT: '8081',
  API_PREFIX: 'api/v1',
  TZ_OFFSET_HOURS: '3',

  // Veritabani (PostgreSQL)
  DATABASE_URL:
    'postgresql://kutuphane:kut52upha33ne59282@172.16.64.110:5432/Kutuphane',
  DB_HOST: '172.16.64.110',
  DB_PORT: '5432',
  DB_USERNAME: 'kutuphane',
  DB_PASSWORD: 'kut52upha33ne59282',
  DB_DATABASE: 'Kutuphane',
  DB_SYNCHRONIZE: 'false',
  DB_LOGGING: 'false',

  // Redis
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6380',

  // JWT Authentication (kutuphane panel)
  JWT_SECRET: 'selcuk-university-library-jwt-prod-2026-xK8vNq3mZ7',
  JWT_EXPIRES_IN: '8h',
  JWT_REFRESH_EXPIRES_IN: '7d',

  // Selcuk Universitesi API Gateway
  SELUK_API_BASE_URL: 'https://apiservices.selcuk.edu.tr',
  SELUK_API_LOCALE: 'tr-TR',
  SELUK_API_CHANNEL: '0',
  SELUK_API_DEVICE_TOKEN: 'string',
  SELUK_API_TIMEOUT_MS: '30000',
  SELUK_API_TLS_INSECURE: 'false',
  SELUK_API_PERMISSION_OPERATION: '0',
  SELUK_API_ADMIN_GROUP_CODE: 'LIBRARY_SYSTEM',
  SELUK_API_ADMIN_PERMISSION_CODES: 'ADMIN',
  SELUK_API_STAFF_GROUP_CODE: 'LIBRARY_SYSTEM',
  SELUK_API_STAFF_PERMISSION_CODES: 'STAFF',

  // QR Kod
  QR_SECRET: 'selcuk-library-qr-prod-2026-pR9wLm4nBv',

  // Konum Dogrulama
  LOCATION_MAX_DISTANCE_METERS: '300',
  LOCATION_ACCURACY_TOLERANCE_CAP_METERS: '25',

  // Rezervasyon Kurallari
  RESERVATION_MAX_HOURS: '3',
  RESERVATION_MIN_HOURS: '1',
  QR_TIMEOUT_MINUTES: '30',
  QR_WARNING_MINUTES: '25',
  CHAIN_QR_TIMEOUT_MINUTES: '15',
  LOCK_RELEASE_DELAY_MINUTES: '5',

  // Bildirimler (Firebase) — henuz kullanilmiyor
  FIREBASE_PROJECT_ID: '',
  FIREBASE_PRIVATE_KEY: '',
  FIREBASE_CLIENT_EMAIL: '',

  // CORS
  CORS_ORIGINS:
    'https://kutuphaneservice.selcuk.edu.tr,http://193.255.245.32:8081,http://localhost:8081,http://localhost:5173,http://localhost:3000',

  // Swagger
  SWAGGER_ENABLED: 'true',
  SWAGGER_TITLE: 'Kutuphane Rezervasyon API',
  SWAGGER_DESCRIPTION:
    'Selcuk Universitesi Kutuphane Masa Rezervasyon Sistemi',
  SWAGGER_VERSION: '1.0',
} as const;

for (const [key, value] of Object.entries(config)) {
  // Bos DATABASE_URL override etmesin; kod icindeki prod URL kullanilsin
  if (key === 'DATABASE_URL' && process.env[key] === '') {
    continue;
  }
  // Bos Firebase alanlari set edilmesin
  if (
    (key === 'FIREBASE_PROJECT_ID' ||
      key === 'FIREBASE_PRIVATE_KEY' ||
      key === 'FIREBASE_CLIENT_EMAIL') &&
    !value
  ) {
    continue;
  }
  if (process.env[key] === undefined || process.env[key] === '') {
    process.env[key] = value;
  }
}
