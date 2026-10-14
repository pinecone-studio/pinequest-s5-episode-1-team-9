import assert from "node:assert/strict";
import { test } from "node:test";

// The role middleware pulls in the auth stack (models → env) on import, so satisfy env first.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://unused";
process.env.CLERK_SECRET_KEY = "sk_test_unused";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_unused";
const { roleAtLeast } = await import("./role");

test("role ladder: users are below moderators and admins", () => {
  assert.ok(roleAtLeast("admin", "admin"));
  assert.ok(roleAtLeast("admin", "moderator"));
  assert.ok(roleAtLeast("admin", "user"));
  assert.ok(roleAtLeast("moderator", "moderator"));
  assert.ok(roleAtLeast("moderator", "user"));
  assert.ok(roleAtLeast("user", "user"));
  assert.ok(!roleAtLeast("user", "moderator"));
  assert.ok(!roleAtLeast("moderator", "admin"));
  assert.ok(!roleAtLeast("user", "admin"));
});