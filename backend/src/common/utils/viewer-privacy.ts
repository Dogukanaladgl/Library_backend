import { UserRole } from '../../database/entities';
import type { RequestUser } from '../../modules/auth/decorators/current-user.decorator';

/** Yönetici dışındaki personel görünümlerinde kişisel ad soyad maskelenir. */
export function shouldMaskPersonalNamesForViewer(
  viewer?: RequestUser | null,
): boolean {
  if (!viewer) return false;
  if (viewer.role === UserRole.ADMIN) return false;
  if (viewer.role === UserRole.STAFF) return true;
  if (viewer.isStaffMember === true) return true;
  return false;
}
