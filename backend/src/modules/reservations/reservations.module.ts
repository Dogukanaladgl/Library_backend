import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { CheckInService } from './check-in.service';
import { ReservationEventService } from './reservation-event.service';
import { ReservationSchedulerService } from './reservation-scheduler.service';
import {
  Reservation,
  ReservationLog,
  Table,
  TableLock,
  Hall,
} from '../../database/entities';
import { HallsModule } from '../halls/halls.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { SumobAuthModule } from '../sumob-auth/sumob-auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reservation,
      ReservationLog,
      Table,
      TableLock,
      Hall,
    ]),
    HallsModule,
    SchedulesModule,
    SumobAuthModule,
  ],
  controllers: [ReservationsController],
  providers: [
    ReservationsService,
    CheckInService,
    ReservationEventService,
    ReservationSchedulerService,
  ],
  exports: [ReservationsService],
})
export class ReservationsModule {}
