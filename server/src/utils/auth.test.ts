import assert from "node:assert/strict";
import { test } from "node:test";

// env.ts validates process.env on import, so configure it before loading the modules under test.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://unused";
process.env.CLERK_SECRET_KEY = "sk_test_unused";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_unused";
process.env.CLIENT_ORIGIN = "https://linguamatch.vercel.app, https://preview.example.com/";
const { verifySessionToken } = await import("./auth");
const { isAllowedOrigin } = await import("../config/env");

test("session tokens: missing and malformed are rejected without a network call", async () => {
  assert.deepEqual(await verifySessionToken(undefined), { ok: false, reason: "missing" });
  assert.deepEqual(await verifySessionToken("not-a-jwt"), { ok: false, reason: "invalid_token" });
});

test("origin allowlist: exact comma-separated origins, localhost outside production", () => {
  assert.ok(isAllowedOrigin("https://linguamatch.vercel.app"));
  assert.ok(isAllowedOrigin("https://preview.example.com"));
  assert.ok(isAllowedOrigin("http://localhost:3000"));
  assert.ok(isAllowedOrigin(undefined));
  assert.ok(!isAllowedOrigin("https://evil.example.com"));
  assert.ok(!isAllowedOrigin("https://linguamatch.vercel.app.evil.com"));
});
