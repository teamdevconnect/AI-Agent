import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushSubscriptionEntry } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';

export interface PushPayload {
  title: string;
  body: string;
}

// Real delivery for the Desktop/Mobile notification channels — VAPID-based
// Web Push, no external app/service beyond the browser's own push service
// (FCM for Chrome, Mozilla's for Firefox, etc). Fails open exactly like
// MailService does with no SMTP_HOST: unset VAPID keys → warn once, no-op
// every send forever, never throws into a caller.
@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  private readonly configured: boolean;

  constructor(
    private config: ConfigService,
    private usersService: UsersService,
  ) {
    const publicKey = this.config.get<string>('webPush.publicKey');
    const privateKey = this.config.get<string>('webPush.privateKey');
    const subject = this.config.get<string>('webPush.subject');
    this.configured = Boolean(publicKey && privateKey && subject);
    if (!this.configured) {
      this.logger.warn('VAPID keys not set — Web Push is disabled (calls will be logged and skipped).');
      return;
    }
    webpush.setVapidDetails(subject!, publicKey!, privateKey!);
  }

  /** Sends to every subscription of the allowed device type(s) — filtering
   * happens here, not by only ever storing "allowed" subscriptions, so a
   * toggle flip takes effect on the very next notification without needing
   * to touch stored subscriptions at all. */
  async sendToUser(
    userId: string,
    payload: PushPayload,
    allowed: { allowDesktop: boolean; allowMobile: boolean },
  ): Promise<void> {
    if (!this.configured) {
      this.logger.warn(`Push suppressed (VAPID not configured): "${payload.title}" -> user ${userId}`);
      return;
    }
    const user = await this.usersService.findById(userId);
    if (!user) return;
    const targets = user.pushSubscriptions.filter(
      (s) => (s.deviceType === 'desktop' && allowed.allowDesktop) || (s.deviceType === 'mobile' && allowed.allowMobile),
    );
    if (targets.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.allSettled(
      targets.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body);
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          // 404/410 are the standard "this subscription is dead" responses
          // (user revoked permission, browser data cleared, etc) — self-
          // clean rather than retrying forever against a URL that will
          // never accept another push. Any other error is left in place
          // (may be transient).
          if (statusCode === 404 || statusCode === 410) {
            await this.usersService.removePushSubscription(userId, sub.endpoint);
          } else {
            this.logger.warn(`Push send failed for user ${userId}: ${(err as Error).message}`);
          }
        }
      }),
    );
  }

  subscribe(userId: string, entry: PushSubscriptionEntry): Promise<void> {
    return this.usersService.addOrReplacePushSubscription(userId, entry);
  }

  unsubscribe(userId: string, endpoint: string): Promise<unknown> {
    return this.usersService.removePushSubscription(userId, endpoint);
  }

  getPublicKey(): string {
    return this.config.get<string>('webPush.publicKey') ?? '';
  }
}
