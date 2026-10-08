# ADR 0001: Same-origin opaque cookie sessions

- Status: Accepted
- Date: 2026-10-08

## Context

The console needs multi-user authentication and strict owner isolation. The
frontend and API deploy separately, but cross-origin cookies add CORS,
`SameSite=None`, and browser-policy complexity.

## Decision

Next.js rewrites `/api/*` to FastAPI. The browser therefore sees one origin.
After sign-in, FastAPI sets an opaque session token in an `HttpOnly`,
`SameSite=Lax` cookie. Only the token's SHA-256 hash is stored in SQLite.
Passwords use Argon2. Production cookies require HTTPS, and failed sign-ins are
rate-limited.

## Consequences

- Browser JavaScript cannot read the session token.
- A database leak does not expose usable session tokens or plaintext passwords.
- Production does not need cross-origin API requests.
- Vercel must know the backend URL at build time.
- API clients outside the web app must maintain the cookie explicitly.
