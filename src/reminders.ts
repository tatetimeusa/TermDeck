// Pure date/recurrence helpers for the REMINDERS module. No store imports so
// these stay trivially testable and reusable from the popup, module and calendar.

import type { Recurrence, RecurUnit, Reminder } from './types';
import { pad } from './util';

export const UNIT_MS: Record<RecurUnit, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

// A snooze temporarily overrides the scheduled time without mutating it.
export const effectiveAt = (r: Reminder): number => r.snoozedUntil ?? r.nextAt;

// First occurrence strictly after nowMs, stepping from fromMs (the *scheduled*
// time, so repeats never drift). Jumps over occurrences that passed while the
// app was closed — the user gets one "missed" popup, not a pile-up.
export function advanceToFuture(rec: Recurrence, fromMs: number, nowMs: number): number {
  switch (rec.kind) {
    case 'none':
      return fromMs;
    case 'daily':
    case 'weekly': {
      // Date component math keeps the local wall-clock time-of-day across DST
      const step = rec.kind === 'daily' ? 1 : 7;
      const d = new Date(fromMs);
      do {
        d.setDate(d.getDate() + step);
      } while (d.getTime() <= nowMs);
      return d.getTime();
    }
    case 'monthly': {
      // keep the original day-of-month, clamped to shorter months
      // (Jan 31 → Feb 28 → Mar 31), never letting setMonth overflow
      const from = new Date(fromMs);
      const wantDay = from.getDate();
      let y = from.getFullYear();
      let m = from.getMonth();
      let t: number;
      do {
        m += 1;
        if (m > 11) {
          m = 0;
          y += 1;
        }
        const lastDay = new Date(y, m + 1, 0).getDate();
        t = new Date(
          y,
          m,
          Math.min(wantDay, lastDay),
          from.getHours(),
          from.getMinutes(),
          from.getSeconds(),
        ).getTime();
      } while (t <= nowMs);
      return t;
    }
    case 'custom': {
      const step = Math.max(1, rec.every) * UNIT_MS[rec.unit];
      const k = Math.max(1, Math.floor((nowMs - fromMs) / step) + 1);
      return fromMs + k * step;
    }
  }
}

export function describeRecurrence(rec: Recurrence): string {
  switch (rec.kind) {
    case 'none':
      return '';
    case 'daily':
    case 'weekly':
    case 'monthly':
      return rec.kind;
    case 'custom': {
      const short: Record<RecurUnit, string> = { minutes: 'm', hours: 'h', days: 'd' };
      return `every ${rec.every}${short[rec.unit]}`;
    }
  }
}

// 'Sat Jul 11 · 14:30'
export function fmtFireTime(ms: number): string {
  const d = new Date(ms);
  const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// just the 'HH:MM' part, for calendar chips and missed badges
export function fmtClockTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
