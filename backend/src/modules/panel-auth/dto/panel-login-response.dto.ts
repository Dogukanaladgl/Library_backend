import { ApiProperty } from '@nestjs/swagger';
import { UserProfileDto } from '../../auth/dto';

export class PanelLoginResponseDto {
  @ApiProperty({
    description: 'Kütüphane panel JWT (Bearer). Üniversite tokenı değildir.',
  })
  accessToken: string;

  @ApiProperty({ type: UserProfileDto })
  user: UserProfileDto;
}

export class PanelMessageResponseDto {
  @ApiProperty({ example: 'Oturum kapatıldı.' })
  message: string;
}
