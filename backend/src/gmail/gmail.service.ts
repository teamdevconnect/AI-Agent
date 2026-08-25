import { HttpService } from '@nestjs/axios';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { EncryptionService } from '../common/encryption/encryption.service';
import { GmailConnection, GmailConnectionDocument } from './schemas/gmail-connection.schema';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

export interface GmailAccountSummary {
  email: string;
  isActive: boolean;
  connectedAt: Date;
  status: 'connected' | 'needs_reauth';
}

// gmail.send is requested now (not just gmail.readonly) so a future
// send-email tool/action doesn't need every existing connection to
// re-consent — no send action is built yet (Phase 8 plan notes: read-only
// this phase).
const GMAIL_SCOPES =
  'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email';

/**
 * Per-user delegated Gmail API auth — 1:1 the same OAuth shape as
 * OutlookService (connect-url -> signed-JWT state -> provider authorize URL
 * -> callback -> code exchange -> upsert connection doc), just against
 * Google's endpoints/scopes instead of Microsoft's. A user can connect
 * several mailboxes; exactly one is "active" at a time — that's the one
 * python-agent reads/refreshes (see app/memory/gmail_store.py).
 */
@Injectable()
export class GmailService {
  constructor(
    private config: ConfigService,
    private http: HttpService,
    private encryption: EncryptionService,
    @InjectModel(GmailConnection.name) private connectionModel: Model<GmailConnectionDocument>,
  ) {}

  buildAuthorizeUrl(state: string): string {
    const clientId = this.config.get<string>('integrations.google.clientId');
    const redirectUri = this.config.get<string>('integrations.google.redirectUri');

    const params = new URLSearchParams({
      client_id: clientId ?? '',
      response_type: 'code',
      redirect_uri: redirectUri ?? '',
      scope: GMAIL_SCOPES,
      // access_type=offline + prompt=consent are what makes Google actually
      // return a refresh_token — unlike Microsoft, Google only issues one
      // on the very first consent unless prompt=consent forces the screen
      // again, so this is required, not just a UX nicety like Outlook's
      // "select_account".
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleCallback(code: string, userId: string): Promise<{ email: string }> {
    const tokens = await this.exchangeCode(code);
    const email = await this.fetchUserEmail(tokens.access_token);

    // Newly connected/reconnected account becomes the active one; every
    // other account for this user is demoted (but stays connected).
    await this.connectionModel.updateMany({ userId }, { isActive: false });
    await this.connectionModel.findOneAndUpdate(
      { userId, email },
      {
        userId,
        email,
        // Encrypted at rest (see common/encryption/encryption.service.ts).
        // A fresh reconnect through this same callback is also how a
        // needs_reauth row recovers — this upsert overwrites status back to
        // the schema default ('connected') along with the new tokens.
        accessToken: this.encryption.encrypt(tokens.access_token),
        refreshToken: this.encryption.encrypt(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
        isActive: true,
        status: 'connected',
      },
      { upsert: true },
    );
    return { email };
  }

  async getStatus(userId: string): Promise<{ connected: boolean; email?: string; needsReauth?: boolean }> {
    const active = await this.connectionModel.findOne({ userId, isActive: true }).select({ email: 1, status: 1 });
    return {
      connected: Boolean(active) && active?.status !== 'needs_reauth',
      email: active?.email,
      needsReauth: active?.status === 'needs_reauth',
    };
  }

  async listAccounts(userId: string): Promise<GmailAccountSummary[]> {
    const connections = await this.connectionModel
      .find({ userId })
      .select({ email: 1, isActive: 1, createdAt: 1, status: 1 })
      .sort({ createdAt: -1 });
    return connections.map((c) => ({
      email: c.email,
      isActive: c.isActive,
      connectedAt: (c as unknown as { createdAt: Date }).createdAt,
      status: c.status ?? 'connected',
    }));
  }

  async setActive(userId: string, email: string): Promise<void> {
    const target = await this.connectionModel.findOne({ userId, email });
    if (!target) throw new NotFoundException(`No connected Gmail account for ${email}`);
    await this.connectionModel.updateMany({ userId }, { isActive: false });
    await this.connectionModel.updateOne({ userId, email }, { isActive: true });
  }

  async disconnect(userId: string, email: string): Promise<void> {
    const wasActive = await this.connectionModel.findOne({ userId, email }).select({ isActive: 1 });
    await this.connectionModel.deleteOne({ userId, email });
    if (wasActive?.isActive) {
      // Promote the most recently connected remaining account, if any.
      const next = await this.connectionModel.findOne({ userId }).sort({ createdAt: -1 });
      if (next) await this.connectionModel.updateOne({ _id: next._id }, { isActive: true });
    }
  }

  private tokenEndpoint(): string {
    return 'https://oauth2.googleapis.com/token';
  }

  private async exchangeCode(code: string): Promise<TokenResponse> {
    const clientId = this.config.get<string>('integrations.google.clientId');
    const clientSecret = this.config.get<string>('integrations.google.clientSecret');
    const redirectUri = this.config.get<string>('integrations.google.redirectUri');

    const body = new URLSearchParams({
      client_id: clientId ?? '',
      client_secret: clientSecret ?? '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri ?? '',
    });

    const response = await firstValueFrom(
      this.http.post<TokenResponse>(this.tokenEndpoint(), body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );
    return response.data;
  }

  private async fetchUserEmail(accessToken: string): Promise<string> {
    const response = await firstValueFrom(
      this.http.get<{ email: string }>('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );
    return response.data.email;
  }
}
