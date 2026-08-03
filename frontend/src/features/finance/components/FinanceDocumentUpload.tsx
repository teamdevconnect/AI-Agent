import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FiUpload } from 'react-icons/fi';
import { Button, Spinner } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { financeDocumentsService, type FinanceDocument } from '@/services/financeDocumentsService';
import styles from '../finance.module.css';

const ACCEPTED_EXTENSIONS = '.pdf,.png,.jpg,.jpeg,.gif,.webp,.xlsx,.xls,.csv,.docx';

export interface FinanceDocumentUploadProps {
  onDocumentReady: (doc: FinanceDocument) => void;
}

// Mirrors AgentRolesSettings.tsx's hidden-input+button+blocking-spinner
// shape, extended to support multi-file selection (processed sequentially,
// not in parallel — avoids piling up concurrent LLM calls) since real
// vendor-payment uploads arrive in batches, unlike the rare one-off
// agent-role upload this pattern was originally built for.
export function FinanceDocumentUpload({ onDocumentReady }: FinanceDocumentUploadProps) {
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
          const doc = await financeDocumentsService.upload(files[i]);
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
    <div className={styles.uploadDropZone}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS}
        style={{ display: 'none' }}
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />
      <Button type="button" variant="outline" leftIcon={<FiUpload />} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
        Choose Files
      </Button>
      {files.length > 0 && !uploading && <span className={styles.uploadProgressCaption}>{files.length} file(s) selected</span>}
      <Button type="button" disabled={files.length === 0 || uploading} loading={uploading} onClick={() => void handleUpload()}>
        {uploading ? 'Processing…' : `Upload${files.length ? ` (${files.length})` : ''}`}
      </Button>
      {progress && (
        <div className={styles.uploadProgressCaption}>
          <Spinner size={16} /> Processing {progress.current} of {progress.total} — {progress.filename}…
        </div>
      )}
    </div>
  );
}
