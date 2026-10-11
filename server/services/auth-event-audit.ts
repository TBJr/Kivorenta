import { parseRoleKeys } from "../auth/permissions.js";
import type { Database } from "../db/index.js";
import { clientIpFromHeaders, userAgentFromHeaders } from "../lib/request-context.js";
import { getSessionUser } from "../lib/session.js";
import { recordAudit } from "./admin.js";

const AUDITED_AUTH_SUFFIXES: Array<{ suffix: string; action: string; eventType: string; privilegedOnly?: boolean }> = [
  { suffix: "/sign-in/email", action: "auth_sign_in", eventType: "authentication", privilegedOnly: true },
  { suffix: "/two-factor/enable", action: "two_factor_enabled", eventType: "two_factor" },
  { suffix: "/two-factor/disable", action: "two_factor_disabled", eventType: "two_factor" },
  { suffix: "/two-factor/generate-backup-codes", action: "two_factor_backup_codes_regenerated", eventType: "two_factor" },
];

export async function recordAuthHandlerAudit(input: {
  db: Database;
  path: string;
  method: string;
  status: number;
  headers: Headers;
}) {
  if (input.method !== "POST" || input.status < 200 || input.status >= 300) return;
  const normalized = input.path.split("?")[0] ?? input.path;
  const rule = AUDITED_AUTH_SUFFIXES.find((entry) => normalized.endsWith(entry.suffix));
  if (!rule) return;

  const account = await getSessionUser(input.headers);
  if (!account) return;
  if (rule.privilegedOnly && !parseRoleKeys((account as { role?: string }).role).includes("super-admin")) {
    return;
  }

  await recordAudit(input.db, {
    actorUserId: account.id,
    targetUserId: account.id,
    action: rule.action,
    eventType: rule.eventType,
    result: "success",
    ipAddress: clientIpFromHeaders(input.headers),
    userAgent: userAgentFromHeaders(input.headers),
    metadata: {},
  });
}
