import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui';
import styles from './ComingSoon.module.css';

export interface ComingSoonProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function ComingSoon({ icon, title, description }: ComingSoonProps) {
  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <span className={styles.icon}>{icon}</span>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
      <Badge variant="accent">Full experience arrives in the next build pass</Badge>
    </motion.div>
  );
}
