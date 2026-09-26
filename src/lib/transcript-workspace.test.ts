import { describe, expect, it } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import { saveTranscript } from "./intelligence.server";

const WORKSPACE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function adminFor(workspaceId: string | null) {
  const writes: Array<{ table: string; op: string; row: Record<string, unknown> }> = [];
  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      const self = () => builder;
      builder["select"] = self;
      builder["eq"] = self;
      builder["upsert"] = (row: Record<string, unknown>) => {
        writes.push({ table, op: "upsert", row });
        return builder;
      };
      builder["insert"] = (row: Record<string, unknown>) => {
        writes.push({ table, op: "insert", row });
        return builder;
      };
      builder["maybeSingle"] = () =>
        Promise.resolve({
          data: table === "phone_numbers" && workspaceId ? { workspace_id: workspaceId } : null,
          error: null,
        });
      builder["then"] = (
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, writes };
}

describe("call transcript workspace", () => {
  it("stores the transcript under the line's workspace", async () => {
    const { client, writes } = adminFor(WORKSPACE);
    await saveTranscript(client, {
      userId: "11111111-1111-4111-8111-111111111111",
      callSid: "CA-transcript",
      appNumber: "+15807450045",
      source: "elevenlabs",
      turns: [{ speaker: "caller", text: "The sink is leaking." }],
    });
    const row = writes.find((write) => write.table === "call_transcripts");
    expect(row?.row["workspace_id"]).toBe(WORKSPACE);
    expect(row?.row["call_sid"]).toBe("CA-transcript");
  });
});
