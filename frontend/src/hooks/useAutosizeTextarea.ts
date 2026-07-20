import { useEffect } from 'react';
import type { RefObject } from 'react';

export function useAutosizeTextarea(ref: RefObject<HTMLTextAreaElement | null>, value: string, maxHeight = 200): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [ref, value, maxHeight]);
}
