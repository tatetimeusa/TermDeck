import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Task, Note, ModuleId, Priority, FocusMode, Column } from './types';

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export interface FocusSettings {
  workMin: number;
  breakMin: number;
}

interface Store {
  tasks: Task[];
  notes: Note[];
  activeModule: ModuleId;

  // focus / pomodoro
  focusMode: FocusMode;
  running: boolean;
  secondsLeft: number;
  activeTaskId: string | null;
  completedSessions: number;
  bankedBreakSeconds: number;
  bestSnake: number;
  settings: FocusSettings;

  // ui prefs
  scanlines: boolean;

  setModule: (m: ModuleId) => void;
  toggleScanlines: () => void;

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
      activeModule: 'todo',

      focusMode: 'work',
      running: false,
      secondsLeft: 25 * 60,
      activeTaskId: null,
      completedSessions: 0,
      bankedBreakSeconds: 0,
      bestSnake: 0,
      settings: { workMin: 25, breakMin: 5 },

      scanlines: false,

      setModule: (m) => set({ activeModule: m }),
      toggleScanlines: () => set((s) => ({ scanlines: !s.scanlines })),

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
        set((s) => ({
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
        })),

      deleteTask: (id) =>
        set((s) => ({
          tasks: s.tasks.filter((t) => t.id !== id),
          activeTaskId: s.activeTaskId === id ? null : s.activeTaskId,
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

      setActiveTask: (id) => set({ activeTaskId: id }),

      startTimer: () => set({ running: true }),
      pauseTimer: () => set({ running: false }),
      resetTimer: () =>
        set((s) => ({
          running: false,
          secondsLeft: (s.focusMode === 'work' ? s.settings.workMin : s.settings.breakMin) * 60,
        })),

      skipSession: () => {
        const s = get();
        if (s.focusMode === 'work') {
          set({ focusMode: 'break', running: false, secondsLeft: s.settings.breakMin * 60 });
        } else {
          set({ focusMode: 'work', running: false, secondsLeft: s.settings.workMin * 60 });
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
        if (!s.running) return;
        const next = s.secondsLeft - 1;

        if (next > 0) {
          // live-log focus time against the active task while working
          if (s.focusMode === 'work' && s.activeTaskId) {
            set({
              secondsLeft: next,
              tasks: s.tasks.map((t) =>
                t.id === s.activeTaskId ? { ...t, focusSeconds: t.focusSeconds + 1 } : t,
              ),
            });
          } else {
            set({ secondsLeft: next });
          }
          return;
        }

        // session just completed
        if (s.focusMode === 'work') {
          set({
            tasks: s.activeTaskId
              ? s.tasks.map((t) =>
                  t.id === s.activeTaskId ? { ...t, focusSeconds: t.focusSeconds + 1 } : t,
                )
              : s.tasks,
            completedSessions: s.completedSessions + 1,
            bankedBreakSeconds: s.bankedBreakSeconds + s.settings.breakMin * 60,
            focusMode: 'break',
            running: false,
            secondsLeft: s.settings.breakMin * 60,
          });
        } else {
          set({ focusMode: 'work', running: false, secondsLeft: s.settings.workMin * 60 });
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
        activeModule: s.activeModule,
        focusMode: s.focusMode,
        secondsLeft: s.secondsLeft,
        activeTaskId: s.activeTaskId,
        completedSessions: s.completedSessions,
        bankedBreakSeconds: s.bankedBreakSeconds,
        bestSnake: s.bestSnake,
        settings: s.settings,
        scanlines: s.scanlines,
      }),
    },
  ),
);
