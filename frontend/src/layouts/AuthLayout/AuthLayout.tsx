import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Logo } from '@/components/common/Logo';
import styles from './AuthLayout.module.css';

export interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className={styles.page}>
      <span className={styles.blobA} aria-hidden />
      <span className={styles.blobB} aria-hidden />
      <span className={styles.blobC} aria-hidden />

      <motion.div
        className={styles.content}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className={styles.card}>
          <div className={styles.logoRow}>
            <Logo />
          </div>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {children}
        </div>
      </motion.div>
    </div>
  );
}
