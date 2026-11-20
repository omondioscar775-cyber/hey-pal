# Initial backend audit

The Express modular monolith uses Mongoose, bcrypt, JWT, Zod, Helmet, CORS and a process-local rate limit. Existing clients depend on the unversioned /api paths and success/message envelopes. The Next.js proxy already keeps bearer credentials in an HttpOnly cookie.

| Domain | Existing implementation | Gap |
| --- | --- | --- |
| Authentication | Register, login, current user, signature and expiry checks | Revocation, account state, reset delivery, login throttling |
| Goals | Owned CRUD and archive through status patch | Cascade and bounded list queries |
| Roadmaps | Owned CRUD, unique goal/version, embedded milestones | Draft approval, atomic supersession and audit |
| Tasks | Owned CRUD, date filters, embedded references | Updates bypass dependency validation, no cycle checks or concurrency coordination |
| Planner and recovery | Frontend-only estimates | Availability, reservations, persisted proposals, atomic approval |
| Focus, reviews and analytics | Frontend-only or derived from CRUD | Authoritative history |
| Accountability | Upcoming frontend state | Deferred until release approval |

The database uses ObjectId references. User.password already holds a bcrypt hash and is excluded by default. Preserve this field for existing records. Milestone and dependency storage may remain embedded while bounded and authoritative. Roadmap writes currently supersede the old active version before creating its replacement. Goal deletion currently leaves related data. There is no global JSON error middleware or readiness check. The inspected configuration consumes MONGODB_URI, JWT_SECRET, CLIENT_URL, NODE_ENV and PORT. No backend environment file was present.

Implementation backlog in order: baseline verification, request/error/session foundation, owned transaction guard and integrity fixes, planner reservations, recovery proposals and approval, focus and reviews, API/schema documentation and verification. Use replica-set transactions for dependent writes. Defer Circles and other sharing until separately approved.
