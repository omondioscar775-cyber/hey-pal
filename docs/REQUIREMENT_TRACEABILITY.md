# MVP requirement traceability

| Requirement | Implementation | Verification scope |
| --- | --- | --- |
| FR-AUTH-01/02 | Auth routes, registration transaction, Next.js session proxy | HTTP integration, built proxy smoke and browser workflows. Hosted smoke pending |
| FR-GOAL-01/02 | Goals and onboarding | Owned API and browser journeys |
| FR-RM-01/02/03 | Roadmap versions, stored draft editor and explicit approval | API transaction and browser draft workflow |
| FR-TASK-01 | Tasks and dependency graph | Owner, DAG and workflow tests |
| FR-PLAN-01/02 | Availability and timed bookings | DST, overlap and concurrency tests. Browser preview and commit |
| FR-FOCUS-01 | Focus lifecycle and persisted timestamps | API transition tests and browser journey |
| FR-REC-01–05 | Detection, options, approval, version and audit | Feasibility, rollback, replay, stale and browser approval tests |
| FR-DASH-01, FR-REV-01 | Dashboard, progress and weekly review | API analytics and browser persistence |
| NFR-SEC, NFR-PRIV | Sessions and owner scopes | Targeted checks. External review and release privacy policy pending |
| NFR-WEB, NFR-ACC, NFR-PERF | Responsive layouts and accessible components | Browser viewport and axe checks. Full conformance and production percentiles pending |
| NFR-REL, NFR-OBS, NFR-MAINT | Transactions, readiness, structured logs, CI, typed APIs | Local build/test evidence. Hosted CI and operational drills pending |
