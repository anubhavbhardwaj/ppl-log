# Ultimate PPL Log

Phone-first workout log for Jeff Nippard's Ultimate PPL (Phase 1), trained on a 4-day gym week
(Mon, Fri, Sat, Sun) with runs, a home session and mobility on office days (Tue, Wed, Thu).

Static site: plain HTML/JS, Firebase Auth (email + password) and Firestore. No build step.

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

On first sign-in the app records Pull #1 Week 1 as done on 2 Oct 2026 and sets Legs #1 Week 1 as next.
