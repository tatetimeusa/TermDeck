import { useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../store';
import { Panel } from '../components/Panel';
import { pad, todayISO } from '../util';
import { advanceToFuture, describeRecurrence, effectiveAt, fmtClockTime, fmtFireTime } from '../reminders';
import type { Recurrence, RecurUnit, Reminder } from '../types';

type RecurKind = Recurrence['kind'];

const nextFullHour = () => {
  const d = new Date();
  return `${pad((d.getHours() + 1) % 24)}:00`;
};

const whenToMs = (dateISO: string, time: string) => {
  const [y, m, d] = dateISO.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
};

export function RemindersModule() {
  const reminders = useStore((s) => s.reminders);
  const tasks = useStore((s) => s.tasks);
  const addReminder = useStore((s) => s.addReminder);
  const updateReminder = useStore((s) => s.updateReminder);
  const deleteReminder = useStore((s) => s.deleteReminder);

  const [text, setText] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nextFullHour());
  const [kind, setKind] = useState<RecurKind>('none');
  const [every, setEvery] = useState(30);
  const [unit, setUnit] = useState<RecurUnit>('minutes');
  const [taskId, setTaskId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showPast, setShowPast] = useState(false);

  const openTasks = tasks.filter((t) => !t.done);
  const upcoming = reminders.filter((r) => !r.done).sort((a, b) => effectiveAt(a) - effectiveAt(b));
  const past = reminders.filter((r) => r.done);

  const resetForm = () => {
    setText('');
    setDate(todayISO());
    setTime(nextFullHour());
    setKind('none');
    setEvery(30);
    setUnit('minutes');
    setTaskId('');
    setEditingId(null);
    setError('');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const recurrence: Recurrence =
      kind === 'custom' ? { kind, every: Math.max(1, every), unit } : { kind };
    let whenMs = whenToMs(date, time);
    const now = Date.now();
    if (whenMs <= now) {
      if (recurrence.kind === 'none') {
        setError('that time already passed — pick a future one.');
        return;
      }
      // a repeat set in the past just means "start the cycle from there"
      whenMs = advanceToFuture(recurrence, whenMs, now);
    }
    if (editingId) {
      if (!text.trim()) return;
      updateReminder(editingId, {
        text: text.trim(),
        taskId: taskId || null,
        nextAt: whenMs,
        recurrence,
        snoozedUntil: null,
        done: false,
      });
      resetForm();
    } else if (addReminder(text, whenMs, { taskId: taskId || null, recurrence })) {
      resetForm();
    }
  };

  const startEdit = (r: Reminder) => {
    const d = new Date(r.nextAt);
    setText(r.text);
    setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setKind(r.recurrence.kind);
    if (r.recurrence.kind === 'custom') {
      setEvery(r.recurrence.every);
      setUnit(r.recurrence.unit);
    }
    setTaskId(r.taskId ?? '');
    setEditingId(r.id);
    setError('');
  };

  const taskTitle = (id: string | null) => {
    if (!id) return null;
    const t = tasks.find((x) => x.id === id);
    return t ? t.title : '(task deleted)';
  };

  return (
    <Panel title="REMINDERS" accent="reminders">
      <form className="rem-add" onSubmit={submit}>
        <div className="rem-add-row">
          <span className="prompt">&gt;</span>
          <input
            className="todo-input"
            placeholder={editingId ? 'edit reminder…' : 'remind me to…'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <button type="submit" className="add-btn">
            {editingId ? '[ SAVE ]' : '[ ADD ]'}
          </button>
          {editingId && (
            <button type="button" className="add-btn" onClick={resetForm}>
              [ CANCEL ]
            </button>
          )}
        </div>
        <div className="rem-add-row opts">
          <label className="rem-opt">
            on
            <input
              className="due-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="rem-opt">
            at
            <input
              className="due-input"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          <label className="rem-opt">
            repeat
            <select
              className="due-input"
              value={kind}
              onChange={(e) => setKind(e.target.value as RecurKind)}
            >
              <option value="none">never</option>
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
              <option value="custom">custom…</option>
            </select>
          </label>
          {kind === 'custom' && (
            <label className="rem-opt">
              every
              <input
                className="due-input rem-every"
                type="number"
                min={1}
                max={999}
                value={every}
                onChange={(e) => setEvery(Math.max(1, Number(e.target.value) || 1))}
              />
              <select
                className="due-input"
                value={unit}
                onChange={(e) => setUnit(e.target.value as RecurUnit)}
              >
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
                <option value="days">days</option>
              </select>
            </label>
          )}
          <label className="rem-opt">
            task
            <select
              className="due-input"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
            >
              <option value="">— no linked task —</option>
              {openTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <div className="rem-error">{error}</div>}
      </form>

      <ul className="rem-list">
        {upcoming.length === 0 && (
          <li className="empty">no reminders set — add one above and it'll pop up on time.</li>
        )}
        {upcoming.map((r) => (
          <li key={r.id} className="rem-item">
            <span className="rem-when">{fmtFireTime(effectiveAt(r))}</span>
            <span className="rem-text">{r.text}</span>
            {r.recurrence.kind !== 'none' && (
              <span className="badge rem-recur">↻ {describeRecurrence(r.recurrence)}</span>
            )}
            {r.snoozedUntil != null && (
              <span className="badge rem-snooze">zzz until {fmtClockTime(r.snoozedUntil)}</span>
            )}
            {r.taskId && <span className="rem-task dim">→ {taskTitle(r.taskId)}</span>}
            <button className="row-btn" onClick={() => startEdit(r)} title="Edit reminder">
              edit
            </button>
            <button className="row-btn del" onClick={() => deleteReminder(r.id)} title="Delete reminder">
              del
            </button>
          </li>
        ))}
      </ul>

      {past.length > 0 && (
        <div className="rem-past">
          <button className="rem-past-toggle" onClick={() => setShowPast((v) => !v)}>
            {showPast ? '▾' : '▸'} PAST ({past.length})
          </button>
          {showPast && (
            <ul className="rem-list past">
              {past.map((r) => (
                <li key={r.id} className="rem-item done">
                  <span className="rem-when">{fmtFireTime(r.nextAt)}</span>
                  <span className="rem-text">{r.text}</span>
                  <button
                    className="row-btn del"
                    onClick={() => deleteReminder(r.id)}
                    title="Delete reminder"
                  >
                    del
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}
