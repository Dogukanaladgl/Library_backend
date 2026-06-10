import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { HallAvailabilityModule } from '../hall-availability/hall-availability.module';
import {
  Reservation,
  Hall,
  Table,
  TableFeature,
  TableLock,
  OperatingSchedule,
  User,
} from '../../database/entities';

@Module({
  imports: [
    HallAvailabilityModule,
    TypeOrmModule.forFeature([
      Reservation,
      Hall,
      Table,
      TableFeature,
      TableLock,
      OperatingSchedule,
      User,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, RolesGuard],
})
export class AdminModule {}
