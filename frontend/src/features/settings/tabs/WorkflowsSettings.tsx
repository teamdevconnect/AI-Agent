import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiTrash2 } from 'react-icons/fi';
import { Badge, Button, IconButton, Input, Modal, Switch } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { dayjs } from '@/utils/date';
import {
  workflowsService,
  type AvailableWorkflow,
  type CreateWorkflowDefinitionPayload,
  type TriggerType,
  type WorkflowDefinition,
  type WorkflowExecution,
} from '@/services/workflowsService';
import { SettingsField, SettingsSection } from '../components/SettingsSection';
import styles from './WorkflowsSettings.module.css';

// Matches backend/src/timeline/schemas/timeline-event.schema.ts's known
// TimelineEventType values — deliberately a plain string there (not an
// enum) so this list can grow without a migration; kept in sync by hand.
const KNOWN_EVENT_TYPES = ['daily_report_generated', 'daily_report_missed', 'task_completed', 'achievement_unlocked'];

const TRIGGER_BADGE: Record<TriggerType, 'info' | 'accent' | 'neutral'> = {
  schedule: 'info',
  event: 'accent',
  manual: 'neutral',
};

const emptyForm: CreateWorkflowDefinitionPayload = {
  name: '',
  workflowName: '',
  triggerType: 'manual',
  schedule: '',
  eventType: '',
  enabled: true,
};

export function WorkflowsSettings() {
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [available, setAvailable] = useState<AvailableWorkflow[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateWorkflowDefinitionPayload>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<WorkflowDefinition | null>(null);
  const [deleting, setDeleting] = useState<WorkflowDefinition | null>(null);
  const [running, setRunning] = useState<Record<string, boolean>>({});

  const [viewingExecutions, setViewingExecutions] = useState<WorkflowDefinition | null>(null);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loadingExecutions, setLoadingExecutions] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [defs, avail] = await Promise.all([workflowsService.list(), workflowsService.listAvailable()]);
      setDefinitions(defs);
      setAvailable(avail);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const closeCreateModal = () => {
    setCreateOpen(false);
    setForm(emptyForm);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await workflowsService.create({
        ...form,
        schedule: form.triggerType === 'schedule' ? form.schedule : undefined,
        eventType: form.triggerType === 'event' ? form.eventType : undefined,
      });
      toast.success('Workflow created');
      closeCreateModal();
      await load();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await workflowsService.update(editing._id, {
        name: editing.name,
        workflowName: editing.workflowName,
        triggerType: editing.triggerType,
        schedule: editing.triggerType === 'schedule' ? editing.schedule : undefined,
        eventType: editing.triggerType === 'event' ? editing.eventType : undefined,
      });
      setDefinitions((prev) => prev.map((d) => (d._id === updated._id ? updated : d)));
      toast.success('Workflow updated');
      setEditing(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (definition: WorkflowDefinition) => {
    try {
      const updated = await workflowsService.update(definition._id, { enabled: !definition.enabled });
      setDefinitions((prev) => prev.map((d) => (d._id === updated._id ? updated : d)));
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleRunNow = async (definition: WorkflowDefinition) => {
    setRunning((prev) => ({ ...prev, [definition._id]: true }));
    try {
      await workflowsService.runNow(definition._id);
      toast.success('Workflow enqueued — check Executions shortly for the result');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setRunning((prev) => ({ ...prev, [definition._id]: false }));
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await workflowsService.remove(deleting._id);
      setDefinitions((prev) => prev.filter((d) => d._id !== deleting._id));
      toast.success('Workflow deleted');
      setDeleting(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const openExecutions = async (definition: WorkflowDefinition) => {
    setViewingExecutions(definition);
    setLoadingExecutions(true);
    try {
      setExecutions(await workflowsService.listExecutions(definition._id));
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoadingExecutions(false);
    }
  };

  return (
    <>
      <SettingsSection
        title="Create a Workflow"
        description="Schedule, event-trigger, or manually run one of the AI's automated workflows (CRM follow-up checks, EOD reports, document summaries, and more)."
        footer={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            + Create Workflow
          </Button>
        }
      >
        <p>Workflows run in the background — failures notify you directly.</p>
      </SettingsSection>

      <SettingsSection title="Workflows" description="All automations configured for this organization.">
        {loading ? (
          <p>Loading workflows…</p>
        ) : definitions.length === 0 ? (
          <div className={styles.emptyState}>No workflows configured yet.</div>
        ) : (
          <div className={styles.list}>
            {definitions.map((d) => (
              <div key={d._id} className={styles.row}>
                <div className={styles.info}>
                  <span className={styles.name}>{d.name}</span>
                  <span className={styles.meta}>
                    {d.workflowName}
                    {d.triggerType === 'schedule' && d.schedule ? ` — ${d.schedule}` : ''}
                    {d.triggerType === 'event' && d.eventType ? ` — on ${d.eventType}` : ''}
                  </span>
                </div>
                <Badge variant={TRIGGER_BADGE[d.triggerType]}>{d.triggerType}</Badge>
                <Switch checked={d.enabled} onChange={() => void handleToggleEnabled(d)} />
                <div className={styles.actions}>
                  <Button type="button" variant="ghost" size="sm" disabled={running[d._id]} onClick={() => void handleRunNow(d)}>
                    {running[d._id] ? 'Running…' : 'Run Now'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void openExecutions(d)}>
                    Executions
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(d)}>
                    Edit
                  </Button>
                  <IconButton icon={<FiTrash2 />} label="Delete workflow" size="sm" onClick={() => setDeleting(d)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      <Modal open={createOpen} onClose={closeCreateModal} title="Create Workflow" maxWidth={480}>
        <div className={styles.modalBody}>
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <SettingsField label="Workflow">
            <select
              className={styles.select}
              value={form.workflowName}
              onChange={(e) => setForm({ ...form, workflowName: e.target.value })}
            >
              <option value="" disabled>
                Select a workflow…
              </option>
              {available.map((w) => (
                <option key={w.name} value={w.name} title={w.description}>
                  {w.name}
                </option>
              ))}
            </select>
          </SettingsField>
          <SettingsField label="Trigger">
            <select
              className={styles.select}
              value={form.triggerType}
              onChange={(e) => setForm({ ...form, triggerType: e.target.value as TriggerType })}
            >
              <option value="manual">Manual (Run Now only)</option>
              <option value="schedule">Schedule (cron)</option>
              <option value="event">Event</option>
            </select>
          </SettingsField>
          {form.triggerType === 'schedule' && (
            <Input
              label="Cron Expression"
              placeholder="e.g. 0 9 * * * (every day at 9am)"
              value={form.schedule}
              onChange={(e) => setForm({ ...form, schedule: e.target.value })}
            />
          )}
          {form.triggerType === 'event' && (
            <SettingsField label="Event Type">
              <select
                className={styles.select}
                value={form.eventType}
                onChange={(e) => setForm({ ...form, eventType: e.target.value })}
              >
                <option value="" disabled>
                  Select an event…
                </option>
                {KNOWN_EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </SettingsField>
          )}
        </div>
        <div className={styles.modalFooter}>
          <Button type="button" variant="ghost" onClick={closeCreateModal}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              saving ||
              !form.name ||
              !form.workflowName ||
              (form.triggerType === 'schedule' && !form.schedule) ||
              (form.triggerType === 'event' && !form.eventType)
            }
            onClick={() => void handleCreate()}
          >
            {saving ? 'Creating…' : 'Create Workflow'}
          </Button>
        </div>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Workflow" maxWidth={480}>
        {editing && (
          <>
            <div className={styles.modalBody}>
              <Input label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <SettingsField label="Workflow">
                <select
                  className={styles.select}
                  value={editing.workflowName}
                  onChange={(e) => setEditing({ ...editing, workflowName: e.target.value })}
                >
                  {available.map((w) => (
                    <option key={w.name} value={w.name} title={w.description}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </SettingsField>
              <SettingsField label="Trigger">
                <select
                  className={styles.select}
                  value={editing.triggerType}
                  onChange={(e) => setEditing({ ...editing, triggerType: e.target.value as TriggerType })}
                >
                  <option value="manual">Manual (Run Now only)</option>
                  <option value="schedule">Schedule (cron)</option>
                  <option value="event">Event</option>
                </select>
              </SettingsField>
              {editing.triggerType === 'schedule' && (
                <Input
                  label="Cron Expression"
                  value={editing.schedule ?? ''}
                  onChange={(e) => setEditing({ ...editing, schedule: e.target.value })}
                />
              )}
              {editing.triggerType === 'event' && (
                <SettingsField label="Event Type">
                  <select
                    className={styles.select}
                    value={editing.eventType ?? ''}
                    onChange={(e) => setEditing({ ...editing, eventType: e.target.value })}
                  >
                    <option value="" disabled>
                      Select an event…
                    </option>
                    {KNOWN_EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </SettingsField>
              )}
            </div>
            <div className={styles.modalFooter}>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="button" disabled={saving} onClick={() => void handleEditSave()}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete Workflow" maxWidth={420}>
        <div className={styles.modalBody}>
          <p>
            Delete <strong>{deleting?.name}</strong>? This cannot be undone.
          </p>
        </div>
        <div className={styles.modalFooter}>
          <Button type="button" variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={() => void handleDelete()}>
            Delete Workflow
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!viewingExecutions}
        onClose={() => setViewingExecutions(null)}
        title={`Executions — ${viewingExecutions?.name ?? ''}`}
        maxWidth={560}
      >
        <div className={styles.modalBody}>
          {loadingExecutions ? (
            <p>Loading…</p>
          ) : executions.length === 0 ? (
            <div className={styles.emptyState}>No executions yet.</div>
          ) : (
            executions.map((e) => (
              <div key={e._id} className={styles.executionRow}>
                <div className={styles.info}>
                  <span className={styles.name}>
                    {e.triggeredBy} — {dayjs(e.startedAt).format('MMM D, h:mm:ss A')} ({e.durationMs}ms)
                  </span>
                  {e.error && <span className={styles.meta}>{e.error}</span>}
                </div>
                <Badge variant={e.status === 'success' ? 'success' : 'danger'}>{e.status}</Badge>
              </div>
            ))
          )}
        </div>
      </Modal>
    </>
  );
}
