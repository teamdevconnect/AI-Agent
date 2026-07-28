import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiShield, FiBell, FiKey } from 'react-icons/fi';
import { Card, Avatar, Badge, Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { ROUTES } from '@/constants/routes';
import { SettingsSection, SettingsField } from '@/features/settings/components/SettingsSection';
import sectionStyles from '@/features/settings/components/SettingsSection.module.css';
import styles from './ProfilePage.module.css';

export function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState(user?.company ?? '');
  const [timezone, setTimezone] = useState(user?.timezone ?? 'Asia/Kolkata');
  const [language, setLanguage] = useState(user?.language ?? 'en-US');

  if (!user) return null;

  return (
    <div className={styles.page}>
      <Card className={styles.headerCard}>
        <Avatar name={`${user.firstName} ${user.lastName}`} size="xl" />
        <div className={styles.headerText}>
          <div className={styles.name}>
            {user.firstName} {user.lastName}
          </div>
          <div className={styles.email}>{user.email}</div>
        </div>
<<<<<<< HEAD
        <Badge variant="accent">{user.role}</Badge>
=======
        <Badge variant="accent">{user.roles.join(', ')}</Badge>
>>>>>>> 6a60a8648 (Initial AI Agent source code)
      </Card>

      <div className={styles.quickLinks}>
        <Button variant="secondary" size="sm" leftIcon={<FiShield />} onClick={() => navigate(ROUTES.settingsSecurity)}>
          Security
        </Button>
        <Button variant="secondary" size="sm" leftIcon={<FiBell />} onClick={() => navigate(ROUTES.settingsNotifications)}>
          Notifications
        </Button>
        <Button variant="secondary" size="sm" leftIcon={<FiKey />} onClick={() => toast('API keys — see Settings > Security')}>
          API Keys
        </Button>
      </div>

      <SettingsSection title="Personal Information" description="Your name and contact details.">
        <div className={sectionStyles.body}>
          <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <Input label="Email" value={user.email} disabled />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
        </div>
      </SettingsSection>

      <SettingsSection title="Company Information" description="Your organization details.">
        <Input label="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
      </SettingsSection>

      <SettingsSection title="Preferences" description="Timezone and language used across the app.">
        <SettingsField label="Timezone">
          <select className={sectionStyles.select} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            <option value="America/New_York">America/New York (ET)</option>
            <option value="Europe/London">Europe/London (GMT)</option>
            <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
          </select>
        </SettingsField>
        <SettingsField label="Language">
          <select className={sectionStyles.select} value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en-US">English (United States)</option>
            <option value="en-GB">English (United Kingdom)</option>
            <option value="hi-IN">Hindi (India)</option>
          </select>
        </SettingsField>
      </SettingsSection>

      <div className={sectionStyles.footer} style={{ borderTop: 'none' }}>
        <Button onClick={() => toast.success('Profile updated')}>Save Changes</Button>
      </div>
    </div>
  );
}
