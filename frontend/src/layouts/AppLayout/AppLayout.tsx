import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useNotificationsStore } from '@/stores/notificationsStore';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const isMobile = useMediaQuery('(max-width: 900px)');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setMobileSidebarOpen(false);
  }, [isMobile]);

  // Fetches existing notifications and subscribes to live push as soon as
  // any authenticated page mounts — not just when the user opens the
  // Notifications page — so the TopBar's unread dot (see TopBar.tsx) is
  // accurate app-wide, and proactive AI notifications (app.workflows in
  // python-agent) arrive live without a manual refresh.
  useEffect(() => {
    useNotificationsStore.getState().init();
  }, []);

  if (!isMobile) {
    return (
      <div className={styles.shell}>
        <Sidebar />
        <div className={styles.mainColumn}>
          <TopBar />
          <main className={styles.content}>
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              className={styles.mobileSidebarBackdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.div
              className={styles.sidebarMobile}
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <Sidebar />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <div className={styles.mainColumn}>
        <TopBar onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
