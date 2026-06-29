import { Injectable } from '@nestjs/common';
import { UserRole } from '../../database/entities';

export interface PanelServerSession {
  universityAccessToken: string;
  role: UserRole.ADMIN | UserRole.STAFF;
}

/**
 * Web panel üniversite oturumu — uni accessToken yalnızca sunucuda tutulur.
 * Panel JWT ile eşleşen userId üzerinden IsAuthenticate / HasPermission kontrolü yapılır.
 */
@Injectable()
export class PanelSessionService {
  private readonly sessions = new Map<string, PanelServerSession>();

  set(userId: string, session: PanelServerSession): void {
    this.sessions.set(userId, session);
  }

  get(userId: string): PanelServerSession | undefined {
    return this.sessions.get(userId);
  }

  delete(userId: string): void {
    this.sessions.delete(userId);
  }
}
