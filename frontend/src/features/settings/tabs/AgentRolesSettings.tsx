import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiUpload, FiX } from 'react-icons/fi';
import { Avatar, Badge, Button, IconButton, Input, Modal, Spinner, StringListEditor } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { agentRolesService, type AgentRole, type AgentRoleKpi } from '@/services/agentRolesService';
import { usersService, type AdminUser } from '@/services/usersService';
import { TOOL_PICKER_OPTIONS } from '@/features/chat/toolPickerOptions';
import { SettingsField, SettingsSection } from '../components/SettingsSection';
import styles from './AgentRolesSettings.module.css';

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.xlsx,.xls,.csv,.html,.htm,.txt,.md';

function KpiListEditor({ kpis, onChange }: { kpis: AgentRoleKpi[]; onChange: (kpis: AgentRoleKpi[]) => void }) {
  return (
    <SettingsField label="KPIs">
      <div className={styles.listEditor}>
        {kpis.map((kpi, index) => (
          <div key={index} className={styles.kpiRow}>
            <Input
              placeholder="KPI name"
              value={kpi.name}
              onChange={(e) => onChange(kpis.map((k, i) => (i === index ? { ...k, name: e.target.value } : k)))}
            />
            <Input
              placeholder="Description"
              value={kpi.description}
              onChange={(e) =>
                onChange(kpis.map((k, i) => (i === index ? { ...k, description: e.target.value } : k)))
              }
            />
            <IconButton
              icon={<FiX />}
              label="Remove"
              size="sm"
              onClick={() => onChange(kpis.filter((_, i) => i !== index))}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={<FiPlus />}
          onClick={() => onChange([...kpis, { name: '', description: '' }])}
        >
          Add KPI
        </Button>
      </div>
    </SettingsField>
  );
}

function CheckboxGrid({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };
  return (
    <div className={styles.checkboxGrid}>
      {options.map((opt) => (
        <label key={opt.value} className={styles.checkboxOption}>
          <input type="checkbox" checked={selected.includes(opt.value)} onChange={() => toggle(opt.value)} />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

export function AgentRolesSettings() {
  const [roles, setRoles] = useState<AgentRole[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [editingRole, setEditingRole] = useState<AgentRole | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadRoles = async () => {
    setLoadingList(true);
    try {
      setRoles(await agentRolesService.list());
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoadingList(false);
    }
    // Separate, non-fatal: GET /users is admin-only, but this page (and its
    // read-only role list) is reachable by every non-agent_user role — a
    // 403 here must not break the page for them, only leave the "Visible To
    // Employees" picker empty (which only admins can act on anyway, since
    // editing/saving a role is already admin-gated server-side).
    try {
      setUsers(await usersService.list());
    } catch {
      setUsers([]);
    }
  };

  useEffect(() => {
    void loadRoles();
  }, []);

  const handleGenerate = async () => {
    if (!file) return;
    setGenerating(true);
    try {
      const draft = await agentRolesService.generate(file);
      toast.success('Role extracted — review before activating');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadRoles();
      setEditingRole(draft);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (status?: 'draft' | 'active') => {
    if (!editingRole?._id) return;
    setSaving(true);
    try {
      const updated = await agentRolesService.update(editingRole._id, {
        name: editingRole.name,
        department: editingRole.department,
        description: editingRole.description,
        responsibilities: editingRole.responsibilities,
        dailyTasks: editingRole.dailyTasks,
        weeklyTasks: editingRole.weeklyTasks,
        kpis: editingRole.kpis,
        systemPrompt: editingRole.systemPrompt,
        assignedDepartments: editingRole.assignedDepartments ?? [],
        assignedUserIds: editingRole.assignedUserIds ?? [],
        allowedTools: editingRole.allowedTools ?? [],
        modelTier: editingRole.modelTier,
        ...(status ? { status } : {}),
      });
      toast.success(status === 'active' ? 'Role activated' : 'Role saved');
      setEditingRole(null);
      setRoles((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
      await loadRoles();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: AgentRole) => {
    if (!role._id) return;
    if (!window.confirm(`Delete "${role.name}"? This cannot be undone.`)) return;
    try {
      await agentRolesService.remove(role._id);
      toast.success('Role deleted');
      await loadRoles();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  return (
    <>
      <SettingsSection
        title="Generate a New Role"
        description="Upload a job description, SOP, or KPI sheet — HaiVE AI extracts the role's responsibilities, tasks, and KPIs and turns it into a new selectable AI persona."
      >
        <div className={styles.uploadRow}>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            style={{ display: 'none' }}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            leftIcon={<FiUpload />}
            onClick={() => fileInputRef.current?.click()}
          >
            Choose File
          </Button>
          {file && <span className={styles.fileName}>{file.name}</span>}
          <Button type="button" disabled={!file || generating} onClick={() => void handleGenerate()}>
            {generating ? 'Generating…' : 'Generate Role'}
          </Button>
        </div>
        {generating && (
          <div className={styles.loadingRow}>
            <Spinner size={16} />
            Analyzing document — this can take up to 15 seconds…
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Existing Roles" description="Built-in personas plus any roles generated from your documents.">
        {loadingList ? (
          <div className={styles.loadingRow}>
            <Spinner size={16} />
            Loading roles…
          </div>
        ) : (
          <div className={styles.roleList}>
            {roles.map((role) => (
              <div key={role._id ?? role.slug} className={styles.roleRow}>
                <Avatar name={role.name} color={role.avatarColor} size="sm" />
                <div className={styles.roleInfo}>
                  <span className={styles.roleName}>{role.name}</span>
                  {role.department && <span className={styles.roleDept}>{role.department}</span>}
                </div>
                {role.builtin ? (
                  <Badge variant="info">Built-in</Badge>
                ) : (
                  <Badge variant={role.status === 'active' ? 'success' : 'warning'}>
                    {role.status === 'active' ? 'Active' : 'Draft'}
                  </Badge>
                )}
                {!role.builtin && (
                  <div className={styles.roleActions}>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditingRole(role)}>
                      Edit
                    </Button>
                    <IconButton
                      icon={<FiTrash2 />}
                      label="Delete role"
                      size="sm"
                      onClick={() => void handleDelete(role)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      <Modal
        open={!!editingRole}
        onClose={() => setEditingRole(null)}
        title={editingRole?.name || 'Review Role'}
        description={editingRole?.sourceDocumentName ? `Extracted from ${editingRole.sourceDocumentName}` : undefined}
        maxWidth={640}
      >
        {editingRole && (
          <>
            <div className={styles.modalBody}>
              <Input
                label="Name"
                value={editingRole.name}
                onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
              />
              <Input
                label="Department"
                value={editingRole.department ?? ''}
                onChange={(e) => setEditingRole({ ...editingRole, department: e.target.value })}
              />
              <Input
                label="Description"
                value={editingRole.description}
                onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
              />
              <StringListEditor
                label="Responsibilities"
                items={editingRole.responsibilities ?? []}
                onChange={(v) => setEditingRole({ ...editingRole, responsibilities: v })}
              />
              <StringListEditor
                label="Daily Tasks"
                items={editingRole.dailyTasks ?? []}
                onChange={(v) => setEditingRole({ ...editingRole, dailyTasks: v })}
              />
              <StringListEditor
                label="Weekly Tasks"
                items={editingRole.weeklyTasks ?? []}
                onChange={(v) => setEditingRole({ ...editingRole, weeklyTasks: v })}
              />
              <KpiListEditor
                kpis={editingRole.kpis ?? []}
                onChange={(v) => setEditingRole({ ...editingRole, kpis: v })}
              />
              <StringListEditor
                label="Visible To Departments (leave empty for org-wide)"
                items={editingRole.assignedDepartments ?? []}
                onChange={(v) => setEditingRole({ ...editingRole, assignedDepartments: v })}
              />
              <SettingsField label="Visible To Employees (leave unchecked for org-wide)">
                <CheckboxGrid
                  options={users.map((u) => ({ value: u.id, label: u.name }))}
                  selected={editingRole.assignedUserIds ?? []}
                  onChange={(v) => setEditingRole({ ...editingRole, assignedUserIds: v })}
                />
              </SettingsField>
              <SettingsField label="Allowed Tools (leave unchecked for unrestricted)">
                <CheckboxGrid
                  options={TOOL_PICKER_OPTIONS.map((t) => ({ value: t.name, label: t.label }))}
                  selected={editingRole.allowedTools ?? []}
                  onChange={(v) => setEditingRole({ ...editingRole, allowedTools: v })}
                />
              </SettingsField>
              <SettingsField label="Model Tier">
                <select
                  className={styles.select}
                  value={editingRole.modelTier ?? ''}
                  onChange={(e) =>
                    setEditingRole({
                      ...editingRole,
                      modelTier: (e.target.value || null) as 'fast' | 'standard' | null,
                    })
                  }
                >
                  <option value="">Default (auto)</option>
                  <option value="fast">Fast (cheaper, quicker)</option>
                  <option value="standard">Standard (full model)</option>
                </select>
              </SettingsField>
              <SettingsField label="System Prompt">
                <textarea
                  className={styles.textarea}
                  value={editingRole.systemPrompt ?? ''}
                  onChange={(e) => setEditingRole({ ...editingRole, systemPrompt: e.target.value })}
                />
              </SettingsField>
            </div>
            <div className={styles.modalFooter}>
              <Button type="button" variant="ghost" onClick={() => setEditingRole(null)}>
                Cancel
              </Button>
              {editingRole.status === 'active' ? (
                <Button type="button" disabled={saving} onClick={() => void handleSave()}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              ) : (
                <>
                  <Button type="button" variant="outline" disabled={saving} onClick={() => void handleSave('draft')}>
                    Save Draft
                  </Button>
                  <Button type="button" disabled={saving} onClick={() => void handleSave('active')}>
                    {saving ? 'Activating…' : 'Activate'}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

