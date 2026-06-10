import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  AvailabilityExceptionType,
  HallClosureReason,
} from '../../../database/entities';

export class CreateAvailabilityExceptionDto {
  @ApiProperty({ example: '2026-06-10', description: 'En az yarın (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Gecerli saat formati: HH:MM',
  })
  startTime: string;

  @ApiProperty({ example: '12:00' })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Gecerli saat formati: HH:MM',
  })
  endTime: string;

  @ApiProperty({ enum: AvailabilityExceptionType, example: 'closed' })
  @IsEnum(AvailabilityExceptionType)
  type: AvailabilityExceptionType;

  @ApiPropertyOptional({ example: 'Kitap sayımı' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class CreateHallClosureDto {
  @ApiProperty({ example: '2026-06-10' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-06-12' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ enum: HallClosureReason, example: 'cleaning' })
  @IsEnum(HallClosureReason)
  reason: HallClosureReason;

  @ApiPropertyOptional({ example: 'Salon temizligi' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateLibraryClosureDto extends CreateHallClosureDto {
  @ApiPropertyOptional({
    description: 'Belirtilmezse tum kutuphane kapanir',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  hallId?: string;
}
