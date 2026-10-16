import assert from "node:assert/strict";
import { test } from "node:test";
import { CHAT_MAX_CHARS } from "@linguamatch/shared";
import { CHAT_RATE_MS, allowedNow, normalizeForMatch, validateMessage, wordsUsedIn } from "./chatRules";

test("validateMessage trims and collapses whitespace", () => {
  const r = validateMessage("  hello   there  ", undefined, 1000);
  assert.deepEqual(r, { ok: true, text: "hello there" });
});

test("validateMessage rejects empty, blank and non-string drafts", () => {
  for (const bad of ["", "   ", "\n\t", 42, null, undefined, {}]) {
    assert.deepEqual(validateMessage(bad, undefined, 1000), { ok: false, reason: "empty" });
  }
});

test("validateMessage enforces the 500 character cap after trimming", () => {
  const atLimit = "a".repeat(CHAT_MAX_CHARS);
  assert.equal(validateMessage(atLimit, undefined, 1000).ok, true);
  assert.deepEqual(validateMessage("a".repeat(CHAT_MAX_CHARS + 1), undefined, 1000), {
    ok: false,
    reason: "too_long",
  });
});

test("validateMessage enforces one message per second", () => {
  assert.deepEqual(validateMessage("hi", 1000, 1000 + CHAT_RATE_MS - 1), { ok: false, reason: "rate_limited" });
  assert.equal(validateMessage("hi", 1000, 1000 + CHAT_RATE_MS).ok, true);
  assert.equal(validateMessage("hi", undefined, 0).ok, true);
});

test("allowedNow gates on the given window", () => {
  assert.ok(allowedNow(undefined, 0, 3000));
  assert.ok(!allowedNow(1000, 3999, 3000));
  assert.ok(allowedNow(1000, 4000, 3000));
});

test("normalizeForMatch lowercases, strips accents and punctuation", () => {
  assert.equal(normalizeForMatch("Café, RELUCTANT!"), "cafe reluctant");
});

test("wordsUsedIn matches whole words only", () => {
  assert.deepEqual(wordsUsedIn("I was reluctant to go", ["reluctant"]), ["reluctant"]);
  assert.deepEqual(wordsUsedIn("reluctantly, I went", ["reluctant"]), []);
  assert.deepEqual(wordsUsedIn("nothing here", ["reluctant"]), []);
});

test("wordsUsedIn ignores case, accents and surrounding punctuation", () => {
  assert.deepEqual(wordsUsedIn("It was a RELUCTANT. choice", ["reluctant"]), ["reluctant"]);
  assert.deepEqual(wordsUsedIn("we met at the café!", ["Café"]), ["Café"]);
});

test("wordsUsedIn matches multi-word phrases and returns the issued spelling", () => {
  assert.deepEqual(wordsUsedIn("I would rather stay in", ["would rather"]), ["would rather"]);
});

test("wordsUsedIn returns every distinct issued word that appears", () => {
  const hits = wordsUsedIn("I was reluctant, but I would rather go", ["reluctant", "would rather", "eager"]);
  assert.deepEqual(hits, ["reluctant", "would rather"]);
});
