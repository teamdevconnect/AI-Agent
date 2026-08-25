import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Badge, Button, Input, StringListEditor, Tabs } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { ROUTES } from '@/constants/routes';
import { TOOL_PICKER_OPTIONS } from '@/features/chat/toolPickerOptions';
import { agentRolesService, type AgentRole, type AgentRoleKpi } from '@/services/agentRolesService';
import type { AdminUser } from '@/services/usersService';
import styles from '../AgentRolesSettings.module.css';

const SECTION_TABS = [
  { id: 'identity', label: 'Identity' },
  { id: 'goals', label: 'Goals' },
  { id: 'instructions', label: 'Instructions' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'tools', label: 'Tools' },
  { id: 'access', label: 'Access' },
];

// A CheckboxGrid generic enough for both "Visible To Employees" and "Allowed
// Tools" — kept local to this form (its two previous private homes were
// both AgentRolesSettings.tsx; not promoted to components/ui since it has
// no other consumer yet).
function CheckboxGrid({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
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

function KpiListEditor({ kpis, onChange }: { kpis: AgentRoleKpi[]; onChange: (next: AgentRoleKpi[]) => void }) {
  const setKpi = (i: number, key: keyof AgentRoleKpi, value: string) =>
    onChange(kpis.map((k, idx) => (idx === i ? { ...k, [key]: value } : k)));
  const remove = (i: number) => onChange(kpis.filter((_, idx) => idx !== i));
  const add = () => onChange([...kpis, { name: '', description: '' }]);
  return (
    <div className={styles.kpiList}>
      {kpis.map((kpi, i) => (
        <div key={i} className={styles.kpiRow}>
          <Input placeholder="KPI name" value={kpi.name} onChange={(e) => setKpi(i, 'name', e.target.value)} />
          <Input placeholder="Description" value={kpi.description} onChange={(e) => setKpi(i, 'description', e.target.value)} />
          <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={add}>
        + Add KPI
      </Button>
    </div>
  );
}

interface FormState {
  name: string;
  department: string;
  description: string;
  goals: string[];
  responsibilities: string[];
  dailyTasks: string[];
  weeklyTasks: string[];
  kpis: AgentRoleKpi[];
  systemPrompt: string;
  assignedDepartments: string[];
  assignedUserIds: string[];
  allowedTools: string[];
  modelTier: 'fast' | 'standard' | null;
}

function toFormState(role: AgentRole): FormState {
  return {
    name: role.name ?? '',
    department: role.department ?? '',
    description: role.description ?? '',
    goals: role.goals ?? [],
    responsibilities: role.responsibilities ?? [],
    dailyTasks: role.dailyTasks ?? [],
    weeklyTasks: role.weeklyTasks ?? [],
    kpis: role.kpis ?? [],
    systemPrompt: role.systemPrompt ?? '',
    assignedDepartments: role.assignedDepartments ?? [],
    assignedUserIds: role.assignedUserIds ?? [],
    allowedTools: role.allowedTools ?? [],
    modelTier: role.modelTier ?? null,
  };
}

interface AgentConfigurationFormProps {
  // For a not-yet-created role (Template/Manual), the caller passes a
  // synthetic AgentRole-shaped object with `_id` omitted and `status:
  // 'draft'` — the form doesn't need a separate "create vs edit" prop, it
  // just checks `role._id` to decide which service call to make on save.
  role: AgentRole;
  users: AdminUser[];
  onSaved: (role: AgentRole) => void;
  onCancel: () => void;
}

// Agent Builder Phase 1 — replaces the old flat single-modal form with real
// sections. Used both for reviewing a freshly-generated/manual config
// (role._id is undefined, or set-but-still-draft) and for editing an
// already-active role later from the list.
export function AgentConfigurationForm({ role, users, onSaved, onCancel }: AgentConfigurationFormProps) {
  const navigate = useNavigate();
  const [section, setSection] = useState('identity');
  const [form, setForm] = useState<FormState>(() => toFormState(role));
  const [saving, setSaving] = useState<'draft' | 'active' | null>(null);

  const employeeOptions = useMemo(() => users.map((u) => ({ value: u.id, label: u.name })), [users]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const isNew = !role._id;
  const isActive = role.status === 'active';

  const save = async (targetStatus: 'draft' | 'active') => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      setSection('identity');
      return;
    }
    if (!form.systemPrompt.trim()) {
      toast.error('Instructions (system prompt) are required');
      setSection('instructions');
      return;
    }

    setSaving(targetStatus);
    try {
      const configFields = {
        name: form.name,
        department: form.department,
        description: form.description,
        goals: form.goals,
        responsibilities: form.responsibilities,
        dailyTasks: form.dailyTasks,
        weeklyTasks: form.weeklyTasks,
        kpis: form.kpis,
        systemPrompt: form.systemPrompt,
        assignedDepartments: form.assignedDepartments,
        assignedUserIds: form.assignedUserIds,
        allowedTools: form.allowedTools,
        modelTier: form.modelTier,
      };

      let saved: AgentRole;
      if (isNew) {
        saved = await agentRolesService.create(configFields);
        if (targetStatus === 'active') {
          saved = await agentRolesService.update(saved._id!, { status: 'active' });
        }
      } else {
        saved = await agentRolesService.update(role._id!, {
          ...configFields,
          // Only include status when it's actually changing — matches the
          // old form's behavior of an already-active role's "Save" button
          // never sending a status field at all.
          ...(targetStatus === 'active' && role.status !== 'active' ? { status: 'active' as const } : {}),
        });
      }
      toast.success(targetStatus === 'active' ? 'Agent activated' : 'Draft saved');
      onSaved(saved);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const handleTestAgent = () => {
    if (!role.slug) return;
    navigate(`${ROUTES.chat}?testAgentId=${encodeURIComponent(role.slug)}`);
  };

  return (
    <div className={styles.configForm}>
      <div className={styles.configHeader}>
        <div>
          <div className={styles.configTitle}>{form.name || 'New Agent'}</div>
          <Badge variant={isActive ? 'success' : 'warning'}>{isActive ? 'Active' : 'Draft'}</Badge>
        </div>
      </div>

      <Tabs items={SECTION_TABS} activeId={section} onChange={setSection} />

      <div className={styles.configBody}>
        {section === 'identity' && (
          <div className={styles.fieldStack}>
            <label className={styles.fieldLabel}>
              Name
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Sales Intelligence Agent" />
            </label>
            <label className={styles.fieldLabel}>
              Department
              <Input value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="e.g. Sales" />
            </label>
            <label className={styles.fieldLabel}>
              Description
              <Input
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="What this agent does, in one sentence"
              />
            </label>
          </div>
        )}

        {section === 'goals' && (
          <div className={styles.fieldStack}>
            <p className={styles.sectionHint}>
              What does success look like for this agent? Outcomes, not tasks — e.g. "Improve sales conversion," not
              "Check CRM daily."
            </p>
            <StringListEditor label="Goals" items={form.goals} onChange={(v) => set('goals', v)} addLabel="Add Goal" />
          </div>
        )}

        {section === 'instructions' && (
          <div className={styles.fieldStack}>
            <label className={styles.fieldLabel}>
              System Prompt
              <textarea
                className={styles.textarea}
                value={form.systemPrompt}
                onChange={(e) => set('systemPrompt', e.target.value)}
                placeholder="How should this agent behave? What should it always/never do?"
                rows={8}
              />
            </label>
            <p className={styles.sectionHint}>
              The details below (responsibilities, tasks, KPIs) are optional extra context — most of an agent's actual
              behavior comes from the System Prompt above.
            </p>
            <StringListEditor label="Responsibilities" items={form.responsibilities} onChange={(v) => set('responsibilities', v)} />
            <StringListEditor label="Daily Tasks" items={form.dailyTasks} onChange={(v) => set('dailyTasks', v)} />
            <StringListEditor label="Weekly Tasks" items={form.weeklyTasks} onChange={(v) => set('weeklyTasks', v)} />
            <div className={styles.fieldLabel}>
              KPIs
              <KpiListEditor kpis={form.kpis} onChange={(v) => set('kpis', v)} />
            </div>
          </div>
        )}

        {section === 'knowledge' && (
          <div className={styles.fieldStack}>
            {role.sourceDocumentName ? (
              <p className={styles.sectionHint}>Generated from: {role.sourceDocumentName}</p>
            ) : null}
            <p className={styles.sectionHint}>
              This agent draws from your organization's shared knowledge base — the same documents every AI agent in
              your organization can already search. There is no way yet to restrict a single agent to its own private
              set of documents.
            </p>
          </div>
        )}

        {section === 'tools' && (
          <div className={styles.fieldStack}>
            <div className={styles.fieldLabel}>
              Allowed Tools (leave unchecked for unrestricted)
              <CheckboxGrid options={TOOL_PICKER_OPTIONS.map((t) => ({ value: t.name, label: t.label }))} selected={form.allowedTools} onChange={(v) => set('allowedTools', v)} />
            </div>
            <label className={styles.fieldLabel}>
              Model Tier
              <select
                className={styles.select}
                value={form.modelTier ?? ''}
                onChange={(e) => set('modelTier', (e.target.value || null) as 'fast' | 'standard' | null)}
              >
                <option value="">Default (auto)</option>
                <option value="fast">Fast (cheaper, quicker)</option>
                <option value="standard">Standard (full model)</option>
              </select>
            </label>
          </div>
        )}

        {section === 'access' && (
          <div className={styles.fieldStack}>
            <StringListEditor
              label="Visible To Departments (leave empty for org-wide)"
              items={form.assignedDepartments}
              onChange={(v) => set('assignedDepartments', v)}
            />
            <div className={styles.fieldLabel}>
              Visible To Employees (leave unchecked for org-wide)
              <CheckboxGrid options={employeeOptions} selected={form.assignedUserIds} onChange={(v) => set('assignedUserIds', v)} />
            </div>
          </div>
        )}
      </div>

      <div className={styles.configFooter}>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={!!saving}>
          Cancel
        </Button>
        {isActive && !isNew ? (
          <Button type="button" onClick={() => void save('active')} loading={saving === 'active'}>
            Save
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={() => void save('draft')} loading={saving === 'draft'}>
              Save Draft
            </Button>
            <Button type="button" onClick={() => void save('active')} loading={saving === 'active'}>
              Activate
            </Button>
          </>
        )}
        {isActive && (
          <Button type="button" variant="outline" onClick={handleTestAgent} disabled={!!saving}>
            Test Agent
          </Button>
        )}
      </div>
    </div>
  );
}
