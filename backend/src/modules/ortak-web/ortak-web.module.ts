import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities';
import { HallsModule } from '../halls/halls.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { SelcukApiModule } from '../selcuk-api/selcuk-api.module';
import { StatisticsModule } from '../statistics/statistics.module';
import { OrtakWebJwtGuard } from './guards/ortak-web-jwt.guard';
import { OrtakWebHallsController } from './ortak-web-halls.controller';
import { OrtakWebMeController } from './ortak-web-me.controller';
import { OrtakWebReservationsController } from './ortak-web-reservations.controller';
import { OrtakWebStatisticsController } from './ortak-web-statistics.controller';
import { OrtakWebUserService } from './ortak-web-user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    SelcukApiModule,
    HallsModule,
    ReservationsModule,
    StatisticsModule,
  ],
  controllers: [
    OrtakWebMeController,
    OrtakWebHallsController,
    OrtakWebStatisticsController,
    OrtakWebReservationsController,
  ],
  providers: [OrtakWebJwtGuard, OrtakWebUserService],
})
export class OrtakWebModule {}
