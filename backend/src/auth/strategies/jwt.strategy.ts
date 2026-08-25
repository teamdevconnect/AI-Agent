import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private usersService: UsersService,
  ) {
    const secret = config.get<string>('jwt.secret');
    if (!secret) {
      throw new Error('JWT_SECRET is not set');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  // Re-reads the account on every request instead of trusting the JWT's own
  // roles/active claims, which were only ever a snapshot from login time —
  // previously a deactivated account or a just-changed role kept working
  // with its old permissions for the token's full TTL (up to a day). This
  // costs one indexed findById per request in exchange for deactivation/role
  // changes taking effect on the very next call. The session check below
  // piggybacks on this same fetch — free, since the array is already on the
  // document this call already had to load.
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload?.sub) {
      throw new UnauthorizedException();
    }
    // Special-purpose tokens (login-2FA challenge, OAuth's own `state`
    // token) must never authenticate a real request even though they carry
    // a valid `sub` — they're proof of an in-progress flow, not a session.
    if (payload.purpose) {
      throw new UnauthorizedException();
    }
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.active === false) {
      throw new UnauthorizedException();
    }
    // The actual revocation check — a session-backed token whose jti no
    // longer appears in the user's sessions array (revoked, or issued
    // before this check existed at all) is rejected here, not just when its
    // own TTL expires.
    if (!payload.jti || !user.sessions.some((s) => s.jti === payload.jti)) {
      throw new UnauthorizedException();
    }
    void this.usersService.touchSessionIfStale(user._id.toString(), payload.jti);
    return {
      sub: user._id.toString(),
      email: user.email,
      roles: user.roles,
      organizationId: user.organizationId,
      storeId: user.storeId,
      assignedAgentId: user.assignedAgentId,
      department: user.department,
      jti: payload.jti,
      authMethod: 'session',
    };
  }
}
