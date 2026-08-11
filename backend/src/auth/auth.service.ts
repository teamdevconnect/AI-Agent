import { randomInt } from 'crypto';
import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { JwtPayload } from './jwt-payload.interface';
import { OAuthProfile, OAuthProviderName } from './oauth.service';

const SALT_ROUNDS = 12;
const VERIFY_OTP_TTL_MS = 10 * 60 * 1000;
const RESET_OTP_TTL_MS = 15 * 60 * 1000;
const GENERIC_OTP_ERROR = 'Invalid or expired code';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private organizationsService: OrganizationsService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  /** Registration always creates a brand-new organization (+ its default
   * store) with this user as its owner — there's no "join an existing org"
   * flow yet; adding teammates afterward goes through POST /users (admin
   * panel), which scopes the new account to the caller's own org. */
  async register(email: string, password: string, name: string, organizationName: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    const { organization, store } = await this.organizationsService.createOrganizationWithOwner(organizationName);
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await this.usersService.create({
      email,
      passwordHash,
      name,
      organizationId: organization._id.toString(),
      storeId: store._id.toString(),
      // 'admin' kept alongside 'owner' so every existing @Roles('admin')
      // gate (store-settings, integrations, agent-roles, user management)
      // keeps working for the org's creator without touching those decorators.
      roles: ['owner', 'admin'],
    });

    // Not awaited: an SMTP hiccup or slow provider must never add latency to
    // (or fail) the register response — MailService itself never throws, it
    // just logs, but this also decouples send time from request time.
    void this.sendVerificationOtp(user);
    void this.mailService.sendWelcomeEmail(user.email, user.name);

    return this.issueToken(user);
  }

  /** Generates a fresh OTP, stores its hash, and emails it — shared by
   * registration (auto-sent) and the explicit resend endpoint. */
  private async sendVerificationOtp(user: UserDocument): Promise<void> {
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);
    await this.usersService.setVerifyOtp(user._id.toString(), otpHash, new Date(Date.now() + VERIFY_OTP_TTL_MS));
    await this.mailService.sendVerificationOtp(user.email, otp);
  }

  /** Re-sends the email-verification OTP. Always resolves the same way
   * whether or not the account exists / is already verified — same
   * anti-enumeration reasoning as login's generic "Invalid credentials". */
  async resendVerificationOtp(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user || user.emailVerified) return;
    await this.sendVerificationOtp(user);
  }

  async verifyEmail(email: string, otp: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.verifyOtpHash || !user.verifyOtpExpiresAt || user.verifyOtpExpiresAt < new Date()) {
      throw new UnauthorizedException(GENERIC_OTP_ERROR);
    }
    if (!(await bcrypt.compare(otp, user.verifyOtpHash))) {
      throw new UnauthorizedException(GENERIC_OTP_ERROR);
    }
    await this.usersService.markEmailVerified(user._id.toString());
  }

  /** Always returns a masked-email shape, even for unknown addresses — the
   * mask is derived from the input itself, not a DB lookup, so a caller
   * learns nothing about whether the account exists. The reset OTP is only
   * actually generated/sent when the account is real. */
  async forgotPassword(email: string): Promise<{ maskedEmail: string }> {
    const user = await this.usersService.findByEmail(email);
    if (user) {
      const otp = generateOtp();
      const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);
      await this.usersService.setResetOtp(user._id.toString(), otpHash, new Date(Date.now() + RESET_OTP_TTL_MS));
      void this.mailService.sendPasswordResetOtp(user.email, otp);
    }
    return { maskedEmail: maskEmail(email) };
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt || user.resetOtpExpiresAt < new Date()) {
      throw new UnauthorizedException(GENERIC_OTP_ERROR);
    }
    if (!(await bcrypt.compare(otp, user.resetOtpHash))) {
      throw new UnauthorizedException(GENERIC_OTP_ERROR);
    }
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.usersService.resetPassword(user._id.toString(), passwordHash);
  }

  /** Change-password for an already-authenticated user (Settings > Security)
   * — distinct from resetPassword() above, which is the unauthenticated
   * forgot-password/OTP flow. Requires the current password rather than an
   * OTP, since the caller already proved identity via their JWT session. */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }
    if (!user.passwordHash) {
      throw new BadRequestException(
        'This account signs in via Google/Microsoft/GitHub and has no password to change — use "Forgot password" on the login page to set one.',
      );
    }
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      // 400, not 401 — the JWT itself is valid (JwtAuthGuard already
      // accepted it); frontend's extractErrorMessage() special-cases 401 as
      // "session expired", which would otherwise mask this message.
      throw new BadRequestException('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.usersService.resetPassword(userId, passwordHash);
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    // !user.passwordHash covers OAuth-only accounts (see loginWithOAuth) —
    // bcrypt.compare throws on a non-string hash, and such an account can't
    // have a valid password anyway. Same generic failure for "no such
    // user"/"wrong password"/"no password set" — don't turn this into a
    // user-enumeration oracle.
    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.active === false) {
      throw new UnauthorizedException('Account disabled');
    }
    return this.issueToken(user);
  }

  /** Finds-or-creates a user for a verified OAuth profile and issues the
   * same JWT shape as password login/register. Lookup order: linked
   * provider id first (stable across email changes), then email (so an
   * existing password-auth user who clicks "Sign in with Google" gets that
   * provider linked to their account instead of a duplicate one), then
   * finally creates a brand-new org+user exactly like register() does. */
  async loginWithOAuth(provider: OAuthProviderName, profile: OAuthProfile) {
    let user: UserDocument | null = await this.usersService.findByOAuthId(provider, profile.providerId);

    if (!user) {
      const existing = await this.usersService.findByEmail(profile.email);
      if (existing) {
        await this.usersService.linkOAuthProvider(existing._id.toString(), provider, profile.providerId);
        user = existing;
      } else {
        user = await this.registerOAuthUser(provider, profile);
      }
    }

    if (user.active === false) {
      throw new UnauthorizedException('Account disabled');
    }
    return this.issueToken(user);
  }

  private async registerOAuthUser(provider: OAuthProviderName, profile: OAuthProfile): Promise<UserDocument> {
    const { organization, store } = await this.organizationsService.createOrganizationWithOwner(
      `${profile.name}'s Workspace`,
    );
    const user = await this.usersService.create({
      email: profile.email,
      name: profile.name,
      organizationId: organization._id.toString(),
      storeId: store._id.toString(),
      roles: ['owner', 'admin'],
    });
    await this.usersService.linkOAuthProvider(user._id.toString(), provider, profile.providerId);
    // The provider already verified this email (Google/Microsoft/GitHub all
    // require a verified address to complete their own login) — no OTP round
    // trip needed here, unlike password registration.
    await this.usersService.markEmailVerified(user._id.toString());
    void this.mailService.sendWelcomeEmail(user.email, user.name);
    return user;
  }

  private issueToken(user: UserDocument) {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      roles: user.roles,
      organizationId: user.organizationId,
      storeId: user.storeId,
      assignedAgentId: user.assignedAgentId,
      department: user.department,
    };
    return { accessToken: this.jwtService.sign(payload) };
  }
}

function generateOtp(): string {
  return String(randomInt(100_000, 1_000_000));
}

// Same masking shape the frontend used to compute client-side for its mock
// flow (see authService.ts's now-removed forgotPassword) — kept identical so
// the UI looks the same now that a real backend produces it.
function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  const masked = name && name.length > 2 ? `${name.slice(0, 2)}${'*'.repeat(name.length - 2)}` : `${name?.[0] ?? ''}*`;
  return `${masked}@${domain ?? 'example.com'}`;
}
