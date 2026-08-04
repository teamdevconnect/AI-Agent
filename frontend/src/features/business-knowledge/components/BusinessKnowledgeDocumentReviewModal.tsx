import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Badge, Button, Input, Modal } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import {
  ASSET_TYPES,
  businessKnowledgeDocumentsService,
  type BusinessKnowledgeDocument,
  type UpdateBusinessKnowledgeDocumentPayload,
} from '@/services/businessKnowledgeDocumentsService';
import styles from './BusinessKnowledgeDocumentReviewModal.module.css';

export interface BusinessKnowledgeDocumentReviewModalProps {
  open: boolean;
  document: BusinessKnowledgeDocument | null;
  onClose: () => void;
  onSaved: (doc: BusinessKnowledgeDocument) => void;
  onDeleted: (id: string) => void;
}

// Mirrors finance/components/FinanceDocumentReviewModal.tsx's shape —
// reviewing one document is a bounded/transient task, so it stays a Modal;
// browsing many records is the separate state-swap
// BusinessKnowledgeDocumentListView.tsx.
export function BusinessKnowledgeDocumentReviewModal({ open, document, onClose, onSaved, onDeleted }: BusinessKnowledgeDocumentReviewModalProps) {
  const [form, setForm] = useState<UpdateBusinessKnowledgeDocumentPayload>({});
  const [saving, setSaving] = useState(false);
  const [viewingFile, setViewingFile] = useState(false);

  useEffect(() => {
    if (!open || !document) return;
    setForm({
      title: document.title,
      assetType: document.assetType,
      keyTopics: document.keyTopics,
    });
  }, [open, document]);

  if (!document) return null;

  const set = <K extends keyof UpdateBusinessKnowledgeDocumentPayload>(key: K, value: UpdateBusinessKnowledgeDocumentPayload[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await businessKnowledgeDocumentsService.update(document._id, form);
      toast.success('Document updated');
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await businessKnowledgeDocumentsService.remove(document._id);
      toast.success('Document deleted');
      onDeleted(document._id);
      onClose();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleViewFile = async () => {
    setViewingFile(true);
    try {
      await businessKnowledgeDocumentsService.viewFile(document._id);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setViewingFile(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={document.originalFilename} maxWidth={640}>
      <div className={styles.form}>
        {document.extractionStatus === 'failed' && (
          <div className={styles.card}>Extraction failed: {document.extractionError ?? 'Unknown error'}</div>
        )}
        {document.aiSummary && <div className={styles.card}>{document.aiSummary}</div>}
        {(document.missingFields.length > 0 || document.inconsistencyNotes.length > 0) && (
          <div className={styles.row}>
            {document.missingFields.length > 0 && (
              <div className={styles.flagList}>
                <Badge variant="warning">Missing fields</Badge>
                {document.missingFields.map((f) => (
                  <span key={f}>• {f}</span>
                ))}
              </div>
            )}
            {document.inconsistencyNotes.length > 0 && (
              <div className={styles.flagList}>
                <Badge variant="danger">Inconsistencies</Badge>
                {document.inconsistencyNotes.map((n) => (
                  <span key={n}>• {n}</span>
                ))}
              </div>
            )}
          </div>
        )}

        <Input label="Title" value={form.title ?? ''} onChange={(e) => set('title', e.target.value || undefined)} />
        <label className={styles.label}>
          Asset Type
          <select className={styles.select} value={form.assetType ?? 'other'} onChange={(e) => set('assetType', e.target.value as UpdateBusinessKnowledgeDocumentPayload['assetType'])}>
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>

        {document.keyTopics.length > 0 && (
          <div className={styles.flagList}>
            <Badge variant="info">Key topics</Badge>
            {document.keyTopics.map((t) => (
              <span key={t}>• {t}</span>
            ))}
          </div>
        )}

        <div className={styles.footer}>
          <Button type="button" variant="ghost" loading={viewingFile} onClick={() => void handleViewFile()}>
            View Original File
          </Button>
          <div className={styles.footerActions}>
            <Button type="button" variant="danger" onClick={() => void handleDelete()}>
              Delete
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" loading={saving} onClick={() => void handleSave()}>
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
