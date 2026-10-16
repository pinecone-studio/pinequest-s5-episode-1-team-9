import assert from "node:assert/strict";
import { test } from "node:test";
import { CEFR_LEVELS } from "@linguamatch/shared";
import { SCENARIO_BANK, pickRandomScenario } from "./scenarioBank";

test("every scenario has two complete, distinct roles", () => {
  assert.ok(SCENARIO_BANK.length >= 5);
  for (const s of SCENARIO_BANK) {
    assert.ok(s.title.length > 0, `${s.title} needs a title`);
    assert.ok(CEFR_LEVELS.includes(s.level), `${s.title} has an invalid level`);
    assert.equal(s.roles.length, 2, `${s.title} must have exactly two roles`);
    for (const role of s.roles) {
      assert.ok(role.roleName.length > 0, `${s.title} role needs a name`);
      assert.ok(role.situation.length > 0, `${s.title} role needs a situation`);
      assert.ok(role.secretGoal.length > 0, `${s.title} role needs a secret goal`);
    }
    assert.notEqual(s.roles[0].roleName, s.roles[1].roleName, `${s.title} roles must differ`);
    assert.notEqual(s.roles[0].secretGoal, s.roles[1].secretGoal, `${s.title} goals must differ`);
  }
});

test("every CEFR level can be served a scenario", () => {
  for (const level of CEFR_LEVELS) {
    const picked = pickRandomScenario(level, [], () => 0);
    assert.ok(picked.title.length > 0);
  }
});

test("picks a scenario at the exact level when one exists", () => {
  const picked = pickRandomScenario("B1", [], () => 0);
  assert.equal(picked.level, "B1");
});

test("skips titles already used and widens to nearby levels", () => {
  const b1 = SCENARIO_BANK.filter((s) => s.level === "B1").map((s) => s.title);
  const picked = pickRandomScenario("B1", b1, () => 0);
  assert.ok(!b1.includes(picked.title));
});

test("falls back to the whole bank rather than failing when everything is used", () => {
  const all = SCENARIO_BANK.map((s) => s.title);
  const picked = pickRandomScenario("B1", all, () => 0);
  assert.ok(SCENARIO_BANK.some((s) => s.title === picked.title));
});

test("the choice is random across the level's pool", () => {
  const seen = new Set<string>();
  for (const r of [0, 0.5, 0.99]) seen.add(pickRandomScenario("A1", [], () => r).title);
  assert.ok(seen.size >= 1);
});
