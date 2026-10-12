# Audit log security

## Access control

- Permission: `audit.read` (see `server/auth/permissions.ts`)
- Enforced on every `/api/admin/audit*` route via `requirePermission`
- Navigation visibility is not sufficient; API checks are mandatory

## Data minimization

`sanitizeAuditMetadata()` strips keys such as passwords, tokens, SMTP/IMAP secrets, message bodies, and raw SMTP payloads.

Never log: passwords, session tokens, reset/invite tokens, 2FA secrets, recovery codes, full email bodies, CSV uploads.

## Immutability

- Application exposes **no** update/delete endpoints for audit rows
- Records are append-only through `recordAuditEvent` / `recordAudit`
- Database-level immutability is **not** enforced (DB admin can still mutate rows)

## Request context

IP and user agent are taken from `x-forwarded-for` / `x-real-ip` and `user-agent` (Vercel-compatible). Actor identity is always derived from server session, not client JSON.

## Reliability

- Auth audit failures are swallowed (logged server-side) so login UX is unaffected
- External SMTP outcomes are recorded on submission rows first; audit insert failures are logged and do not resend mail
- Critical admin mutations should move toward same-transaction audit where feasible (ongoing)

## Retention

No automatic deletion is configured. Define organizational retention separately before enabling cleanup jobs.
