import { describe, expect, it } from "vitest";

import { continueInboundDial, chooseInboundAnswer, MAX_SIMULTANEOUS_CLIENTS } from "./inbound-ring";
import { planInboundRing, type PresenceHit } from "./ring-targets";
import {
  forwardedCallTwiml,
  inboundClientDialTwiml,
  inboundRingActionUrl,
} from "./voice-answer.server";

const NOW = Date.parse("2026-09-26T12:00:00Z");

function hit(overrides: Partial<PresenceHit> = {}): PresenceHit {
  return {
    userId: "user-a",
    workspaceId: "workspace-a",
    identity: "client:a",
    lastSeenAt: "2026-09-26T11:59:40Z",
    ...overrides,
  };
}

describe("planInboundRing", () => {
  it("rings only present assignees of the called workspace", () => {
    const plan = planInboundRing({
      workspaceId: "workspace-a",
      assignedUserIds: ["user-a", "user-b"],
      ownerCell: "+15555550100",
      aiEnabled: true,
      now: NOW,
      presence: [
        hit(),
        hit({
          userId: "user-b",
          workspaceId: "workspace-b",
          identity: "client:b",
        }),
        hit({
          userId: "user-c",
          identity: "client:c",
        }),
        hit({
          userId: "user-a",
          identity: "client:a-duplicate",
        }),
        hit({
          userId: "user-b",
          identity: "client:stale",
          lastSeenAt: "2026-09-26T11:58:00Z",
        }),
      ],
    });
    expect(plan.identities).toEqual(["client:a"]);
    expect(plan.userIds).toEqual(["user-a"]);
    expect(plan.fallback).toBe("owner_cell");
    expect(plan.ownerCell).toBe("+15555550100");
  });

  it("falls back to the owner cell, then AI, then voicemail", () => {
    const base = {
      workspaceId: "workspace-a",
      assignedUserIds: ["user-a"],
      presence: [] as PresenceHit[],
      now: NOW,
    };
    expect(
      planInboundRing({ ...base, ownerCell: " +15555550100 ", aiEnabled: true }),
    ).toMatchObject({ identities: [], fallback: "owner_cell", ownerCell: "+15555550100" });
    expect(planInboundRing({ ...base, ownerCell: "  ", aiEnabled: true })).toMatchObject({
      identities: [],
      fallback: "ai",
      ownerCell: null,
    });
    expect(planInboundRing({ ...base, ownerCell: null, aiEnabled: false })).toMatchObject({
      identities: [],
      fallback: "voicemail",
      ownerCell: null,
    });
  });
});

describe("chooseInboundAnswer", () => {
  it("prefers simultaneous present clients, then the cell, then AI", () => {
    expect(
      chooseInboundAnswer({
        identities: ["client:a", "client:b"],
        fallback: "owner_cell",
        ownerCell: "+15555550100",
      }),
    ).toEqual({ kind: "clients", identities: ["client:a", "client:b"] });
    expect(
      chooseInboundAnswer({ identities: [], fallback: "owner_cell", ownerCell: "+15555550100" }),
    ).toEqual({ kind: "owner_cell", cell: "+15555550100" });
    expect(chooseInboundAnswer({ identities: [], fallback: "ai", ownerCell: null })).toEqual({
      kind: "ai",
    });
    expect(chooseInboundAnswer({ identities: [], fallback: "voicemail", ownerCell: null })).toEqual(
      { kind: "ai" },
    );
  });

  it("caps a client dial at ten simultaneous legs", () => {
    const identities = Array.from({ length: 12 }, (_, index) => `client:${index}`);
    const choice = chooseInboundAnswer({ identities, fallback: "ai", ownerCell: null });
    expect(choice).toMatchObject({ kind: "clients" });
    if (choice.kind !== "clients") return;
    expect(choice.identities).toHaveLength(MAX_SIMULTANEOUS_CLIENTS);
  });
});

describe("inbound client TwiML", () => {
  it("dials every present client and points the action at dial-action", () => {
    const actionUrl = inboundRingActionUrl("clients");
    const twiml = inboundClientDialTwiml({
      record: false,
      callerId: "+15555550123",
      timeoutSeconds: 24,
      actionUrl,
      clientIdentities: ["client:a", "client:b"],
    });
    expect(twiml).toContain("<Client>client:a</Client>");
    expect(twiml).toContain("<Client>client:b</Client>");
    expect(twiml).toContain('answerOnBridge="true"');
    expect(twiml).toContain("/api/public/twilio/dial-action");
    expect(twiml).toContain("leg=clients");
    expect(actionUrl).toContain("leg=clients");
  });

  it("dials the owner cell with the same action pattern as a forwarded call", () => {
    const actionUrl = inboundRingActionUrl("owner_cell");
    const twiml = forwardedCallTwiml({
      record: false,
      callerId: "+15807450045",
      destination: "+15555550100",
      timeoutSeconds: 24,
      actionUrl,
    });
    expect(twiml).toContain("<Number>+15555550100</Number>");
    expect(twiml).toContain("leg=owner_cell");
    expect(twiml).toContain('timeout="24"');
    expect(twiml).toContain('ringTone="us"');
    expect(twiml).not.toContain("<Client>");
  });
});

describe("continueInboundDial", () => {
  it.each(["no-answer", "busy", "failed", "canceled"] as const)(
    "continues an unanswered %s client leg to the owner cell, then AI",
    (dialStatus) => {
      expect(
        continueInboundDial({ dialStatus, leg: "clients", ownerCell: "+15555550100" }),
      ).toEqual({ kind: "owner_cell", cell: "+15555550100" });
      expect(continueInboundDial({ dialStatus, leg: "clients", ownerCell: "  " })).toEqual({
        kind: "ai",
      });
      expect(
        continueInboundDial({ dialStatus, leg: "owner_cell", ownerCell: "+15555550100" }),
      ).toEqual({ kind: "ai" });
    },
  );

  it.each(["completed", "answered", ""] as const)(
    "ends the call when DialCallStatus is %s",
    (dialStatus) => {
      expect(
        continueInboundDial({ dialStatus, leg: "clients", ownerCell: "+15555550100" }),
      ).toEqual({ kind: "end" });
    },
  );

  it("leaves dials outside the ring chain alone", () => {
    expect(
      continueInboundDial({ dialStatus: "no-answer", leg: null, ownerCell: "+15555550100" }),
    ).toEqual({ kind: "end" });
  });
});
