import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../store';
import type { ModuleId } from '../types';

const moduleAliases: Record<string, ModuleId> = {
  todo: 'todo',
  board: 'board',
  calendar: 'calendar',
  cal: 'calendar',
  notes: 'notes',
  note: 'notes',
  focus: 'focus',
  arcade: 'arcade',
  game: 'arcade',
};

export function CommandBar() {
  const ref = useRef<HTMLInputElement>(null);
  const [val, setVal] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  const activeModule = useStore((s) => s.activeModule);
  const addTask = useStore((s) => s.addTask);
  const addNote = useStore((s) => s.addNote);
  const setModule = useStore((s) => s.setModule);
  const setActiveTask = useStore((s) => s.setActiveTask);
  const startTimer = useStore((s) => s.startTimer);
  const pauseTimer = useStore((s) => s.pauseTimer);
  const resetTimer = useStore((s) => s.resetTimer);

  useEffect(() => {
    const focus = () => ref.current?.focus();
    window.addEventListener('termdeck:focus-command', focus);
    return () => window.removeEventListener('termdeck:focus-command', focus);
  }, []);

  const flash = (msg: string) => {
    setHint(msg);
    window.setTimeout(() => setHint(null), 2000);
  };

  const run = (e: FormEvent) => {
    e.preventDefault();
    const raw = val.trim();
    if (!raw) return;
    setVal('');

    if (raw.startsWith('/')) {
      const [cmd, ...rest] = raw.slice(1).split(' ');
      const arg = rest.join(' ').trim();
      const c = cmd.toLowerCase();

      if (moduleAliases[c]) return setModule(moduleAliases[c]);
      if (c === 'go' && moduleAliases[arg]) return setModule(moduleAliases[arg]);
      if (c === 'todo' && arg) {
        addTask(arg);
        return flash(`task added: ${arg}`);
      }
      if (c === 'note') {
        addNote(arg || 'untitled');
        return setModule('notes');
      }
      if (c === 'start') {
        setModule('focus');
        return startTimer();
      }
      if (c === 'pause') return pauseTimer();
      if (c === 'reset') return resetTimer();
      if (c === 'help')
        return flash('commands: /todo <text>, /note <title>, /focus, /start, /pause, /reset, /go <module>');
      return flash(`unknown command: /${c}  ·  try /help`);
    }

    // plain text → context-aware action
    if (activeModule === 'notes') {
      addNote(raw);
      return flash('note created');
    }
    if (activeModule === 'focus') {
      const id = addTask(raw);
      if (id) setActiveTask(id);
      return flash(`focusing on: ${raw}`);
    }
    addTask(raw);
    flash(`task added: ${raw}`);
  };

  const placeholder =
    activeModule === 'notes'
      ? 'type a note title + Enter…    (or /help)'
      : activeModule === 'focus'
        ? 'type a task to focus on + Enter…    (or /start)'
        : 'quick-add a task + Enter…    (or /help)';

  return (
    <form className="cmdbar" onSubmit={run}>
      <span className="cmd-prompt">
        termdeck<span className="cmd-mod"> {activeModule}</span> &gt;
      </span>
      <input
        ref={ref}
        className="cmd-input"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
      />
      {hint ? (
        <span className="cmd-hint">{hint}</span>
      ) : (
        <span className="cmd-help">
          <kbd>/</kbd> jump here · <kbd>1-6</kbd> switch module
        </span>
      )}
    </form>
  );
}
