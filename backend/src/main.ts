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
  const corsOrigins = configService.get<string[]>('app.corsOrigins', [
    'http://localhost:5173',
  ]);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Swagger
  const swaggerEnabled = configService.get<boolean>('app.swaggerEnabled', true);
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle(
        configService.get<string>(
          'app.swaggerTitle',
          'Kutuphane Rezervasyon API',
        ),
      )
      .setDescription(configService.get<string>('app.swaggerDescription', ''))
      .setVersion(configService.get<string>('app.swaggerVersion', '1.0'))
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
