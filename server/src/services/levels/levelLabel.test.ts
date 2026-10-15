import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CEFR_LEVELS,
  TARGET_LANGUAGES,
  levelLabel,
  levelOptions,
  levelScale,
  levelScaleNote,
  levelShort,
  levelWithArticle,
} from "@linguamatch/shared";

test("CEFR languages keep the letter grade with a plain-English name", () => {
  assert.equal(levelLabel("en", "A1"), "A1 Beginner");
  assert.equal(levelLabel("en", "B1"), "B1 Intermediate");
  assert.equal(levelLabel("en", "C2"), "C2 Proficient");
  for (const lang of ["es", "fr", "de", "it", "pt", "ru"]) {
    assert.equal(levelLabel(lang, "B2"), "B2 Upper intermediate", `${lang} should use CEFR`);
  }
});

test("Chinese uses HSK 1 to 6", () => {
  const map = { A1: "HSK 1", A2: "HSK 2", B1: "HSK 3", B2: "HSK 4", C1: "HSK 5", C2: "HSK 6" } as const;
  for (const [cefr, expected] of Object.entries(map)) {
    assert.equal(levelShort("zh", cefr as never), expected);
  }
});

test("Japanese uses JLPT N5 to N1, with C1 and C2 both mapping to N1", () => {
  const map = { A1: "N5", A2: "N4", B1: "N3", B2: "N2", C1: "N1", C2: "N1" } as const;
  for (const [cefr, expected] of Object.entries(map)) {
    assert.equal(levelShort("ja", cefr as never), `JLPT ${expected}`);
  }
  assert.equal(levelShort("ja", "C1"), levelShort("ja", "C2"));
});

test("Korean uses TOPIK 1 to 6", () => {
  assert.equal(levelShort("ko", "A1"), "TOPIK 1");
  assert.equal(levelShort("ko", "C2"), "TOPIK 6");
});

test("non-CEFR labels keep the underlying CEFR letter visible", () => {
  assert.equal(levelLabel("zh", "B1"), "HSK 3 (B1)");
  assert.equal(levelLabel("ja", "C2"), "JLPT N1 (C2)");
  assert.equal(levelLabel("ko", "A2"), "TOPIK 2 (A2)");
});

test("an unknown or missing language falls back to CEFR", () => {
  for (const lang of [null, undefined, "", "mn", "tlh"]) {
    assert.equal(levelScale(lang), "cefr");
    assert.equal(levelShort(lang, "B1"), "B1");
  }
});

test("levelOptions covers every CEFR level in order for each scale", () => {
  for (const lang of ["en", "zh", "ja", "ko"]) {
    const options = levelOptions(lang);
    assert.deepEqual(
      options.map((o) => o.value),
      [...CEFR_LEVELS],
      `${lang} must offer all six levels`,
    );
    for (const o of options) assert.ok(o.label.length > 0 && o.short.length > 0);
  }
});

test("every supported target language produces a label for every level", () => {
  for (const lang of TARGET_LANGUAGES) {
    for (const level of CEFR_LEVELS) {
      assert.ok(levelShort(lang.code, level).length > 0, `${lang.code}/${level}`);
      assert.ok(levelLabel(lang.code, level).length > 0, `${lang.code}/${level}`);
    }
  }
});

test("only the three non-CEFR scales carry an approximation note", () => {
  assert.equal(levelScaleNote("en"), null);
  assert.equal(levelScaleNote("ru"), null);
  assert.match(levelScaleNote("zh") ?? "", /approximate/i);
  assert.match(levelScaleNote("ja") ?? "", /N1/);
  assert.match(levelScaleNote("ko") ?? "", /approximate/i);
});

test("levelWithArticle picks a or an from the visible label", () => {
  assert.equal(levelWithArticle("en", "B1"), "a B1");
  assert.equal(levelWithArticle("en", "A1"), "an A1");
  assert.equal(levelWithArticle("zh", "B1"), "an HSK 3");
  assert.equal(levelWithArticle("ja", "B1"), "a JLPT N3");
  assert.equal(levelWithArticle("ko", "A1"), "a TOPIK 1");
});
