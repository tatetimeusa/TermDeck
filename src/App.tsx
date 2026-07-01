import { useEffect, useState } from 'react';
import { useStore } from './store';
import { playClick } from './sound';
import { Intro } from './components/Intro';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { CommandBar } from './components/CommandBar';
import { TodoModule } from './modules/TodoModule';
import { NotesModule } from './modules/NotesModule';
import { FocusModule } from './modules/FocusModule';
import { BoardModule } from './modules/BoardModule';
import { CalendarModule } from './modules/CalendarModule';
import { ArcadeModule } from './modules/ArcadeModule';
import { GoalsModule } from './modules/GoalsModule';
import { StreaksModule } from './modules/StreaksModule';
import type { ModuleId } from './types';

const moduleKeys: Record<string, ModuleId> = {
  '1': 'todo',
  '2': 'board',
  '3': 'calendar',
  '4': 'notes',
  '5': 'focus',
  '6': 'arcade',
  '7': 'goals',
  '8': 'streaks',
};

export default function App() {
  const activeModule = useStore((s) => s.activeModule);
  const setModule = useStore((s) => s.setModule);
  const tick = useStore((s) => s.tick);
  const scanlines = useStore((s) => s.scanlines);
  // play the boot intro on launch (read once at mount so toggling it mid-session
  // never disturbs the running app)
  const [introActive, setIntroActive] = useState(() => useStore.getState().introEnabled);

  // 1-second heartbeat that drives the focus timer
  useEffect(() => {
    const id = setInterval(() => tick(), 1000);
    // The heartbeat gets throttled while the window is minimized/hidden, so
    // re-sync the moment it comes back to the foreground (the timer is anchored
    // to a real end-time, so this snaps it to the correct value instantly).
    const resync = () => tick();
    window.addEventListener('focus', resync);
    document.addEventListener('visibilitychange', resync);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', resync);
      document.removeEventListener('visibilitychange', resync);
    };
  }, [tick]);

  // soft UI tick on any interactive click (gated by the SND toggle). Capture
  // phase so it still fires when a handler calls stopPropagation (e.g. cal chips).
  useEffect(() => {
    const isInteractive = (el: HTMLElement | null): boolean => {
      if (!el) return false;
      if (el.closest('button, a, input, select, textarea, label, [role="button"]')) return true;
      let node: HTMLElement | null = el;
      for (let i = 0; node && i < 5; i++, node = node.parentElement) {
        if (getComputedStyle(node).cursor === 'pointer') return true;
      }
      return false;
    };
    let last = 0;
    const onClick = (e: MouseEvent) => {
      const now = Date.now();
      if (now - last < 40) return; // de-dupe label→input double fire
      if (!useStore.getState().soundEnabled) return;
      if (!isInteractive(e.target as HTMLElement)) return;
      last = now;
      playClick();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

      if (e.key === '/' && !typing) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('termdeck:focus-command'));
        return;
      }
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && moduleKeys[e.key]) {
        setModule(moduleKeys[e.key]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setModule]);

  return (
    <div className={`app${scanlines ? ' scanlines' : ''}`}>
      {introActive && <Intro onDone={() => setIntroActive(false)} />}
      <TopBar />
      <Sidebar />
      <main className="main">
        {activeModule === 'todo' && <TodoModule />}
        {activeModule === 'notes' && <NotesModule />}
        {activeModule === 'focus' && <FocusModule />}
        {activeModule === 'board' && <BoardModule />}
        {activeModule === 'calendar' && <CalendarModule />}
        {activeModule === 'arcade' && <ArcadeModule />}
        {activeModule === 'goals' && <GoalsModule />}
        {activeModule === 'streaks' && <StreaksModule />}
      </main>
      <CommandBar />
    </div>
  );
}
