import { FiPlus, FiX } from 'react-icons/fi';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Input } from './Input';
import styles from './StringListEditor.module.css';

export interface StringListEditorProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  addLabel?: string;
}

// Promoted out of AgentRolesSettings.tsx (its original, private home) —
// Business Knowledge's profile form (branches/products/services/brands/
// values) is its second real consumer, the same promotion trigger this
// codebase used for MultiSelectDropdown/DateRangeControl in Phase 10a.
export function StringListEditor({ label, items, onChange, addLabel = 'Add' }: StringListEditorProps) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.listEditor}>
        {items.map((item, index) => (
          <div key={index} className={styles.listEditorRow}>
            <Input value={item} onChange={(e) => onChange(items.map((it, i) => (i === index ? e.target.value : it)))} />
            <IconButton icon={<FiX />} label="Remove" size="sm" onClick={() => onChange(items.filter((_, i) => i !== index))} />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" leftIcon={<FiPlus />} onClick={() => onChange([...items, ''])}>
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
