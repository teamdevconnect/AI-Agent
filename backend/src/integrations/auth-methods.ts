// The universal-connector piece: every non-OAuth auth style a "connect any
// REST API" flow actually needs, in one small builder. OAuth-based platforms
// (Salesforce, Zoho, HubSpot, Slack, ...) each need their own dedicated
// consent flow and app registration — see outlook/gmail/auth/oauth.service.ts
// for that shape — and aren't handled here; this is deliberately the subset
// that needs no per-provider app registration, callback route, or consent
// screen, so a customer can self-serve connect any REST API immediately.
export type AuthType = 'apiKey' | 'apiKeyBaseUrl' | 'bearer' | 'basic' | 'customHeaders';

export const AUTH_TYPES: AuthType[] = ['apiKey', 'apiKeyBaseUrl', 'bearer', 'basic', 'customHeaders'];

// Superset of every field any AuthType might need — a given connection only
// ever populates the subset its authType actually uses (validated in
// integrations.service.ts before this ever gets called). Kept as one flat
// shape rather than a discriminated union so it round-trips through a single
// encrypted JSON blob (see IntegrationCredential.credentialsEncrypted)
// without a schema per auth type.
export interface AuthCredentials {
  apiKey?: string;
  bearerToken?: string;
  username?: string;
  password?: string;
  headerName?: string;
  headers?: Record<string, string>;
}

export function requiredCredentialFields(authType: AuthType): (keyof AuthCredentials)[] {
  switch (authType) {
    case 'apiKey':
    case 'apiKeyBaseUrl':
      return ['apiKey'];
    case 'bearer':
      return ['bearerToken'];
    case 'basic':
      return ['username', 'password'];
    case 'customHeaders':
      return ['headers'];
  }
}

/** Builds the HTTP headers a request to this provider needs. Mirrored
 * byte-for-byte in python-agent/app/memory/integration_store.py's
 * build_auth_headers — any change here needs the same change there. */
export function buildAuthHeaders(authType: AuthType, creds: AuthCredentials): Record<string, string> {
  switch (authType) {
    case 'apiKey':
    case 'apiKeyBaseUrl':
      // No universal standard header name for a bare API key across
      // arbitrary REST APIs (X-Api-Key, Api-Key, X-API-TOKEN all appear in
      // the wild) — headerName lets the customer specify theirs; falls back
      // to the most common convention if they don't.
      return { [creds.headerName || 'X-Api-Key']: creds.apiKey ?? '' };
    case 'bearer':
      return { Authorization: `Bearer ${creds.bearerToken ?? ''}` };
    case 'basic': {
      const encoded = Buffer.from(`${creds.username ?? ''}:${creds.password ?? ''}`).toString('base64');
      return { Authorization: `Basic ${encoded}` };
    }
    case 'customHeaders':
      return creds.headers ?? {};
  }
}
