import { useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import { useStore } from '../store';
import type { Column } from '../types';
import { Panel } from '../components/Panel';
import { fmtDuration, todayISO } from '../util';

const columns: { id: Column; label: string }[] = [
  { id: 'todo', label: 'TO DO' },
  { id: 'doing', label: 'DOING' },
  { id: 'done', label: 'DONE' },
];

export function BoardModule() {
  const tasks = useStore((s) => s.tasks);
  const moveTask = useStore((s) => s.moveTask);
  const addTask = useStore((s) => s.addTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const setActiveTask = useStore((s) => s.setActiveTask);
  const setModule = useStore((s) => s.setModule);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Column | null>(null);
  const [newCard, setNewCard] = useState('');

  const today = todayISO();

  const onDrop = (e: DragEvent, col: Column) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragId;
    if (id) moveTask(id, col);
    setDragId(null);
    setOverCol(null);
  };

  const addCard = (e: FormEvent) => {
    e.preventDefault();
    if (addTask(newCard)) setNewCard('');
  };

  const focusOn = (id: string) => {
    setActiveTask(id);
    setModule('focus');
  };

  return (
    <Panel title="BOARD" accent="board">
      <div className="board">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.column === col.id);
          return (
            <div
              key={col.id}
              className={`board-col${overCol === col.id ? ' over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(col.id);
              }}
              onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
              onDrop={(e) => onDrop(e, col.id)}
            >
              <div className="board-col-head">
                <span className="board-col-title">{col.label}</span>
                <span className="board-col-count">{colTasks.length}</span>
              </div>

              <div className="board-cards">
                {colTasks.length === 0 && <div className="board-empty">drop cards here</div>}
                {colTasks.map((t) => (
                  <div
                    key={t.id}
                    className={`card${t.done ? ' done' : ''}${dragId === t.id ? ' dragging' : ''}`}
                    draggable
                    onDragStart={(e: DragEvent) => {
                      setDragId(t.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', t.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                  >
                    <div className="card-top">
                      <span className={`dot p-${t.priority}`} title={`priority: ${t.priority}`} />
                      <span className="card-title">{t.title}</span>
                    </div>
                    <div className="card-meta">
                      {t.due && (
                        <span
                          className={`badge due${t.due === today && !t.done ? ' today' : ''}${
                            t.due < today && !t.done ? ' over' : ''
                          }`}
                        >
                          {t.due}
                        </span>
                      )}
                      {t.focusSeconds > 0 && (
                        <span className="badge focus-badge">◐ {fmtDuration(t.focusSeconds)}</span>
                      )}
                      <span className="card-actions">
                        <button className="card-btn" onClick={() => focusOn(t.id)} title="Focus on this task">
                          focus
                        </button>
                        <button className="card-btn del" onClick={() => deleteTask(t.id)} title="Delete">
                          del
                        </button>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {col.id === 'todo' && (
                <form className="board-add" onSubmit={addCard}>
                  <input
                    value={newCard}
                    onChange={(e) => setNewCard(e.target.value)}
                    placeholder="+ add card…"
                  />
                </form>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
