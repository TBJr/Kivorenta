# Audit log event taxonomy

Canonical constants: `server/lib/audit-taxonomy.ts` (`AUDIT_ACTIONS`, `AUDIT_CATEGORIES`).

## Categories

`AUTHENTICATION`, `SECURITY`, `USER_MANAGEMENT`, `ROLE_MANAGEMENT`, `EMAIL`, `MAILBOX`, `DRAFT`, `CONTACT`, `RECIPIENT_LIST`, `SUPPRESSION`, `CAMPAIGN`, `QUEUE`, `SETTINGS`, `ADMINISTRATION`, `ACTIVITY`, `SYSTEM`.

## Representative actions

| Action | Category | Notes |
| --- | --- | --- |
| `auth_sign_in` / `auth_sign_in_failed` | AUTHENTICATION | All successful sign-ins; no password or email-existence hints on failure |
| `auth_sign_out` | AUTHENTICATION | |
| `password_changed` / `password_change_failed` | SECURITY | |
| `two_factor_*` | SECURITY | |
| `user.*`, `user_updated`, `invitation_*` | USER_MANAGEMENT | Existing admin flows |
| `role_*` | ROLE_MANAGEMENT | |
| `email_send_requested`, `email_smtp_accepted`, `email_smtp_rejected`, `email_smtp_failed` | EMAIL | Submission id + recipient count only |
| `draft_created` / `updated` / `deleted` | DRAFT | |
| `contact_created` / `contact_updated` / `contact_deleted` / `contacts_imported` | CONTACT | No PII in metadata |
| `contact_list_created` / `updated` / `deleted` | RECIPIENT_LIST | |
| `suppression_created` | SUPPRESSION | |
| `page_viewed` | ACTIVITY | SPA routes; server dedupes same actor+path within 30s |
| `admin_access_denied` | ADMINISTRATION | Permission check failures |
| `campaign_simulation_requested` | CAMPAIGN | Simulation only |
| `campaign_simulation_completed` / `failed` | CAMPAIGN | Worker summary |
| `campaign_cancelled` | CAMPAIGN | |
| `queue_simulation_job_failed` | QUEUE | Terminal failures only |

Campaign-specific history remains in `campaign_events`; queue pipeline detail in `queue_events`.
