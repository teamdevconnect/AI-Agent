import styles from '../AuthForm.module.css';

const LEVELS = [
  { label: 'Very weak', color: 'var(--color-danger)' },
  { label: 'Weak', color: 'var(--color-danger)' },
  { label: 'Fair', color: 'var(--color-warning)' },
  { label: 'Good', color: 'var(--color-info)' },
  { label: 'Strong', color: 'var(--color-success)' },
];

function scorePassword(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  const score = scorePassword(password);
  const level = LEVELS[score];

  return (
    <div>
      <div className={styles.strengthMeter}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={styles.strengthBar}
            style={{ background: i <= score - 1 || (score === 0 && i === 0 && password.length > 0) ? level.color : undefined }}
          />
        ))}
      </div>
      {password.length > 0 && <div className={styles.strengthLabel}>{level.label}</div>}
    </div>
  );
}
