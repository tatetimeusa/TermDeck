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

export type ModuleId = 'todo' | 'board' | 'calendar' | 'notes' | 'focus' | 'arcade';

export type FocusMode = 'work' | 'break';
