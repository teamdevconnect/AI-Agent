import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiUser, FiMail, FiLock, FiPhone, FiBriefcase, FiEye, FiEyeOff } from 'react-icons/fi';
import { Input, Button } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { ROUTES } from '@/constants/routes';
import { registerSchema, type RegisterFormValues } from './schemas';
import { PasswordStrengthMeter } from './components/PasswordStrengthMeter';
import styles from './AuthForm.module.css';

export function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const register_ = useAuthStore((state) => state.register);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      company: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      acceptTerms: undefined as unknown as true,
      marketingConsent: false,
    },
  });

  const password = watch('password');

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      await register_(values);
      toast.success('Account created — welcome to HaiVE AI!');
      navigate(ROUTES.chat, { replace: true });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className={styles.row2}>
          <Input label="First name" leftIcon={<FiUser />} error={errors.firstName?.message} {...register('firstName')} />
          <Input label="Last name" error={errors.lastName?.message} {...register('lastName')} />
        </div>

        <Input label="Company" leftIcon={<FiBriefcase />} error={errors.company?.message} {...register('company')} />

        <Input label="Email" type="email" leftIcon={<FiMail />} error={errors.email?.message} {...register('email')} />

        <Input label="Phone" type="tel" leftIcon={<FiPhone />} error={errors.phone?.message} {...register('phone')} />

        <Input
          label="Password"
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
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordStrengthMeter password={password ?? ''} />

        <Input
          label="Confirm password"
          type={showPassword ? 'text' : 'password'}
          leftIcon={<FiLock />}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <label className={styles.checkboxRow}>
          <input type="checkbox" {...register('acceptTerms')} />
          <span>
            I accept the <a className={styles.link}>Terms of Service</a> and <a className={styles.link}>Privacy Policy</a>
          </span>
        </label>
        {errors.acceptTerms && <span className={styles.strengthLabel}>{errors.acceptTerms.message}</span>}

        <label className={styles.checkboxRow}>
          <input type="checkbox" {...register('marketingConsent')} />
          <span>Send me product updates and marketing communications</span>
        </label>

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Create Account
        </Button>
      </form>

      <p className={styles.footerText}>
        Already have an account?{' '}
        <Link className={styles.link} to={ROUTES.login}>
          Sign in
        </Link>
      </p>
    </>
  );
}
