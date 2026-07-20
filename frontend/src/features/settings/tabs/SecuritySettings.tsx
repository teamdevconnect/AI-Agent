import { useState } from 'react';
import toast from 'react-hot-toast';
import { FiMonitor, FiSmartphone, FiPlus } from 'react-icons/fi';
import { Button, Switch, Badge, Input } from '@/components/ui';
import { SettingsSection } from '../components/SettingsSection';
import sectionStyles from '../components/SettingsSection.module.css';
import styles from './SecuritySettings.module.css';

const SESSIONS = [
  { id: 's1', device: 'Chrome on Windows', location: 'Bengaluru, IN', current: true, icon: FiMonitor },
  { id: 's2', device: 'HaiVE AI Mobile', location: 'Bengaluru, IN', current: false, icon: FiSmartphone },
];

export function SecuritySettings() {
  const [twoFactor, setTwoFactor] = useState(false);

  return (
    <>
      <SettingsSection title="Password" description="Change your account password.">
        <Input label="Current password" type="password" placeholder="••••••••" />
        <Input label="New password" type="password" placeholder="••••••••" />
        <div className={sectionStyles.footer} style={{ borderTop: 'none' }}>
          <Button onClick={() => toast.success('Password updated (mock)')}>Update Password</Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Two-Factor Authentication" description="Add an extra layer of security to your account.">
        <Switch
          checked={twoFactor}
          onChange={(checked) => {
            setTwoFactor(checked);
            toast.success(checked ? 'Two-factor authentication enabled (mock)' : 'Two-factor authentication disabled');
          }}
          label="Require a verification code at sign-in"
          description="Uses an authenticator app (Phase 2 for real enrollment)."
        />
      </SettingsSection>

      <SettingsSection title="Active Sessions" description="Devices currently signed in to your account.">
        {SESSIONS.map((session) => (
          <div key={session.id} className={styles.sessionRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <session.icon size={18} />
              <div className={styles.sessionInfo}>
                <span className={styles.sessionDevice}>{session.device}</span>
                <span className={styles.sessionMeta}>{session.location}</span>
              </div>
            </div>
            {session.current ? (
              <Badge variant="success" dot>
                This device
              </Badge>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => toast.success('Session revoked (mock)')}>
                Revoke
              </Button>
            )}
          </div>
        ))}
      </SettingsSection>

      <SettingsSection title="API Tokens" description="Placeholder for programmatic access tokens.">
        <div className={styles.apiKeyRow}>sk-pantheras-•••••••••••••••••••3f9a</div>
        <div className={sectionStyles.footer} style={{ borderTop: 'none' }}>
          <Button variant="secondary" leftIcon={<FiPlus />} onClick={() => toast('API tokens — Phase 2 feature')}>
            Generate New Token
          </Button>
        </div>
      </SettingsSection>
    </>
  );
}
