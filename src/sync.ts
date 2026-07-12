import { supabase } from './lib/supabase';
import { useStore } from './store';
import type { CloudData } from './store';

// Local-first sync: the app is fully usable signed-out/offline; when signed in,
// the whole deck syncs as one blob to the user's row in the `decks` table.
// Conflict rule is last-write-wins on the server's updated_at clock.

const PUSH_DEBOUNCE_MS = 2_500;
// focus accrual changes the blob every second during a work session — without a
// max wait the debounce would starve until the session ends
const PUSH_MAX_WAIT_MS = 30_000;
const FOCUS_RECONCILE_MIN_MS = 30_000;

let userId: string | null = null;
let applyingRemote = false;
let reconciling = false;
let lastSnapshot: string | null = null; // JSON of the blob this machine last pushed or pulled
let pushTimer: number | null = null;
let firstPendingAt: number | null = null;
let lastReconcileAt = 0;

function buildBlob(s = useStore.getState()): CloudData {
  return {
    tasks: s.tasks,
    notes: s.notes,
    goals: s.goals,
    reminders: s.reminders,
    completedSessions: s.completedSessions,
    bankedBreakSeconds: s.bankedBreakSeconds,
    bestSnake: s.bestSnake,
    settings: s.settings,
    scanlines: s.scanlines,
    soundEnabled: s.soundEnabled,
    introEnabled: s.introEnabled,
  };
}

function setStatus(status: 'off' | 'syncing' | 'synced' | 'error' | 'offline') {
  useStore.getState().setSyncStatus(status);
}

function failStatus() {
  setStatus(navigator.onLine ? 'error' : 'offline');
}

function clearPushTimer() {
  if (pushTimer != null) window.clearTimeout(pushTimer);
  pushTimer = null;
  firstPendingAt = null;
}

async function pushNow(): Promise<void> {
  if (!supabase || !userId) return;
  clearPushTimer();
  const snap = JSON.stringify(buildBlob());
  setStatus('syncing');
  const { data, error } = await supabase
    .from('decks')
    .upsert({ user_id: userId, data: JSON.parse(snap) as CloudData })
    .select('updated_at')
    .single();
  if (error || !data) {
    failStatus();
    return;
  }
  lastSnapshot = snap;
  useStore.getState().setLastSyncedAt(data.updated_at as string);
  setStatus('synced');
}

// Startup / sign-in / window-focus / back-online: pull if the cloud moved on
// without us, otherwise push anything local that hasn't been pushed yet.
async function reconcile(): Promise<void> {
  if (!supabase || !userId || reconciling) return;
  reconciling = true;
  lastReconcileAt = Date.now();
  try {
    setStatus('syncing');
    const { data: row, error } = await supabase
      .from('decks')
      .select('data, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      failStatus();
      return;
    }

    if (!row) {
      // brand-new account — seed the cloud with this machine's deck
      await pushNow();
      return;
    }

    const st = useStore.getState();
    const cloudIsNewer =
      st.lastSyncedAt == null || // first sign-in on this machine → cloud wins
      new Date(row.updated_at as string).getTime() > new Date(st.lastSyncedAt).getTime();

    if (cloudIsNewer) {
      clearPushTimer();
      applyingRemote = true;
      try {
        st.applyCloudData(row.data as CloudData);
      } finally {
        applyingRemote = false;
      }
      lastSnapshot = JSON.stringify(buildBlob());
      useStore.getState().setLastSyncedAt(row.updated_at as string);
      setStatus('synced');
      return;
    }

    // cloud hasn't moved — push if this machine has unpushed changes
    // (lastSnapshot === null right after startup: push once to be safe, it
    // heals edits made in the final debounce window before the app last quit)
    const snap = JSON.stringify(buildBlob(st));
    if (lastSnapshot === null || snap !== lastSnapshot) {
      await pushNow();
    } else {
      setStatus('synced');
    }
  } finally {
    reconciling = false;
  }
}

function schedulePush() {
  if (!userId || applyingRemote) return;
  const snap = JSON.stringify(buildBlob());
  if (snap === lastSnapshot) return;
  const now = Date.now();
  if (firstPendingAt == null) firstPendingAt = now;
  if (pushTimer != null) window.clearTimeout(pushTimer);
  const overdue = now - firstPendingAt >= PUSH_MAX_WAIT_MS;
  pushTimer = window.setTimeout(() => void pushNow(), overdue ? 0 : PUSH_DEBOUNCE_MS);
}

export function initSync(): void {
  if (!supabase) return;

  supabase.auth.onAuthStateChange((event, session) => {
    // defer supabase calls out of the auth callback (it runs under auth-js's lock)
    if (session?.user && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
      const isNewUser = userId !== session.user.id;
      userId = session.user.id;
      useStore.getState().setAuth(session.user.email ?? '(no email)');
      if (isNewUser || event === 'INITIAL_SESSION') window.setTimeout(() => void reconcile(), 0);
    } else if (event === 'SIGNED_OUT') {
      userId = null;
      clearPushTimer();
      lastSnapshot = null;
      const st = useStore.getState();
      st.setAuth(null);
      st.setLastSyncedAt(null); // a later sign-in starts fresh: cloud wins
      st.setSyncStatus('off');
    }
  });

  useStore.subscribe(() => {
    schedulePush();
  });

  window.addEventListener('online', () => void reconcile());
  window.addEventListener('offline', () => {
    if (userId) setStatus('offline');
  });
  window.addEventListener('focus', () => {
    if (userId && Date.now() - lastReconcileAt >= FOCUS_RECONCILE_MIN_MS) void reconcile();
  });
}

// ---- called by the account UI ----

export const syncConfigured = supabase !== null;

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'sync is not configured in this build';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? error.message : null; // success flows through onAuthStateChange
}

export async function signUp(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'sync is not configured in this build';
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return error.message;
  // with email confirmation disabled a session comes back immediately
  if (!data.session) return 'check your email to confirm the account, then sign in';
  return null;
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function forceSync(): void {
  void reconcile();
}
