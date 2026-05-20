import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  STUDENT = 'student',
  ADMIN = 'admin',
  STAFF = 'staff',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_number', length: 50, unique: true })
  studentNumber: string;

  /**
   * Eski parola-tabanlı login kaldırıldı; oturum doğrulaması artık SUMOB
   * (`sp_find_user`) üzerinden yapılıyor. Alan geriye dönük şema uyumluluğu
   * için tutuluyor; yeni satırlar boş string olarak yazılır.
   */
  @Column({
    type: 'varchar',
    name: 'password_hash',
    length: 255,
    nullable: true,
  })
  passwordHash: string | null;

  @Column({ name: 'full_name', length: 150 })
  fullName: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.STUDENT,
  })
  role: UserRole;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_super_admin', default: false })
  isSuperAdmin: boolean;

  /**
   * Yarı zamanlı salon görevlisi kaydı (`is_staff_member`); görev atanırken
   * rolleri `staff` yapılır (giriş yönlendirmesi için). Admin hesapları hariç.
   */
  @Column({ name: 'is_staff_member', default: false })
  isStaffMember: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
