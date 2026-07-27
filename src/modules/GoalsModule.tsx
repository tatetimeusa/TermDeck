import { useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../store';
import { Panel } from '../components/Panel';
import { addDays, daysInclusive, prettyDate, todayISO } from '../util';
import { COMPETITION_TOTAL, competitionLeft, streakStats } from '../competition';

const QUICK: { label: string; days: number }[] = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1yr', days: 365 },
];

export function GoalsModule() {
  const goals = useStore((s) => s.goals);
  const addGoal = useStore((s) => s.addGoal);
  const deleteGoal = useStore((s) => s.deleteGoal);
  const setModule = useStore((s) => s.setModule);

  const today = todayISO();
  const [title, setTitle] = useState('');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDays(today, 30));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (end < start) return;
    if (addGoal(title, start, end)) {
      setTitle('');
      setStart(today);
      setEnd(addDays(today, 30));
    }
  };

  return (
    <Panel title="GOALS" accent="goals">
      <form className="goal-add" onSubmit={submit}>
        <div className="goal-add-row">
          <span className="prompt">&gt;</span>
          <input
            className="todo-input"
            placeholder="name a goal…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <button type="submit" className="add-btn">
            [ ADD ]
          </button>
        </div>
        <div className="goal-add-row dates">
          <label className="goal-date">
            from
            <input
              className="due-input"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="goal-date">
            to
            <input
              className="due-input"
              type="date"
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <div className="goal-quick">
            {QUICK.map((q) => (
              <button
                key={q.label}
                type="button"
                className={`filter${end === addDays(start, q.days) ? ' on' : ''}`}
                onClick={() => setEnd(addDays(start, q.days))}
                title={`${q.days} days from start`}
              >
                {q.label}
              </button>
            ))}
            <span className="goal-len dim">{daysInclusive(start, end)} days</span>
          </div>
        </div>
      </form>

      {goals.length > 0 && (
        <p className="comp-hint dim">
          <b>… of 100,000 left</b> under each goal is how many of an imaginary 100,000 people who set
          the same goal are still going after as many check-ins as you&rsquo;ve made. Click it for
          the full picture in STREAKS [8].
        </p>
      )}

      <ul className="goal-list">
        {goals.length === 0 && (
          <li className="empty">no goals yet — name one above and pick a timeframe.</li>
        )}
        {goals.map((g) => {
          const total = daysInclusive(g.startDate, g.endDate);
          const done = g.checkIns.length;
          const pct = Math.min(100, Math.round((done / total) * 100));
          const { current } = streakStats(g.checkIns);
          const left = competitionLeft(done);
          const ended = g.endDate < today;
          const daysLeft = ended ? 0 : daysInclusive(today, g.endDate);
          return (
            <li key={g.id} className="goal-item">
              <div className="goal-top">
                <span className="goal-title">{g.title}</span>
                <span className="goal-when dim">
                  {prettyDate(g.startDate)} → {prettyDate(g.endDate)}
                </span>
                <span className={`badge${ended ? ' over' : ''}`}>
                  {ended ? 'ended' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                </span>
                <button className="row-btn del" onClick={() => deleteGoal(g.id)} title="Delete goal">
                  del
                </button>
              </div>

              <div className="goal-bar" title={`${done} of ${total} days`}>
                <div className="goal-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="goal-bar-foot">
                <span className="goal-bar-label">
                  {done} / {total} days · {pct}%
                </span>
                <span className="goal-stats">
                  {current > 0 && <span className="streak-fire">🔥 {current}</span>}
                  <button
                    className="goal-link"
                    onClick={() => setModule('streaks')}
                    title={`Of an imaginary ${COMPETITION_TOTAL.toLocaleString()} people who set the same goal, ${left.toLocaleString()} are still going after your ${done} check-in${
                      done === 1 ? '' : 's'
                    }. Open STREAKS.`}
                  >
                    {left.toLocaleString()} of {COMPETITION_TOTAL.toLocaleString()} left →
                  </button>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
