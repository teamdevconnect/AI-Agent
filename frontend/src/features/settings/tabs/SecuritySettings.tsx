import { ApiTokensSection } from './security/ApiTokensSection';
import { PasswordSection } from './security/PasswordSection';
import { SessionsSection } from './security/SessionsSection';
import { TwoFactorSection } from './security/TwoFactorSection';

export function SecuritySettings() {
  return (
    <>
      <PasswordSection />
      <TwoFactorSection />
      <SessionsSection />
      <ApiTokensSection />
    </>
  );
}
