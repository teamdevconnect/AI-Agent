import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FiFileText, FiLayers, FiMessageSquare, FiUpload } from 'react-icons/fi';
import { Button, Modal, Spinner } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { agentRolesService, type AgentRole } from '@/services/agentRolesService';
import type { AdminUser } from '@/services/usersService';
import { AGENT_TEMPLATES } from './agentTemplates';
import { AgentConfigurationForm } from './AgentConfigurationForm';
import styles from '../AgentRolesSettings.module.css';

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.xlsx,.xls,.csv,.html,.htm,.txt,.md';

type Method = 'choose' | 'template' | 'documents' | 'describe' | 'configure';

// A synthetic, not-yet-persisted AgentRole for Template/Manual — the
// configuration form only ever checks `_id` to decide create vs. update, so
// this is the entire bridge between "no backend record yet" and the shared
// editor.
function blankDraft(seed: Partial<AgentRole> = {}): AgentRole {
  return {
    slug: '',
    name: '',
    description: '',
    status: 'draft',
    avatarColor: '#6b7280',
    builtin: false,
    ...seed,
  };
}

interface CreateAgentDialogProps {
  open: boolean;
  users: AdminUser[];
  onClose: () => void;
  onSaved: (role: AgentRole) => void;
}

// Agent Builder Phase 1 — the "Create AI Agent" entry point. Four methods
// (Template/Documents/Describe/Manual) all converge on the same
// AgentConfigurationForm for review before anything is saved as active.
export function CreateAgentDialog({ open, users, onClose, onSaved }: CreateAgentDialogProps) {
  const [method, setMethod] = useState<Method>('choose');
  const [draft, setDraft] = useState<AgentRole | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setMethod('choose');
    setDraft(null);
    setFile(null);
    setDescription('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleTemplate = (templateId: string) => {
    const template = AGENT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setDraft(blankDraft(template.config));
    setMethod('configure');
  };

  const handleGenerateFromDocument = async () => {
    if (!file) return;
    setGenerating(true);
    try {
      const created = await agentRolesService.generate(file);
      toast.success('Configuration generated — review before activating');
      setDraft(created);
      setMethod('configure');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateFromDescription = async () => {
    if (description.trim().length < 10) {
      toast.error('Describe the agent in a bit more detail');
      return;
    }
    setGenerating(true);
    try {
      const created = await agentRolesService.generateFromDescription(description.trim());
      toast.success('Configuration generated — review before activating');
      setDraft(created);
      setMethod('configure');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleManual = () => {
    setDraft(blankDraft());
    setMethod('configure');
  };

  const handleSaved = (role: AgentRole) => {
    onSaved(role);
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={method === 'configure' ? undefined : 'Create AI Agent'} maxWidth={720}>
      {method === 'choose' && (
        <div className={styles.createChooser}>
          <p className={styles.sectionHint}>Create an AI agent from a template, your existing documents, or a custom description.</p>
          <div className={styles.methodGrid}>
            <button type="button" className={styles.methodCard} onClick={() => setMethod('template')}>
              <FiLayers />
              <span>Start from Template</span>
              <small>Sales, Support, Marketing, and more</small>
            </button>
            <button type="button" className={styles.methodCard} onClick={() => setMethod('documents')}>
              <FiFileText />
              <span>Generate from Documents</span>
              <small>Upload a job description, SOP, or KPI sheet</small>
            </button>
            <button type="button" className={styles.methodCard} onClick={() => setMethod('describe')}>
              <FiMessageSquare />
              <span>Describe Your Agent</span>
              <small>Write a sentence or two, AI drafts the rest</small>
            </button>
            <button type="button" className={styles.methodCard} onClick={handleManual}>
              <FiUpload />
              <span>Build Manually</span>
              <small>Start from a blank agent</small>
            </button>
          </div>
        </div>
      )}

      {method === 'template' && (
        <div className={styles.createChooser}>
          <div className={styles.templateGrid}>
            {AGENT_TEMPLATES.map((t) => (
              <button key={t.id} type="button" className={styles.methodCard} onClick={() => handleTemplate(t.id)}>
                <span>{t.label}</span>
                <small>{t.blurb}</small>
              </button>
            ))}
          </div>
          <Button type="button" variant="ghost" onClick={() => setMethod('choose')}>
            Back
          </Button>
        </div>
      )}

      {method === 'documents' && (
        <div className={styles.createChooser}>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            className={styles.hiddenInput}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <div className={styles.uploadRow}>
            <Button type="button" leftIcon={<FiUpload />} onClick={() => fileInputRef.current?.click()} disabled={generating}>
              Choose File
            </Button>
            {file && <span className={styles.fileName}>{file.name}</span>}
          </div>
          {generating ? (
            <div className={styles.loadingRow}>
              <Spinner /> Analyzing document — this can take up to 15 seconds…
            </div>
          ) : (
            <div className={styles.uploadRow}>
              <Button type="button" disabled={!file} onClick={() => void handleGenerateFromDocument()}>
                Generate Configuration
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMethod('choose')}>
                Back
              </Button>
            </div>
          )}
        </div>
      )}

      {method === 'describe' && (
        <div className={styles.createChooser}>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder='Create an AI sales manager that monitors deals, analyzes customer emails, and creates follow-up tasks…'
            rows={5}
            disabled={generating}
          />
          {generating ? (
            <div className={styles.loadingRow}>
              <Spinner /> Generating configuration…
            </div>
          ) : (
            <div className={styles.uploadRow}>
              <Button type="button" onClick={() => void handleGenerateFromDescription()}>
                Generate Configuration
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMethod('choose')}>
                Back
              </Button>
            </div>
          )}
        </div>
      )}

      {method === 'configure' && draft && (
        <AgentConfigurationForm role={draft} users={users} onSaved={handleSaved} onCancel={handleClose} />
      )}
    </Modal>
  );
}
