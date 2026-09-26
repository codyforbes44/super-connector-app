import { describe, expect, it } from "vitest";

import {
  NOT_SPAM_ORS,
  SPAM_BLOCKED_OR,
  callStory,
  callerListForNumber,
  describeLineType,
  describeSpamScore,
  describeStir,
  isSpamBlocked,
  matchesScreening,
  otherPartyNumber,
  sameCallerNumber,
  spamFacts,
} from "./call-spam";

describe("isSpamBlocked", () => {
  it("treats gate action, status, and answer path as blocked spam", () => {
    expect(isSpamBlocked({ spam_action: "block" })).toBe(true);
    expect(isSpamBlocked({ spam_action: "Blocked" })).toBe(true);
    expect(isSpamBlocked({ status: "blocked" })).toBe(true);
    expect(isSpamBlocked({ answer_path: "spam" })).toBe(true);
  });

  it("leaves a normal missed call alone", () => {
    expect(
      isSpamBlocked({
        spam_action: "allow",
        status: "no-answer",
        answer_path: "voicemail",
      }),
    ).toBe(false);
    expect(isSpamBlocked({})).toBe(false);
  });
});

describe("callStory", () => {
  it("does not describe a blocked spam call as missed", () => {
    const story = callStory({
      direction: "inbound",
      status: "blocked",
      spam_action: "block",
      answer_path: "spam",
      spam_reason: "Known spam (StirVerstat Failed, non-fixed VoIP).",
    });
    expect(story).toBe("Stopped before it rang. This looks like spam.");
    expect(story.toLowerCase()).not.toContain("missed");
  });

  it("says when the number is already on the block list", () => {
    expect(
      callStory({
        direction: "inbound",
        spam_action: "block",
        spam_reason: "On the block list.",
      }),
    ).toBe("On your block list, so it never rang.");
  });

  it("keeps the ordinary missed and answered stories", () => {
    expect(callStory({ direction: "inbound", status: "no-answer" })).toBe("Missed call");
    expect(callStory({ direction: "outbound", status: "busy" })).toBe("No answer");
    expect(callStory({ direction: "inbound", status: "completed", answered_by: "ai" })).toBe(
      "Answered by receptionist",
    );
  });
});

describe("matchesScreening", () => {
  const spam = { status: "blocked", answer_path: "spam", spam_action: "block" };
  const missed = { status: "no-answer", spam_action: "allow" };

  it("filters spam and normal calls", () => {
    expect(matchesScreening(spam, "all")).toBe(true);
    expect(matchesScreening(missed, "all")).toBe(true);
    expect(matchesScreening(spam, "spam")).toBe(true);
    expect(matchesScreening(missed, "spam")).toBe(false);
    expect(matchesScreening(spam, "normal")).toBe(false);
    expect(matchesScreening(missed, "normal")).toBe(true);
  });
});

describe("spam facts", () => {
  it("turns score, line type, and STIR into plain language", () => {
    expect(describeSpamScore(82)).toBe("82 out of 100");
    expect(describeSpamScore(null)).toBe("Not scored");
    expect(describeLineType("nonFixedVoip")).toBe("Non-fixed VoIP — often used by robocallers");
    expect(describeLineType("mobile")).toBe("Mobile phone");
    expect(describeStir("Failed")).toContain("could not verify");
    expect(describeStir("A")).toContain("vouches");
    expect(describeStir(null)).toContain("No carrier attestation");

    const facts = spamFacts({
      spam_action: "block",
      spam_score: 82,
      spam_reason: "Known spam (StirVerstat Failed, non-fixed VoIP).",
      line_type: "nonFixedVoip",
      stir_verstat: "Failed",
      status: "blocked",
      answer_path: "spam",
    });
    expect(facts.map((fact) => fact.label)).toEqual([
      "Screening",
      "Spam score",
      "Why",
      "Line type",
      "Carrier check",
    ]);
    expect(facts.find((fact) => fact.label === "Screening")?.value).toBe("Blocked before it rang");
  });

  it("omits screening rows when the call was not scored", () => {
    expect(spamFacts({ status: "completed" })).toEqual([]);
  });
});

describe("caller numbers", () => {
  it("picks the other party and ignores anonymous callers", () => {
    expect(otherPartyNumber({ direction: "inbound", from_number: "+19185550199" })).toBe(
      "+19185550199",
    );
    expect(otherPartyNumber({ direction: "outbound", to_number: "client:+19185550142" })).toBe(
      "+19185550142",
    );
    expect(otherPartyNumber({ direction: "inbound", from_number: "Anonymous" })).toBe("");
  });

  it("matches list rows to the number on the call", () => {
    expect(sameCallerNumber("+1 (918) 555-0199", "19185550199")).toBe(true);
    expect(sameCallerNumber("555", "5550199")).toBe(false);
    expect(
      callerListForNumber([{ phone_number: "+19185550199", list: "block" }], "+1 918 555 0199"),
    ).toBe("block");
    expect(
      callerListForNumber([{ phone_number: "+19185550100", list: "allow" }], "+19185550199"),
    ).toBe(null);
  });
});

describe("query filters", () => {
  it("names every column the gate uses to mark spam", () => {
    expect(SPAM_BLOCKED_OR).toContain("spam_action");
    expect(SPAM_BLOCKED_OR).toContain("status");
    expect(SPAM_BLOCKED_OR).toContain("answer_path");
    expect(NOT_SPAM_ORS.join(" ")).toContain("is.null");
  });
});
