# Cadence

Phone-first app for daily life: training, leave and travel. Started as a workout log for Jeff Nippard's
Ultimate PPL (Phase 1) and now also plans vacation, work-from-India days and trips.

Static site: plain HTML and ES modules, Firebase Auth (email + password) and Firestore. No build step.

## Tabs

- **Today**: current or next trip, this week's training, today's gym session or office-day plan.
  On trip days the PPL sequence pauses and a travel session is suggested.
- **Gym**: Phase 1 plan grid, session previews, history.
- **Travel**: leave balances per year, trips with leave blocks, year calendar, Bavarian (Munich)
  public holidays, long weekends and bridge days.

## Code

- `js/app.js`: shell, tabs, Today screen, login
- `js/store.js`: Firebase Auth and Firestore
- `js/gym.js`: program data, office-day plans, workout logging
- `js/leave.js`: holidays, workday counting, budgets, checks, bridges (pure functions)
- `js/travel.js`: Travel tab and trip editor
- `js/util.js`: helpers and shared UI state

## Setup

1. **Firebase**: create a project, then
   - Authentication > Sign-in method: enable Email/Password.
   - Authentication > Users: add your user (there is no sign-up screen in the app).
   - Firestore Database: create it (production mode), then paste `firestore.rules` into the Rules tab and publish.
   - Project settings > Your apps: add a Web app and copy its config into `firebase-config.js`.
2. **Netlify**: Add new site > Import from GitHub > pick this repo.
   Build command: empty. Publish directory: `.`
3. **Firebase Auth domain**: Authentication > Settings > Authorized domains: add your `*.netlify.app` domain.
4. On your phone, open the site and use Add to Home Screen.

## Data

All data lives under `users/{uid}/`:
- `meta/state`: `{ next }`, the index (0-35) of the next session in Phase 1 order.
- `logs/*`: one document per finished gym or office-day session.
- `trips/*`: `{ title, kind, status, depart, return, blocks: [{ type, start, end, carry? }], flex: { departFrom, departTo, nights }, airports: { from, to }, note }`.
  Block types are `vacation`, `yearEnd` and `wfi`. Only weekdays that aren't Bavarian public holidays are charged.
  `carry: true` charges a January block to the previous year (allowed only directly after the year-end block).
  Trips with status `idea` don't count against the balance.
- `leave/{year}`: `{ vacation, yearEnd, wfi }` budgets. Defaults: 30 vacation (6 of them held for year-end) and 15 work from India.

On first sign-in the app records Pull #1 Week 1 as done on 2 Oct 2026 and sets Legs #1 Week 1 as next.
The Travel tab offers to load the 2027 plan when that year has no trips.
