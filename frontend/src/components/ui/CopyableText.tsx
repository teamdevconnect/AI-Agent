import { useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import styles from './CopyableText.module.css';

export interface CopyableTextProps {
  value: string;
  className?: string;
}

// Generalizes the inline copy-button pattern already used in chat's
// MessageBubble/CodeBlock (useState<boolean> copied + navigator.clipboard
// + 1500ms icon-swap + toast) into a reusable primitive — for the
// once-only reveal of a new API token or 2FA backup codes, where copying
// correctly matters more than anywhere else in the app.
export function CopyableText({ value, className }: CopyableTextProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={clsx(styles.row, className)}>
      <code className={styles.value}>{value}</code>
      <button type="button" className={styles.copyButton} onClick={() => void handleCopy()} aria-label="Copy to clipboard">
        {copied ? <FiCheck /> : <FiCopy />}
      </button>
    </div>
  );
}
