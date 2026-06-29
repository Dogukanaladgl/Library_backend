import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';

// .env önce yüklenmeli; aksi halde env.defaults production DB'ye zorlar
loadDotenv({ path: resolve(process.cwd(), '.env') });

import './env.defaults';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global Prefix
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  // Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS
  const corsOrigins = configService.get<string[]>('app.corsOrigins', ['http://localhost:5173']);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Swagger
  const swaggerEnabled = configService.get<boolean>('app.swaggerEnabled', true);
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Kütüphane Rezervasyon API')
      .setDescription(
        `
        ## Selçuk Üniversitesi Kütüphane Masa Rezervasyon Sistemi
        
        Bu API, kütüphane masa rezervasyonu, QR check-in ve doluluk takibi işlemlerini yönetir.
        
        ### Özellikler
        - 🎫 Masa rezervasyonu (1-3 saat)
        - 📱 QR kod ile check-in
        - 📍 Konum doğrulama
        - 🔔 Bildirim sistemi
        - 📊 Doluluk istatistikleri
        `,
      )
      .setVersion('1.1.0-session-autoclose')
      .addBearerAuth()
      .addTag('auth', 'Kimlik doğrulama işlemleri')
      .addTag('halls', 'Salon işlemleri')
      .addTag('tables', 'Masa işlemleri')
      .addTag('reservations', 'Rezervasyon işlemleri')
      .addTag('statistics', 'İstatistik işlemleri')
      .addTag('schedules', 'Çalışma takvimi işlemleri')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  // Start
  const port = configService.get<number>('app.port', 8081);
  await app.listen(port);

  console.log(`
  🚀 Uygulama başlatıldı!
  
  📍 API: http://localhost:${port}/${apiPrefix}
  📚 Swagger: http://localhost:${port}/api/docs
  🌍 Ortam: ${configService.get('app.nodeEnv')}
  `);
}

bootstrap();
