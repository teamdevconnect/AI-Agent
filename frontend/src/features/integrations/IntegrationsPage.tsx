import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiDatabase, FiKey, FiLink, FiPlus, FiSettings, FiShield, FiTrash2 } from 'react-icons/fi';
import { Card, Badge, Button, Input, Modal } from '@/components/ui';
import {
  integrationsService,
  type AuthCredentials,
  type AuthType,
  type CustomIntegration,
  type GmailAccount,
  type OutlookAccount,
  type OutlookOrgAccount,
  type ProviderRule,
  type TenantAuthorizationStatus,
  type TestConnectionResult,
} from '@/services/integrationsService';
import { extractErrorMessage } from '@/utils/errors';
import styles from './IntegrationsPage.module.css';

type CardStatus = 'connected' | 'disconnected' | 'error' | 'loading';

interface CardState {
  status: CardStatus;
  detail?: string;
}

type KeyProvider = 'anthropic' | 'crm';

const KEY_MODAL_COPY: Record<KeyProvider, { title: string; description: string; placeholder: string; needsBaseUrl: boolean }> = {
  anthropic: {
    title: 'Connect Anthropic',
    description: "Paste your Anthropic API key. It's stored server-side and used by the chat agent — never exposed to the browser.",
    placeholder: 'sk-ant-api03-...',
    needsBaseUrl: false,
  },
  crm: {
    title: 'Connect CRM',
    description: 'Enter your CRM API base URL and key. Stored server-side and used by the chat agent to look up leads, customers, and opportunities.',
    placeholder: 'Your CRM API key',
    needsBaseUrl: true,
  },
};

// OAuth-based platforms (Salesforce, Slack, HubSpot, ...) aren't offered
// here deliberately — this wizard is only for auth styles that need no
// dedicated consent flow/app registration (see backend/src/integrations/
// auth-methods.ts's comment). Each of those needs its own integration, the
// way Outlook/Gmail/the login providers already have.
const AUTH_TYPE_LABELS: Record<AuthType, string> = {
  apiKey: 'API Key',
  apiKeyBaseUrl: 'Base URL + API Key',
  bearer: 'Bearer Token',
  basic: 'Username + Password (Basic Auth)',
  customHeaders: 'Custom Headers',
};

const AUTH_TYPES: AuthType[] = ['apiKeyBaseUrl', 'apiKey', 'bearer', 'basic', 'customHeaders'];

export function IntegrationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [anthropic, setAnthropic] = useState<CardState>({ status: 'loading' });
  const [crm, setCrm] = useState<CardState>({ status: 'loading' });
  const [outlookAccounts, setOutlookAccounts] = useState<OutlookAccount[]>([]);
  const [outlookOrgAccounts, setOutlookOrgAccounts] = useState<OutlookOrgAccount[]>([]);
  const [outlookStatus, setOutlookStatus] = useState<CardStatus>('loading');
  const [outlookError, setOutlookError] = useState<string | undefined>();
  const [outlookModalOpen, setOutlookModalOpen] = useState(false);
  const [tenantAuthStatus, setTenantAuthStatus] = useState<TenantAuthorizationStatus | null>(null);
  const [requestingAdminConsent, setRequestingAdminConsent] = useState(false);
  const [gmailAccounts, setGmailAccounts] = useState<GmailAccount[]>([]);
  const [gmailStatus, setGmailStatus] = useState<CardStatus>('loading');
  const [gmailError, setGmailError] = useState<string | undefined>();
  const [gmailModalOpen, setGmailModalOpen] = useState(false);
  const [keyModalProvider, setKeyModalProvider] = useState<KeyProvider | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [connecting, setConnecting] = useState(false);

  // Generic "connect any CRM/SaaS" flow — see integrationsService.ts's
  // ConnectCustomIntegrationPayload / auth-methods.ts on the backend.
  const [customIntegrations, setCustomIntegrations] = useState<CustomIntegration[]>([]);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customProvider, setCustomProvider] = useState('');
  const [customAuthType, setCustomAuthType] = useState<AuthType>('apiKeyBaseUrl');
  const [customCredentials, setCustomCredentials] = useState<AuthCredentials>({});
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customHealthCheckPath, setCustomHealthCheckPath] = useState('');
  const [customHeadersText, setCustomHeadersText] = useState('');
  const [testingCustom, setTestingCustom] = useState(false);
  const [customTestResult, setCustomTestResult] = useState<TestConnectionResult | null>(null);
  const [savingCustom, setSavingCustom] = useState(false);
  // Smart provider detection (see provider-rules.ts) — null while unknown/
  // not yet looked up, in which case every auth type is offered.
  const [customProviderRule, setCustomProviderRule] = useState<ProviderRule | null>(null);

  const loadOutlookAccounts = () => {
    integrationsService
      .getOutlookAccounts()
      .then((accounts) => {
        setOutlookAccounts(accounts);
        setOutlookStatus(accounts.length > 0 ? 'connected' : 'disconnected');
      })
      .catch((error) => {
        setOutlookStatus('error');
        setOutlookError(extractErrorMessage(error));
      });
  };

  const loadOutlookOrgAccounts = () => {
    integrationsService
      .getOutlookOrgAccounts()
      .then(setOutlookOrgAccounts)
      .catch(() => {
        // Non-critical — the personal accounts list above still works even
        // if this org-wide view fails to load for some reason.
      });
  };

  const loadTenantAuthStatus = () => {
    integrationsService
      .getOutlookTenantAuthorizationStatus()
      .then(setTenantAuthStatus)
      .catch(() => setTenantAuthStatus(null));
  };

  const loadCustomIntegrations = () => {
    integrationsService
      .listCustomIntegrations()
      .then(setCustomIntegrations)
      .catch(() => setCustomIntegrations([]));
  };

  const loadGmailAccounts = () => {
    integrationsService
      .getGmailAccounts()
      .then((accounts) => {
        setGmailAccounts(accounts);
        setGmailStatus(accounts.length > 0 ? 'connected' : 'disconnected');
      })
      .catch((error) => {
        setGmailStatus('error');
        setGmailError(extractErrorMessage(error));
      });
  };

  useEffect(() => {
    integrationsService
      .getCredentialStatus('anthropic')
      .then((s) => setAnthropic({ status: s.connected ? 'connected' : 'disconnected', detail: s.maskedKey }))
      .catch((error) => setAnthropic({ status: 'error', detail: extractErrorMessage(error) }));

    integrationsService
      .getCredentialStatus('crm')
      .then((s) =>
        setCrm({
          status: s.connected ? 'connected' : 'disconnected',
          detail: s.connected ? `${s.baseUrl ?? ''} ${s.maskedKey ?? ''}`.trim() : undefined,
        }),
      )
      .catch((error) => setCrm({ status: 'error', detail: extractErrorMessage(error) }));

    loadOutlookAccounts();
    loadOutlookOrgAccounts();
    loadTenantAuthStatus();
    loadCustomIntegrations();
    loadGmailAccounts();
  }, []);

  // Landing back here after the full-page Microsoft OAuth round trip (see
  // backend/src/outlook/outlook.controller.ts's callback/adminConsentCallback,
  // which redirect to /integrations?outlook=<status>). Never show the raw
  // Microsoft/AADSTS error text — translate every status into a plain
  // message, and open the Outlook modal automatically so the relevant
  // section (personal accounts, or the admin-consent prompt) is right there.
  useEffect(() => {
    const outlookResult = searchParams.get('outlook');
    if (!outlookResult) return;

    switch (outlookResult) {
      case 'connected':
        toast.success('Outlook connected');
        loadOutlookAccounts();
        loadOutlookOrgAccounts();
        break;
      case 'admin_consent_required':
        toast.error("Your organization's Microsoft admin needs to approve this app first.");
        setOutlookModalOpen(true);
        break;
      case 'admin_consent_granted':
        toast.success('Your organization approved Outlook access — everyone can now connect normally.');
        loadTenantAuthStatus();
        setOutlookModalOpen(true);
        break;
      case 'admin_consent_declined':
        toast.error('Organization approval was not granted.');
        break;
      default:
        toast.error('Could not connect Outlook — please try again.');
    }

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('outlook');
      return next;
    }, { replace: true });
  }, [searchParams]);

  // Smart provider detection — debounced so it doesn't fire on every
  // keystroke; falls back to "every auth type allowed" (null rule) for
  // anything not yet typed or not recognized, same as the backend's
  // getProviderRule default for unknown providers.
  useEffect(() => {
    if (!customModalOpen || !customProvider.trim()) {
      setCustomProviderRule(null);
      return;
    }
    const timeout = setTimeout(() => {
      integrationsService
        .getProviderRule(customProvider.trim())
        .then((rule) => {
          setCustomProviderRule(rule);
          if (rule.allowedAuthTypes.length > 0 && !rule.allowedAuthTypes.includes(customAuthType)) {
            setCustomAuthType(rule.allowedAuthTypes[0]);
          }
        })
        .catch(() => setCustomProviderRule(null));
    }, 400);
    return () => clearTimeout(timeout);
  }, [customProvider, customModalOpen]);

  const openKeyModal = (provider: KeyProvider) => {
    setApiKeyInput('');
    setBaseUrlInput('');
    setKeyModalProvider(provider);
  };

  const handleSaveKey = async () => {
    const provider = keyModalProvider;
    if (!provider) return;
    const copy = KEY_MODAL_COPY[provider];

    if (apiKeyInput.trim().length < 10) {
      toast.error(`That doesn’t look like a valid ${copy.title.replace('Connect ', '')} API key.`);
      return;
    }
    if (copy.needsBaseUrl && baseUrlInput.trim().length === 0) {
      toast.error('A base URL is required.');
      return;
    }

    setConnecting(true);
    try {
      const result = await integrationsService.connectWithApiKey(
        provider,
        apiKeyInput.trim(),
        copy.needsBaseUrl ? baseUrlInput.trim() : undefined,
      );
      if (provider === 'anthropic') {
        setAnthropic({ status: 'connected', detail: result.maskedKey });
        toast.success('Anthropic connected — Claude will now be used for chat and Outlook mail analysis.');
      } else {
        setCrm({ status: 'connected', detail: `${result.baseUrl ?? ''} ${result.maskedKey ?? ''}`.trim() });
        toast.success('CRM connected — the chat agent can now look up leads, customers, and opportunities.');
      }
      setKeyModalProvider(null);
      setApiKeyInput('');
      setBaseUrlInput('');
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectAnthropic = async () => {
    await integrationsService.disconnectCredential('anthropic');
    setAnthropic({ status: 'disconnected' });
    toast.success('Anthropic disconnected');
  };

  const handleDisconnectCrm = async () => {
    await integrationsService.disconnectCredential('crm');
    setCrm({ status: 'disconnected' });
    toast.success('CRM disconnected');
  };

  // "Header: value" per line, matching how most people paste headers from
  // API docs — parsed into the Record<string,string> the backend expects.
  const parseHeadersText = (text: string): Record<string, string> => {
    const headers: Record<string, string> = {};
    for (const line of text.split('\n')) {
      const separator = line.indexOf(':');
      if (separator === -1) continue;
      const name = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (name) headers[name] = value;
    }
    return headers;
  };

  const openCustomModal = () => {
    setCustomProvider('');
    setCustomAuthType('apiKeyBaseUrl');
    setCustomCredentials({});
    setCustomBaseUrl('');
    setCustomHealthCheckPath('');
    setCustomHeadersText('');
    setCustomTestResult(null);
    setCustomModalOpen(true);
  };

  const buildCustomPayload = () => ({
    authType: customAuthType,
    baseUrl: customBaseUrl.trim() || undefined,
    healthCheckPath: customHealthCheckPath.trim() || undefined,
    credentials: customAuthType === 'customHeaders' ? { headers: parseHeadersText(customHeadersText) } : customCredentials,
  });

  const handleTestCustomConnection = async () => {
    setTestingCustom(true);
    setCustomTestResult(null);
    try {
      const result = await integrationsService.testCustomIntegrationConnection(
        customProvider.trim() || '_preview',
        buildCustomPayload(),
      );
      setCustomTestResult(result);
    } catch (error) {
      setCustomTestResult({ ok: false, message: extractErrorMessage(error) });
    } finally {
      setTestingCustom(false);
    }
  };

  const handleSaveCustomIntegration = async () => {
    if (!customProvider.trim()) {
      toast.error('Give this integration a name.');
      return;
    }
    setSavingCustom(true);
    try {
      await integrationsService.connectCustomIntegration(customProvider.trim().toLowerCase(), buildCustomPayload());
      toast.success(`${customProvider} connected`);
      setCustomModalOpen(false);
      loadCustomIntegrations();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setSavingCustom(false);
    }
  };

  const handleDisconnectCustomIntegration = async (provider: string) => {
    try {
      await integrationsService.disconnectCredential(provider);
      toast.success(`${provider} disconnected`);
      loadCustomIntegrations();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  };

  const handleConnectOutlook = async () => {
    try {
      const url = await integrationsService.getOutlookConnectUrl();
      window.location.href = url;
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  };

  const handleSetActiveOutlookAccount = async (email: string) => {
    try {
      await integrationsService.setActiveOutlookAccount(email);
      toast.success(`${email} is now the active Outlook account`);
      loadOutlookAccounts();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  };

  const handleStartAdminConsent = async () => {
    setRequestingAdminConsent(true);
    try {
      const url = await integrationsService.getOutlookAdminConsentUrl();
      window.location.href = url;
    } catch (error) {
      toast.error(extractErrorMessage(error));
      setRequestingAdminConsent(false);
    }
  };

  const handleDisconnectOutlookAccount = async (email: string) => {
    try {
      await integrationsService.disconnectOutlookAccount(email);
      toast.success(`${email} disconnected`);
      loadOutlookAccounts();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  };

  const handleConnectGmail = async () => {
    try {
      const url = await integrationsService.getGmailConnectUrl();
      window.location.href = url;
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  };

  const handleSetActiveGmailAccount = async (email: string) => {
    try {
      await integrationsService.setActiveGmailAccount(email);
      toast.success(`${email} is now the active Gmail account`);
      loadGmailAccounts();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  };

  const handleDisconnectGmailAccount = async (email: string) => {
    try {
      await integrationsService.disconnectGmailAccount(email);
      toast.success(`${email} disconnected`);
      loadGmailAccounts();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  };

  // Shared across Outlook/Gmail personal + org-wide lists — 'needs_reauth'
  // means python-agent's refresh loop found the grant revoked/expired (see
  // outlook_store.py/gmail_store.py) and reconnecting is the only fix.
  const accountBadge = (account: { isActive: boolean; status: 'connected' | 'needs_reauth' }) => {
    if (account.status === 'needs_reauth') {
      return (
        <Badge variant="danger" dot>
          Needs reconnecting
        </Badge>
      );
    }
    return account.isActive ? (
      <Badge variant="success" dot>Active</Badge>
    ) : (
      <Badge variant="neutral" dot>Connected</Badge>
    );
  };

  const badgeFor = (state: CardState) => {
    if (state.status === 'loading') return <Badge variant="neutral">Checking...</Badge>;
    if (state.status === 'connected') return <Badge variant="success" dot>Connected</Badge>;
    if (state.status === 'error') return <Badge variant="danger" dot>Connection error</Badge>;
    return <Badge variant="neutral" dot>Not connected</Badge>;
  };

  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        {/* Anthropic — real API key, stored server-side, used for chat + Outlook mail analysis */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.iconTile}>A</span>
            <div className={styles.cardTitleRow}>
              <div className={styles.cardName}>Anthropic</div>
              <div className={styles.cardCategory}>AI Model</div>
            </div>
            {badgeFor(anthropic)}
          </div>
          <p className={styles.cardDescription}>Claude models for chat, reasoning, and Outlook mail analysis.</p>
          {(anthropic.status === 'connected' || anthropic.status === 'error') && anthropic.detail && (
            <div className={styles.keyPreview}>{anthropic.detail}</div>
          )}
          <div className={styles.cardFooter}>
            {anthropic.status === 'connected' ? (
              <Button size="sm" variant="secondary" onClick={handleDisconnectAnthropic}>
                Disconnect
              </Button>
            ) : (
              <Button size="sm" leftIcon={<FiKey />} onClick={() => openKeyModal('anthropic')}>
                Connect
              </Button>
            )}
          </div>
        </Card>

        {/* CRM — generic REST CRM, stored server-side, used by the crm_lookup tool */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.iconTile}>
              <FiDatabase />
            </span>
            <div className={styles.cardTitleRow}>
              <div className={styles.cardName}>CRM</div>
              <div className={styles.cardCategory}>Sales</div>
            </div>
            {badgeFor(crm)}
          </div>
          <p className={styles.cardDescription}>Leads, customers, and opportunities via your CRM's REST API.</p>
          {(crm.status === 'connected' || crm.status === 'error') && crm.detail && (
            <div className={styles.keyPreview}>{crm.detail}</div>
          )}
          <div className={styles.cardFooter}>
            {crm.status === 'connected' ? (
              <Button size="sm" variant="secondary" onClick={handleDisconnectCrm}>
                Disconnect
              </Button>
            ) : (
              <Button size="sm" leftIcon={<FiKey />} onClick={() => openKeyModal('crm')}>
                Connect
              </Button>
            )}
          </div>
        </Card>

        {/* Gmail — real Google OAuth delegated flow, mirrors Outlook below */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.iconTile}>G</span>
            <div className={styles.cardTitleRow}>
              <div className={styles.cardName}>Gmail</div>
              <div className={styles.cardCategory}>Communication</div>
            </div>
            {badgeFor({ status: gmailStatus, detail: gmailError })}
          </div>
          <p className={styles.cardDescription}>Email via the Gmail API — analyzed using Claude.</p>
          {gmailStatus === 'connected' && (
            <div className={styles.keyPreview}>
              {gmailAccounts.find((a) => a.isActive)?.email ?? gmailAccounts[0].email}
              {gmailAccounts.length > 1 && ` (+${gmailAccounts.length - 1} more)`}
            </div>
          )}
          {gmailStatus === 'error' && gmailError && <div className={styles.keyPreview}>{gmailError}</div>}
          <div className={styles.cardFooter}>
            {gmailStatus === 'connected' ? (
              <Button size="sm" variant="secondary" leftIcon={<FiSettings />} onClick={() => setGmailModalOpen(true)}>
                Manage Accounts
              </Button>
            ) : (
              <Button size="sm" leftIcon={<FiCheckCircle />} onClick={handleConnectGmail}>
                Connect
              </Button>
            )}
          </div>
        </Card>

        {/* Outlook — real Microsoft Graph delegated OAuth flow, supports multiple connected accounts */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.iconTile}>O</span>
            <div className={styles.cardTitleRow}>
              <div className={styles.cardName}>Microsoft Outlook</div>
              <div className={styles.cardCategory}>Communication</div>
            </div>
            {badgeFor({ status: outlookStatus, detail: outlookError })}
          </div>
          <p className={styles.cardDescription}>Email and calendar via Microsoft Graph — analyzed using Claude.</p>
          {outlookStatus === 'connected' && (
            <div className={styles.keyPreview}>
              {outlookAccounts.find((a) => a.isActive)?.email ?? outlookAccounts[0].email}
              {outlookAccounts.length > 1 && ` (+${outlookAccounts.length - 1} more)`}
            </div>
          )}
          {outlookStatus === 'error' && outlookError && <div className={styles.keyPreview}>{outlookError}</div>}
          <div className={styles.cardFooter}>
            {outlookStatus === 'connected' ? (
              <Button size="sm" variant="secondary" leftIcon={<FiSettings />} onClick={() => setOutlookModalOpen(true)}>
                Manage Accounts
              </Button>
            ) : (
              <Button size="sm" leftIcon={<FiCheckCircle />} onClick={handleConnectOutlook}>
                Connect
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Custom Integrations — connect any CRM/SaaS via API Key, Bearer
          Token, Basic Auth, or Custom Headers. OAuth-based platforms need
          their own dedicated flow (like Outlook/Gmail above) and aren't
          offered here. */}
      <Card className={styles.customSection}>
        <div className={styles.customHeader}>
          <span className={styles.sectionTitle}>Custom Integrations</span>
          <Button size="sm" leftIcon={<FiLink />} onClick={openCustomModal}>
            Add Integration
          </Button>
        </div>
        {customIntegrations.length === 0 ? (
          <p className={styles.cardDescription}>
            Connect any REST API — a CRM, SaaS tool, or internal system — with an API key, bearer token, basic
            auth, or custom headers.
          </p>
        ) : (
          <div className={styles.accountList}>
            {customIntegrations.map((integration) => (
              <div key={integration.provider} className={styles.accountRow}>
                <div>
                  <div className={styles.accountEmail}>{integration.provider}</div>
                  <span className={styles.accountOwner}>
                    {integration.authType ? AUTH_TYPE_LABELS[integration.authType] : 'API Key'}
                    {integration.baseUrl ? ` · ${integration.baseUrl}` : ''}
                  </span>
                </div>
                <div className={styles.accountActions}>
                  <Badge variant="success" dot>
                    Connected
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<FiTrash2 />}
                    onClick={() => handleDisconnectCustomIntegration(integration.provider)}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {customModalOpen && (
        <Modal
          open
          onClose={() => setCustomModalOpen(false)}
          title="Connect a Custom Integration"
          description="Connect any REST API using the authentication method it supports."
        >
          <div className={styles.accountList}>
            <Input
              label="Integration name"
              placeholder="e.g. salesforce, zoho, my-internal-tool"
              value={customProvider}
              onChange={(e) => setCustomProvider(e.target.value)}
              autoFocus
            />

            {customProviderRule?.note && (
              <div className={styles.testResultFail} style={{ background: 'transparent' }}>
                {customProviderRule.note}
              </div>
            )}

            {!customProviderRule?.dedicatedFlowPath && (
              <>
                <div>
                  <span className={styles.fieldLabel}>Authentication method</span>
                  <select
                    className={styles.select}
                    value={customAuthType}
                    onChange={(e) => {
                      setCustomAuthType(e.target.value as AuthType);
                      setCustomTestResult(null);
                    }}
                  >
                    {(customProviderRule?.allowedAuthTypes.length ? customProviderRule.allowedAuthTypes : AUTH_TYPES).map(
                      (type) => (
                        <option key={type} value={type}>
                          {AUTH_TYPE_LABELS[type]}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                {(customAuthType === 'apiKeyBaseUrl' || customAuthType === 'apiKey') && (
                  <Input
                    label="API key"
                    type="password"
                    value={customCredentials.apiKey ?? ''}
                    onChange={(e) => setCustomCredentials((c) => ({ ...c, apiKey: e.target.value }))}
                  />
                )}
                {customAuthType === 'bearer' && (
                  <Input
                    label="Bearer token"
                    type="password"
                    value={customCredentials.bearerToken ?? ''}
                    onChange={(e) => setCustomCredentials((c) => ({ ...c, bearerToken: e.target.value }))}
                  />
                )}
                {customAuthType === 'basic' && (
                  <>
                    <Input
                      label="Username"
                      value={customCredentials.username ?? ''}
                      onChange={(e) => setCustomCredentials((c) => ({ ...c, username: e.target.value }))}
                    />
                    <Input
                      label="Password"
                      type="password"
                      value={customCredentials.password ?? ''}
                      onChange={(e) => setCustomCredentials((c) => ({ ...c, password: e.target.value }))}
                    />
                  </>
                )}
                {customAuthType === 'customHeaders' && (
                  <div>
                    <span className={styles.fieldLabel}>Headers (one "Name: value" per line)</span>
                    <textarea
                      className={styles.select}
                      style={{ height: 88, paddingTop: 'var(--space-2)', paddingBottom: 'var(--space-2)' }}
                      placeholder={'X-Api-Key: abc123\nX-Client-Id: myapp'}
                      value={customHeadersText}
                      onChange={(e) => setCustomHeadersText(e.target.value)}
                    />
                  </div>
                )}

                <Input
                  label="Base URL"
                  placeholder="https://api.example.com"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                />
                <Input
                  label="Health check path (optional)"
                  placeholder="/health"
                  value={customHealthCheckPath}
                  onChange={(e) => setCustomHealthCheckPath(e.target.value)}
                />

                {customTestResult && (
                  <div className={customTestResult.ok ? styles.testResultOk : styles.testResultFail}>
                    {customTestResult.message}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                  <Button variant="secondary" loading={testingCustom} onClick={handleTestCustomConnection}>
                    Test Connection
                  </Button>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <Button variant="ghost" onClick={() => setCustomModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button loading={savingCustom} onClick={handleSaveCustomIntegration}>
                      Save
                    </Button>
                  </div>
                </div>
              </>
            )}

            {customProviderRule?.dedicatedFlowPath && (
              <Button variant="ghost" onClick={() => setCustomModalOpen(false)}>
                Close
              </Button>
            )}
          </div>
        </Modal>
      )}

      {keyModalProvider && (
        <Modal
          open
          onClose={() => setKeyModalProvider(null)}
          title={KEY_MODAL_COPY[keyModalProvider].title}
          description={KEY_MODAL_COPY[keyModalProvider].description}
        >
          {KEY_MODAL_COPY[keyModalProvider].needsBaseUrl && (
            <Input
              label="Base URL"
              placeholder="https://api.yourcrm.com/v1"
              value={baseUrlInput}
              onChange={(e) => setBaseUrlInput(e.target.value)}
              autoFocus
              style={{ marginBottom: 'var(--space-4)' }}
            />
          )}
          <Input
            label="API key"
            type="password"
            placeholder={KEY_MODAL_COPY[keyModalProvider].placeholder}
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            autoFocus={!KEY_MODAL_COPY[keyModalProvider].needsBaseUrl}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-5)' }}>
            <Button variant="ghost" onClick={() => setKeyModalProvider(null)}>
              Cancel
            </Button>
            <Button loading={connecting} onClick={handleSaveKey}>
              Save Key
            </Button>
          </div>
        </Modal>
      )}

      {outlookModalOpen && (
        <Modal
          open
          onClose={() => setOutlookModalOpen(false)}
          title="Outlook Account Management"
          description="Manage Outlook accounts connected to your business, and connect new ones."
        >
          <div className={styles.accountList}>
            {outlookAccounts.map((account) => (
              <div key={account.email} className={styles.accountRow}>
                <div>
                  <div className={styles.accountEmail}>{account.email}</div>
                  {accountBadge(account)}
                </div>
                <div className={styles.accountActions}>
                  {!account.isActive && (
                    <Button size="sm" variant="secondary" onClick={() => handleSetActiveOutlookAccount(account.email)}>
                      Set Active
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<FiTrash2 />}
                    onClick={() => handleDisconnectOutlookAccount(account.email)}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {outlookOrgAccounts.length > 0 && (
            <>
              <div className={styles.sectionDivider}>Connected across your organization</div>
              <div className={styles.accountList}>
                {outlookOrgAccounts.map((account) => (
                  <div key={account.email} className={styles.accountRow}>
                    <div>
                      <div className={styles.accountEmail}>{account.email}</div>
                      <span className={styles.accountOwner}>
                        {account.ownerName} · {account.ownerEmail}
                      </span>
                    </div>
                    {accountBadge(account)}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className={styles.sectionDivider}>Organization approval</div>
          {tenantAuthStatus?.authorized ? (
            <div className={styles.accountRow}>
              <div>
                <span className={styles.accountOwner}>
                  Approved by {tenantAuthStatus.authorizedByEmail} — teammates in your organization can connect
                  Outlook without an admin approval prompt.
                </span>
              </div>
              <Badge variant="success" dot>
                Approved
              </Badge>
            </div>
          ) : (
            <div className={styles.accountRow}>
              <div>
                <span className={styles.accountOwner}>
                  If your organization's Microsoft admin policy requires it, someone with Microsoft admin rights
                  can approve Pantheras AI once for everyone — after that, teammates connect with a normal login,
                  no approval prompt.
                </span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<FiShield />}
                loading={requestingAdminConsent}
                onClick={handleStartAdminConsent}
              >
                Approve for organization
              </Button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-5)' }}>
            <Button variant="ghost" onClick={() => setOutlookModalOpen(false)}>
              Close
            </Button>
            <Button leftIcon={<FiPlus />} onClick={handleConnectOutlook}>
              Connect New Account
            </Button>
          </div>
        </Modal>
      )}

      {gmailModalOpen && (
        <Modal
          open
          onClose={() => setGmailModalOpen(false)}
          title="Gmail Account Management"
          description="Manage Gmail accounts connected to your business, and connect new ones."
        >
          <div className={styles.accountList}>
            {gmailAccounts.map((account) => (
              <div key={account.email} className={styles.accountRow}>
                <div>
                  <div className={styles.accountEmail}>{account.email}</div>
                  {accountBadge(account)}
                </div>
                <div className={styles.accountActions}>
                  {!account.isActive && (
                    <Button size="sm" variant="secondary" onClick={() => handleSetActiveGmailAccount(account.email)}>
                      Set Active
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<FiTrash2 />}
                    onClick={() => handleDisconnectGmailAccount(account.email)}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-5)' }}>
            <Button variant="ghost" onClick={() => setGmailModalOpen(false)}>
              Close
            </Button>
            <Button leftIcon={<FiPlus />} onClick={handleConnectGmail}>
              Connect New Account
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
