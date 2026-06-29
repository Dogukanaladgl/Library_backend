import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../database/entities';

export class UserProfileDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Library users.id (FK referansı; istemci için anlamsız).',
  })
  id: string;

  @ApiProperty({ example: '200000001', description: 'Kurum / öğrenci numarası.' })
  studentNumber: string;

  @ApiProperty({
    example: 'Ahmet Yılmaz',
    description: 'Kütüphane veritabanındaki ad soyad.',
  })
  fullName: string;

  @ApiProperty({ enum: UserRole, example: UserRole.STAFF })
  role: UserRole;

  @ApiProperty({ required: false, nullable: true, example: 'user@selcuk.edu.tr' })
  email?: string | null;

  @ApiProperty({ required: false, nullable: true, example: 'Mühendislik Fakültesi' })
  facultyName?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'Bilgisayar Mühendisliği',
  })
  departmentName?: string | null;

  @ApiProperty({ required: false, example: false })
  isSuperAdmin?: boolean;

  @ApiProperty({
    required: false,
    example: false,
    description:
      'Yarı zamanlı salon görevlisi bayrağı; mobil uygulama için kullanılır.',
  })
  isStaffMember?: boolean;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Oturum başarıyla kapatıldı.' })
  message: string;
}
