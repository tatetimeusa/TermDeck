import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Panel } from '../components/Panel';

export function NotesModule() {
  const notes = useStore((s) => s.notes);
  const addNote = useStore((s) => s.addNote);
  const updateNote = useStore((s) => s.updateNote);
  const deleteNote = useStore((s) => s.deleteNote);

  const [selected, setSelected] = useState<string | null>(notes[0]?.id ?? null);

  // keep the selection pointing at something that still exists
  useEffect(() => {
    if (selected && !notes.find((n) => n.id === selected)) {
      setSelected(notes[0]?.id ?? null);
    } else if (!selected && notes[0]) {
      setSelected(notes[0].id);
    }
  }, [notes, selected]);

  // a note made from the command bar opens in the editor
  useEffect(() => {
    const open = (e: Event) => setSelected((e as CustomEvent<{ id: string }>).detail.id);
    window.addEventListener('termdeck:open-note', open);
    return () => window.removeEventListener('termdeck:open-note', open);
  }, []);

  const note = notes.find((n) => n.id === selected) ?? null;

  const create = () => setSelected(addNote('untitled'));

  return (
    <Panel
      title="NOTES"
      accent="notes"
      right={
        <button className="add-btn" onClick={create}>
          [ + NEW ]
        </button>
      }
    >
      <div className="notes-layout">
        <ul className="notes-list">
          {notes.length === 0 && (
            <li className="empty">
              <span className="quip">&gt; no notes. a clean mind, or a forgetful one.</span>
            </li>
          )}
          {notes.map((n) => (
            <li
              key={n.id}
              className={`note-item${selected === n.id ? ' on' : ''}`}
              onClick={() => setSelected(n.id)}
              tabIndex={0}
              role="button"
              aria-pressed={selected === n.id}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelected(n.id);
                }
              }}
            >
              <div className="note-item-title">{n.title || 'untitled'}</div>
              <div className="note-item-sub">{n.body.split('\n')[0]?.slice(0, 38) || '—'}</div>
            </li>
          ))}
        </ul>

        <div className="note-editor">
          {note ? (
            <>
              <input
                className="note-title-input"
                value={note.title}
                onChange={(e) => updateNote(note.id, { title: e.target.value })}
                placeholder="title"
              />
              <textarea
                className="note-body-input"
                value={note.body}
                onChange={(e) => updateNote(note.id, { body: e.target.value })}
                placeholder="start typing…  (plain text for now — rich formatting comes in a later phase)"
              />
              <div className="note-foot">
                <span className="dim">saved · {new Date(note.updatedAt).toLocaleString()}</span>
                <button className="row-btn del" onClick={() => deleteNote(note.id)}>
                  delete note
                </button>
              </div>
            </>
          ) : (
            <div className="empty big">
              no note selected — hit <b>[ + NEW ]</b>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
