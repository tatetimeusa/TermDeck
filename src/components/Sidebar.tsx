import { useStore } from '../store';
import type { ModuleId } from '../types';
import { fmtDuration, todayISO } from '../util';

const items: { id: ModuleId; key: string; label: string; soon?: boolean }[] = [
  { id: 'todo', key: '1', label: 'TODO' },
  { id: 'board', key: '2', label: 'BOARD' },
  { id: 'calendar', key: '3', label: 'CALENDAR' },
  { id: 'notes', key: '4', label: 'NOTES' },
  { id: 'focus', key: '5', label: 'FOCUS' },
  { id: 'arcade', key: '6', label: 'ARCADE' },
];

export function Sidebar() {
  const activeModule = useStore((s) => s.activeModule);
  const setModule = useStore((s) => s.setModule);
  const tasks = useStore((s) => s.tasks);
  const completedSessions = useStore((s) => s.completedSessions);
  const bankedBreakSeconds = useStore((s) => s.bankedBreakSeconds);

  const open = tasks.filter((t) => !t.done).length;
  const dueToday = tasks.filter((t) => !t.done && t.due === todayISO()).length;

  return (
    <aside className="sidebar">
      <nav className="nav">
        {items.map((it) => (
          <button
            key={it.id}
            className={`nav-item accent-${it.id}${activeModule === it.id ? ' active' : ''}`}
            onClick={() => setModule(it.id)}
          >
            <span className="nav-key">[{it.key}]</span>
            <span className="nav-label">{it.label}</span>
            {it.soon && <span className="nav-soon">soon</span>}
          </button>
        ))}
      </nav>

      <div className="status">
        <div className="status-line">
          <span className="led" /> local · saved
        </div>
        <div className="status-line">
          {open} task{open === 1 ? '' : 's'} open
        </div>
        {dueToday > 0 && <div className="status-line warn">{dueToday} due today</div>}
        <div className="status-line">
          {completedSessions} focus session{completedSessions === 1 ? '' : 's'}
        </div>
        <div className="status-line dim">break bank · {fmtDuration(bankedBreakSeconds)}</div>
      </div>
    </aside>
  );
}
