# MVP engineering decisions

- Retain Next.js on Vercel and Express on a separate Node host. Browser requests use the same-origin Next.js proxy.
- Use server-only CIRCLEUP_API_URL. Require HTTPS on Vercel and allow a loopback default for local runtime.
- Preserve managed JWT sessions, the HttpOnly browser cookie and the existing MongoDB replica-set transaction architecture.
- Maintain one Task lifecycle. Calendar bookings store time intervals and focus sessions store elapsed effort.
- Keep embedded ordered milestones, accepted roadmap versions and the roadmap audit event collection. Draft approval checks the saved revision.
- Calendar previews are read-only. Booking commits revalidate server-side and use request keys. Recovery approval continues to use proposal identity, fingerprint, and the account transaction guard.
- Preserve UTC instants and IANA availability zones. The booking form interprets input in the device timezone and shows that timezone explicitly.
