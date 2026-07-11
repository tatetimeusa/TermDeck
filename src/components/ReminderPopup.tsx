import { useEffect } from 'react';
import { useStore } from '../store';
import { fmtFireTime } from '../reminders';

// Fixed overlay that shows a card per fired reminder, above every module.
// The layer itself lets clicks through so the app stays usable behind it.
export function ReminderPopup() {
  const firing = useStore((s) => s.firing);
  const reminders = useStore((s) => s.reminders);
  const tasks = useStore((s) => s.tasks);
  const dismissFired = useStore((s) => s.dismissFired);
  const snoozeReminder = useStore((s) => s.snoozeReminder);
  const toggleTask = useStore((s) => s.toggleTask);

  // Escape dismisses the newest card. Capture phase + stopPropagation so the
  // press never reaches other global handlers, and typing targets are skipped
  // so the command bar keeps its own Escape behavior.
  useEffect(() => {
    if (firing.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      e.preventDefault();
      e.stopPropagation();
      dismissFired(firing[firing.length - 1].reminderId);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [firing, dismissFired]);

  if (firing.length === 0) return null;

  return (
    <div className="reminder-layer">
      {firing.map((f) => {
        const r = reminders.find((x) => x.id === f.reminderId);
        if (!r) return null;
        const task = r.taskId ? tasks.find((t) => t.id === r.taskId) : undefined;
        return (
          <div key={f.reminderId} className="reminder-card">
            <div className="reminder-head">
              <span className="reminder-title">REMINDER</span>
              {f.missed && (
                <span className="reminder-missed">MISSED @ {fmtFireTime(f.scheduledFor)}</span>
              )}
            </div>
            <div className="reminder-text">{r.text}</div>
            {task && !task.done && (
              <div className="reminder-task">
                <span className="dim">task:</span> {task.title}
                <button
                  className="reminder-btn"
                  onClick={() => {
                    toggleTask(task.id);
                    dismissFired(r.id);
                  }}
                >
                  [ MARK TASK DONE ]
                </button>
              </div>
            )}
            <div className="reminder-actions">
              <button className="reminder-btn main" onClick={() => dismissFired(r.id)}>
                [ DISMISS ]
              </button>
              <button className="reminder-btn" onClick={() => snoozeReminder(r.id, 5)}>
                [ zZ 5m ]
              </button>
              <button className="reminder-btn" onClick={() => snoozeReminder(r.id, 15)}>
                [ zZ 15m ]
              </button>
              <button className="reminder-btn" onClick={() => snoozeReminder(r.id, 60)}>
                [ zZ 60m ]
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
