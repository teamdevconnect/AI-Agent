import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Switch } from '@/components/ui';
import { SettingsSection } from '../components/SettingsSection';
import styles from '../components/SettingsSection.module.css';

export function NotificationSettings() {
  const [desktop, setDesktop] = useState(true);
  const [email, setEmail] = useState(true);
  const [push, setPush] = useState(false);
  const [slack, setSlack] = useState(false);
  const [teams, setTeams] = useState(false);

  return (
    <>
      <SettingsSection title="Channels" description="Choose where you'd like to receive notifications.">
        <Switch checked={desktop} onChange={setDesktop} label="Desktop notifications" description="Browser push notifications for new activity." />
        <Switch checked={email} onChange={setEmail} label="Email notifications" description="Daily digest and important alerts via email." />
        <Switch checked={push} onChange={setPush} label="Mobile push notifications" description="Requires the HaiVE AI mobile app." />
      </SettingsSection>

      <SettingsSection title="Integrations" description="Route notifications to connected workspace tools.">
        <Switch checked={slack} onChange={setSlack} label="Slack (placeholder)" description="Send notifications to a Slack channel." />
        <Switch checked={teams} onChange={setTeams} label="Microsoft Teams" description="Send notifications to a Teams channel." />
      </SettingsSection>

      <div className={styles.footer} style={{ borderTop: 'none' }}>
        <Button onClick={() => toast.success('Notification preferences saved')}>Save Changes</Button>
      </div>
    </>
  );
}
