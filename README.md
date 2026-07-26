# TermDeck

A retro terminal–style productivity desktop app for Windows. One connected workspace for your day — to‑do list, kanban board, calendar, notes, a Pomodoro focus timer, and a Snake break game — all sharing the same tasks, with everything saved locally on your PC.

## Download (Windows)

Grab the latest build from the **[Releases page](https://github.com/tatetimeusa/TermDeck/releases)** → download `TermDeck-windows-x64.zip` → unzip → run `TermDeck.exe`.

> On first launch Windows shows a blue *"Windows protected your PC"* notice, because the app isn't code‑signed. Click **More info → Run anyway**. It's a personal app — nothing is installed system‑wide, and it runs entirely offline.

## Modules

- **TODO** — tasks with priority, due dates, and filters
- **BOARD** — drag‑and‑drop kanban (To Do / Doing / Done)
- **CALENDAR** — month view; tasks with due dates show up automatically
- **NOTES** — multiple notes, autosaved as you type
- **FOCUS** — a Pomodoro timer that logs focus time against each task
- **ARCADE** — Snake, unlocked by the break time you earn while focusing
- **GOALS / STREAKS** — date‑ranged goals with daily check‑ins
- **REMINDERS** — one‑off or repeating reminders, with Windows notifications

Everything shares one task list, so nothing's ever double‑entered. Press `1`–`9` to switch modules and `/` to jump to the command bar. Your data lives on your computer; signing in (optional) syncs it to your other machines.

## Sync & accounts

Sync is optional — the app is fully usable signed out. Click the **SYNC** badge (or run `/login`) to sign in with an email and password, and your tasks, notes, goals and reminders follow the account across computers.

**Forgot your password?** Click *forgot password?* on the sign‑in form, or run `/forgot`. You'll get an emailed code, paste it into the app, then pick a new password. **Ignore the link in the email** — the desktop app can't open it, since it runs from a local file rather than a web address. The code is what works.

Finishing a reset also signs you in, and a first sign‑in on a machine takes the cloud copy of your deck. To change a password you already know, use **CHANGE PASSWORD** in the account panel (or `/passwd`).

### Supabase setup (self‑hosters)

Sync needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`, a `decks` table (one row per user, a `jsonb` `data` column, RLS on `user_id`), and two Auth settings — **without the first one, password reset cannot work**:

1. **Auth → Emails → Templates → Reset Password**: include `{{ .Token }}` (that's the code the app asks for). Drop `{{ .ConfirmationURL }}` — the link goes somewhere the packaged app can't receive.
2. **Project Settings → Authentication → SMTP**: point it at a real email sender (Resend, Postmark, SES). Supabase's built‑in sender only reaches project team addresses and allows a handful of emails per hour, so reset codes won't arrive for anyone else. Raise **Auth → Rate Limits → emails** to match.

Leave *Secure password change* off, or changing a password will also require re‑entering the old one.

## Run from source

```bash
npm install
npm run dev        # browser dev server (http://localhost:5173)
npm run app        # build + open the desktop window
npm run package    # build the standalone Windows app into release/
```

Built with React + Vite + Zustand, packaged with Electron.
