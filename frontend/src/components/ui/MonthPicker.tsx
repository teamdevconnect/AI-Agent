import styles from './MonthPicker.module.css';

// A plain native <input type="month"> wrapper — the only existing precedent
// for this in the app was an inline one-off in SalesTargetsSettings.tsx.
// Built directly in components/ui/ from day one (Phase 19's Analytics
// Dashboard is consumer #1, SalesTargetsSettings' equivalent inline input is
// an obvious, pre-existing second use case) rather than feature-local-then-
// promoted-later — retrofitting SalesTargetsSettings to actually use this is
// optional, not required.
export function MonthPicker({ value, onChange }: { value: string; onChange: (period: string) => void }) {
  return (
    <input
      type="month"
      className={styles.input}
      value={value}
      onChange={(e) => {
        if (e.target.value) onChange(e.target.value);
      }}
    />
  );
}
