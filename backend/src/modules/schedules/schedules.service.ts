import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { getNowInTurkeyFrame } from '../../common/utils/turkey-time';
import {
  OperatingSchedule,
  ScheduleType,
  SchedulePeriodKind,
  ScheduleRules,
} from '../../database/entities';
import { CreateScheduleDto, UpdateScheduleDto } from './dto';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(OperatingSchedule)
    private readonly scheduleRepository: Repository<OperatingSchedule>,
  ) {}

  async findAll(): Promise<OperatingSchedule[]> {
    return this.scheduleRepository.find({
      order: { startDate: 'DESC' },
    });
  }

  async findActive(): Promise<OperatingSchedule[]> {
    return this.scheduleRepository.find({
      where: { isActive: true },
      order: { startDate: 'DESC' },
    });
  }

  async findCurrent(): Promise<OperatingSchedule | null> {
    const today = getNowInTurkeyFrame();
    const queryDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    return this.findEffectiveScheduleByDate(queryDate);
  }

  async findOne(id: string): Promise<OperatingSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException('Takvim bulunamadı');
    }

    return schedule;
  }

  async create(createDto: CreateScheduleDto): Promise<OperatingSchedule> {
    const schedule = this.scheduleRepository.create({
      ...createDto,
      periodKind: createDto.periodKind ?? SchedulePeriodKind.STANDARD,
      priority: createDto.priority ?? 0,
      rules: createDto.rules ?? {},
    });
    return this.scheduleRepository.save(schedule);
  }

  async update(id: string, updateDto: UpdateScheduleDto): Promise<OperatingSchedule> {
    const schedule = await this.findOne(id);
    Object.assign(schedule, {
      ...updateDto,
      ...(updateDto.rules ? { rules: updateDto.rules } : {}),
    });
    return this.scheduleRepository.save(schedule);
  }

  async remove(id: string): Promise<void> {
    const schedule = await this.findOne(id);
    schedule.isActive = false;
    await this.scheduleRepository.save(schedule);
  }

  async getOperatingHoursForDate(date: Date): Promise<{
    is24h: boolean;
    openingTime: string;
    closingTime: string;
    scheduleType: ScheduleType;
    scheduleName: string;
  }> {
    const schedule = await this.findEffectiveScheduleByDate(date);

    if (schedule) {
      return {
        is24h: schedule.is24h,
        openingTime: schedule.openingTime,
        closingTime: schedule.closingTime,
        scheduleType: schedule.scheduleType,
        scheduleName: schedule.name,
      };
    }

    // Varsayılan değerler
    return {
      is24h: false,
      openingTime: '08:00',
      closingTime: '23:00',
      scheduleType: ScheduleType.NORMAL,
      scheduleName: 'Normal Dönem',
    };
  }

  async findEffectiveScheduleByDate(date: Date): Promise<OperatingSchedule | null> {
    return this.scheduleRepository.findOne({
      where: {
        isActive: true,
        startDate: LessThanOrEqual(date),
        endDate: MoreThanOrEqual(date),
      },
      order: {
        priority: 'DESC',
        startDate: 'DESC',
      },
    });
  }

  async getReservationDatePolicyForDate(date: Date): Promise<{
    periodKind: SchedulePeriodKind;
    rules: ScheduleRules;
    scheduleName: string;
  }> {
    const schedule = await this.findEffectiveScheduleByDate(date);
    if (!schedule) {
      return {
        periodKind: SchedulePeriodKind.STANDARD,
        rules: {},
        scheduleName: 'Normal Dönem',
      };
    }

    return {
      periodKind: schedule.periodKind ?? SchedulePeriodKind.STANDARD,
      rules: schedule.rules ?? {},
      scheduleName: schedule.name,
    };
  }
}

