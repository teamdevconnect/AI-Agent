import toast from 'react-hot-toast';
import { FiSun, FiMoon } from 'react-icons/fi';
import { Button, Switch } from '@/components/ui';
import { useUiStore } from '@/stores/uiStore';
import { SettingsSection } from '../components/SettingsSection';
import styles from '../components/SettingsSection.module.css';

export function GeneralSettings() {
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);

  const handleSave = () => toast.success('General settings saved');

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

      <div className={styles.footer} style={{ borderTop: 'none' }}>
        <Button onClick={handleSave} leftIcon={theme === 'dark' ? <FiMoon /> : <FiSun />}>
          Save Changes
        </Button>
      </div>
    </>
  );
}
