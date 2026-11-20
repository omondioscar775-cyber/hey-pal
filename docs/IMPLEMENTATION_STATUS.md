# CircleUp MVP verification

## Registration and deployment

The public Vercel deployment returned HTTP 401 with "Please sign in." for a signed-out GET to /api/circleup/auth/me. An empty JSON POST to /api/circleup/auth/register returned HTTP 502 with the application's own upstream error message. Both responses matched the Next.js catch-all route. The empty request could not create a user. Express registration itself is public and validates the empty payload as 400 when reachable.

The shipped catch-all could fall back to localhost and merged transport, timeout, and response parsing failures into one 502. The patched route requires a server-side HTTPS CIRCLEUP_API_URL on Vercel, normalizes a root URL or /api suffix, and exposes a sanitized /api/circleup/ready probe. It distinguishes missing configuration, unreachable upstreams, upstream timeouts and malformed responses. Private Vercel settings, Express hosting logs and Atlas connectivity remain unverified. The exact live upstream transport or response failure therefore remains open.

Express 5 calls its app.listen callback on a bind error. The former callback unconditionally reported success and a separate listener reported failure. Startup now waits for the HTTP listening event and reports a single bind failure with an error code. The original port state is unknown.

Registration commits the user and managed session together on the existing replica-set topology. Saved roadmap drafts can be edited and explicitly approved from version history. The Planner offers timed task slots, breaks and fixed commitments with a server preview, explicit confirmation, available capacity and cancellation. Frontend CI builds and runs lint, unit tests and Playwright.

## Deployment gate

Use Vercel Root Directory `frontend`. Set `CIRCLEUP_API_URL` on the Vercel project to the reachable HTTPS Express origin or its /api base. Keep `MONGODB_URI` and `JWT_SECRET` on the Express host. The host supplies `PORT`. Use a replica set or sharded cluster and configure `CLIENT_URL` for the deployed frontend. The Express host's /api/ready and the frontend's /api/circleup/ready should both return 200. Vercel applies environment changes to new deployments, so schedule a new deployment after explicit approval. Production account creation and relay logs require approval and access.

Locally, build both projects with `npm run build`. Run `npm test` in each. With an isolated local replica set, set `CIRCLEUP_TEST_MONGO_URI` in the backend terminal and run `node scripts/verify-mvp.mjs` to exercise the built Next.js proxy and Express against a disposable MongoDB database. The script listens on ports 3172 and 3173.

## Local verification and changed contracts

- Backend `npm test` with the test replica-set URI built TypeScript and passed all 19 tests. The built-proxy smoke command above passed with real MongoDB, including HTTP 400 for invalid registration, 409 for duplicate email, managed-cookie authentication and owned goal persistence. A second listener on the smoke API port exited with EADDRINUSE and emitted no successful-listener event.
- Frontend `npm test`, `npm run lint` and `npm run build` passed. The eight unit tests include canonical upstream URL and hosted configuration checks.
- The proxy receives a new public GET readiness path. Existing browser and Express authentication routes retain their method and payload contracts. Registration changes persistence boundaries and requires no schema migration.
- Changed implementation includes `frontend/src/app/api/circleup/[...path]/route.ts`, `frontend/src/lib/upstream.ts`, `backend/src/server.ts`, `backend/src/controllers/authController.ts`, `backend/src/modules/auth/service.ts`, and `backend/scripts/verify-mvp.mjs`. Workspace changes are in `CalendarPlanner.tsx`, `CreateRoadmapModal.tsx`, `ExecutionWorkspace.tsx`, and the frontend API client. Tests, the environment template and frontend CI were updated alongside them.

**Release decision** Local validation can proceed. Production promotion remains blocked by confirmation of the deployed Express endpoint, Vercel configuration and logs, and authorized production verification.

Frontend `npm run test:e2e` with `CIRCLEUP_BROWSER_CHANNEL=msedge` passed all six desktop, tablet and mobile tests. The browser fixture exercises saved roadmap approval, calendar preview and confirmation, and the complete goal-to-review journey. Axe reported no violations in the scanned landing and Recovery Centre states. The independent built-proxy smoke verified authentication against live local MongoDB.
