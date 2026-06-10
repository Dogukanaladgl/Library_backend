import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Hall } from './hall.entity';
import { User } from './user.entity';

export enum AvailabilityExceptionType {
  OPEN = 'open',
  CLOSED = 'closed',
}

@Entity('hall_availability_exceptions')
export class HallAvailabilityException {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'hall_id' })
  hallId: string;

  @Column({ name: 'exception_date', type: 'date' })
  exceptionDate: Date;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({
    name: 'exception_type',
    type: 'enum',
    enum: AvailabilityExceptionType,
    default: AvailabilityExceptionType.CLOSED,
  })
  exceptionType: AvailabilityExceptionType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Hall, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hall_id' })
  hall: Hall;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;
}
