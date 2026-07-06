import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Panel } from '../components/Panel';
import { fmtDuration, fmtTimer } from '../util';

const MIN_MINUTES = 1;
const MAX_MINUTES = 999;

// Editable minutes field: type any value directly, or use the +/- steppers.
// The steppers snap to the nearest multiple of `step` so they always land on
// clean numbers (e.g. from 1 the work stepper goes to 5, never 6).
function MinuteField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  // Re-sync the text field whenever the stored value changes elsewhere
  // (stepper buttons, reset, or a completed session rolling over).
  useEffect(() => setDraft(String(value)), [value]);

  const clamp = (n: number) => Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, n));

  const commit = () => {
    const n = parseInt(draft, 10);
    if (Number.isNaN(n)) setDraft(String(value)); // revert empty/invalid input
    else onChange(clamp(n));
  };

  const dec = () => onChange(clamp((Math.ceil(value / step) - 1) * step));
  const inc = () => onChange(clamp((Math.floor(value / step) + 1) * step));

  return (
    <div className="set">
      <span>{label}</span>
      <button onClick={dec} aria-label={`decrease ${label} minutes`}>
        −
      </button>
      <input
        className="set-input"
        type="text"
        inputMode="numeric"
        value={draft}
        aria-label={`${label} minutes`}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      <span className="unit">m</span>
      <button onClick={inc} aria-label={`increase ${label} minutes`}>
        +
      </button>
    </div>
  );
}

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
  const pct = total > 0 ? Math.min(100, Math.max(0, (1 - secondsLeft / total) * 100)) : 0;

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
          <MinuteField
            label="work"
            value={settings.workMin}
            step={5}
            onChange={(n) => setSettings({ workMin: n })}
          />
          <MinuteField
            label="break"
            value={settings.breakMin}
            step={1}
            onChange={(n) => setSettings({ breakMin: n })}
          />
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
