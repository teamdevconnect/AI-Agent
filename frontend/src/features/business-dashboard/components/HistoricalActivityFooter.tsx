import { useNavigate } from 'react-router-dom';
import { FiArchive } from 'react-icons/fi';
import { Button, SectionCard } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import styles from '../business-dashboard.module.css';

// Tier 8 — deliberately no new data fetch. Per the brief's own principle
// ("everything not in the 8 tiers belongs on a drill-down page"), this is
// just a link into the existing Timeline page's full history, not a second
// live feed duplicating tier 7.
export function HistoricalActivityFooter() {
  const navigate = useNavigate();
  return (
    <SectionCard title="Historical Activity" icon={FiArchive}>
      <div className={styles.footerCard}>
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate(ROUTES.timeline)}>
          View full Activity History →
        </Button>
      </div>
    </SectionCard>
  );
}
