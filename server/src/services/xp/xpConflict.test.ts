import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const serverSrc = join(here, "..", "..");
const drizzleDir = join(serverSrc, "..", "drizzle");

const read = (p: string) => readFileSync(p, "utf8");

function latestMigrationWith(needle: string): string {
  const files = readdirSync(drizzleDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .reverse();
  for (const f of files) {
    const sql = read(join(drizzleDir, f));
    if (sql.includes(needle)) return sql;
  }
  throw new Error(`no migration mentions ${needle}`);
}

const indexKey = (userId: string, sessionId: string, reason: string, detail: string | null) =>
  JSON.stringify([userId, sessionId, reason, detail ?? ""]);

test("the xp_events unique index is the coalesce(detail) expression index", () => {
  const sql = latestMigrationWith("xp_events_user_session_reason_key");
  assert.match(
    sql,
    /CREATE UNIQUE INDEX "xp_events_user_session_reason_key"[^;]*coalesce\("detail", ''\)/,
    "the unique index must include coalesce(detail, '') or per-word XP cannot dedupe",
  );
});

test("xp_events inserts use an untargeted ON CONFLICT", () => {
  for (const name of ["xpService.ts", "wordXp.ts"]) {
    const src = read(join(here, name));
    assert.ok(src.includes("insert(xpEvents)"), `${name} should insert into xpEvents`);
    assert.ok(src.includes(".onConflictDoNothing()"), `${name} must call onConflictDoNothing() with no target`);
    assert.ok(
      !/onConflict\w*\(\s*\{\s*target/.test(src),
      `${name} must not name an ON CONFLICT target: Postgres cannot infer the coalesce(detail) expression index and raises 42P10`,
    );
  }
});

test("no server code names an ON CONFLICT target on xp_events", () => {
  const stack: string[] = [serverSrc];
  const offenders: string[] = [];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
        const src = read(full);
        if (src.includes("insert(xpEvents)") && /onConflict\w*\(\s*\{\s*target/.test(src)) offenders.push(full);
      }
    }
  }
  assert.deepEqual(offenders, [], "these files target an index Postgres cannot infer");
});

test("a repeat award for the same session and reason collides on the same index key", () => {
  const first = indexKey("user_a", "session_1", "call", null);
  assert.equal(first, indexKey("user_a", "session_1", "call", null), "a second 'call' award hits the same key and inserts nothing");
  assert.notEqual(first, indexKey("user_a", "session_1", "streak", null), "call and streak are separate awards");
  assert.notEqual(first, indexKey("user_a", "session_2", "call", null), "a new session earns again");
});

test("word awards dedupe per word, not per session", () => {
  const reluctant = indexKey("user_a", "session_1", "word", "reluctant");
  assert.equal(reluctant, indexKey("user_a", "session_1", "word", "reluctant"), "the same word must dedupe");
  assert.notEqual(reluctant, indexKey("user_a", "session_1", "word", "eager"), "different words are separate awards");
  assert.notEqual(reluctant, indexKey("user_a", "session_2", "word", "reluctant"), "the same word in a new session re-earns");
  assert.notEqual(reluctant, indexKey("user_b", "session_1", "word", "reluctant"), "each user earns their own words");
});

test("the reason CHECK allows the gamified reasons", () => {
  const schema = read(join(serverSrc, "db", "schema.ts"));
  assert.match(schema, /XP_REASONS = \["call", "streak", "skip_penalty", "word", "quiz"\]/);
  const sql = latestMigrationWith("xp_events_reason_check");
  for (const reason of ["call", "streak", "skip_penalty", "word", "quiz"]) {
    assert.ok(sql.includes(`'${reason}'`), `the CHECK must allow '${reason}'`);
  }
});
