import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../store';
import type { Priority, Task } from '../types';
import { Panel } from '../components/Panel';
import { fmtDuration, todayISO } from '../util';

const prios: Priority[] = ['low', 'med', 'high'];

export function TodoModule() {
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);
  const toggleTask = useStore((s) => s.toggleTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const updateTask = useStore((s) => s.updateTask);
  const clearCompleted = useStore((s) => s.clearCompleted);
  const setActiveTask = useStore((s) => s.setActiveTask);
  const setModule = useStore((s) => s.setModule);

  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('med');
  const [due, setDue] = useState('');
  const [filter, setFilter] = useState<'active' | 'all' | 'done'>('active');
  const [editingId, setEditingId] = useState<string | null>(null);
  // after a tick the row may vanish (the active tab hides done tasks); keep the
  // cursor on that row if it's still there, else move it to the next one
  const [afterTick, setAfterTick] = useState<{ id: string; next: string | null } | null>(null);

  const resetForm = () => {
    setTitle('');
    setDue('');
    setPriority('med');
    setEditingId(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (editingId) {
      const t = title.trim();
      if (!t) return; // an emptied title is a slip, not a delete — del does that
      updateTask(editingId, { title: t, priority, due: due || null });
      resetForm();
      return;
    }
    if (addTask(title, { priority, due: due || null })) {
      resetForm();
    }
  };

  const startEdit = (t: Task) => {
    setTitle(t.title);
    setPriority(t.priority);
    setDue(t.due ?? '');
    setEditingId(t.id);
    titleRef.current?.focus();
  };

  // the task can vanish mid-edit — deleted from a row, or replaced wholesale by a
  // cloud sync — so drop the edit rather than saving onto a task that's gone
  useEffect(() => {
    if (editingId && !tasks.some((t) => t.id === editingId)) resetForm();
  }, [editingId, tasks]);

  // escape backs out of an edit from anywhere on the page; nothing else binds it
  useEffect(() => {
    if (!editingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resetForm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingId]);

  const shown = tasks.filter((t) => (filter === 'all' ? true : filter === 'active' ? !t.done : t.done));

  const tick = (id: string) => {
    const i = shown.findIndex((t) => t.id === id);
    const next = shown[i + 1]?.id ?? shown[i - 1]?.id ?? null;
    toggleTask(id);
    setAfterTick({ id, next });
  };

  useEffect(() => {
    if (!afterTick) return;
    const find = (id: string | null) =>
      id ? document.querySelector<HTMLButtonElement>(`[data-task="${id}"] .check`) : null;
    (find(afterTick.id) ?? find(afterTick.next) ?? titleRef.current)?.focus();
    setAfterTick(null);
  }, [afterTick, tasks]);
  const doneCount = tasks.filter((t) => t.done).length;
  const today = todayISO();

  const focusOn = (id: string) => {
    setActiveTask(id);
    setModule('focus');
  };

  return (
    <Panel title="TODO" accent="todo">
      <form className="todo-add" onSubmit={submit}>
        <span className="prompt">&gt;</span>
        <input
          ref={titleRef}
          className="todo-input"
          placeholder={editingId ? 'edit task…' : 'add a task…'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <button
          type="button"
          className={`prio-btn p-${priority}`}
          onClick={() => setPriority(prios[(prios.indexOf(priority) + 1) % 3])}
          title="Cycle priority"
        >
          {priority.toUpperCase()}
        </button>
        <input
          className="due-input"
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          title="Due date"
        />
        <button type="submit" className="add-btn">
          {editingId ? '[ SAVE ]' : '[ ADD ]'}
        </button>
        {editingId && (
          <button type="button" className="add-btn" onClick={resetForm} title="Cancel (Esc)">
            [ CANCEL ]
          </button>
        )}
      </form>

      <div className="todo-filters">
        {(['active', 'all', 'done'] as const).map((f) => (
          <button key={f} className={`filter${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
        <span className="spacer" />
        {doneCount > 0 && (
          <button className="filter" onClick={clearCompleted}>
            clear done ({doneCount})
          </button>
        )}
      </div>

      <ul className="todo-list">
        {shown.length === 0 && (
          <li className="empty">
            <span className="quip">
              {filter === 'done' ? '> nothing finished yet. the day is young.' : '> no tasks. suspicious.'}
            </span>
            type above to add one.
          </li>
        )}
        {shown.map((t) => (
          <li
            key={t.id}
            data-task={t.id}
            className={`todo-item${t.done ? ' done' : ''}${editingId === t.id ? ' editing' : ''}`}
          >
            <button className="check" onClick={() => tick(t.id)}>
              {t.done ? '[x]' : '[ ]'}
            </button>
            <span className={`dot p-${t.priority}`} title={`priority: ${t.priority}`} />
            <span className="todo-title" onClick={() => toggleTask(t.id)}>
              {t.title}
            </span>
            {t.focusSeconds > 0 && (
              <span className="badge focus-badge" title="time focused">
                ◐ {fmtDuration(t.focusSeconds)}
              </span>
            )}
            {t.due && (
              <span className={`badge due${t.due === today && !t.done ? ' today' : ''}${t.due < today && !t.done ? ' over' : ''}`}>
                {t.due}
              </span>
            )}
            <button className="row-btn" onClick={() => startEdit(t)} title="Edit this task">
              edit
            </button>
            <button className="row-btn" onClick={() => focusOn(t.id)} title="Focus on this task">
              focus
            </button>
            <button className="row-btn del" onClick={() => deleteTask(t.id)} title="Delete">
              del
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
