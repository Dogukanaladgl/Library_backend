import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// Config
import { appConfig, databaseConfig } from './config';

// Entities
import {
  Hall,
  Table,
  TableFeature,
  TableLock,
  Reservation,
  ReservationLog,
  OperatingSchedule,
  Notification,
  UserPreference,
  User,
  UserSession,
} from './database/entities';

// Modules
import { HallsModule } from './modules/halls/halls.module';
import { TablesModule } from './modules/tables/tables.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AdminModule } from './modules/admin/admin.module';
import { DeskModule } from './modules/desk/desk.module';

@Module({
  imports: [
    // Konfigürasyon
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      load: [appConfig, databaseConfig],
      envFilePath: ['.env', '.env.development', '.env.local'],
    }),

    // Veritabanı
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const entities = [
          Hall,
          Table,
          TableFeature,
          TableLock,
          Reservation,
          ReservationLog,
          OperatingSchedule,
          Notification,
          UserPreference,
          User,
          UserSession,
        ];
        const base = {
          type: 'postgres' as const,
          entities,
          synchronize: configService.get('database.synchronize'),
          logging: configService.get('database.logging'),
        };
        const url = configService.get<string | undefined>('database.url');
        if (url) {
          return { ...base, url };
        }
        return {
          ...base,
          host: configService.get<string>('database.host', 'localhost'),
          port: configService.get<number>('database.port', 5432),
          username: configService.get<string>('database.username', ''),
          password: configService.get<string>('database.password', ''),
          database: configService.get<string>('database.database', ''),
        };
      },
    }),

    // Zamanlayıcı (Cron jobs)
    ScheduleModule.forRoot(),

    // Uygulama Modülleri
    AuthModule,
    UsersModule,
    HallsModule,
    TablesModule,
    ReservationsModule,
    StatisticsModule,
    SchedulesModule,
    AdminModule,
    DeskModule,
  ],
})
export class AppModule {}
