import { useEffect, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { FiSearch } from 'react-icons/fi';
import { Badge, Button, Input, MultiSelectDropdown, Skeleton, type MultiSelectOption } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { formatINR } from '@/utils/currency';
import { usersService, type AdminUser } from '@/services/usersService';
import { dealsService, type AssignmentDealRow, type DealFilters, type ExternalOwnerRow } from '@/services/dealsService';
import { SettingsSection } from '../components/SettingsSection';
import styles from './DealAssignmentSettings.module.css';

const STATUS_VARIANT: Record<AssignmentDealRow['dealStatus'], 'success' | 'danger' | 'neutral'> = {
  won: 'success',
  lost: 'danger',
  open: 'neutral',
};

const STATUS_OPTIONS: MultiSelectOption[] = [
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

// Only non-'account' sources get a hint — an Account is a real linked
// record, everything else is a best-effort guess and should read as one
// (same "coverage/source transparency" convention deal-performance's
// CustomerActivityTable already uses).
const CUSTOMER_SOURCE_HINT: Partial<Record<NonNullable<AssignmentDealRow['customerNameSource']>, string>> = {
  quote_client_details: 'From linked quote',
  deal_name_heuristic: 'Derived from deal name',
};

const PAGE_SIZE = 25;

export function DealAssignmentSettings() {
  const [employees, setEmployees] = useState<AdminUser[]>([]);
  const [ownerRows, setOwnerRows] = useState<ExternalOwnerRow[]>([]);
  const [mappingSaving, setMappingSaving] = useState<Record<string, boolean>>({});

  const [filters, setFilters] = useState<DealFilters>({});
  const [needsMappingOnly, setNeedsMappingOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [deals, setDeals] = useState<AssignmentDealRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<Record<string, boolean>>({});

  const loadStatic = async () => {
    try {
      const [userList, mappingRows] = await Promise.all([usersService.list(), dealsService.listOwnerMappings()]);
      setEmployees(userList.filter((u) => u.roles.includes('manager') || u.roles.includes('consultant')));
      setOwnerRows(mappingRows);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const loadDeals = async () => {
    setLoading(true);
    try {
      const result = await dealsService.listForAssignment(filters, page, PAGE_SIZE, needsMappingOnly);
      setDeals(result.items);
      setTotal(result.total);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatic();
  }, []);

  useEffect(() => {
    void loadDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, needsMappingOnly, page]);

  // Filters/toggle changes reset to page 1 in the same handler that updates
  // them (not via a separate effect keyed off filters) — batches into one
  // render, avoiding a stale-page fetch immediately followed by a
  // page-1 refetch.
  const updateFilters = (patch: Partial<DealFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };
  const updateNeedsMappingOnly = (value: boolean) => {
    setNeedsMappingOnly(value);
    setPage(1);
  };

  const employeeName = (id?: string) => employees.find((e) => e.id === id)?.name;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleAssign = async (dealId: string, ownerId: string) => {
    setAssigning((prev) => ({ ...prev, [dealId]: true }));
    try {
      await dealsService.assign(dealId, ownerId || null);
      toast.success(ownerId ? `Assigned to ${employeeName(ownerId)}` : 'Unassigned');
      await loadDeals();
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
      await Promise.all([loadStatic(), loadDeals()]);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setMappingSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const ownerCell = (d: AssignmentDealRow) => {
    let badge: ReactNode;
    if (d.ownershipStatus === 'assigned') {
      badge = <Badge variant="success">{d.ownerName ?? 'Unknown user'}</Badge>;
    } else if (d.ownershipStatus === 'pending_mapping') {
      badge = <Badge variant="warning">CRM: {d.externalOwnerLabel ?? d.externalOwnerRef} — needs mapping</Badge>;
    } else {
      badge = <Badge variant="neutral">Unassigned</Badge>;
    }
    return (
      <div className={styles.ownerCell}>
        {badge}
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
    );
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
                  {!row.mapping && row.suggestedOwnerId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={mappingSaving[key]}
                      onClick={() => void handleMapOwner(row, row.suggestedOwnerId!)}
                    >
                      Use suggested: {row.suggestedOwnerName}
                    </Button>
                  )}
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

      <div className={styles.filterBar}>
        <div className={styles.filterRow}>
          <div className={styles.valueField} style={{ width: 240 }}>
            <Input
              leftIcon={<FiSearch />}
              placeholder="Search deals by name"
              value={filters.search ?? ''}
              onChange={(e) => updateFilters({ search: e.target.value || undefined })}
            />
          </div>
          <MultiSelectDropdown
            label="Status"
            options={STATUS_OPTIONS}
            selected={filters.dealStatus ?? []}
            onChange={(v) => updateFilters({ dealStatus: v.length ? (v as DealFilters['dealStatus']) : undefined })}
          />
          <label className={styles.filterToggle}>
            <input type="checkbox" checked={needsMappingOnly} onChange={(e) => updateNeedsMappingOnly(e.target.checked)} />
            Needs mapping only
          </label>
        </div>
      </div>

      {loading ? (
        <Skeleton height={280} />
      ) : deals.length === 0 ? (
        <div className={styles.emptyState}>{needsMappingOnly ? 'Every deal is assigned.' : 'No deals match this filter.'}</div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Deal</th>
                  <th>Customer / Account</th>
                  <th>Status</th>
                  <th>Deal Owner</th>
                  <th>Value</th>
                  <th>Closes</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => {
                  const hint = d.customerNameSource ? CUSTOMER_SOURCE_HINT[d.customerNameSource] : undefined;
                  return (
                    <tr key={d._id}>
                      <td>
                        <div className={styles.listItemMain}>
                          <span className={styles.listItemTitle}>{d.name}</span>
                          {d.externalOwnerProvider && <span className={styles.listItemMeta}>Synced from {d.externalOwnerProvider}</span>}
                        </div>
                      </td>
                      <td>
                        <div className={styles.listItemMain}>
                          <span className={styles.listItemTitle}>{d.customerName ?? '—'}</span>
                          {hint && <span className={styles.listItemMeta}>{hint}</span>}
                        </div>
                      </td>
                      <td>
                        <Badge variant={STATUS_VARIANT[d.dealStatus]}>{d.dealStatus}</Badge>
                      </td>
                      <td>{ownerCell(d)}</td>
                      <td>{formatINR(d.monetaryValue)}</td>
                      <td>{d.expectedClosingDate ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.paginationRow}>
            <span className={styles.mappingHint}>{total} deal{total === 1 ? '' : 's'}</span>
            {totalPages > 1 && (
              <div className={styles.paginationControls}>
                <Button type="button" variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className={styles.mappingHint}>
                  Page {page} of {totalPages}
                </span>
                <Button type="button" variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </SettingsSection>
  );
}
