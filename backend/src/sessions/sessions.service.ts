import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ChatGateway } from '../chat/chat.gateway';
import { UsersService } from '../users/users.service';

export interface SessionSummary {
  jti: string;
  device: string;
  location?: string;
  ip?: string;
  createdAt: Date;
  lastSeenAt: Date;
  current: boolean;
}

// Every method here is scoped to `userId` supplied by the caller (always
// the authenticated caller's own @CurrentUser().sub, see
// SessionsController) — there is no code path anywhere in this service that
// accepts or resolves a different user's id, so cross-user access is
// impossible by construction, not by a runtime check.
@Injectable()
export class SessionsService {
  constructor(
    private usersService: UsersService,
    private chatGateway: ChatGateway,
  ) {}

  async list(userId: string, currentJti: string): Promise<SessionSummary[]> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return [...user.sessions]
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
      .map((s) => ({
        jti: s.jti,
        device: s.device,
        location: s.location,
        ip: s.ip,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        current: s.jti === currentJti,
      }));
  }

  async revoke(userId: string, jti: string, currentJti: string): Promise<void> {
    if (jti === currentJti) {
      throw new BadRequestException('Use logout to end your own current session');
    }
    await this.usersService.revokeSession(userId, jti);
    this.chatGateway.disconnectSession(jti);
  }

  async revokeAllOthers(userId: string, currentJti: string): Promise<{ revokedCount: number }> {
    const revokedJtis = await this.usersService.revokeAllOtherSessions(userId, currentJti);
    for (const jti of revokedJtis) {
      this.chatGateway.disconnectSession(jti);
    }
    return { revokedCount: revokedJtis.length };
  }
}
