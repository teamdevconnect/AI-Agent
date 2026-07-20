import { HttpService } from '@nestjs/axios';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { OutlookConnection, OutlookConnectionDocument } from './schemas/outlook-connection.schema';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

export interface OutlookAccountSummary {
  email: string;
  isActive: boolean;
  connectedAt: Date;
}

const GRAPH_SCOPES = 'offline_access User.Read Mail.Read Calendars.Read Contacts.Read';

/**
 * Per-user delegated Microsoft Graph auth. A user can connect several
 * mailboxes; exactly one is "active" at a time — that's the one python-agent
 * reads/refreshes to call Graph on the user's behalf (see python-agent's
 * app/memory/outlook_store.py, which filters on isActive).
 */
@Injectable()
export class OutlookService {
  constructor(
    private config: ConfigService,
    private http: HttpService,
    @InjectModel(OutlookConnection.name) private connectionModel: Model<OutlookConnectionDocument>,
  ) {}

  private get configured(): boolean {
    return Boolean(this.config.get<string>('integrations.msGraph.clientId'));
  }

  async getEmails() {
    if (!this.configured) return this.placeholderEmails();
    return this.placeholderEmails();
  }

  async getCalendarEvents() {
    return [];
  }

  async getContacts() {
    return [];
  }

  private placeholderEmails() {
    return [
      {
        id: 'msg-1',
        from: 'client@example.com',
        subject: 'Following up on our proposal',
        receivedAt: new Date().toISOString(),
      },
    ];
  }

  buildAuthorizeUrl(state: string): string {
    const clientId = this.config.get<string>('integrations.msGraph.clientId');
    const redirectUri = this.config.get<string>('integrations.msGraph.redirectUri');

    const params = new URLSearchParams({
      client_id: clientId ?? '',
      response_type: 'code',
      redirect_uri: redirectUri ?? '',
      response_mode: 'query',
      scope: GRAPH_SCOPES,
      // Always show Microsoft's account picker rather than silently reusing
      // whichever Microsoft account happens to be signed into the browser —
      // this is what makes "connect a different account" actually work.
      prompt: 'select_account',
      state,
    });
    // "organizations" (not a specific tenant ID) so any franchise business's
    // Microsoft 365 tenant can connect — this app is registered as
    // multi-tenant in Azure AD. Requires the Azure App Registration's
    // "Supported account types" to be set to multi-tenant.
    return `https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?${params.toString()}`;
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
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
        isActive: true,
      },
      { upsert: true },
    );
    return { email };
  }

  async getStatus(userId: string): Promise<{ connected: boolean; email?: string }> {
    const active = await this.connectionModel.findOne({ userId, isActive: true }).select({ email: 1 });
    return { connected: Boolean(active), email: active?.email };
  }

  async listAccounts(userId: string): Promise<OutlookAccountSummary[]> {
    const connections = await this.connectionModel
      .find({ userId })
      .select({ email: 1, isActive: 1, createdAt: 1 })
      .sort({ createdAt: -1 });
    return connections.map((c) => ({
      email: c.email,
      isActive: c.isActive,
      connectedAt: (c as unknown as { createdAt: Date }).createdAt,
    }));
  }

  async setActive(userId: string, email: string): Promise<void> {
    const target = await this.connectionModel.findOne({ userId, email });
    if (!target) throw new NotFoundException(`No connected Outlook account for ${email}`);
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
    return `https://login.microsoftonline.com/organizations/oauth2/v2.0/token`;
  }

  private async exchangeCode(code: string): Promise<TokenResponse> {
    const clientId = this.config.get<string>('integrations.msGraph.clientId');
    const clientSecret = this.config.get<string>('integrations.msGraph.clientSecret');
    const redirectUri = this.config.get<string>('integrations.msGraph.redirectUri');

    const body = new URLSearchParams({
      client_id: clientId ?? '',
      client_secret: clientSecret ?? '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri ?? '',
      scope: GRAPH_SCOPES,
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
      this.http.get<{ mail?: string; userPrincipalName: string }>('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );
    return response.data.mail ?? response.data.userPrincipalName;
  }
}