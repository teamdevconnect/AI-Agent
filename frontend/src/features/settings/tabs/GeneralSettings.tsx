<<<<<<< HEAD
import toast from 'react-hot-toast';
import { FiSun, FiMoon } from 'react-icons/fi';
import { Button, Switch } from '@/components/ui';
import { useUiStore } from '@/stores/uiStore';
import { SettingsSection } from '../components/SettingsSection';
import styles from '../components/SettingsSection.module.css';

=======
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiSun, FiMoon, FiClock } from 'react-icons/fi';
import { Button, Input, Switch } from '@/components/ui';
import { useUiStore } from '@/stores/uiStore';
import { storeSettingsService } from '@/services/storeSettingsService';
import { SettingsField, SettingsSection } from '../components/SettingsSection';
import styles from '../components/SettingsSection.module.css';

// Intl.supportedValuesOf isn't in older TS DOM libs' typings yet, and not
// every runtime implements it — fall back to a short curated list so the
// picker still works either way.
function listTimezones(): string[] {
  const intlWithSupportedValues = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  try {
    const values = intlWithSupportedValues.supportedValuesOf?.('timeZone');
    if (values?.length) return values;
  } catch {
    // fall through to the static list below
  }
  return [
    'Asia/Kolkata',
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'America/Chicago',
    'Europe/London',
    'Europe/Berlin',
    'Asia/Dubai',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney',
  ];
}

const TIMEZONES = listTimezones();

>>>>>>> 6a60a8648 (Initial AI Agent source code)
export function GeneralSettings() {
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);

  const handleSave = () => toast.success('General settings saved');

<<<<<<< HEAD
=======
  const [openingTime, setOpeningTime] = useState('09:00');
  const [closingTime, setClosingTime] = useState('18:00');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    storeSettingsService
      .getSettings()
      .then((settings) => {
        setOpeningTime(settings.openingTime);
        setClosingTime(settings.closingTime);
        setTimezone(settings.timezone);
      })
      .catch(() => {
        // Defaults above are fine if this is the first time settings are loaded.
      });
  }, []);

  const handleSaveHours = async () => {
    setSavingHours(true);
    try {
      await storeSettingsService.updateSettings({ openingTime, closingTime, timezone });
      toast.success('Store timing saved');
    } catch {
      toast.error('Could not save store timing — please try again.');
    } finally {
      setSavingHours(false);
    }
  };

>>>>>>> 6a60a8648 (Initial AI Agent source code)
  return (
    <>
      <SettingsSection title="Theme" description="Choose how HaiVE AI looks on your device.">
        <Switch
          checked={theme === 'dark'}
          onChange={toggleTheme}
          label={theme === 'dark' ? 'Dark theme' : 'Light theme'}
          description="Switch between dark and light appearance."
        />
      </SettingsSection>

<<<<<<< HEAD
=======
      <SettingsSection
        title="Store Timing"
        description="Sets when the store opens and closes. HaiVE AI uses this to automatically post a to-do list before opening and an end-of-day report at closing, grounded in your CRM and Outlook data."
        footer={
          <Button onClick={() => void handleSaveHours()} disabled={savingHours} leftIcon={<FiClock />}>
            {savingHours ? 'Saving…' : 'Save Store Timing'}
          </Button>
        }
      >
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <Input
            type="time"
            label="Opening time"
            value={openingTime}
            onChange={(e) => setOpeningTime(e.target.value)}
          />
          <Input
            type="time"
            label="Closing time"
            value={closingTime}
            onChange={(e) => setClosingTime(e.target.value)}
          />
        </div>
        <SettingsField label="Timezone">
          <select className={styles.select} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {/* TIMEZONES is Intl.supportedValuesOf('timeZone') where available, but
                different browsers/ICU versions disagree on canonical vs. alias names
                for the same zone (e.g. some report "Asia/Calcutta", not "Asia/Kolkata",
                for India) — if the saved/current value isn't literally one of the
                <option>s, a native <select> silently displays its first option
                instead while the real value stays selected internally, which looks
                exactly like the picker "forgetting" a correctly-saved timezone.
                Unioning the current value in guarantees it's always a real option. */}
            {(TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]).map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </SettingsField>
      </SettingsSection>

>>>>>>> 6a60a8648 (Initial AI Agent source code)
      <div className={styles.footer} style={{ borderTop: 'none' }}>
        <Button onClick={handleSave} leftIcon={theme === 'dark' ? <FiMoon /> : <FiSun />}>
          Save Changes
        </Button>
      </div>
    </>
  );
}
