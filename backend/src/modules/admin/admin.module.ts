import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  Reservation,
  Hall,
  Table,
  TableFeature,
  TableLock,
  OperatingSchedule,
} from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reservation,
      Hall,
      Table,
      TableFeature,
      TableLock,
      OperatingSchedule,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, RolesGuard],
})
export class AdminModule {}
