import { useStore } from '../store';
import { Panel } from '../components/Panel';
import { fmtDuration, fmtTimer } from '../util';

export function FocusModule() {
  const focusMode = useStore((s) => s.focusMode);
  const running = useStore((s) => s.running);
  const secondsLeft = useStore((s) => s.secondsLeft);
  const startTimer = useStore((s) => s.startTimer);
  const pauseTimer = useStore((s) => s.pauseTimer);
  const resetTimer = useStore((s) => s.resetTimer);
  const skipSession = useStore((s) => s.skipSession);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const tasks = useStore((s) => s.tasks);
  const activeTaskId = useStore((s) => s.activeTaskId);
  const setActiveTask = useStore((s) => s.setActiveTask);
  const completedSessions = useStore((s) => s.completedSessions);

  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null;
  const openTasks = tasks.filter((t) => !t.done);

  const total = (focusMode === 'work' ? settings.workMin : settings.breakMin) * 60;
  const pct = total > 0 ? Math.min(100, (1 - secondsLeft / total) * 100) : 0;

  return (
    <Panel title="FOCUS" accent="focus">
      <div className="focus-wrap">
        <div className={`focus-mode ${focusMode}`}>
          {focusMode === 'work' ? '◐ FOCUS SESSION' : '☺ BREAK TIME'}
        </div>

        <div className={`focus-clock${running ? ' running' : ''}`}>{fmtTimer(secondsLeft)}</div>

        <div className="focus-progress">
          <div className="focus-progress-bar" style={{ width: `${pct}%` }} />
        </div>

        <div className="focus-controls">
          {running ? (
            <button className="big-btn" onClick={pauseTimer}>
              [ PAUSE ]
            </button>
          ) : (
            <button className="big-btn go" onClick={startTimer}>
              [ START ]
            </button>
          )}
          <button className="big-btn ghost" onClick={resetTimer}>
            [ RESET ]
          </button>
          <button className="big-btn ghost" onClick={skipSession}>
            [ SKIP &#9656; ]
          </button>
        </div>

        <div className="focus-task">
          <label>focusing on:</label>
          <select value={activeTaskId ?? ''} onChange={(e) => setActiveTask(e.target.value || null)}>
            <option value="">— nothing selected —</option>
            {openTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          {activeTask && <span className="dim">logged {fmtDuration(activeTask.focusSeconds)}</span>}
        </div>

        <div className="focus-settings">
          <div className="set">
            <span>work</span>
            <button onClick={() => setSettings({ workMin: Math.max(1, settings.workMin - 5) })}>−</button>
            <b>{settings.workMin}m</b>
            <button onClick={() => setSettings({ workMin: settings.workMin + 5 })}>+</button>
          </div>
          <div className="set">
            <span>break</span>
            <button onClick={() => setSettings({ breakMin: Math.max(1, settings.breakMin - 1) })}>−</button>
            <b>{settings.breakMin}m</b>
            <button onClick={() => setSettings({ breakMin: settings.breakMin + 1 })}>+</button>
          </div>
          <div className="set stat">
            sessions done <b>{completedSessions}</b>
          </div>
        </div>

        <p className="focus-hint dim">
          Finish a focus session to bank break time — that unlocks the ARCADE (Snake) in a later phase.
        </p>
      </div>
    </Panel>
  );
}
