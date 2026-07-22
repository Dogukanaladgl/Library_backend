import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../database/entities';
import { UserProfileDto } from '../auth/dto';
import { SelcukAuthException } from '../selcuk-api/selcuk-auth.exception';
import { stripUserNameToNumber } from '../selcuk-api/selcuk-login.util';
import { SelcukApiService } from '../selcuk-api/selcuk-api.service';
import { PanelLoginDto } from './dto/panel-login.dto';
import { PanelLoginResponseDto } from './dto/panel-login-response.dto';
import { PanelSessionService } from './panel-session.service';
import type { PanelJwtPayload } from './panel-auth.types';

type PanelAccessRole = UserRole.ADMIN | UserRole.STAFF;

@Injectable()
export class PanelAuthService {
  private readonly logger = new Logger(PanelAuthService.name);

  constructor(
    private readonly selcukApi: SelcukApiService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly panelSessions: PanelSessionService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Web panel girişi:
   * 1) apiservices Auth/Login
   * 2) IsAuthenticate + HasPermission → rol
   * 3) Üniversite token sunucu oturumuna yazılır
   * 4) Yalnızca panel accessToken döner (refresh yok)
   */
  async login(dto: PanelLoginDto): Promise<PanelLoginResponseDto> {
    const { studentNumber, panelRole, universityAccessToken } =
      await this.verifyUniversityCredentials(dto);

    let libUser = await this.findLibraryUser(studentNumber, dto.userName);

    if (!libUser) {
      // Yetki University'de (HasPermission) verildiği için, yerel `users` satırı yoksa
      // burada otomatik oluşturulur (mobil `ensureLibraryUserId` ile aynı nötr
      // varsayılanlar). Böylece University tek doğru kaynak olur; manuel kayıt gerekmez.
      libUser = await this.provisionLibraryUser(studentNumber);
    }

    if (!libUser.isActive) {
      throw new ForbiddenException(
        'Hesabınız kütüphane sisteminde devre dışı bırakılmış.',
      );
    }

    this.panelSessions.set(libUser.id, {
      universityAccessToken,
      role: panelRole,
    });

    const accessToken = await this.issueAccessToken(libUser, panelRole);

    this.logger.log(
      `Panel girişi başarılı (studentNumber=${libUser.studentNumber}, panelRole=${panelRole})`,
    );

    return {
      accessToken,
      user: this.toProfile(libUser, panelRole),
    };
  }

  logout(userId: string): void {
    this.panelSessions.delete(userId);
  }

  async getProfileById(
    userId: string,
    panelRole: PanelAccessRole,
  ): Promise<UserProfileDto> {
    const libUser = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!libUser || !libUser.isActive) {
      throw new UnauthorizedException('Kullanıcı bulunamadı.');
    }
    return this.toProfile(libUser, panelRole);
  }

  private async verifyUniversityCredentials(
    dto: PanelLoginDto,
  ): Promise<{
    studentNumber: string;
    panelRole: PanelAccessRole;
    universityAccessToken: string;
  }> {
    try {
      const loginValue = await this.selcukApi.loginForPanel({
        userName: dto.userName,
        password: dto.password,
      });

      const panelRole = await this.selcukApi.resolvePanelRoleFromPermissions(
        loginValue.accessToken,
        { trustFreshLogin: true },
      );

      const studentNumber =
        stripUserNameToNumber(dto.userName) || dto.userName.trim();
      if (!studentNumber) {
        throw new UnauthorizedException('Kullanıcı numarası geçersiz.');
      }

      return {
        studentNumber,
        panelRole,
        universityAccessToken: loginValue.accessToken,
      };
    } catch (error) {
      if (error instanceof SelcukAuthException) {
        throw error;
      }
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Kullanıcı adı veya şifre hatalı.');
    }
  }

  private async findLibraryUser(
    primaryNumber: string,
    rawUserName: string,
  ): Promise<User | null> {
    const candidates = [
      primaryNumber.trim(),
      stripUserNameToNumber(rawUserName),
    ].filter(Boolean);

    const unique = [...new Set(candidates)];

    for (const studentNumber of unique) {
      const user = await this.userRepository.findOne({
        where: { studentNumber },
      });
      if (user) return user;
    }

    return null;
  }

  /**
   * University yetkisi doğrulanmış fakat kütüphanede kaydı olmayan kullanıcı için
   * yerel `users` satırını lazy oluşturur. Mobil akıştaki `ensureLibraryUserId` ile
   * AYNI nötr varsayılanlar kullanılır — hiçbir yerel ayrıcalık (staff/superadmin)
   * verilmez; panel erişim tier'ı her istekte University HasPermission'dan doğrulanır,
   * yani DB `role`/flag'leri yetki kapısı DEĞİLDİR. Satır yalnızca rezervasyon FK'si içindir.
   */
  private async provisionLibraryUser(studentNumber: string): Promise<User> {
    try {
      return await this.userRepository.save(
        this.userRepository.create({
          studentNumber,
          fullName: studentNumber, // gerçek ad için ileride University GetProfile eklenebilir
          role: UserRole.STUDENT,
          isActive: true,
          isSuperAdmin: false,
          isStaffMember: false,
        }),
      );
    } catch (error) {
      // Eşzamanlı ilk giriş yarışı: unique(student_number) ihlali → mevcut satırı getir
      const existing = await this.findLibraryUser(studentNumber, studentNumber);
      if (existing) return existing;
      throw error;
    }
  }

  private async issueAccessToken(
    user: User,
    panelRole: PanelAccessRole,
  ): Promise<string> {
    const accessPayload: PanelJwtPayload = {
      sub: user.id,
      studentNumber: user.studentNumber,
      role: panelRole,
      isSuperAdmin: user.isSuperAdmin,
      isStaffMember: user.isStaffMember,
      type: 'panel',
    };

    const accessExpiresIn = this.config.get<string>(
      'app.jwtExpiresIn',
      '8h',
    );

    return this.jwtService.signAsync(accessPayload, {
      expiresIn: accessExpiresIn as '8h',
    });
  }

  private toProfile(
    user: User,
    panelRole: PanelAccessRole,
  ): UserProfileDto {
    return {
      id: user.id,
      studentNumber: user.studentNumber,
      fullName: user.fullName,
      role: panelRole,
      email: null,
      facultyName: null,
      departmentName: null,
      isSuperAdmin: user.isSuperAdmin,
      isStaffMember: user.isStaffMember,
    };
  }
}
