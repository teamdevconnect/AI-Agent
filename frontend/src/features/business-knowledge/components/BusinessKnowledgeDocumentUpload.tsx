import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FiUpload } from 'react-icons/fi';
import { Button, Spinner } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { businessKnowledgeDocumentsService, type BusinessKnowledgeDocument } from '@/services/businessKnowledgeDocumentsService';
import styles from '../business-knowledge.module.css';

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.pptx,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.gif,.webp,.html,.htm,.txt,.md';

export interface BusinessKnowledgeDocumentUploadProps {
  onDocumentReady: (doc: BusinessKnowledgeDocument) => void;
}

// Mirrors finance/components/FinanceDocumentUpload.tsx's exact
// hidden-input+button+blocking-spinner shape, extended for the wider set of
// asset formats this module accepts (see Phase 14a plan notes).
export function BusinessKnowledgeDocumentUpload({ onDocumentReady }: BusinessKnowledgeDocumentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; filename: string } | null>(null);

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length, filename: files[i].name });
        try {
          const doc = await businessKnowledgeDocumentsService.upload(files[i]);
          onDocumentReady(doc);
          toast.success(doc.extractionStatus === 'completed' ? `${files[i].name} processed` : `${files[i].name} uploaded — extraction failed`);
        } catch (err) {
          toast.error(`${files[i].name}: ${extractErrorMessage(err)}`);
        }
      }
    } finally {
      setUploading(false);
      setProgress(null);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className={styles.formGrid}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS}
        style={{ display: 'none' }}
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button type="button" variant="outline" leftIcon={<FiUpload />} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          Choose Files
        </Button>
        {files.length > 0 && !uploading && <span className={styles.pageSubtitle}>{files.length} file(s) selected</span>}
        <Button type="button" disabled={files.length === 0 || uploading} loading={uploading} onClick={() => void handleUpload()}>
          {uploading ? 'Processing…' : `Upload${files.length ? ` (${files.length})` : ''}`}
        </Button>
      </div>
      {progress && (
        <div className={styles.pageSubtitle}>
          <Spinner size={16} /> Processing {progress.current} of {progress.total} — {progress.filename}…
        </div>
      )}
    </div>
  );
}
