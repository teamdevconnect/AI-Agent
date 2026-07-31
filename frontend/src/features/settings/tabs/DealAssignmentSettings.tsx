import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { formatINR } from '@/utils/currency';
import { usersService, type AdminUser } from '@/services/usersService';
import { dealsService, type Deal } from '@/services/dealsService';
import { SettingsSection } from '../components/SettingsSection';
import styles from './DealAssignmentSettings.module.css';

const STATUS_VARIANT: Record<Deal['dealStatus'], 'success' | 'danger' | 'neutral'> = {
  won: 'success',
  lost: 'danger',
  open: 'neutral',
};

export function DealAssignmentSettings() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [employees, setEmployees] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [assigning, setAssigning] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [dealList, userList] = await Promise.all([dealsService.list(), usersService.list()]);
      setDeals(dealList);
      setEmployees(userList.filter((u) => u.roles.includes('manager') || u.roles.includes('consultant')));
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visibleDeals = useMemo(
    () => (unassignedOnly ? deals.filter((d) => !d.ownerId) : deals),
    [deals, unassignedOnly],
  );

  const employeeName = (id?: string) => employees.find((e) => e.id === id)?.name;

  const handleAssign = async (dealId: string, ownerId: string) => {
    setAssigning((prev) => ({ ...prev, [dealId]: true }));
    try {
      const updated = await dealsService.assign(dealId, ownerId || null);
      setDeals((prev) => prev.map((d) => (d._id === dealId ? updated : d)));
      toast.success(ownerId ? `Assigned to ${employeeName(ownerId)}` : 'Unassigned');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setAssigning((prev) => ({ ...prev, [dealId]: false }));
    }
  };

  return (
    <SettingsSection
      title="Deal Assignment"
      description="Assign each deal to the employee who owns it — this is what drives real numbers on that person's individual dashboard. Deals synced from an external CRM arrive unassigned since it doesn't track this."
    >
      <label className={styles.filterRow}>
        <input type="checkbox" checked={unassignedOnly} onChange={(e) => setUnassignedOnly(e.target.checked)} />
        Show unassigned only
      </label>

      {loading ? (
        <p>Loading deals…</p>
      ) : visibleDeals.length === 0 ? (
        <div className={styles.emptyState}>
          {unassignedOnly ? 'Every deal is assigned.' : 'No deals yet.'}
        </div>
      ) : (
        <div className={styles.dealList}>
          {visibleDeals.map((d) => (
            <div key={d._id} className={styles.dealRow}>
              <div className={styles.dealInfo}>
                <span className={styles.dealName}>{d.name}</span>
                <span className={styles.dealMeta}>
                  {formatINR(d.monetaryValue)}
                  {d.expectedClosingDate ? ` — closes ${d.expectedClosingDate}` : ''}
                </span>
              </div>
              <Badge variant={STATUS_VARIANT[d.dealStatus]}>{d.dealStatus}</Badge>
              <select
                className={styles.select}
                value={d.ownerId ?? ''}
                disabled={assigning[d._id]}
                onChange={(e) => void handleAssign(d._id, e.target.value)}
              >
                <option value="">Unassigned</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}
