import { randomInt } from 'crypto';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { AuditService } from '../audit/audit.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { MailService } from '../mail/mail.service';
import { TwoFactorBackupCode, UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AuthService, SessionMeta } from './auth.service';

// ±1 step (±30s) either side of "now" — otplib's default (0) is stricter
// than real-world phone/server clock skew tolerates well; this is the
// standard, widely-used tolerance for TOTP verification.
authenticator.options = { window: 1 };

const PENDING_SECRET_TTL_MS = 15 * 60 * 1000;
const SALT_ROUNDS = 12;
const BACKUP_CODE_COUNT = 10;
// Excludes 0/O/1/I/l — visually ambiguous characters a user copying a code
// by hand (from an authenticator app enrollment screen or a saved list)
// could easily mistype.
const BACKUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class TwoFactorService {
  constructor(
    private usersService: UsersService,
    private encryption: EncryptionService,
    private jwtService: JwtService,
    private auditService: AuditService,
    private mailService: MailService,
    private authService: AuthService,
  ) {}

  async getStatus(userId: string): Promise<{ enabled: boolean; enabledAt?: Date; backupCodesRemaining: number }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();
    return {
      enabled: user.twoFactorEnabled,
      enabledAt: user.twoFactorEnabledAt,
      backupCodesRemaining: user.twoFactorBackupCodes.filter((c) => !c.usedAt).length,
    };
  }

  async setup(userId: string): Promise<{ secret: string; qrCodeDataUrl: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();
    const secret = authenticator.generateSecret();
    await this.usersService.setPendingTwoFactorSecret(
      userId,
      this.encryption.encrypt(secret),
      new Date(Date.now() + PENDING_SECRET_TTL_MS),
    );
    const uri = authenticator.keyuri(user.email, 'HaiVE', secret);
    const qrCodeDataUrl = await qrcode.toDataURL(uri);
    // Raw secret returned alongside the QR for manual entry (standard
    // practice — this endpoint is already JwtAuthGuard-protected, so it's
    // not spuriously exposed to anyone but the account owner).
    return { secret, qrCodeDataUrl };
  }

  async enable(userId: string, code: string, ip?: string): Promise<{ backupCodes: string[] }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();
    if (!user.twoFactorPendingSecretEncrypted || !user.twoFactorPendingSecretExpiresAt) {
      throw new BadRequestException('No pending 2FA setup — start again from Settings > Security');
    }
    if (user.twoFactorPendingSecretExpiresAt < new Date()) {
      throw new BadRequestException('2FA setup expired — start again and scan the new QR code');
    }
    const secret = this.encryption.decrypt(user.twoFactorPendingSecretEncrypted);
    if (!authenticator.verify({ token: normalizeCode(code), secret })) {
      throw new BadRequestException('Incorrect code — check your authenticator app and try again');
    }
    const { plain, entries } = await this.generateBackupCodes();
    await this.usersService.confirmTwoFactor(userId, this.encryption.encrypt(secret), entries);
    void this.mailService.sendTwoFactorEnabledEmail(user.email);
    void this.auditService.log({
      userId,
      organizationId: user.organizationId,
      method: 'POST',
      route: '/auth/2fa/enable',
      statusCode: 200,
      durationMs: 0,
      ip,
      action: '2fa.enable',
    });
    return { backupCodes: plain };
  }

  async disable(userId: string, reauth: { password?: string; code?: string }, currentJti: string, ip?: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }
    await this.assertReauth(user, reauth);
    await this.usersService.clearTwoFactor(userId);
    await this.usersService.revokeAllOtherSessions(userId, currentJti);
    void this.auditService.log({
      userId,
      organizationId: user.organizationId,
      method: 'POST',
      route: '/auth/2fa/disable',
      statusCode: 200,
      durationMs: 0,
      ip,
      action: '2fa.disable',
    });
  }

  async regenerateBackupCodes(
    userId: string,
    reauth: { password?: string; code?: string },
    ip?: string,
  ): Promise<{ backupCodes: string[] }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }
    await this.assertReauth(user, reauth);
    const { plain, entries } = await this.generateBackupCodes();
    await this.usersService.setBackupCodes(userId, entries);
    void this.auditService.log({
      userId,
      organizationId: user.organizationId,
      method: 'POST',
      route: '/auth/2fa/backup-codes/regenerate',
      statusCode: 200,
      durationMs: 0,
      ip,
      action: '2fa.backup_codes_regenerated',
    });
    return { backupCodes: plain };
  }

  /** Completes the login-2fa-challenge flow started by AuthService.
   * issueTokenOrChallenge — verifies the short-lived challenge token itself
   * (same manual jwtService.verify() pattern OAuthController already uses
   * for its own `state` token), then the user's code, and only then issues
   * a real session — never at challenge-issuing time. Deliberately not
   * audit-logged, same as plain login (see AuthService.changePassword's own
   * comment on the /auth audit-skip rule) — this is an auth-frequency
   * event, not a security-settings change. */
  async verifyLoginChallenge(challengeToken: string, code: string, meta: SessionMeta): Promise<{ accessToken: string }> {
    let payload: { sub: string; purpose: string };
    try {
      payload = this.jwtService.verify(challengeToken);
    } catch {
      throw new UnauthorizedException('This code has expired — please sign in again');
    }
    if (payload.purpose !== 'login-2fa-challenge') {
      throw new UnauthorizedException();
    }
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.active === false || !user.twoFactorEnabled) {
      throw new UnauthorizedException();
    }
    if (!(await this.verifyCode(user, code))) {
      throw new UnauthorizedException('Incorrect code');
    }
    return this.authService.issueSessionToken(user, meta);
  }

  /** Shared by disable/regenerate — accepts EITHER the account password OR
   * a current TOTP/backup code. Requiring only a fresh TOTP would create a
   * lockout paradox for the single most common real reason to disable 2FA
   * (a lost/reset authenticator device); password is the primary path
   * (mirrors AuthService.changePassword's own re-auth), code is the
   * fallback for OAuth-only accounts with no passwordHash. */
  private async assertReauth(user: UserDocument, reauth: { password?: string; code?: string }): Promise<void> {
    if (reauth.password && user.passwordHash && (await bcrypt.compare(reauth.password, user.passwordHash))) {
      return;
    }
    if (reauth.code && (await this.verifyCode(user, reauth.code))) {
      return;
    }
    throw new BadRequestException('Confirm your password or a current 2FA code to continue');
  }

  /** 6 digits → TOTP against the account's own confirmed secret; anything
   * else → tried against each unused backup-code hash. Marks a matching
   * backup code used (single-use) as a side effect of a successful match. */
  private async verifyCode(user: UserDocument, code: string): Promise<boolean> {
    const normalized = normalizeCode(code);
    if (/^\d{6}$/.test(normalized) && user.twoFactorSecretEncrypted) {
      const secret = this.encryption.decrypt(user.twoFactorSecretEncrypted);
      if (authenticator.verify({ token: normalized, secret })) return true;
    }
    for (const entry of user.twoFactorBackupCodes) {
      if (entry.usedAt) continue;
      if (await bcrypt.compare(normalized, entry.codeHash)) {
        await this.usersService.markBackupCodeUsed(user._id.toString(), entry.codeHash);
        return true;
      }
    }
    return false;
  }

  private async generateBackupCodes(): Promise<{ plain: string[]; entries: TwoFactorBackupCode[] }> {
    const raws = Array.from({ length: BACKUP_CODE_COUNT }, () => generateBackupCodeValue());
    const entries = await Promise.all(raws.map(async (raw) => ({ codeHash: await bcrypt.hash(raw, SALT_ROUNDS) })));
    return { plain: raws.map(formatBackupCode), entries };
  }
}

function generateBackupCodeValue(): string {
  let raw = '';
  for (let i = 0; i < 8; i++) {
    raw += BACKUP_CODE_ALPHABET[randomInt(BACKUP_CODE_ALPHABET.length)];
  }
  return raw;
}

function formatBackupCode(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

// Strips whitespace/hyphens and uppercases so "1234 5678", "1234-5678", and
// "12345678" (and their lowercase forms) all compare identically — matches
// how the codes are hashed at generation time (the un-hyphenated raw form).
function normalizeCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}
