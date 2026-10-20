import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import type { SelcukProfileValue } from '../selcuk-api/selcuk-api.types';
import { stripUserNameToNumber } from '../selcuk-api/selcuk-login.util';
import { SumobAuthService } from '../sumob-auth/sumob-auth.service';

@Injectable()
export class OrtakWebUserService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly sumobAuth: SumobAuthService,
  ) {}

  async fromUniversityProfile(profile: SelcukProfileValue): Promise<RequestUser> {
    const studentNumber = studentNumberFromProfile(profile);
    if (!studentNumber) {
      throw new UnauthorizedException(
        'Üniversite profilinden öğrenci numarası alınamadı.',
      );
    }

    const fullName =
      [profile.name, profile.surname].filter(Boolean).join(' ').trim() ||
      studentNumber;

    const id = await this.sumobAuth.ensureLibraryUserId(
      studentNumber,
      fullName,
    );
    const user = await this.users.findOne({ where: { id } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Kullanıcı kütüphane sisteminde bulunamadı veya devre dışı.',
      );
    }

    return {
      id: user.id,
      studentNumber: user.studentNumber,
      role: user.role,
      fullName: user.fullName,
      email: profile.email ?? null,
      isSuperAdmin: user.isSuperAdmin,
      isStaffMember: user.isStaffMember,
    };
  }
}

export function studentNumberFromProfile(
  profile: SelcukProfileValue,
): string | null {
  const fromReg = String(profile.corporateRegistrationNo ?? '').trim();
  if (fromReg) return stripUserNameToNumber(fromReg) || fromReg;

  const fromUser = String(profile.username ?? '').trim();
  if (fromUser) return stripUserNameToNumber(fromUser) || fromUser;

  if (profile.id != null && String(profile.id).trim() !== '') {
    return String(profile.id);
  }

  return null;
}
