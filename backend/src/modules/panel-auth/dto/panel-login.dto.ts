import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class PanelLoginDto {
  @ApiProperty({
    example: '223301001',
    description: 'Öğrenci veya personel numarası (apiservices Auth/Login)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Kullanıcı adı boş olamaz.' })
  userName: string;

  @ApiProperty({
    example: '********',
    description: 'Üniversite / OBIS şifresi (apiservices)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Şifre boş olamaz.' })
  @MinLength(1, { message: 'Şifre boş olamaz.' })
  password: string;
}
