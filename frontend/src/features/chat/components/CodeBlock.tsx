import { useState, Children, isValidElement } from 'react';
import type { ReactNode } from 'react';
import { FiCopy, FiCheck } from 'react-icons/fi';
import styles from './CodeBlock.module.css';

function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return extractText(node.props.children);
  return '';
}

export interface CodeBlockProps {
  language: string;
  children: ReactNode;
  codeClassName?: string;
}

export function CodeBlock({ language, children, codeClassName }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(extractText(children));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={styles.block}>
      <div className={styles.header}>
        <span className={styles.language}>{language || 'text'}</span>
        <button type="button" className={styles.copyButton} onClick={handleCopy}>
          {copied ? <FiCheck /> : <FiCopy />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className={styles.pre}>
        <code className={codeClassName}>{Children.toArray(children)}</code>
      </pre>
    </div>
  );
}
