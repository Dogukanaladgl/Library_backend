import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * SUMOB doğrulaması sonrası `request.user` olarak set edilen kullanıcı bilgisi.
 * Profil alanları (fullName/email/faculty/department) her istekte SUMOB'tan
 * tazelenir; library DB sadece rol haritasını tutar.
 */
export interface RequestUser {
  /** Library `users.id` (FK için). */
  id: string;
  /** SUMOB kurumNo. */
  studentNumber: string;
  /** Library rolü (student/admin/staff). */
  role: string;
  /** SUMOB'tan gelen tam ad. */
  fullName: string;
  /** SUMOB e-posta. */
  email?: string | null;
  /** SUMOB fakülte adı. */
  facultyName?: string | null;
  /** SUMOB bölüm adı. */
  departmentName?: string | null;
  /** Library super-admin bayrağı. */
  isSuperAdmin?: boolean;
  /** Yarı zamanlı salon görevlisi (student rolü + staff paneli). */
  isStaffMember?: boolean;
  /** SUMOB userKey (audit/cache). */
  sumobUserKey?: string;
  /** SUMOB Users.id. */
  sumobUserId?: number;
}

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: RequestUser = request.user;
    return data ? user[data] : user;
  },
);
