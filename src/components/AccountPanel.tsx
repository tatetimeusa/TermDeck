import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../store';
import {
  MIN_PASSWORD,
  cancelRecovery,
  forceSync,
  requestPasswordReset,
  setNewPassword,
  signIn,
  signOut,
  signUp,
  syncConfigured,
  verifyRecoveryCode,
} from '../sync';

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

// signed-out steps: sign in → paste the emailed code → pick a new password
type Mode = 'signin' | 'code' | 'newpw';
type Msg = { kind: 'ok' | 'err'; text: string };

export function AccountPanel({
  onClose,
  openPassword = false,
}: {
  onClose: () => void;
  openPassword?: boolean;
}) {
  const authEmail = useStore((s) => s.authEmail);
  const syncStatus = useStore((s) => s.syncStatus);
  const lastSyncedAt = useStore((s) => s.lastSyncedAt);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<Msg | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [mode, setMode] = useState<Mode>('signin');
  const [resetEmail, setResetEmail] = useState(''); // frozen when the code is sent
  const [code, setCode] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwOpen, setPwOpen] = useState(openPassword);

  const say = (kind: Msg['kind'], text: string) => setMsg({ kind, text });

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

  // closing the panel part-way through a reset (Esc, backdrop, ✕) must not leave
  // the verified-but-unfinished session signed in — no-ops once it's finished
  useEffect(() => () => void cancelRecovery(), []);

  const submit = async (kind: 'in' | 'up', e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) return say('err', 'enter email and password');
    setBusy(true);
    setMsg(null);
    if (kind === 'in') {
      const err = await signIn(email.trim(), password);
      setBusy(false);
      if (err) say('err', err);
      else setPassword('');
      return;
    }
    const res = await signUp(email.trim(), password);
    setBusy(false);
    if (res.message) say(res.ok ? 'ok' : 'err', res.message);
    if (res.ok) setPassword('');
  };

  const sendCode = async (addr: string) => {
    if (busy) return;
    if (!addr) return say('err', 'enter your email first');
    setBusy(true);
    setMsg(null);
    const res = await requestPasswordReset(addr);
    setBusy(false);
    if (res.message) say(res.ok ? 'ok' : 'err', res.message);
    if (res.ok) {
      setResetEmail(addr);
      setPassword('');
      setMode('code');
    }
  };

  const verify = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (!code.trim()) return say('err', 'enter the code from the email');
    setBusy(true);
    setMsg(null);
    const res = await verifyRecoveryCode(resetEmail, code);
    setBusy(false);
    // keep the code on screen on failure so a typo can just be fixed
    if (!res.ok) return say('err', res.message ?? 'that code did not work');
    setMode('newpw');
  };

  const savePassword = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (pw1.length < MIN_PASSWORD)
      return say('err', `password must be at least ${MIN_PASSWORD} characters`);
    if (pw1 !== pw2) return say('err', 'passwords do not match');
    const wasSignedIn = authEmail != null;
    setBusy(true);
    setMsg(null);
    const res = await setNewPassword(pw1);
    setBusy(false);
    if (!res.ok) return say('err', res.message ?? 'could not change the password');
    setPw1('');
    setPw2('');
    setPwOpen(false);
    setMode('signin');
    // finishing a reset also signs you in, and a first sign-in on a machine
    // takes the cloud copy of the deck — say so rather than surprising them
    say('ok', wasSignedIn ? 'password changed' : 'password changed — signed in, pulling your cloud deck');
  };

  const abortReset = async () => {
    await cancelRecovery();
    setMode('signin');
    setCode('');
    setPw1('');
    setPw2('');
    setMsg(null);
  };

  const msgLine = msg ? (
    <p className={msg.kind === 'ok' ? 'account-ok' : 'account-error'}>{msg.text}</p>
  ) : null;

  const passwordFields = (
    <>
      <label className="account-label">
        new password
        <input
          className="account-input"
          type="password"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          autoFocus
        />
      </label>
      <label className="account-label">
        confirm new password
        <input
          className="account-input"
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
        />
      </label>
    </>
  );

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
            {msgLine}
            {pwOpen ? (
              <form className="account-body" onSubmit={(e) => void savePassword(e)}>
                {passwordFields}
                <div className="account-actions">
                  <button className="reminder-btn main" type="submit" disabled={busy}>
                    {busy ? '[ … ]' : '[ SAVE ]'}
                  </button>
                  <button
                    className="reminder-btn"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPwOpen(false);
                      setPw1('');
                      setPw2('');
                      setMsg(null);
                    }}
                  >
                    [ CANCEL ]
                  </button>
                </div>
              </form>
            ) : (
              <div className="account-actions">
                <button className="reminder-btn main" onClick={() => forceSync()} disabled={busy}>
                  [ SYNC NOW ]
                </button>
                <button
                  className="reminder-btn"
                  disabled={busy}
                  onClick={() => {
                    setMsg(null);
                    setPwOpen(true);
                  }}
                >
                  [ CHANGE PASSWORD ]
                </button>
                <button
                  className="reminder-btn"
                  disabled={busy}
                  onClick={() => {
                    void signOut();
                    setMsg(null);
                  }}
                >
                  [ SIGN OUT ]
                </button>
              </div>
            )}
            <p className="account-dim">
              Signing out keeps everything on this computer — it just stops syncing.
            </p>
          </div>
        ) : mode === 'code' ? (
          <form className="account-body" onSubmit={(e) => void verify(e)}>
            <p className="account-dim">
              Ignore the link in the email — paste the code from it here. Codes expire after about
              an hour.
            </p>
            <p className="account-status">code sent to {resetEmail}</p>
            <label className="account-label">
              reset code
              <input
                className="account-input account-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                spellCheck={false}
                autoFocus
              />
            </label>
            {msgLine}
            <div className="account-actions">
              <button className="reminder-btn main" type="submit" disabled={busy}>
                {busy ? '[ … ]' : '[ VERIFY CODE ]'}
              </button>
              <button
                className="reminder-btn"
                type="button"
                disabled={busy}
                onClick={() => void sendCode(resetEmail)}
              >
                [ RESEND CODE ]
              </button>
              <button
                className="reminder-btn"
                type="button"
                disabled={busy}
                onClick={() => {
                  setMode('signin');
                  setCode('');
                  setMsg(null);
                }}
              >
                [ BACK ]
              </button>
            </div>
          </form>
        ) : mode === 'newpw' ? (
          <form className="account-body" onSubmit={(e) => void savePassword(e)}>
            <p className="account-dim">
              Code accepted. Pick a new password for <span className="account-email">{resetEmail}</span>
              {' '}— at least {MIN_PASSWORD} characters.
            </p>
            {passwordFields}
            {msgLine}
            <div className="account-actions">
              <button className="reminder-btn main" type="submit" disabled={busy}>
                {busy ? '[ … ]' : '[ SET PASSWORD ]'}
              </button>
              <button
                className="reminder-btn"
                type="button"
                disabled={busy}
                onClick={() => void abortReset()}
              >
                [ CANCEL ]
              </button>
            </div>
            <p className="account-dim">Closing this panel cancels the reset.</p>
          </form>
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
            {msgLine}
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
            <button
              className="account-link"
              type="button"
              disabled={busy}
              onClick={() => void sendCode(email.trim())}
            >
              forgot password?
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
