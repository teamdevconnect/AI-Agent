import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { EncryptionService } from '../common/encryption/encryption.service';
import { AuthCredentials, AuthType, buildAuthHeaders, requiredCredentialFields } from './auth-methods';
import { ConnectIntegrationDto } from './dto/connect-integration.dto';
import { TestConnectionDto } from './dto/test-connection.dto';
import { getProviderRule, ProviderRule } from './provider-rules';
import {
  IntegrationCredential,
  IntegrationCredentialDocument,
} from './schemas/integration-credential.schema';

const PROVIDER_SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export interface IntegrationStatus {
  connected: boolean;
  authType?: AuthType;
  maskedKey?: string;
  baseUrl?: string;
}

export interface IntegrationSummary extends IntegrationStatus {
  provider: string;
  connectedAt?: Date;
}

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectModel(IntegrationCredential.name)
    private credentialModel: Model<IntegrationCredentialDocument>,
    private encryption: EncryptionService,
    private http: HttpService,
  ) {}

  /** Legacy shape, byte-for-byte unchanged: apiKey (+ optional baseUrl),
   * used by the 'anthropic' and 'crm' connect UI today. Every existing
   * caller of this method keeps working exactly as before. */
  async connect(
    organizationId: string,
    provider: string,
    apiKey: string,
    baseUrl?: string,
  ): Promise<{ connected: true; maskedKey: string; baseUrl?: string }> {
    this.assertAllowed(provider);
    await this.credentialModel.findOneAndUpdate(
      { organizationId, provider },
      { organizationId, provider, apiKey, baseUrl, authType: undefined, credentialsEncrypted: undefined },
      { upsert: true },
    );
    return { connected: true, maskedKey: this.mask(apiKey), baseUrl };
  }

  /** Flexible path — any of auth-methods.ts's AuthType styles. Used when the
   * request DTO sets `authType`; connect() above is untouched for requests
   * that don't. */
  async connectWithAuth(
    organizationId: string,
    provider: string,
    dto: ConnectIntegrationDto,
  ): Promise<{ connected: true; authType: AuthType; baseUrl?: string }> {
    const authType = dto.authType!;
    this.assertAllowed(provider, authType);
    const credentials = (dto.credentials ?? {}) as AuthCredentials;

    const missing = requiredCredentialFields(authType).filter((field) => !credentials[field]);
    if (missing.length > 0) {
      throw new BadRequestException(`Missing required field(s) for ${authType}: ${missing.join(', ')}`);
    }

    await this.credentialModel.findOneAndUpdate(
      { organizationId, provider },
      {
        organizationId,
        provider,
        authType,
        credentialsEncrypted: this.encryption.encrypt(JSON.stringify(credentials)),
        baseUrl: dto.baseUrl,
        healthCheckPath: dto.healthCheckPath,
        apiKey: undefined,
      },
      { upsert: true },
    );
    return { connected: true, authType, baseUrl: dto.baseUrl };
  }

  /** Routes to connect() or connectWithAuth() above based on whether the
   * request set authType — the single HTTP entry point (see
   * IntegrationsController), kept as one endpoint so the API surface
   * doesn't fork in two. */
  connectFromDto(organizationId: string, provider: string, dto: ConnectIntegrationDto) {
    if (dto.authType) return this.connectWithAuth(organizationId, provider, dto);
    return this.connect(organizationId, provider, dto.apiKey!, dto.baseUrl);
  }

  async status(organizationId: string, provider: string): Promise<IntegrationStatus> {
    this.assertAllowed(provider);
    const doc = await this.credentialModel.findOne({ organizationId, provider });
    if (!doc) return { connected: false };
    if (doc.authType) {
      // No single "key" to mask for bearer/basic/customHeaders — the fact
      // that credentials are on file plus which auth style is enough for
      // the UI to show without ever decrypting them for display.
      return { connected: true, authType: doc.authType, baseUrl: doc.baseUrl };
    }
    return { connected: true, maskedKey: this.mask(doc.apiKey ?? ''), baseUrl: doc.baseUrl };
  }

  /** Every custom integration connected for this org — the "Custom
   * Integrations" list in IntegrationsPage.tsx. Excludes 'anthropic'/'crm'
   * (those already have their own fixed cards) so this only surfaces
   * providers the user actually typed in themselves. */
  async listCustom(organizationId: string): Promise<IntegrationSummary[]> {
    const docs = await this.credentialModel
      .find({ organizationId, provider: { $nin: ['anthropic', 'crm'] } })
      .sort({ createdAt: -1 });
    return docs.map((doc) => ({
      provider: doc.provider,
      connected: true,
      authType: doc.authType,
      maskedKey: doc.authType ? undefined : this.mask(doc.apiKey ?? ''),
      baseUrl: doc.baseUrl,
      connectedAt: (doc as unknown as { createdAt: Date }).createdAt,
    }));
  }

  async disconnect(organizationId: string, provider: string): Promise<void> {
    this.assertAllowed(provider);
    await this.credentialModel.deleteOne({ organizationId, provider });
  }

  /** Pings the provider's baseUrl (+ optional healthCheckPath) with the
   * saved (or just-entered, pre-save) credentials' auth headers applied.
   * Never throws — every failure mode (DNS, timeout, 401/403, 5xx) is
   * translated into a friendly {ok:false, message} instead of a raw HTTP/
   * network error, per the "never expose raw errors" requirement. */
  async testConnection(
    organizationId: string,
    provider: string,
    dto: TestConnectionDto,
  ): Promise<{ ok: boolean; message: string }> {
    let baseUrl = dto.baseUrl;
    let healthCheckPath = dto.healthCheckPath;
    let authType = dto.authType;
    let credentials = dto.credentials as AuthCredentials | undefined;

    // No credentials in this test request — re-test the already-saved
    // connection instead of requiring the user to re-type everything.
    if (!authType && !dto.apiKey) {
      const doc = await this.credentialModel.findOne({ organizationId, provider });
      if (!doc) return { ok: false, message: 'Nothing connected yet for this provider.' };
      baseUrl = baseUrl ?? doc.baseUrl;
      healthCheckPath = healthCheckPath ?? doc.healthCheckPath;
      if (doc.authType) {
        authType = doc.authType;
        credentials = JSON.parse(this.encryption.decrypt(doc.credentialsEncrypted!)) as AuthCredentials;
      } else {
        authType = 'apiKeyBaseUrl';
        credentials = { apiKey: doc.apiKey };
      }
    } else if (!authType) {
      // Legacy-shaped test request (apiKey/baseUrl, no authType).
      authType = 'apiKeyBaseUrl';
      credentials = { apiKey: dto.apiKey };
    }

    if (!baseUrl) {
      return { ok: false, message: 'A base URL is required to test the connection.' };
    }

    const url = healthCheckPath ? `${baseUrl.replace(/\/$/, '')}/${healthCheckPath.replace(/^\//, '')}` : baseUrl;
    const headers = buildAuthHeaders(authType, credentials ?? {});

    try {
      const response = await firstValueFrom(this.http.get(url, { headers, timeout: 10_000 }));
      return { ok: true, message: `Connected — received HTTP ${response.status}.` };
    } catch (err) {
      return { ok: false, message: this.friendlyErrorMessage(err) };
    }
  }

  private friendlyErrorMessage(err: unknown): string {
    const axiosErr = err as { response?: { status?: number }; code?: string };
    const status = axiosErr.response?.status;
    if (status === 401) return 'The provider rejected these credentials (401 Unauthorized).';
    if (status === 403) return 'These credentials don\'t have permission to access this resource (403 Forbidden).';
    if (status === 404) return 'Reached the server, but that URL/endpoint was not found (404).';
    if (status && status >= 500) return `The provider's server had an error (HTTP ${status}).`;
    if (axiosErr.code === 'ECONNABORTED') return 'The connection timed out — check the base URL.';
    if (axiosErr.code === 'ENOTFOUND' || axiosErr.code === 'ECONNREFUSED') {
      return "Couldn't reach that URL — check it's correct and publicly reachable.";
    }
    return 'Could not connect — please check the URL and credentials.';
  }

  getProviderRule(provider: string): ProviderRule {
    return getProviderRule(provider);
  }

  /** Server-side enforcement of provider-rules.ts — the frontend filters
   * the auth-method dropdown using the same table (GET
   * /integrations/provider-rules/:provider) so a user normally never gets
   * this far with a disallowed combination, but this is the actual security
   * boundary: "never fake or bypass authentication requirements" has to
   * hold even against a direct API call, not just the UI. */
  private assertAllowed(provider: string, authType?: AuthType): void {
    if (!PROVIDER_SLUG.test(provider)) {
      throw new BadRequestException('Provider name must be alphanumeric (dashes/underscores allowed).');
    }
    const rule = getProviderRule(provider);
    if (rule.dedicatedFlowPath) {
      throw new BadRequestException(rule.note ?? `"${provider}" has its own dedicated connect flow.`);
    }
    if (authType && !rule.allowedAuthTypes.includes(authType)) {
      throw new BadRequestException(
        rule.note ??
          `${rule.label} only supports: ${rule.allowedAuthTypes.join(', ') || 'a dedicated flow not yet built here'}.`,
      );
    }
  }

  private mask(apiKey: string): string {
    return apiKey.length > 12 ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : '***';
  }
}
