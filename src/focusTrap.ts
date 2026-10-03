import { useEffect } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

// Keeps Tab / Shift+Tab cycling inside a popup while it's open, so the cursor
// can't wander onto the app behind it. Moves the cursor into the popup on open
// unless something inside already has it (an autofocused field).
export function useFocusTrap(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const focusables = () =>
      ref.current
        ? [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
            (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
          )
        : [];

    if (ref.current && !ref.current.contains(document.activeElement)) focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !ref.current) return;
      const els = focusables();
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && ref.current.contains(active);
      if (!inside || (e.shiftKey ? active === first : active === last)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [ref]);
}
