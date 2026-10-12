import { describe, expect, it } from "vitest";

import { MailboxError } from "../mail/errors.js";
import { permissionForRequest } from "../auth/permissions.js";
import { sanitizeAuditMetadata } from "../lib/security-audit.js";
import { testSendSchema } from "../validation/mail.js";
import {
  buildTestListSummary,
  planTestListRecipients,
  rejectsClientRecipientBatch,
  sendEligibleRecipients,
  testListAuditMetadata,
  testMessageListRecipientLimit,
  type FrozenRecipient,
} from "../services/test-list-plan.js";

const message = {
  subject: "Complete Your Registration",
  text: "Hello",
  confirm: true as const,
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
};

describe("test list eligibility", () => {
  it("keeps subscribed addresses and skips suppressed, unsubscribed, invalid, and duplicates", () => {
    const plan = planTestListRecipients(
      [
        { contactId: "b", email: "QA@Example.com", subscriptionStatus: "subscribed" },
        { contactId: "a", email: "qa@example.com", subscriptionStatus: "subscribed" },
        { contactId: "c", email: "blocked@example.com", subscriptionStatus: "subscribed" },
        { contactId: "d", email: "gone@example.com", subscriptionStatus: "unsubscribed" },
        { contactId: "e", email: "not-an-email", subscriptionStatus: "subscribed" },
        { contactId: "f", email: "pending@example.com", subscriptionStatus: "pending" },
      ],
      new Set(["blocked@example.com"]),
    );
    expect(plan.eligible).toEqual([{ contactId: "a", email: "qa@example.com" }]);
    expect(plan.duplicates).toBe(1);
    expect(plan.suppressed).toBe(1);
    expect(plan.skipped).toBe(3);
    expect(plan.requested).toBe(6);
  });
});

describe("test list safety", () => {
  it("uses a conservative default and ignores an oversized cap", () => {
    expect(testMessageListRecipientLimit({})).toBe(8);
    expect(testMessageListRecipientLimit({ TEST_MESSAGE_MAX_LIST_RECIPIENTS: "4" })).toBe(4);
    expect(testMessageListRecipientLimit({ TEST_MESSAGE_MAX_LIST_RECIPIENTS: "100" })).toBe(8);
  });

  it("rejects a client-supplied recipient array and ordinary list payloads", () => {
    expect(rejectsClientRecipientBatch({ recipients: ["a@example.com"] })).toBe(true);
    expect(rejectsClientRecipientBatch({ to: ["a@example.com"], cc: [], bcc: [] })).toBe(true);
    expect(rejectsClientRecipientBatch({ recipientMode: "test_list", testListId: message.idempotencyKey })).toBe(false);
    expect(testSendSchema.safeParse({ ...message, testRecipient: "qa@example.com" }).success).toBe(true);
    expect(
      testSendSchema.safeParse({ ...message, recipientMode: "test_list", testListId: message.idempotencyKey }).success,
    ).toBe(true);
    expect(testSendSchema.safeParse({ ...message, recipientMode: "test_list" }).success).toBe(false);
    expect(permissionForRequest("/api/mail/test-send", "POST")).toBe("mailbox.send_test");
    expect(permissionForRequest("/api/mail/test-lists", "GET")).toBe("mailbox.send_test");
    expect(permissionForRequest("/api/contact-lists/list-1", "PATCH")).toBe("lists.update");
  });
});

describe("separate test-list submissions", () => {
  const recipients: FrozenRecipient[] = [
    { contactId: "1", email: "one@example.com" },
    { contactId: "2", email: "two@example.com" },
    { contactId: "3", email: "three@example.com" },
  ];

  it("submits one address at a time and keeps earlier accepts when one recipient is rejected", async () => {
    const calls: string[] = [];
    const { attempts, sharedFailure } = await sendEligibleRecipients({
      recipients,
      alreadyRecorded: new Set(["1"]),
      sendOne: async (recipient) => {
        calls.push(recipient.email);
        if (recipient.email === "three@example.com") return "rejected";
        return "accepted";
      },
    });
    expect(calls).toEqual(["two@example.com", "three@example.com"]);
    expect(calls.every((email) => !email.includes(","))).toBe(true);
    expect(sharedFailure).toBeNull();
    expect(attempts.map((attempt) => attempt.outcome)).toEqual(["accepted", "rejected"]);
    const summary = buildTestListSummary({
      listId: "list-1",
      listName: "Internal QA",
      requested: 4,
      eligible: 3,
      suppressed: 1,
      skipped: 0,
      attempts,
      priorAccepted: 1,
      sharedFailure: null,
    });
    expect(summary.smtpAccepted).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.status).toBe("completed");
  });

  it("stops after a shared SMTP failure without marking earlier accepts as failed", async () => {
    const calls: string[] = [];
    const { attempts, sharedFailure } = await sendEligibleRecipients({
      recipients,
      alreadyRecorded: new Set(),
      sendOne: async (recipient) => {
        calls.push(recipient.email);
        if (calls.length === 2) {
          throw new MailboxError("Outgoing mail server rejected the mailbox credentials.", 502, "SMTP_SEND_FAILED");
        }
        return "accepted";
      },
    });
    expect(calls).toEqual(["one@example.com", "two@example.com"]);
    expect(attempts).toEqual([
      { contactId: "1", email: "one@example.com", outcome: "accepted" },
    ]);
    expect(sharedFailure).toContain("credentials");
    const summary = buildTestListSummary({
      listId: "list-1",
      listName: "Internal QA",
      requested: 3,
      eligible: 3,
      suppressed: 0,
      skipped: 0,
      attempts,
      sharedFailure,
    });
    expect(summary.smtpAccepted).toBe(1);
    expect(summary.failed).toBe(0);
    expect(summary.status).toBe("failed");
    const metadata = sanitizeAuditMetadata(testListAuditMetadata(summary));
    expect(JSON.stringify(metadata)).not.toContain("@");
    expect(metadata).not.toHaveProperty("html");
    expect(metadata).not.toHaveProperty("recipients");
    expect(metadata).toMatchObject({
      listId: "list-1",
      eligibleCount: 3,
      acceptedCount: 1,
    });
  });
});
