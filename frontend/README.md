# CircleUp frontend

CircleUp uses the existing Next.js App Router and Express API. The workspace, marketing pages, forms, dialogs and progress components use the CircleUp design tokens and self-hosted Inter. Desktop includes a collapsible sidebar. Compact layouts show bottom navigation and a keyboard-accessible More dialog.

## Run locally

From the outer `Heypal` folder in PowerShell, enter the repository first.

```powershell
cd .\hey-pal
```

Open a terminal in this repository folder for each process below. Use `npm.cmd` in PowerShell if your execution policy blocks `npm.ps1`.

1. In `backend`, run `npm ci`. Configure a replica-set `MONGODB_URI` and `JWT_SECRET` in the backend environment, then run `npm run dev`. See [backend setup](../docs/BACKEND.md).
2. In `frontend`, run `npm ci` and `npm run dev`. Open the local URL printed by Next.js.
3. Set `CIRCLEUP_API_URL` in the frontend server environment if Express uses an address other than `http://localhost:5000/api`. Production requires a Next.js server runtime, HTTPS, and a reachable Express API.

The same-origin Next.js proxy forwards the JWT to Express using its existing bearer contract. The browser receives the user record and an HttpOnly session cookie. Browsers upgrading from an earlier version clear the legacy stored token and sign in again.

## Implementation status

| Route | Implemented behavior |
| --- | --- |
| `/` | Marketing and a labeled example workspace |
| `/login`, `/register` | Account forms, server validation, session establishment and navigation |
| `/forgot-password`, `/reset-password` | Reset request/completion forms with configured backend mail delivery |
| `/onboarding` | Six-step goal wizard with editable review and authenticated save |
| `/dashboard` | Personal goals, priorities, weekly activity, deadlines and recovery summary from API data |
| `/goals`, `/goals/[id]` | Search, filter and sort, goal details, edit, confirmed deletion and linked history |
| `/roadmaps` | Goal selector, editable draft, target-date warning, explicit activation, version history and milestone completion |
| `/planner` | Today, This Week, Upcoming and Overdue views, per-goal workload, task creation, rescheduling, completion, reopening and confirmed deletion |
| `/tasks` | Redirect to Planner |
| `/focus` | Task selection, duration target, start/pause/resume, server-recorded elapsed time and reflection |
| `/recovery` | Missed work and direct dependency impact, weekly estimates, three server-generated comparisons, previews and explicit approval |
| `/progress` | Milestone and goal achievements, task activity by scheduled day and persisted weekly reflection |
| `/settings` | Account readout and availability by preference section |
| `/circles` | Upcoming state for private, opt-in accountability |

## Backend integration details

The workspace uses the existing goal, roadmap and task APIs. Availability, managed logout, password reset, verified recovery options and approval, focus sessions, and weekly review writes use the expanded backend APIs. Calendar reservations and capacity are available through the API. The Planner UI includes an availability editor and retains date-based task scheduling. Full account preferences, Circle invitations and sharing, and launch-jurisdiction data policy remain pending.
## Verification

Run `npm run lint`, `npm test` and `npm run build` from `frontend`. The unit tests require Node.js 24. Install the default browser with `npx playwright install chromium`, then run `npm run test:e2e`. To use an existing Microsoft Edge installation, set `CIRCLEUP_BROWSER_CHANNEL=msedge`.

Playwright starts the production Next.js frontend and a deterministic HTTP fixture for the tested Express response contracts. Desktop, emulated tablet and emulated mobile tests exercise authentication errors, session cookies, onboarding, goal edits, roadmap approval, planner capacity, the focus timer, recovery previews and logout. Axe scans the landing and populated Recovery Centre. The browser suite prints local landing LCP and CLS measurements. A production Core Web Vitals assessment needs real-user percentile data.

The Express tests run separately from `backend` with `npm test`. They exercise JWT handling and ownership checks with stubbed model lookups. The browser and Express suites use isolated test data. A live MongoDB journey needs a configured backend database.

The recorded Windows verification passed the production build, ESLint, five frontend unit tests, six Edge browser tests and twelve Express tests. Axe reported zero violations in the scanned landing and populated Recovery Centre states. Local landing LCP was 692 ms on desktop, 616 ms on the tablet preset and 564 ms on the mobile preset. CLS was 0.003 or lower on all three.
