import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { fmtClock, fmtTimer } from '../util';

export function TopBar() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const running = useStore((s) => s.running);
  const focusMode = useStore((s) => s.focusMode);
  const secondsLeft = useStore((s) => s.secondsLeft);
  const scanlines = useStore((s) => s.scanlines);
  const toggleScanlines = useStore((s) => s.toggleScanlines);
  const soundEnabled = useStore((s) => s.soundEnabled);
  const toggleSound = useStore((s) => s.toggleSound);
  const introEnabled = useStore((s) => s.introEnabled);
  const toggleIntro = useStore((s) => s.toggleIntro);

  return (
    <header className="topbar">
      <div className="brand">
        TERMDECK<span className="cursor">_</span>
      </div>
      <div className="topbar-right">
        <span className={`tb-timer ${focusMode}${running ? ' on' : ''}`}>
          {focusMode === 'work' ? '◐ FOCUS' : '☺ BREAK'} {fmtTimer(secondsLeft)}
        </span>
        <button className="ghost-btn" onClick={toggleSound} title="Toggle sounds">
          {soundEnabled ? 'SND:ON' : 'SND:OFF'}
        </button>
        <button className="ghost-btn" onClick={toggleScanlines} title="Toggle CRT scanlines">
          {scanlines ? 'CRT:ON' : 'CRT:OFF'}
        </button>
        <button className="ghost-btn" onClick={toggleIntro} title="Toggle startup intro">
          {introEnabled ? 'INTRO:ON' : 'INTRO:OFF'}
        </button>
        <span className="clock">{fmtClock(now)}</span>
      </div>
    </header>
  );
}
