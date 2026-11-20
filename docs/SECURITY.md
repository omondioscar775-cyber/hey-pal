# Security and Session Notes

## Current authentication behavior

Verified in `backend/src/controllers/authController.ts`,
`backend/src/middleware/authMiddleware.ts`, and
`frontend/src/lib/api.ts`:

- Passwords are hashed with bcrypt using 12 rounds.
- Login and registration return a signed JWT with a seven-day expiry.
- Protected API routes verify the token signature and expiry.
- The frontend stores the JWT in `localStorage` and attaches it as a bearer token.
- Frontend logout removes the local token only; there is no server-side revocation.
- There is no refresh-token flow, password-reset flow, or account session registry.
- The authentication middleware returns unauthorized responses for missing,
  invalid, and expired tokens, and returns a service error if the JWT secret is
  not configured.

These are implementation facts, not a production-readiness assessment.

## Session lifecycle decision points

Before changing the current contract, decide:

1. Whether sessions should remain stateless or become revocable server-side
   sessions.
2. The access-token lifetime and whether refresh-token rotation is needed.
3. Whether browser credentials should move from `localStorage` to `HttpOnly`,
   `Secure`, `SameSite` cookies. Cookie-based credentials also require a CSRF
   protection strategy.
4. How logout, password changes, account deletion, and suspected credential
   compromise revoke existing sessions.
5. Whether existing clients require a migration or a compatibility period.

No session architecture migration is approved by this note. Keep the existing
API behavior until those decisions, deployment constraints, and migration
requirements are reviewed.

## Verification

`npm test` currently exercises the authentication middleware for valid,
missing, empty, expired, invalid-signature, and missing-secret cases. Resource
ownership and cross-user access for goals, roadmaps, and tasks are tested
through the Express API using stubbed model lookups, so these checks do not
require or modify a MongoDB database. Login rate limiting and end-to-end session
flows still need integration tests.
