import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HallsController } from './halls.controller';
import { HallsService } from './halls.service';
import { Hall, Table, TableLock, Reservation } from '../../database/entities';
import { SchedulesModule } from '../schedules/schedules.module';
import { HallAvailabilityModule } from '../hall-availability/hall-availability.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Hall, Table, TableLock, Reservation]),
    SchedulesModule,
    HallAvailabilityModule,
  ],
  controllers: [HallsController],
  providers: [HallsService],
  exports: [HallsService],
})
export class HallsModule {}

