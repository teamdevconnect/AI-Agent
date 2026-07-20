import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiEye, FiEyeOff, FiGithub } from 'react-icons/fi';
import { FaGoogle, FaMicrosoft } from 'react-icons/fa';
import { Input, Button } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { ROUTES } from '@/constants/routes';
import { loginSchema, type LoginFormValues } from './schemas';
import styles from './AuthForm.module.css';

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const location = useLocation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await login(values);
      const from = (location.state as { from?: Location })?.from?.pathname ?? ROUTES.chat;
      navigate(from, { replace: true });
      toast.success('Welcome back!');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className={styles.hintBox}>Sign in with your account, or create one below.</div>

        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          leftIcon={<FiMail />}
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
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
          error={errors.password?.message}
          {...register('password')}
        />

        <div className={styles.optionsRow}>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" {...register('rememberMe')} />
            Remember me
          </label>
          <Link className={styles.link} to={ROUTES.forgotPassword}>
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Sign In
        </Button>
      </form>

      <div className={styles.divider}>or continue with</div>
      <div className={styles.socialRow}>
        <button type="button" className={styles.socialButton} onClick={() => toast('Google SSO — Phase 2')} aria-label="Continue with Google">
          <FaGoogle />
        </button>
        <button
          type="button"
          className={styles.socialButton}
          onClick={() => toast('Microsoft SSO — Phase 2')}
          aria-label="Continue with Microsoft"
        >
          <FaMicrosoft />
        </button>
        <button type="button" className={styles.socialButton} onClick={() => toast('GitHub SSO — Phase 2')} aria-label="Continue with GitHub">
          <FiGithub />
        </button>
      </div>

      <p className={styles.footerText}>
        Don't have an account?{' '}
        <Link className={styles.link} to={ROUTES.register}>
          Create one
        </Link>
      </p>
    </>
  );
}
