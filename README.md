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

Everything shares one task list, so nothing's ever double‑entered. Press `1`–`6` to switch modules and `/` to jump to the command bar. Your data stays on your computer — no account, no cloud.

## Run from source

```bash
npm install
npm run dev        # browser dev server (http://localhost:5173)
npm run app        # build + open the desktop window
npm run package    # build the standalone Windows app into release/
```

Built with React + Vite + Zustand, packaged with Electron.
