import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_WEEKLY_SCHEDULE } from "@/lib/business-hours";
import { DEFAULT_TEXT_BACK_TEMPLATE, DEFAULT_TEXT_BACK_TEMPLATE_ES } from "@/lib/missed-call";

const state = vi.hoisted(() => {
  const box = {
    row: null as Record<string, unknown> | null,
    updates: [] as Array<Record<string, unknown>>,
  };

  function from() {
    const api = {
      select() {
        return api;
      },
      eq() {
        return api;
      },
      maybeSingle: async () => ({ data: box.row, error: null }),
      update(patch: Record<string, unknown>) {
        return {
          eq: async () => {
            box.updates.push(patch);
            if (box.row) Object.assign(box.row, patch);
            return { error: null };
          },
        };
      },
    };
    return api;
  }

  return { box, from };
});

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: () => state.from() },
}));

vi.mock("@/lib/app.server", () => ({
  requireAdmin: async () => "admin",
}));

import type { LineAutomationInput } from "./line-automation.server";
import { getLineAutomation, saveLineAutomation } from "./line-automation.server";

const supabase = { from: () => state.from() };

function row(overrides: Record<string, unknown> = {}) {
  return {
    sid: "PN123",
    phone_number: "+15805550100",
    friendly_name: "Shop",
    elevenlabs_agent_id: null,
    messaging_service_sid: null,
    campaign_status: null,
    workspace_id: "ws",
    text_back_enabled: false,
    text_back_template: null,
    text_back_on_ai: false,
    text_back_on_voicemail: false,
    text_back_dedupe_minutes: 60,
    business_hours_enabled: false,
    business_timezone: "America/Chicago",
    business_hours: DEFAULT_WEEKLY_SCHEDULE,
    business_holidays: [],
    after_hours_route: "ai",
    emergency_keywords: ["burst pipe"],
    emergency_transfer_number: null,
    ai_language: "en",
    ...overrides,
  };
}

function input(overrides: Partial<LineAutomationInput> = {}): LineAutomationInput {
  return {
    sid: "PN123",
    textBackEnabled: true,
    textBackTemplate: DEFAULT_TEXT_BACK_TEMPLATE,
    textBackOnAi: false,
    textBackOnVoicemail: false,
    textBackDedupeMinutes: 60,
    businessHoursEnabled: false,
    businessTimezone: "America/Chicago",
    schedule: DEFAULT_WEEKLY_SCHEDULE,
    holidays: [],
    afterHours: "ai",
    emergencyKeywords: ["burst pipe"],
    emergencyTransferNumber: null,
    language: "en",
    ...overrides,
  };
}

afterEach(() => {
  state.box.row = null;
  state.box.updates = [];
});

describe("line answering language", () => {
  it("loads en by default and shows the Spanish default on a Spanish line", async () => {
    state.box.row = row({ ai_language: null, text_back_template: null });
    await expect(getLineAutomation(supabase as never, "user", "PN123")).resolves.toMatchObject({
      language: "en",
      textBackTemplate: DEFAULT_TEXT_BACK_TEMPLATE,
    });

    state.box.row = row({ ai_language: "es", text_back_template: null });
    const spanish = await getLineAutomation(supabase as never, "user", "PN123");
    expect(spanish.language).toBe("es");
    expect(spanish.textBackTemplate).toBe(DEFAULT_TEXT_BACK_TEMPLATE_ES);

    state.box.row = row({
      ai_language: "es",
      text_back_template: "Text the shop at 555-0100.",
    });
    const custom = await getLineAutomation(supabase as never, "user", "PN123");
    expect(custom.textBackTemplate).toBe("Text the shop at 555-0100.");
  });

  it("saves es and auto without calling ElevenLabs when the line has no agent", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    state.box.row = row();
    const saved = await saveLineAutomation(supabase as never, "user", input({ language: "es" }));
    expect(saved.language).toBe("es");
    expect(state.box.row?.["ai_language"]).toBe("es");
    expect(saved.languageSync).toEqual({
      synced: false,
      detail: "This line has no AI agent yet.",
    });
    expect(state.box.row?.["text_back_template"]).toBe(DEFAULT_TEXT_BACK_TEMPLATE);
    expect(saved.textBackTemplate).toBe(DEFAULT_TEXT_BACK_TEMPLATE_ES);

    const auto = await saveLineAutomation(supabase as never, "user", input({ language: "auto" }));
    expect(auto.language).toBe("auto");
    expect(state.box.row?.["ai_language"]).toBe("auto");

    const english = await saveLineAutomation(supabase as never, "user", {
      ...input(),
      language: "fr" as "en",
    });
    expect(english.language).toBe("en");
    expect(state.box.row?.["ai_language"]).toBe("en");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("keeps a custom missed-call text when Spanish is saved", async () => {
    state.box.row = row();
    const saved = await saveLineAutomation(
      supabase as never,
      "user",
      input({ language: "es", textBackTemplate: "Text the shop at 555-0100." }),
    );
    expect(saved.textBackTemplate).toBe("Text the shop at 555-0100.");
    expect(state.box.row?.["text_back_template"]).toBe("Text the shop at 555-0100.");
    expect(state.box.row?.["ai_language"]).toBe("es");
  });
});
