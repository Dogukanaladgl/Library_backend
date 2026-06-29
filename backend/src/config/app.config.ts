import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8081', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'default-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // QR
  qrSecret: process.env.QR_SECRET || 'default-qr-secret',
  
  // Konum
  locationMaxDistanceMeters: parseInt(process.env.LOCATION_MAX_DISTANCE_METERS || '300', 10),
  locationAccuracyToleranceCapMeters: parseInt(
    process.env.LOCATION_ACCURACY_TOLERANCE_CAP_METERS || '25',
    10,
  ),
  
  // Rezervasyon Kuralları
  reservationMaxHours: parseInt(process.env.RESERVATION_MAX_HOURS || '3', 10),
  reservationMinHours: parseInt(process.env.RESERVATION_MIN_HOURS || '1', 10),
  qrTimeoutMinutes: parseInt(process.env.QR_TIMEOUT_MINUTES || '30', 10),
  qrWarningMinutes: parseInt(process.env.QR_WARNING_MINUTES || '25', 10),
  chainQrTimeoutMinutes: parseInt(process.env.CHAIN_QR_TIMEOUT_MINUTES || '15', 10),
  lockReleaseDelayMinutes: parseInt(process.env.LOCK_RELEASE_DELAY_MINUTES || '5', 10),
  
  // CORS
  //corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
   
  // CORS
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : [
        'http://localhost:8081',
        'http://localhost:5173',
        'http://localhost:8082',
        'http://127.0.0.1:8081',
        'http://127.0.0.1:8082',
      ],

  // Timezone
  // DB stores TIMESTAMP WITHOUT TIME ZONE values as local Turkey wall-clock time.
  // This offset aligns new Date() (UTC) to that same "naive-UTC" frame for comparisons.
  tzOffsetHours: parseInt(process.env.TZ_OFFSET_HOURS || '3', 10),

  // Swagger
  swaggerEnabled: process.env.SWAGGER_ENABLED !== 'false',
  swaggerTitle: process.env.SWAGGER_TITLE || 'Kutuphane Rezervasyon API',
  swaggerDescription:
    process.env.SWAGGER_DESCRIPTION ||
    'Selcuk Universitesi Kutuphane Masa Rezervasyon Sistemi',
  swaggerVersion: process.env.SWAGGER_VERSION || '1.0',
}));

