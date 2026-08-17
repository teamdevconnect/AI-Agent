import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { formatINR } from '@/utils/currency';
import { usersService, type AdminUser } from '@/services/usersService';
import { dealsService, type Deal, type ExternalOwnerRow } from '@/services/dealsService';
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
  const [ownerRows, setOwnerRows] = useState<ExternalOwnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [assigning, setAssigning] = useState<Record<string, boolean>>({});
  const [mappingSaving, setMappingSaving] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [dealList, userList, mappingRows] = await Promise.all([
        dealsService.list(),
        usersService.list(),
        dealsService.listOwnerMappings(),
      ]);
      setDeals(dealList);
      setEmployees(userList.filter((u) => u.roles.includes('manager') || u.roles.includes('consultant')));
      setOwnerRows(mappingRows);
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

  const handleMapOwner = async (row: ExternalOwnerRow, ownerId: string) => {
    if (!ownerId) return;
    const key = `${row.provider}::${row.externalOwnerRef}`;
    setMappingSaving((prev) => ({ ...prev, [key]: true }));
    try {
      await dealsService.upsertOwnerMapping({
        provider: row.provider,
        externalOwnerRef: row.externalOwnerRef,
        externalOwnerLabel: row.externalOwnerLabel,
        ownerId,
      });
      toast.success(
        `Mapped to ${employeeName(ownerId) ?? 'employee'} — ${row.dealCount} deal${row.dealCount === 1 ? '' : 's'} updated`,
      );
      await load();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setMappingSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <SettingsSection
      title="Deal Assignment"
      description="Assign each deal to the employee who owns it — this is what drives real numbers on that person's individual dashboard. Deals synced from an external CRM carry their own owner automatically once you map that CRM's salesperson to a real employee below."
    >
      {ownerRows.length > 0 && (
        <div className={styles.mappingSection}>
          <h4 className={styles.mappingHeading}>External CRM Owner Mapping</h4>
          <p className={styles.mappingHint}>
            Each row is a distinct salesperson id seen on your synced deals. Map it to a real employee once — every
            matching deal (including future syncs) is updated automatically, regardless of which CRM it came from.
          </p>
          <div className={styles.dealList}>
            {ownerRows.map((row) => {
              const key = `${row.provider}::${row.externalOwnerRef}`;
              return (
                <div key={key} className={styles.dealRow}>
                  <div className={styles.dealInfo}>
                    <span className={styles.dealName}>{row.externalOwnerLabel || row.externalOwnerRef}</span>
                    <span className={styles.dealMeta}>
                      {row.provider} · {row.dealCount} deal{row.dealCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <select
                    className={styles.select}
                    value={row.mapping?.ownerId ?? ''}
                    disabled={mappingSaving[key]}
                    onChange={(e) => void handleMapOwner(row, e.target.value)}
                  >
                    <option value="">Not mapped</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
