import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import styles from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  orientation?: 'horizontal' | 'vertical';
}

export function Tabs({ items, activeId, onChange, orientation = 'horizontal' }: TabsProps) {
  return (
    <div className={clsx(styles.list, orientation === 'vertical' && styles.vertical)} role="tablist">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={clsx(styles.tab, active && styles.tabActive)}
            onClick={() => onChange(item.id)}
          >
            {item.icon}
            {item.label}
            {active && <motion.span layoutId="tab-indicator" className={styles.indicator} />}
          </button>
        );
      })}
    </div>
  );
}
