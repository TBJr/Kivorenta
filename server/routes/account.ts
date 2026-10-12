import type { Context, Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "../auth/auth.js";
import { parseRoleKeys } from "../auth/permissions.js";
import { createDb } from "../db/index.js";
import { user } from "../db/schema.js";
import { loadEnv } from "../env.js";
import { defaultTwoFactorEnforcementDate, loadAccountSecurityState } from "../lib/account-security.js";
import { validationError } from "../lib/http-errors.js";
import { validatePassword } from "../lib/password-policy.js";
import { clientIpFromRequest, userAgentFromRequest } from "../lib/request-context.js";
import { getSessionUser } from "../lib/session.js";
import { recordAudit } from "../services/audit-log.js";

const env = loadEnv();
const { db } = createDb(env);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  revokeOtherSessions: z.boolean().optional(),
});

function json(c: Context, body: unknown, status: 200 | 400 | 401 | 403 | 500 = 200) {
  c.header("Cache-Control", "no-store");
  return c.json(body, status);
}

export function registerAccountRoutes(app: Hono) {
  app.get("/api/account/security", async (c) => {
    const account = await getSessionUser(c.req.raw.headers);
    if (!account) return json(c, { error: "Unauthorized" }, 401);
    const state = await loadAccountSecurityState(db, account.id);
    if (!state) return json(c, { error: "Unauthorized" }, 401);
    return json(c, {
      security: {
        mustChangePassword: state.mustChangePassword,
        twoFactorEnabled: state.twoFactorEnabled,
        twoFactorEnforcementRequired: state.twoFactorEnforcementRequired,
        twoFactorEnforcementAfter: state.twoFactorEnforcementAfter,
        isSuperAdmin: state.isSuperAdmin,
      },
    });
  });

  app.post("/api/account/change-password", async (c) => {
    const account = await getSessionUser(c.req.raw.headers);
    if (!account) return json(c, { error: "Unauthorized" }, 401);

    const parsed = changePasswordSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return json(c, validationError(parsed.error), 400);

    const policyError = validatePassword(parsed.data.newPassword);
    if (policyError) return json(c, { error: policyError }, 400);

    if (parsed.data.newPassword === parsed.data.currentPassword) {
      return json(c, { error: "Choose a password that is different from your current password." }, 400);
    }

    const ip = clientIpFromRequest(c);
    const userAgent = userAgentFromRequest(c);

    try {
      await auth.api.changePassword({
        headers: c.req.raw.headers,
        body: {
          currentPassword: parsed.data.currentPassword,
          newPassword: parsed.data.newPassword,
          revokeOtherSessions: parsed.data.revokeOtherSessions ?? true,
        },
      });
    } catch (error) {
      await recordAudit(db, {
        actorUserId: account.id,
        targetUserId: account.id,
        action: "password_change_failed",
        eventType: "password",
        result: "failure",
        ipAddress: ip,
        userAgent,
        metadata: { reason: "change_password_rejected" },
      });
      const message = error instanceof Error ? error.message : "Password change failed.";
      return json(c, { error: message }, 400);
    }

    const isSuperAdmin = parseRoleKeys((account as { role?: string }).role).includes("super-admin");
    await db
      .update(user)
      .set({
        mustChangePassword: false,
        twoFactorEnforcementAfter: isSuperAdmin ? defaultTwoFactorEnforcementDate() : null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, account.id));

    await recordAudit(db, {
      actorUserId: account.id,
      targetUserId: account.id,
      action: "password_changed",
      eventType: "password",
      result: "success",
      ipAddress: ip,
      userAgent,
      metadata: { revokeOtherSessions: parsed.data.revokeOtherSessions ?? true },
    });

    return json(c, { ok: true, mustChangePassword: false });
  });
}
