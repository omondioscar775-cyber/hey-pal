# CircleUp security and sessions

- Express signs only HS256 JWTs with an expiry. New tokens carry a managed session ID. Each protected call with a managed token checks expiry, revocation, account status, and the credential stamp. The Next.js proxy stores the token in an HttpOnly, SameSite=Lax cookie with Secure enabled in production.
- Browser writes use the same-origin JSON proxy. It rejects cross-site mutations reported by Fetch Metadata and permits only known application paths. Express authenticates with a bearer header.
- Logout revokes the managed session before the proxy clears the browser cookie. Enable `REQUIRE_MANAGED_SESSIONS=true` to invalidate legacy tokens during cutover. Production enables it by default.
- Passwords use bcrypt with 12 rounds. New passwords respect the 72-byte bcrypt input limit. Password-reset tokens are random, single-use, stored by hash and checked against their expiry. Reset revokes managed sessions and advances the credential stamp in one transaction.
- The reset provider uses an independent secret and HTTPS. It must keep URLs, reset tokens and credentials out of logs. Delivery uses a synchronous webhook. Test it and review response-timing exposure in staging.
- Resource operations derive owner identity from the authenticated request. Linked joins are scoped to the owner. Task dependencies are checked against the goal graph and concurrent updates share a transaction guard. Proposal approval revalidates the current planning state before applying changes.
- The API uses Helmet, configured CORS origins, per-process rate limiting, bounded JSON and sanitized errors with request IDs. Place production API traffic behind a gateway. Review distributed abuse controls and permissions at deployment.
- Before launch, confirm HTTPS, least-privilege MongoDB access, privacy retention policy, audit retention, monitoring, and backup restore procedures.

See [backend operations and verification](BACKEND.md) for the verification scope.
