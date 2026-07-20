import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { ROUTES } from '@/constants/routes';
import styles from './NotFoundPage.module.css';

export function NotFoundPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <div className={styles.page}>
      <span className={styles.code}>404</span>
      <span className={styles.title}>Page not found</span>
      <p className={styles.description}>The page you're looking for doesn't exist or has been moved.</p>
      <Button onClick={() => navigate(isAuthenticated ? ROUTES.chat : ROUTES.login)}>
        {isAuthenticated ? 'Back to Chat' : 'Back to Sign In'}
      </Button>
    </div>
  );
}
