import { useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../store';
import { Panel } from '../components/Panel';
import { MONTHS, WEEKDAYS, isoFromDate, prettyDate, todayISO } from '../util';

export function CalendarModule() {
  const tasks = useStore((s) => s.tasks);
  const goals = useStore((s) => s.goals);
  const addTask = useStore((s) => s.addTask);
  const toggleTask = useStore((s) => s.toggleTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const setModule = useStore((s) => s.setModule);

  const today = todayISO();
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState<string>(today);
  const [title, setTitle] = useState('');

  const startWeekday = new Date(view.y, view.m, 1).getDay();
  const start = new Date(view.y, view.m, 1 - startWeekday);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { iso: isoFromDate(date), day: date.getDate(), inMonth: date.getMonth() === view.m };
  });

  const prevMonth = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const nextMonth = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));
  const goToday = () => {
    setView({ y: now.getFullYear(), m: now.getMonth() });
    setSelected(today);
  };

  const selTasks = tasks.filter((t) => t.due === selected);
  const addOnDay = (e: FormEvent) => {
    e.preventDefault();
    if (addTask(title, { due: selected })) setTitle('');
  };

  return (
    <Panel title="CALENDAR" accent="calendar">
      <div className="cal-layout">
        <div className="cal-main">
          <div className="cal-head">
            <button className="cal-nav" onClick={prevMonth} title="Previous month">
              ◂
            </button>
            <span className="cal-month">
              {MONTHS[view.m]} {view.y}
            </span>
            <button className="cal-nav" onClick={nextMonth} title="Next month">
              ▸
            </button>
            <button className="cal-today" onClick={goToday}>
              today
            </button>
          </div>

          <div className="cal-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="cal-grid">
            {cells.map((c) => {
              const dayTasks = tasks.filter((t) => t.due === c.iso);
              const dayGoals = goals.filter((g) => g.endDate === c.iso);
              const checkedIn = goals.some((g) => g.checkIns.includes(c.iso));
              return (
                <div
                  key={c.iso}
                  className={`cal-cell${c.inMonth ? '' : ' out'}${c.iso === today ? ' today' : ''}${
                    c.iso === selected ? ' selected' : ''
                  }${checkedIn ? ' checked' : ''}`}
                  onClick={() => setSelected(c.iso)}
                >
                  <div className="cal-day">{c.day}</div>
                  <div className="cal-cell-tasks">
                    {dayGoals.map((g) => (
                      <div
                        key={g.id}
                        className="cal-chip goal-chip"
                        title={`goal due: ${g.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setModule('goals');
                        }}
                      >
                        ◇ {g.title}
                      </div>
                    ))}
                    {dayTasks.slice(0, 3).map((t) => (
                      <div
                        key={t.id}
                        className={`cal-chip p-${t.priority}${t.done ? ' done' : ''}`}
                        title={t.title}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTask(t.id);
                        }}
                      >
                        {t.title}
                      </div>
                    ))}
                    {dayTasks.length > 3 && <div className="cal-more">+{dayTasks.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="cal-detail">
          <div className="cal-detail-head">{prettyDate(selected)}</div>
          <form className="cal-add" onSubmit={addOnDay}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="add a task on this day…"
            />
            <button type="submit" className="add-btn">
              [ ADD ]
            </button>
          </form>
          <ul className="cal-detail-list">
            {selTasks.length === 0 && <li className="empty">nothing due this day.</li>}
            {selTasks.map((t) => (
              <li key={t.id} className={`cal-detail-item${t.done ? ' done' : ''}`}>
                <button className="check" onClick={() => toggleTask(t.id)}>
                  {t.done ? '[x]' : '[ ]'}
                </button>
                <span className={`dot p-${t.priority}`} />
                <span className="cal-detail-title">{t.title}</span>
                <button className="row-btn del" onClick={() => deleteTask(t.id)}>
                  del
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
