import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiDatabase, FiKey, FiPlus, FiSettings, FiTrash2 } from 'react-icons/fi';
import { Card, Badge, Button, Input, Modal } from '@/components/ui';
import { integrationsService, type OutlookAccount } from '@/services/integrationsService';
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

export function IntegrationsPage() {
  const [anthropic, setAnthropic] = useState<CardState>({ status: 'loading' });
  const [crm, setCrm] = useState<CardState>({ status: 'loading' });
  const [outlookAccounts, setOutlookAccounts] = useState<OutlookAccount[]>([]);
  const [outlookStatus, setOutlookStatus] = useState<CardStatus>('loading');
  const [outlookError, setOutlookError] = useState<string | undefined>();
  const [outlookModalOpen, setOutlookModalOpen] = useState(false);
  const [keyModalProvider, setKeyModalProvider] = useState<KeyProvider | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [connecting, setConnecting] = useState(false);

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
  }, []);

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

  const handleDisconnectOutlookAccount = async (email: string) => {
    try {
      await integrationsService.disconnectOutlookAccount(email);
      toast.success(`${email} disconnected`);
      loadOutlookAccounts();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
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

        {/* Gmail — no OAuth client configured yet, kept visible as a placeholder */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.iconTile}>G</span>
            <div className={styles.cardTitleRow}>
              <div className={styles.cardName}>Gmail</div>
              <div className={styles.cardCategory}>Communication</div>
            </div>
            <Badge variant="neutral" dot>Not configured</Badge>
          </div>
          <p className={styles.cardDescription}>Send and read email via Gmail.</p>
          <div className={styles.cardFooter}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => toast('Gmail needs a Google OAuth client — not configured yet.')}
            >
              Connect
            </Button>
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
                  {account.isActive ? (
                    <Badge variant="success" dot>Active</Badge>
                  ) : (
                    <Badge variant="neutral" dot>Connected</Badge>
                  )}
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
    </div>
  );
}
