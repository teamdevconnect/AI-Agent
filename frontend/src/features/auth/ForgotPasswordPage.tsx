import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiCheck, FiEye, FiEyeOff } from 'react-icons/fi';
import { Input, Button } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { authService } from '@/services/authService';
import { forgotPasswordSchema, resetPasswordSchema, type ForgotPasswordFormValues, type ResetPasswordFormValues } from './schemas';
import styles from './AuthForm.module.css';

type Step = 'email' | 'reset' | 'success';

export function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const emailForm = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });
  const resetForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { otp: '', password: '', confirmPassword: '' },
  });

  const onSubmitEmail = async (values: ForgotPasswordFormValues) => {
    try {
      const { maskedEmail } = await authService.forgotPassword(values);
      setEmail(values.email);
      setMaskedEmail(maskedEmail);
      setStep('reset');
      toast.success('Verification code sent');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const onSubmitReset = async (values: ResetPasswordFormValues) => {
    try {
      await authService.resetPassword({ email, ...values });
      setStep('success');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  if (step === 'success') {
    return (
      <div style={{ textAlign: 'center' }}>
        <span className={styles.successIcon}>
          <FiCheck />
        </span>
        <p className={styles.footerText} style={{ marginTop: 0, marginBottom: 'var(--space-6)' }}>
          Your password has been reset successfully. You can now sign in with your new password.
        </p>
        <Button fullWidth size="lg" onClick={() => navigate(ROUTES.login)}>
          Back to Sign In
        </Button>
      </div>
    );
  }

  if (step === 'reset') {
    return (
      <form className={styles.form} onSubmit={resetForm.handleSubmit(onSubmitReset)} noValidate>
        <div className={styles.hintBox}>Enter the code sent to {maskedEmail}.</div>
        <Input
          label="Verification code"
          placeholder="123456"
          maxLength={6}
          error={resetForm.formState.errors.otp?.message}
          {...resetForm.register('otp')}
        />
        <Input
          label="New password"
          type={showPassword ? 'text' : 'password'}
          leftIcon={<FiLock />}
          rightIcon={
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          }
          error={resetForm.formState.errors.password?.message}
          {...resetForm.register('password')}
        />
        <Input
          label="Confirm new password"
          type={showConfirmPassword ? 'text' : 'password'}
          leftIcon={<FiLock />}
          rightIcon={
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          }
          error={resetForm.formState.errors.confirmPassword?.message}
          {...resetForm.register('confirmPassword')}
        />
        <Button type="submit" size="lg" fullWidth loading={resetForm.formState.isSubmitting}>
          Reset Password
        </Button>
      </form>
    );
  }

  return (
    <>
      <form className={styles.form} onSubmit={emailForm.handleSubmit(onSubmitEmail)} noValidate>
        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          leftIcon={<FiMail />}
          error={emailForm.formState.errors.email?.message}
          {...emailForm.register('email')}
        />
        <Button type="submit" size="lg" fullWidth loading={emailForm.formState.isSubmitting}>
          Send Verification Code
        </Button>
      </form>
      <p className={styles.footerText}>
        Remembered your password?{' '}
        <Link className={styles.link} to={ROUTES.login}>
          Sign in
        </Link>
      </p>
    </>
  );
}
