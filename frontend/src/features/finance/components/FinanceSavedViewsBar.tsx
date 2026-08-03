import { useState } from 'react';
import { FiBookmark, FiX } from 'react-icons/fi';
import { Button, IconButton } from '@/components/ui';
import type { FinancePreset } from '@/services/financeDashboardService';
import styles from './FinanceSavedViewsBar.module.css';

export interface FinanceSavedViewsBarProps {
  presets: FinancePreset[];
  onApply: (preset: FinancePreset) => void;
  onDelete: (id: string) => void;
  onSaveNew: (name: string) => void;
}

// Clone of deal-performance/components/SavedViewsBar.tsx — personal filter
// presets + widget-visibility toggles, the entire customization surface
// (no drag-and-drop/layout reorder, per the standing scope decision).
export function FinanceSavedViewsBar({ presets, onApply, onDelete, onSaveNew }: FinanceSavedViewsBarProps) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSaveNew(trimmed);
    setName('');
    setNaming(false);
  };

  return (
    <div className={styles.row}>
      {presets.map((p) => (
        <div key={p._id} className={styles.chip}>
          <button type="button" className={styles.chipLabel} onClick={() => onApply(p)}>
            {p.name}
          </button>
          <IconButton icon={<FiX size={12} />} label={`Delete ${p.name}`} size="sm" onClick={() => onDelete(p._id)} />
        </div>
      ))}
      {naming ? (
        <div className={styles.namingRow}>
          <input
            className={styles.nameInput}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="View name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') {
                setNaming(false);
                setName('');
              }
            }}
          />
          <Button type="button" size="sm" onClick={handleSave}>
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setNaming(false);
              setName('');
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" size="sm" variant="ghost" leftIcon={<FiBookmark />} onClick={() => setNaming(true)}>
          Save View
        </Button>
      )}
    </div>
  );
}
