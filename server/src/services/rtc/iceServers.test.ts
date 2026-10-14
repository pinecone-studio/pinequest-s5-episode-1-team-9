import assert from "node:assert/strict";
import { test } from "node:test";

// env.ts validates process.env on import, so configure it before loading the module under test.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://unused";
process.env.CLERK_SECRET_KEY = "sk_test_unused";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_unused";
process.env.STUN_URLS = "stun:stun.example.com:3478";
process.env.CLOUDFLARE_TURN_KEY_ID = "key-id";
process.env.CLOUDFLARE_TURN_API_TOKEN = "api-token";
const { iceServers } = await import("./iceServers");

const realFetch = globalThis.fetch;

test("ice servers: Cloudflare failure falls back to STUN only", async (t) => {
  t.after(() => (globalThis.fetch = realFetch));
  globalThis.fetch = (async () => new Response("nope", { status: 500 })) as typeof fetch;
  assert.deepEqual(await iceServers(), [{ urls: ["stun:stun.example.com:3478"] }]);
});

test("ice servers: Cloudflare credentials are fetched once, cached, and port 53 is dropped", async (t) => {
  t.after(() => (globalThis.fetch = realFetch));
  const calls: { url: string; auth: string | null; body: unknown }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, auth: new Headers(init.headers).get("authorization"), body: JSON.parse(String(init.body)) });
    return Response.json(
      {
        iceServers: [
          { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] },
          {
            urls: ["turn:turn.cloudflare.com:3478?transport=udp", "turn:turn.cloudflare.com:53?transport=udp"],
            username: "u",
            credential: "c",
          },
        ],
      },
      { status: 201 },
    );
  }) as typeof fetch;

  const [first, second] = await Promise.all([iceServers(), iceServers()]);
  await iceServers();

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, "https://rtc.live.cloudflare.com/v1/turn/keys/key-id/credentials/generate-ice-servers");
  assert.equal(calls[0]!.auth, "Bearer api-token");
  assert.deepEqual(calls[0]!.body, { ttl: 86_400 });
  assert.deepEqual(first, [
    { urls: ["stun:stun.cloudflare.com:3478"] },
    { urls: ["turn:turn.cloudflare.com:3478?transport=udp"], username: "u", credential: "c" },
  ]);
  assert.deepEqual(second, first);
});
