export type Priority = 'low' | 'med' | 'high';

export type Column = 'todo' | 'doing' | 'done';

export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: Priority;
  due: string | null; // 'YYYY-MM-DD'
  createdAt: number;
  completedAt: number | null;
  focusSeconds: number; // total time focused on this task
  column: Column; // used by the BOARD module (next phase)
}

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface Goal {
  id: string;
  title: string;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD' (deadline)
  createdAt: number;
  checkIns: string[]; // ISO dates the daily box was checked
}

export type RecurUnit = 'minutes' | 'hours' | 'days';

export type Recurrence =
  | { kind: 'none' }
  | { kind: 'daily' }
  | { kind: 'weekly' }
  | { kind: 'monthly' }
  | { kind: 'custom'; every: number; unit: RecurUnit };

export interface Reminder {
  id: string;
  text: string;
  taskId: string | null; // optional link to a Task
  nextAt: number; // epoch ms of the next scheduled fire (wall-clock anchored, like endsAt)
  recurrence: Recurrence;
  snoozedUntil: number | null; // epoch ms; overrides nextAt as the effective fire time
  done: boolean; // one-shot reminders after dismissal (kept as history)
  createdAt: number;
}

// a reminder that has gone off and is waiting on the popup — transient, never persisted,
// so an undismissed popup at quit re-fires as "missed" on the next launch
export interface FiredReminder {
  reminderId: string;
  scheduledFor: number; // the effective time it was supposed to fire
  firedAt: number;
  missed: boolean; // fired more than 60s late (e.g. the app was closed)
}

export type ModuleId =
  | 'todo'
  | 'board'
  | 'calendar'
  | 'notes'
  | 'focus'
  | 'arcade'
  | 'goals'
  | 'streaks'
  | 'reminders';

export type FocusMode = 'work' | 'break';
