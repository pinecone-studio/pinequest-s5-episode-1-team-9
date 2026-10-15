import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BALANCE_GRACE_MS,
  BALANCE_WINDOW_MS,
  LOUDER_TIP,
  MIN_WINDOW_SPEECH_MS,
  QUIETER_TIP_FALLBACK,
  TIP_COOLDOWN_MS,
  balanceOf,
  quieterTip,
  tipFor,
  trimSamples,
  windowDelta,
  type BalanceSample,
} from "@linguamatch/shared";

const QUESTIONS = ["What do you usually do?", "Why do you like it?", "Would you change it?"];

const base = {
  callElapsedMs: BALANCE_GRACE_MS,
  lastTipAt: null as number | null,
  now: 1_000_000,
  questions: QUESTIONS,
  tipCount: 0,
};

test("balanceOf splits percentages and always sums to 100", () => {
  assert.deepEqual(balanceOf(70, 30), { minePct: 70, partnerPct: 30, totalMs: 100 });
  assert.deepEqual(balanceOf(1, 2), { minePct: 33, partnerPct: 67, totalMs: 3 });
  for (const [a, b] of [[1, 1], [7, 3], [1, 99], [12345, 1]]) {
    const r = balanceOf(a!, b!);
    assert.equal(r.minePct + r.partnerPct, 100);
  }
});

test("balanceOf shows an even split before anyone has spoken", () => {
  assert.deepEqual(balanceOf(0, 0), { minePct: 50, partnerPct: 50, totalMs: 0 });
});

test("balanceOf clamps negative input", () => {
  assert.deepEqual(balanceOf(-50, 100), { minePct: 0, partnerPct: 100, totalMs: 100 });
});

test("windowDelta measures speech inside the window only", () => {
  const samples: BalanceSample[] = [
    { at: 0, cumulativeMs: 0 },
    { at: 60_000, cumulativeMs: 10_000 },
    { at: 120_000, cumulativeMs: 30_000 },
    { at: 180_000, cumulativeMs: 50_000 },
  ];
  assert.equal(windowDelta(samples, 180_000, BALANCE_WINDOW_MS), 40_000);
  assert.equal(windowDelta(samples, 180_000, 60_000), 20_000);
});

test("windowDelta handles empty and single-sample histories", () => {
  assert.equal(windowDelta([], 1000), 0);
  assert.equal(windowDelta([{ at: 1000, cumulativeMs: 5000 }], 1000), 0);
});

test("windowDelta never returns a negative delta if the counter resets", () => {
  const samples: BalanceSample[] = [
    { at: 0, cumulativeMs: 9000 },
    { at: 10_000, cumulativeMs: 0 },
  ];
  assert.equal(windowDelta(samples, 10_000, BALANCE_WINDOW_MS), 0);
});

test("trimSamples keeps one baseline outside the window so deltas stay correct", () => {
  const samples: BalanceSample[] = [
    { at: 0, cumulativeMs: 0 },
    { at: 1000, cumulativeMs: 500 },
    { at: 200_000, cumulativeMs: 20_000 },
  ];
  const trimmed = trimSamples(samples, 200_000, BALANCE_WINDOW_MS);
  assert.deepEqual(trimmed, [{ at: 1000, cumulativeMs: 500 }, { at: 200_000, cumulativeMs: 20_000 }]);
  assert.equal(windowDelta(trimmed, 200_000, BALANCE_WINDOW_MS), 19_500);
});

test("no tip during the first 60 seconds, however lopsided", () => {
  const tip = tipFor({ ...base, callElapsedMs: BALANCE_GRACE_MS - 1, mineWindowMs: 100_000, partnerWindowMs: 0 });
  assert.equal(tip, null);
});

test("the louder speaker is told to hand over the turn", () => {
  const tip = tipFor({ ...base, mineWindowMs: 80_000, partnerWindowMs: 20_000 });
  assert.deepEqual(tip, { role: "louder", text: LOUDER_TIP });
});

test("the quieter speaker is given a topic question to answer", () => {
  const tip = tipFor({ ...base, mineWindowMs: 20_000, partnerWindowMs: 80_000 });
  assert.deepEqual(tip, { role: "quieter", text: `Jump in! Try answering: ${QUESTIONS[0]}` });
});

test("quieter tips rotate through the topic questions", () => {
  const texts = [0, 1, 2, 3].map(
    (tipCount) => tipFor({ ...base, tipCount, mineWindowMs: 10_000, partnerWindowMs: 90_000 })!.text,
  );
  assert.deepEqual(texts, [
    `Jump in! Try answering: ${QUESTIONS[0]}`,
    `Jump in! Try answering: ${QUESTIONS[1]}`,
    `Jump in! Try answering: ${QUESTIONS[2]}`,
    `Jump in! Try answering: ${QUESTIONS[0]}`,
  ]);
});

test("the quieter tip falls back when there are no questions", () => {
  const tip = tipFor({ ...base, questions: [], mineWindowMs: 10_000, partnerWindowMs: 90_000 });
  assert.deepEqual(tip, { role: "quieter", text: QUIETER_TIP_FALLBACK });
  assert.equal(quieterTip(null), QUIETER_TIP_FALLBACK);
  assert.equal(quieterTip("   "), QUIETER_TIP_FALLBACK);
});

test("a balanced conversation gets no tip", () => {
  assert.equal(tipFor({ ...base, mineWindowMs: 50_000, partnerWindowMs: 50_000 }), null);
  assert.equal(tipFor({ ...base, mineWindowMs: 74_000, partnerWindowMs: 26_000 }), null);
});

test("exactly 75 percent is not dominant; just over is", () => {
  assert.equal(tipFor({ ...base, mineWindowMs: 75_000, partnerWindowMs: 25_000 }), null);
  assert.equal(tipFor({ ...base, mineWindowMs: 75_100, partnerWindowMs: 24_900 })?.role, "louder");
});

test("at most one tip per 60 seconds", () => {
  const lopsided = { ...base, mineWindowMs: 90_000, partnerWindowMs: 10_000 };
  assert.equal(tipFor({ ...lopsided, lastTipAt: base.now - TIP_COOLDOWN_MS + 1 }), null);
  assert.equal(tipFor({ ...lopsided, lastTipAt: base.now - TIP_COOLDOWN_MS })?.role, "louder");
});

test("a near-silent window never triggers a tip", () => {
  const tip = tipFor({ ...base, mineWindowMs: MIN_WINDOW_SPEECH_MS - 1, partnerWindowMs: 0 });
  assert.equal(tip, null);
  assert.equal(tipFor({ ...base, mineWindowMs: 0, partnerWindowMs: 0 }), null);
  assert.equal(tipFor({ ...base, mineWindowMs: MIN_WINDOW_SPEECH_MS, partnerWindowMs: 0 })?.role, "louder");
});
