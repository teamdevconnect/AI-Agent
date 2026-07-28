import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiUpload, FiX } from 'react-icons/fi';
import { Avatar, Badge, Button, IconButton, Input, Modal, Spinner } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { agentRolesService, type AgentRole, type AgentRoleKpi } from '@/services/agentRolesService';
import { SettingsField, SettingsSection } from '../components/SettingsSection';
import styles from './AgentRolesSettings.module.css';

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.xlsx,.xls,.csv,.html,.htm,.txt,.md';

function StringListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <SettingsField label={label}>
      <div className={styles.listEditor}>
        {items.map((item, index) => (
          <div key={index} className={styles.listEditorRow}>
            <Input
              value={item}
              onChange={(e) => onChange(items.map((it, i) => (i === index ? e.target.value : it)))}
            />
            <IconButton
              icon={<FiX />}
              label="Remove"
              size="sm"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={<FiPlus />}
          onClick={() => onChange([...items, ''])}
        >
          Add
        </Button>
      </div>
    </SettingsField>
  );
}

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

export function AgentRolesSettings() {
  const [roles, setRoles] = useState<AgentRole[]>([]);
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

