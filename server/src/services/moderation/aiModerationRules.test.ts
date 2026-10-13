import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_DETAILS_LENGTH,
  categoryToReportReason,
  composeReportDetails,
  meetsLevel,
  qualifyingFindings,
  truncate,
} from "./aiModerationRules";
import type { ModerationFinding } from "../ai/types";

const finding = (over: Partial<ModerationFinding> = {}): ModerationFinding => ({
  speaker: "a",
  category: "harassment",
  severity: "high",
  confidence: "high",
  quote: "you are an idiot",
  reason: "direct insult",
  ...over,
});

test("meetsLevel ranks low < medium < high", () => {
  assert.ok(meetsLevel("high", "low"));
  assert.ok(meetsLevel("high", "high"));
  assert.ok(meetsLevel("medium", "medium"));
  assert.ok(meetsLevel("medium", "low"));
  assert.ok(!meetsLevel("low", "medium"));
  assert.ok(!meetsLevel("medium", "high"));
  assert.ok(!meetsLevel("low", "high"));
});

test("qualifyingFindings requires both severity and confidence to clear their thresholds", () => {
  const findings = [
    finding({ severity: "high", confidence: "high" }),
    finding({ severity: "high", confidence: "low" }),
    finding({ severity: "low", confidence: "high" }),
  ];
  const kept = qualifyingFindings(findings, "medium", "medium");
  assert.equal(kept.length, 1);
  assert.equal(kept[0]!.confidence, "high");
});

test("qualifyingFindings keeps everything at low thresholds", () => {
  const findings = [finding({ severity: "low", confidence: "low" })];
  assert.equal(qualifyingFindings(findings, "low", "low").length, 1);
});

test("AI categories map to the same community-rules report reasons", () => {
  for (const category of ["harassment", "sexual", "hate", "minor", "spam", "other"] as const) {
    assert.equal(categoryToReportReason(category), category);
  }
});

test("truncate only shortens overlong text", () => {
  assert.equal(truncate("short"), "short");
  const long = "x".repeat(MAX_DETAILS_LENGTH + 50);
  assert.equal(truncate(long).length, MAX_DETAILS_LENGTH);
  assert.ok(truncate(long).endsWith("…"));
});

test("composeReportDetails includes the quote and stays within the DB limit", () => {
  const details = composeReportDetails(finding({ quote: "q".repeat(2000) }));
  assert.ok(details.includes("direct insult"));
  assert.ok(details.includes("harassment/high"));
  assert.ok(details.length <= MAX_DETAILS_LENGTH);
});
