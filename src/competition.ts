import { todayISO, addDays } from './util';

// "You vs 100,000" — a consistency depletion curve transcribed from the source
// spreadsheet. Each entry is how many of the 100,000 quit on that day of
// consistency. The drop-off is heavily front-loaded: the very first check-in
// beats 70,000 (the 70% who never follow through), and it grinds toward
// everyone by the 1,000-day mark.

export const COMPETITION_TOTAL = 100000;

const run = (v: number, n: number) => Array<number>(n).fill(v);
const P = [4, 4, 4, 4, 5]; // repeating weekly cadence of the long tail
const Ps = (n: number) => Array.from({ length: n }, () => P).flat();

const WEIGHTS: number[] = [
  // stage 1 — first 40 days, heavily front-loaded
  ...run(70000, 1), ...run(1167, 4), ...run(1166, 2),
  ...run(348, 19), ...run(347, 4), ...run(37, 10),
  // stages 2–9 — steady 37/day out to ~day 360
  ...run(37, 320),
  // stage 10 — one-year mark
  ...run(37, 5), ...Ps(7),
  // stages 11–20 — long tail (10 × 40 days)
  ...Ps(80),
  // stages 21–22 — 800–880 days (low plateau with 3s)
  ...run(4, 4), ...run(3, 25), ...run(5, 1), ...Ps(2),
  ...run(4, 4), ...run(3, 25), ...run(5, 1), ...Ps(2),
  // stage 23 — 880–920 days
  ...Ps(6), ...run(4, 3), ...run(3, 2), ...run(4, 4), ...run(5, 1),
  // stages 24–25 — 920–1000 days
  ...Ps(16),
]; // length === 1000

// cumulative[n] = people beaten after n check-ins (n = 0..1000)
const CUM = WEIGHTS.reduce<number[]>((a, w) => (a.push((a.at(-1) ?? 0) + w), a), [0]);

export const beatenAfter = (checkIns: number) =>
  checkIns <= 0 ? 0 : CUM[Math.min(checkIns, CUM.length - 1)];

export const competitionLeft = (checkIns: number) =>
  Math.max(0, COMPETITION_TOTAL - beatenAfter(checkIns));

// consecutive-streak flair — alive if checked today or yesterday. Independent of
// the competition counter (which is driven by total check-ins, not the streak).
export function streakStats(checkIns: string[]): { current: number; best: number } {
  if (!checkIns.length) return { current: 0, best: 0 };
  const set = new Set(checkIns);
  const sorted = [...set].sort();
  let best = 1;
  let r = 1;
  for (let i = 1; i < sorted.length; i++) {
    r = sorted[i] === addDays(sorted[i - 1], 1) ? r + 1 : 1;
    best = Math.max(best, r);
  }
  let current = 0;
  let cur = todayISO();
  if (!set.has(cur)) cur = addDays(cur, -1);
  while (set.has(cur)) {
    current++;
    cur = addDays(cur, -1);
  }
  return { current, best };
}
