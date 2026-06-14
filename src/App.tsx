import { useEffect } from 'react';
import { useStore } from './store';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { CommandBar } from './components/CommandBar';
import { TodoModule } from './modules/TodoModule';
import { NotesModule } from './modules/NotesModule';
import { FocusModule } from './modules/FocusModule';
import { BoardModule } from './modules/BoardModule';
import { CalendarModule } from './modules/CalendarModule';
import { ArcadeModule } from './modules/ArcadeModule';
import type { ModuleId } from './types';

const moduleKeys: Record<string, ModuleId> = {
  '1': 'todo',
  '2': 'board',
  '3': 'calendar',
  '4': 'notes',
  '5': 'focus',
  '6': 'arcade',
};

export default function App() {
  const activeModule = useStore((s) => s.activeModule);
  const setModule = useStore((s) => s.setModule);
  const tick = useStore((s) => s.tick);
  const scanlines = useStore((s) => s.scanlines);

  // 1-second heartbeat that drives the focus timer
  useEffect(() => {
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [tick]);

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
      if (!typing && moduleKeys[e.key]) {
        setModule(moduleKeys[e.key]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setModule]);

  return (
    <div className={`app${scanlines ? ' scanlines' : ''}`}>
      <TopBar />
      <Sidebar />
      <main className="main">
        {activeModule === 'todo' && <TodoModule />}
        {activeModule === 'notes' && <NotesModule />}
        {activeModule === 'focus' && <FocusModule />}
        {activeModule === 'board' && <BoardModule />}
        {activeModule === 'calendar' && <CalendarModule />}
        {activeModule === 'arcade' && <ArcadeModule />}
      </main>
      <CommandBar />
    </div>
  );
}
