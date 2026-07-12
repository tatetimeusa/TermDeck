import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../store';
import { forceSync, signIn, signOut, signUp, syncConfigured } from '../sync';

function agoLabel(iso: string, now: number): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const STATUS_LINE: Record<string, string> = {
  syncing: 'SYNC: … working',
  synced: 'SYNC: ✓',
  error: 'SYNC: ✗ error — will retry on next change or focus',
  offline: 'SYNC: ⚠ offline — will resume when back online',
  off: 'SYNC: off',
};

export function AccountPanel({ onClose }: { onClose: () => void }) {
  const authEmail = useStore((s) => s.authEmail);
  const syncStatus = useStore((s) => s.syncStatus);
  const lastSyncedAt = useStore((s) => s.lastSyncedAt);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (kind: 'in' | 'up', e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) return setMsg('enter email and password');
    setBusy(true);
    setMsg(null);
    const err = await (kind === 'in' ? signIn(email.trim(), password) : signUp(email.trim(), password));
    setBusy(false);
    if (err) setMsg(err);
    else setPassword('');
  };

  return (
    <div className="account-layer" onClick={onClose}>
      <div className="account-card" onClick={(e) => e.stopPropagation()}>
        <div className="account-head">
          <span className="account-title">ACCOUNT / SYNC</span>
          <button className="reminder-btn" onClick={onClose} title="Close (Esc)">
            ✕
          </button>
        </div>

        {!syncConfigured ? (
          <div className="account-body">
            <p className="account-dim">
              This build has no sync server configured. Everything is saved on this computer only.
            </p>
          </div>
        ) : authEmail ? (
          <div className="account-body">
            <p>
              signed in as <span className="account-email">{authEmail}</span>
            </p>
            <p className="account-status">
              {STATUS_LINE[syncStatus]}
              {syncStatus === 'synced' && lastSyncedAt ? ` synced ${agoLabel(lastSyncedAt, now)}` : ''}
            </p>
            <p className="account-dim">
              Your tasks, notes, goals and reminders follow this account across computers.
            </p>
            <div className="account-actions">
              <button className="reminder-btn main" onClick={() => forceSync()} disabled={busy}>
                [ SYNC NOW ]
              </button>
              <button
                className="reminder-btn"
                onClick={() => {
                  void signOut();
                  setMsg(null);
                }}
              >
                [ SIGN OUT ]
              </button>
            </div>
            <p className="account-dim">
              Signing out keeps everything on this computer — it just stops syncing.
            </p>
          </div>
        ) : (
          <form className="account-body" onSubmit={(e) => void submit('in', e)}>
            <p className="account-dim">
              Optional: sign in to keep your deck in sync across computers. The app works fully
              without it.
            </p>
            <label className="account-label">
              email
              <input
                className="account-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                spellCheck={false}
              />
            </label>
            <label className="account-label">
              password
              <input
                className="account-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {msg && <p className="account-error">{msg}</p>}
            <div className="account-actions">
              <button className="reminder-btn main" type="submit" disabled={busy}>
                {busy ? '[ … ]' : '[ SIGN IN ]'}
              </button>
              <button
                className="reminder-btn"
                type="button"
                disabled={busy}
                onClick={() => void submit('up')}
              >
                [ SIGN UP ]
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
