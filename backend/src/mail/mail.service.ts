import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { passwordResetOtp, verifyEmailOtp, welcomeEmail } from './templates';

// Fire-and-forget by design, same fail-open shape as RedisCacheService
// (see common/redis/redis-cache.service.ts): an unreachable/misconfigured
// SMTP server must never block or fail a request that merely triggers an
// email as a side effect (register, forgot-password, etc). Callers should
// not await these for anything response-critical.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('mail.host');
    this.from = this.config.get<string>('mail.from') ?? '';

    if (!host) {
      this.logger.warn('SMTP_HOST not set — outgoing email is disabled (calls will be logged and skipped).');
      this.transporter = null;
      return;
    }

    const port = this.config.get<number>('mail.port') ?? 587;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user: this.config.get<string>('mail.user'),
        pass: this.config.get<string>('mail.password'),
      },
    });
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`Email suppressed (SMTP not configured): "${subject}" -> ${to}`);
      return;
    }
    try {
      const info = await this.transporter.sendMail({ from: this.from, to, subject, html });
      // Was silent on success before — made every "not receiving email"
      // report indistinguishable between "never sent" and "sent, check
      // spam/provider" without re-running an ad-hoc script to find out.
      this.logger.log(`Email "${subject}" -> ${to} accepted by SMTP server (${info.response})`);
    } catch (err) {
      this.logger.error(`Failed to send email "${subject}" to ${to}: ${(err as Error).message}`);
    }
  }

  sendWelcomeEmail(to: string, name: string): Promise<void> {
    const { subject, html } = welcomeEmail(name);
    return this.send(to, subject, html);
  }

  sendVerificationOtp(to: string, code: string): Promise<void> {
    const { subject, html } = verifyEmailOtp(code);
    return this.send(to, subject, html);
  }

  sendPasswordResetOtp(to: string, code: string): Promise<void> {
    const { subject, html } = passwordResetOtp(code);
    return this.send(to, subject, html);
  }
}
