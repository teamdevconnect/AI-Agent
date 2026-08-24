import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input } from '@/components/ui';
import { twoFactorChallengeSchema, type TwoFactorChallengeFormValues } from '../schemas';
import styles from '../AuthForm.module.css';

export interface TwoFactorChallengeFormProps {
  onSubmit: (code: string) => Promise<void>;
  onBack: () => void;
}

// Shared between LoginPage (password path) and OAuthCallbackPage (OAuth
// path) — both reach the exact same backend challenge/verify flow (see
// AuthService.issueTokenOrChallenge, the single branch point both paths
// share), so this is one UI serving both entry points rather than two.
export function TwoFactorChallengeForm({ onSubmit, onBack }: TwoFactorChallengeFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TwoFactorChallengeFormValues>({
    resolver: zodResolver(twoFactorChallengeSchema),
    defaultValues: { code: '' },
  });

  const submit = async (values: TwoFactorChallengeFormValues) => {
    await onSubmit(values.code);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
      <div className={styles.hintBox}>
        Enter the 6-digit code from your authenticator app, or one of your backup codes.
      </div>

      <Input
        label="Verification code"
        placeholder="123456"
        autoFocus
        error={errors.code?.message}
        {...register('code')}
      />

      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        Verify
      </Button>
      <Button type="button" variant="ghost" size="lg" fullWidth onClick={onBack} disabled={isSubmitting}>
        Back
      </Button>
    </form>
  );
}
