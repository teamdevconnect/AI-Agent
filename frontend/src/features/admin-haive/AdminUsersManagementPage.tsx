import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiSearch } from 'react-icons/fi';
import { Badge, Button, Input, Modal, Skeleton } from '@/components/ui';
import { adminUsersService, type AdminUserRow } from '@/services/adminUsersService';
import { extractErrorMessage } from '@/utils/errors';
import { useAuthStore } from '@/stores/authStore';
import shared from './adminShared.module.css';

// Only an existing platform_admin can reach this page (AdminProtectedRoute)
// or its backend routes (@Roles('platform_admin')) — normal organization
// admins/owners can never grant this role, matching the "no self-serve
// grant path" rule documented on billing-admin.controller.ts.
export function AdminUsersManagementPage() {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [admins, setAdmins] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<AdminUserRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    adminUsersService
      .listPlatformAdmins({ limit: 100 })
      .then((result) => setAdmins(result.items))
      .catch((error) => toast.error(extractErrorMessage(error)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    if (!modalOpen) return;
    if (search.trim().length < 2) {
      setCandidates([]);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(() => {
      adminUsersService
        .searchCandidates(search.trim())
        .then(setCandidates)
        .catch((error) => toast.error(extractErrorMessage(error)))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, modalOpen]);

  const grant = async (user: AdminUserRow) => {
    setBusyId(user.id);
    try {
      await adminUsersService.grant(user.id);
      toast.success(`${user.name} is now a platform admin.`);
      setModalOpen(false);
      setSearch('');
      setCandidates([]);
      load();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (user: AdminUserRow) => {
    if (!window.confirm(`Revoke platform admin access for ${user.name}?`)) return;
    setBusyId(user.id);
    try {
      await adminUsersService.revoke(user.id);
      toast.success(`Revoked platform admin access for ${user.name}.`);
      load();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={shared.page}>
      <div className={shared.headerRow}>
        <div>
          <h1 className={shared.pageTitle}>Admin Users</h1>
          <p className={shared.pageSubtitle}>Everyone with platform_admin access — the only role that can reach this panel.</p>
        </div>
        <Button leftIcon={<FiPlus />} onClick={() => setModalOpen(true)}>
          Grant Access
        </Button>
      </div>

      <div className={shared.tableWrap}>
        <table className={shared.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5}>
                  <Skeleton height={20} />
                </td>
              </tr>
            )}
            {!loading &&
              admins.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.roles.join(', ')}</td>
                  <td>
                    <Badge variant={user.active ? 'success' : 'neutral'}>{user.active ? 'active' : 'inactive'}</Badge>
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={user.id === currentUserId}
                      loading={busyId === user.id}
                      onClick={() => revoke(user)}
                    >
                      {user.id === currentUserId ? 'That’s you' : 'Revoke'}
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Grant platform admin access" description="Search any user across every organization by name or email.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input placeholder="Search by name or email..." leftIcon={<FiSearch />} value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
          {searching && <Skeleton height={20} />}
          {!searching && search.trim().length >= 2 && candidates.length === 0 && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>No matching users.</p>
          )}
          {!searching &&
            candidates.map((user) => (
              <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)' }}>{user.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{user.email}</div>
                </div>
                {user.roles.includes('platform_admin') ? (
                  <Badge variant="accent">Already admin</Badge>
                ) : (
                  <Button size="sm" loading={busyId === user.id} onClick={() => grant(user)}>
                    Grant
                  </Button>
                )}
              </div>
            ))}
        </div>
      </Modal>
    </div>
  );
}
