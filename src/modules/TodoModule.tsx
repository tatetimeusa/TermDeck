import { useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../store';
import type { Priority } from '../types';
import { Panel } from '../components/Panel';
import { fmtDuration, todayISO } from '../util';

const prios: Priority[] = ['low', 'med', 'high'];

export function TodoModule() {
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);
  const toggleTask = useStore((s) => s.toggleTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const clearCompleted = useStore((s) => s.clearCompleted);
  const setActiveTask = useStore((s) => s.setActiveTask);
  const setModule = useStore((s) => s.setModule);

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('med');
  const [due, setDue] = useState('');
  const [filter, setFilter] = useState<'active' | 'all' | 'done'>('active');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (addTask(title, { priority, due: due || null })) {
      setTitle('');
      setDue('');
      setPriority('med');
    }
  };

  const shown = tasks.filter((t) => (filter === 'all' ? true : filter === 'active' ? !t.done : t.done));
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
          className="todo-input"
          placeholder="add a task…"
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
          [ ADD ]
        </button>
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
        {shown.length === 0 && <li className="empty">no tasks here — type above to add one.</li>}
        {shown.map((t) => (
          <li key={t.id} className={`todo-item${t.done ? ' done' : ''}`}>
            <button className="check" onClick={() => toggleTask(t.id)}>
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
              <span className={`badge due${t.due === today ? ' today' : ''}${t.due < today && !t.done ? ' over' : ''}`}>
                {t.due}
              </span>
            )}
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
