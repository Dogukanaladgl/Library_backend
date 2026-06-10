import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Hall,
  HallAvailabilityException,
  HallClosure,
} from '../../database/entities';
import { HallAvailabilityService } from './hall-availability.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HallAvailabilityException,
      HallClosure,
      Hall,
    ]),
  ],
  providers: [HallAvailabilityService],
  exports: [HallAvailabilityService],
})
export class HallAvailabilityModule {}
