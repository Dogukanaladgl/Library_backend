import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../database/entities';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (requiredRoles.includes(user.role)) return true;

    // Yarı zamanlı salon görevlileri: `student` rolündeler ama `isStaffMember`
    // bayrağı ile staff panel endpoint'lerine erişebilirler.
    if (
      requiredRoles.includes(UserRole.STAFF) &&
      user?.isStaffMember === true
    ) {
      return true;
    }
    return false;
  }
}
