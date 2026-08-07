import { HttpService } from '@nestjs/axios';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { EncryptionService } from '../common/encryption/encryption.service';
import { UsersService } from '../users/users.service';
import { OutlookConnection, OutlookConnectionDocument } from './schemas/outlook-connection.schema';
import {
  MicrosoftTenantAuthorization,
  MicrosoftTenantAuthorizationDocument,
} from './schemas/microsoft-tenant-authorization.schema';

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
  status: 'connected' | 'needs_reauth';
}

export interface OutlookOrgAccountSummary extends OutlookAccountSummary {
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
}

// Mail.Send added for Phase 14d's real reply-sending — widening an
// already-issued OAuth grant is not possible; every previously-connected
// account (including real production ones) must disconnect and reconnect
// through Microsoft's consent screen once to pick up this scope. A stale
// token issued under the old scope will fail an actual send attempt with a
// real Graph error rather than silently succeeding or no-op'ing.
// No openid/profile here deliberately — this flow never issues or reads an
// ID token (the caller is already authenticated via our own JWT, see
// OutlookController's JwtAuthGuard); requesting them just widens the
// consent screen with claims this flow doesn't use. Keeps this request
// scoped to pure data-access permissions, separate from auth/oauth.service.ts's
// login flow (openid/profile/email/User.Read only, no Mail/Calendar scopes).
const GRAPH_SCOPES = 'offline_access User.Read Mail.Read Mail.Send Calendars.Read Calendars.ReadWrite Contacts.Read';

// AADSTS90094: "the grant requires admin consent" — Microsoft's specific
// code for exactly the "Need admin approval" screen this whole flow exists
// to route around. Matched loosely (also the plain-English phrase) since
// Microsoft doesn't guarantee the code appears in every locale/variant of
// this error. Used by OutlookController to redirect the user to a
// "your organization needs to approve this app" prompt instead of a
// generic, unexplained connection failure.
export function isAdminConsentRequiredError(errorDescription?: string): boolean {
  if (!errorDescription) return false;
  return /AADSTS90094|admin approval|admin consent/i.test(errorDescription);
}

/**
 * Per-user delegated Microsoft Graph auth, against ONE platform-owned Azure
 * App Registration (MS_GRAPH_CLIENT_ID/SECRET below) — every organization
 * connects through the same app; customers never see or provide OAuth
 * credentials of their own. A user can connect several mailboxes; exactly
 * one is "active" at a time — that's the one python-agent reads/refreshes
 * to call Graph on the user's behalf (see python-agent's
 * app/memory/outlook_store.py, which filters on isActive).
 */
@Injectable()
export class OutlookService {
  constructor(
    private config: ConfigService,
    private http: HttpService,
    private encryption: EncryptionService,
    private usersService: UsersService,
    @InjectModel(OutlookConnection.name) private connectionModel: Model<OutlookConnectionDocument>,
    @InjectModel(MicrosoftTenantAuthorization.name)
    private tenantAuthModel: Model<MicrosoftTenantAuthorizationDocument>,
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

  /** Microsoft's tenant-wide admin consent endpoint — a tenant admin visits
   * this once to pre-approve Mail.Send/Calendars.ReadWrite/etc for their
   * whole organization. After that, every employee's normal connect-url
   * flow above succeeds without hitting the interactive "Need admin
   * approval" wall — Microsoft/Azure AD enforces that automatically once
   * consent is on file; nothing in this app has to branch per-employee to
   * make it work. This app never requests application (app-only)
   * permissions — admin consent here only covers the same delegated scopes
   * an individual user could already consent to themselves, just granted
   * once for everyone instead of one at a time. */
  buildAdminConsentUrl(state: string): string {
    const clientId = this.config.get<string>('integrations.msGraph.clientId');
    const redirectUri = this.config.get<string>('integrations.msGraph.adminConsentRedirectUri');

    const params = new URLSearchParams({
      client_id: clientId ?? '',
      redirect_uri: redirectUri ?? '',
      state,
    });
    return `https://login.microsoftonline.com/organizations/adminconsent?${params.toString()}`;
  }

  async recordTenantAuthorization(
    tenantId: string,
    organizationId: string,
    userId: string,
    userEmail: string,
  ): Promise<void> {
    await this.tenantAuthModel.findOneAndUpdate(
      { tenantId },
      { tenantId, organizationId, authorizedByUserId: userId, authorizedByEmail: userEmail },
      { upsert: true },
    );
  }

  async getTenantAuthorizationStatus(
    organizationId: string,
  ): Promise<{ authorized: boolean; tenantId?: string; authorizedByEmail?: string }> {
    // Informational — see the schema's comment. Scoped by organizationId
    // (who recorded it), not a live Microsoft lookup: there's no delegated
    // Graph call that reports "has our app been admin-consented for this
    // tenant", short of an app-only Graph call this app doesn't have
    // credentials for.
    const doc = await this.tenantAuthModel.findOne({ organizationId }).sort({ createdAt: -1 });
    if (!doc) return { authorized: false };
    return { authorized: true, tenantId: doc.tenantId, authorizedByEmail: doc.authorizedByEmail };
  }

  async handleCallback(code: string, userId: string, organizationId?: string): Promise<{ email: string }> {
    const tokens = await this.exchangeCode(code);
    const email = await this.fetchUserEmail(tokens.access_token);

    // Newly connected/reconnected account becomes the active one; every
    // other account for this user is demoted (but stays connected).
    await this.connectionModel.updateMany({ userId }, { isActive: false });
    await this.connectionModel.findOneAndUpdate(
      { userId, email },
      {
        userId,
        organizationId,
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

  async listAccounts(userId: string): Promise<OutlookAccountSummary[]> {
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

  /** Org-wide view across every user's connected mailboxes — e.g. sales@,
   * support@, hr@ each connected by a different team member — vs.
   * listAccounts() above, which only ever sees the caller's own. Connections
   * made before organizationId existed on this schema (see the schema's
   * comment) are invisible here by design: there's no org to attribute them
   * to, and they still work fine through the unchanged per-user endpoints. */
  async listOrgAccounts(organizationId: string): Promise<OutlookOrgAccountSummary[]> {
    const connections = await this.connectionModel
      .find({ organizationId })
      .select({ userId: 1, email: 1, isActive: 1, createdAt: 1, status: 1 })
      .sort({ createdAt: -1 });

    const ownerIds = [...new Set(connections.map((c) => c.userId))];
    const owners = await Promise.all(ownerIds.map((id) => this.usersService.findById(id)));
    const ownersById = new Map(owners.filter(Boolean).map((u) => [u!._id.toString(), u!]));

    return connections.map((c) => {
      const owner = ownersById.get(c.userId);
      return {
        email: c.email,
        isActive: c.isActive,
        connectedAt: (c as unknown as { createdAt: Date }).createdAt,
        status: c.status ?? 'connected',
        ownerUserId: c.userId,
        ownerName: owner?.name ?? 'Unknown',
        ownerEmail: owner?.email ?? '',
      };
    });
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
