import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { useClickOutside } from '@/hooks/useClickOutside';
import styles from './Dropdown.module.css';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  placement?: 'top' | 'bottom';
}

export function Dropdown({ trigger, items, align = 'left', placement = 'bottom' }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useClickOutside(wrapperRef, () => setOpen(false), open);

  const yOffset = placement === 'top' ? 6 : -6;

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <span onClick={() => setOpen((prev) => !prev)}>{trigger}</span>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className={clsx(
              styles.menu,
              align === 'right' ? styles.alignRight : styles.alignLeft,
              placement === 'top' && styles.placementTop,
            )}
            initial={{ opacity: 0, y: yOffset, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: yOffset, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
          >
            {items.map((item) => (
              <div key={item.id}>
                {item.separatorBefore && <div className={styles.separator} />}
                <button
                  type="button"
                  role="menuitem"
                  className={clsx(styles.item, item.danger && styles.itemDanger)}
                  onClick={() => {
                    item.onSelect();
                    setOpen(false);
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
