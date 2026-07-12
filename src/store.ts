import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Task,
  Note,
  Goal,
  Reminder,
  FiredReminder,
  Recurrence,
  ModuleId,
  Priority,
  FocusMode,
  Column,
} from './types';
import { playReminder, playSessionEnd, primeAudio } from './sound';
import { advanceToFuture, effectiveAt } from './reminders';
import { ensureNotifyPermission, notifyReminder } from './notify';

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

// Credit the active task with the real seconds elapsed since the last accrual.
// Returns a state patch, or null if nothing to credit. Never logs time past the
// end of the session, so a long stretch minimized still only counts up to 0:00.
function creditActiveTask(s: Store, now: number): Partial<Store> | null {
  if (s.focusMode !== 'work' || !s.activeTaskId || s.lastLogAt == null || s.endsAt == null) {
    return null;
  }
  const until = Math.min(now, s.endsAt);
  const gained = Math.floor((until - s.lastLogAt) / 1000);
  if (gained <= 0) return null;
  return {
    tasks: s.tasks.map((t) =>
      t.id === s.activeTaskId ? { ...t, focusSeconds: t.focusSeconds + gained } : t,
    ),
    lastLogAt: s.lastLogAt + gained * 1000,
  };
}

export interface FocusSettings {
  workMin: number;
  breakMin: number;
}

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error' | 'offline';

// exactly what lives in the cloud blob — user data + cross-machine prefs;
// never transient timer/UI state (a ticking pomodoro must not teleport between machines)
export interface CloudData {
  tasks: Task[];
  notes: Note[];
  goals: Goal[];
  reminders: Reminder[];
  completedSessions: number;
  bankedBreakSeconds: number;
  bestSnake: number;
  settings: FocusSettings;
  scanlines: boolean;
  soundEnabled: boolean;
  introEnabled: boolean;
}

interface Store {
  tasks: Task[];
  notes: Note[];
  goals: Goal[];
  reminders: Reminder[];
  firing: FiredReminder[]; // reminders currently showing a popup — transient, not persisted
  activeModule: ModuleId;

  // focus / pomodoro
  focusMode: FocusMode;
  running: boolean;
  secondsLeft: number;
  endsAt: number | null; // wall-clock ms when the running timer hits 0 (source of truth)
  lastLogAt: number | null; // wall-clock ms of the last focus-time accrual
  activeTaskId: string | null;
  completedSessions: number;
  bankedBreakSeconds: number;
  bestSnake: number;
  settings: FocusSettings;

  // ui prefs
  scanlines: boolean;
  soundEnabled: boolean;
  introEnabled: boolean;

  // account + sync — authEmail/syncStatus are transient; lastSyncedAt persists
  // per machine (the server updated_at of the last blob this machine saw)
  authEmail: string | null;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  setAuth: (email: string | null) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncedAt: (iso: string | null) => void;
  applyCloudData: (blob: CloudData) => void;

  setModule: (m: ModuleId) => void;
  toggleScanlines: () => void;
  toggleSound: () => void;
  toggleIntro: () => void;

  // tasks
  addTask: (title: string, opts?: { priority?: Priority; due?: string | null }) => string | null;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  clearCompleted: () => void;
  moveTask: (id: string, column: Column) => void;

  // notes
  addNote: (title?: string) => string;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body'>>) => void;
  deleteNote: (id: string) => void;

  // goals + streaks
  addGoal: (title: string, startDate: string, endDate: string) => string | null;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  toggleGoalCheckIn: (id: string, dateISO: string) => void;

  // reminders
  addReminder: (
    text: string,
    whenMs: number,
    opts?: { taskId?: string | null; recurrence?: Recurrence },
  ) => string | null;
  updateReminder: (id: string, patch: Partial<Omit<Reminder, 'id' | 'createdAt'>>) => void;
  deleteReminder: (id: string) => void;
  snoozeReminder: (id: string, minutes: number) => void;
  dismissFired: (id: string) => void;
  checkReminders: () => void;

  // focus
  setActiveTask: (id: string | null) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  skipSession: () => void;
  setSettings: (patch: Partial<FocusSettings>) => void;
  tick: () => void;

  // arcade
  spendBreak: (seconds: number) => void;
  setBestSnake: (n: number) => void;
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      tasks: [],
      notes: [],
      goals: [],
      reminders: [],
      firing: [],
      activeModule: 'todo',

      focusMode: 'work',
      running: false,
      secondsLeft: 25 * 60,
      endsAt: null,
      lastLogAt: null,
      activeTaskId: null,
      completedSessions: 0,
      bankedBreakSeconds: 0,
      bestSnake: 0,
      settings: { workMin: 25, breakMin: 5 },

      scanlines: false,
      soundEnabled: true,
      introEnabled: true,

      authEmail: null,
      syncStatus: 'off',
      lastSyncedAt: null,

      setAuth: (email) => set({ authEmail: email }),
      setSyncStatus: (status) => set({ syncStatus: status }),
      setLastSyncedAt: (iso) => set({ lastSyncedAt: iso }),

      applyCloudData: (blob) =>
        set((s) => ({
          ...blob,
          // the cloud copy may have deleted what this machine was pointing at
          activeTaskId:
            s.activeTaskId && blob.tasks.some((t) => t.id === s.activeTaskId)
              ? s.activeTaskId
              : null,
          firing: s.firing.filter((f) => blob.reminders.some((r) => r.id === f.reminderId)),
        })),

      setModule: (m) => set({ activeModule: m }),
      toggleScanlines: () => set((s) => ({ scanlines: !s.scanlines })),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      toggleIntro: () => set((s) => ({ introEnabled: !s.introEnabled })),

      addTask: (title, opts) => {
        const t = title.trim();
        if (!t) return null;
        const task: Task = {
          id: uid(),
          title: t,
          done: false,
          priority: opts?.priority ?? 'med',
          due: opts?.due ?? null,
          createdAt: Date.now(),
          completedAt: null,
          focusSeconds: 0,
          column: 'todo',
        };
        set((s) => ({ tasks: [task, ...s.tasks] }));
        return task.id;
      },

      toggleTask: (id) =>
        set((s) => {
          const nowDone = s.tasks.some((t) => t.id === id && !t.done);
          return {
            tasks: s.tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    done: !t.done,
                    completedAt: !t.done ? Date.now() : null,
                    column: !t.done ? 'done' : t.column === 'done' ? 'todo' : t.column,
                  }
                : t,
            ),
            // a finished task is no longer being focused on
            activeTaskId: nowDone && s.activeTaskId === id ? null : s.activeTaskId,
          };
        }),

      deleteTask: (id) =>
        set((s) => ({
          tasks: s.tasks.filter((t) => t.id !== id),
          activeTaskId: s.activeTaskId === id ? null : s.activeTaskId,
          // unlink any reminder pointing at the deleted task
          reminders: s.reminders.map((r) => (r.taskId === id ? { ...r, taskId: null } : r)),
        })),

      updateTask: (id, patch) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

      clearCompleted: () => set((s) => ({ tasks: s.tasks.filter((t) => !t.done) })),

      moveTask: (id, column) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            if (column === 'done') {
              return { ...t, column, done: true, completedAt: t.completedAt ?? Date.now() };
            }
            return { ...t, column, done: false, completedAt: null };
          }),
          activeTaskId: column === 'done' && s.activeTaskId === id ? null : s.activeTaskId,
        })),

      addNote: (title) => {
        const note: Note = {
          id: uid(),
          title: title?.trim() || 'untitled',
          body: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({ notes: [note, ...s.notes] }));
        return note.id;
      },

      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
        })),

      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      addGoal: (title, startDate, endDate) => {
        const t = title.trim();
        if (!t) return null;
        const goal: Goal = {
          id: uid(),
          title: t,
          startDate,
          endDate,
          createdAt: Date.now(),
          checkIns: [],
        };
        set((s) => ({ goals: [goal, ...s.goals] }));
        return goal.id;
      },

      updateGoal: (id, patch) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),

      deleteGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      toggleGoalCheckIn: (id, dateISO) =>
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === id
              ? {
                  ...g,
                  checkIns: g.checkIns.includes(dateISO)
                    ? g.checkIns.filter((d) => d !== dateISO)
                    : [...g.checkIns, dateISO],
                }
              : g,
          ),
        })),

      addReminder: (text, whenMs, opts) => {
        const t = text.trim();
        if (!t) return null;
        ensureNotifyPermission(); // creation is a user gesture — the right moment to ask
        const reminder: Reminder = {
          id: uid(),
          text: t,
          taskId: opts?.taskId ?? null,
          nextAt: whenMs,
          recurrence: opts?.recurrence ?? { kind: 'none' },
          snoozedUntil: null,
          done: false,
          createdAt: Date.now(),
        };
        set((s) => ({ reminders: [reminder, ...s.reminders] }));
        return reminder.id;
      },

      updateReminder: (id, patch) =>
        set((s) => ({
          reminders: s.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),

      deleteReminder: (id) =>
        set((s) => ({
          reminders: s.reminders.filter((r) => r.id !== id),
          firing: s.firing.filter((f) => f.reminderId !== id),
        })),

      snoozeReminder: (id, minutes) =>
        set((s) => ({
          reminders: s.reminders.map((r) =>
            r.id === id ? { ...r, snoozedUntil: Date.now() + minutes * 60_000 } : r,
          ),
          firing: s.firing.filter((f) => f.reminderId !== id),
        })),

      dismissFired: (id) =>
        set((s) => ({
          firing: s.firing.filter((f) => f.reminderId !== id),
          reminders: s.reminders.map((r) => {
            if (r.id !== id) return r;
            // one-shots are kept as history; repeats jump to the next future
            // occurrence measured from the scheduled time (never drifts, and a
            // fast interval can't pile up popups after a long time closed)
            if (r.recurrence.kind === 'none') return { ...r, done: true, snoozedUntil: null };
            return {
              ...r,
              nextAt: advanceToFuture(r.recurrence, r.nextAt, Date.now()),
              snoozedUntil: null,
            };
          }),
        })),

      checkReminders: () => {
        const s = get();
        const now = Date.now();
        const due = s.reminders.filter(
          (r) =>
            !r.done &&
            !s.firing.some((f) => f.reminderId === r.id) &&
            effectiveAt(r) <= now,
        );
        if (due.length === 0) return;
        const fired: FiredReminder[] = due.map((r) => ({
          reminderId: r.id,
          scheduledFor: effectiveAt(r),
          firedAt: now,
          missed: now - effectiveAt(r) > 60_000,
        }));
        set({ firing: [...s.firing, ...fired] });
        if (s.soundEnabled) playReminder(); // once per batch, not per reminder
        for (const f of fired) {
          const r = due.find((d) => d.id === f.reminderId)!;
          notifyReminder(r.text, { missed: f.missed, scheduledFor: f.scheduledFor });
        }
      },

      setActiveTask: (id) => set({ activeTaskId: id }),

      startTimer: () => {
        if (get().soundEnabled) primeAudio(); // unlock audio on this user gesture
        set((s) => ({
          running: true,
          endsAt: Date.now() + s.secondsLeft * 1000,
          lastLogAt: Date.now(),
        }));
      },

      pauseTimer: () => {
        const s = get();
        const now = Date.now();
        const credit = s.endsAt != null ? creditActiveTask(s, now) : null;
        const remaining =
          s.endsAt != null ? Math.max(0, Math.round((s.endsAt - now) / 1000)) : s.secondsLeft;
        set({ ...credit, running: false, endsAt: null, lastLogAt: null, secondsLeft: remaining });
      },

      resetTimer: () =>
        set((s) => ({
          running: false,
          endsAt: null,
          lastLogAt: null,
          secondsLeft: (s.focusMode === 'work' ? s.settings.workMin : s.settings.breakMin) * 60,
        })),

      skipSession: () => {
        const s = get();
        if (s.focusMode === 'work') {
          set({
            focusMode: 'break',
            running: false,
            endsAt: null,
            lastLogAt: null,
            secondsLeft: s.settings.breakMin * 60,
          });
        } else {
          set({
            focusMode: 'work',
            running: false,
            endsAt: null,
            lastLogAt: null,
            secondsLeft: s.settings.workMin * 60,
          });
        }
      },

      setSettings: (patch) =>
        set((s) => {
          const settings = { ...s.settings, ...patch };
          const secondsLeft = !s.running
            ? (s.focusMode === 'work' ? settings.workMin : settings.breakMin) * 60
            : s.secondsLeft;
          return { settings, secondsLeft };
        }),

      tick: () => {
        const s = get();
        if (!s.running || s.endsAt == null) return;
        const now = Date.now();

        // credit real elapsed time to the active task (catches up after the
        // window was minimized and the heartbeat was throttled)
        const credit = creditActiveTask(s, now);
        const remaining = Math.max(0, Math.round((s.endsAt - now) / 1000));

        if (remaining > 0) {
          set({ ...credit, secondsLeft: remaining });
          return;
        }

        // the deadline has passed (possibly while minimized) — roll the session over
        if (s.soundEnabled) playSessionEnd(s.focusMode);
        if (s.focusMode === 'work') {
          set({
            ...credit,
            completedSessions: s.completedSessions + 1,
            bankedBreakSeconds: s.bankedBreakSeconds + s.settings.breakMin * 60,
            focusMode: 'break',
            running: false,
            endsAt: null,
            lastLogAt: null,
            secondsLeft: s.settings.breakMin * 60,
          });
        } else {
          set({
            focusMode: 'work',
            running: false,
            endsAt: null,
            lastLogAt: null,
            secondsLeft: s.settings.workMin * 60,
          });
        }
      },

      spendBreak: (seconds) =>
        set((s) => ({ bankedBreakSeconds: Math.max(0, s.bankedBreakSeconds - seconds) })),

      setBestSnake: (n) => set({ bestSnake: n }),
    }),
    {
      name: 'termdeck-v1',
      partialize: (s) => ({
        tasks: s.tasks,
        notes: s.notes,
        goals: s.goals,
        reminders: s.reminders, // NOT firing — undismissed popups re-fire as missed on relaunch
        activeModule: s.activeModule,
        focusMode: s.focusMode,
        secondsLeft: s.secondsLeft,
        activeTaskId: s.activeTaskId,
        completedSessions: s.completedSessions,
        bankedBreakSeconds: s.bankedBreakSeconds,
        bestSnake: s.bestSnake,
        settings: s.settings,
        scanlines: s.scanlines,
        soundEnabled: s.soundEnabled,
        introEnabled: s.introEnabled,
        lastSyncedAt: s.lastSyncedAt,
      }),
      // pre-0.3.0 blobs have no version (zustand treats them as 0) — same shape, pass through
      version: 1,
      migrate: (persisted) => persisted as Store,
    },
  ),
);
