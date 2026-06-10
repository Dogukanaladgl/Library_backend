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

export enum HallClosureReason {
  INVENTORY_COUNT = 'inventory_count',
  CLEANING = 'cleaning',
  MAINTENANCE = 'maintenance',
  OTHER = 'other',
}

@Entity('hall_closures')
export class HallClosure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** null = tüm kütüphane kapalı */
  @Column({ name: 'hall_id', nullable: true })
  hallId: string | null;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Column({
    type: 'enum',
    enum: HallClosureReason,
    default: HallClosureReason.OTHER,
  })
  reason: HallClosureReason;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Hall, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hall_id' })
  hall: Hall | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;
}
