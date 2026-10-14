import assert from "node:assert/strict";
import { test } from "node:test";
import { canCall, nextFriendshipState, type CallFacts, type FriendshipView } from "./friendRules";

const facts = (over: Partial<CallFacts> = {}): CallFacts => ({
  callerId: "user_a",
  calleeId: "user_b",
  friendship: "accepted",
  blockedEitherWay: false,
  calleeOnline: true,
  calleeBusy: false,
  callerBusy: false,
  ...over,
});

test("canCall allows an online, idle, accepted friend", () => {
  assert.deepEqual(canCall(facts()), { ok: true });
});

test("canCall refuses calling yourself", () => {
  assert.deepEqual(canCall(facts({ calleeId: "user_a" })), { ok: false, reason: "self" });
});

test("canCall refuses anyone who is not an accepted friend", () => {
  assert.deepEqual(canCall(facts({ friendship: "none" })), { ok: false, reason: "not_friends" });
  assert.deepEqual(canCall(facts({ friendship: "pending" })), { ok: false, reason: "not_friends" });
});

test("canCall refuses a block in either direction, whatever else is true", () => {
  assert.deepEqual(canCall(facts({ blockedEitherWay: true })), { ok: false, reason: "blocked" });
  assert.deepEqual(
    canCall(facts({ blockedEitherWay: true, friendship: "accepted", calleeOnline: true })),
    { ok: false, reason: "blocked" },
  );
});

test("canCall takes a block over a missing friendship, so blocking is never leaked as 'not a friend'", () => {
  assert.deepEqual(canCall(facts({ blockedEitherWay: true, friendship: "none" })), { ok: false, reason: "blocked" });
});

test("canCall refuses an offline friend", () => {
  assert.deepEqual(canCall(facts({ calleeOnline: false })), { ok: false, reason: "offline" });
});

test("canCall refuses a friend who is queueing or already in a call", () => {
  assert.deepEqual(canCall(facts({ calleeBusy: true })), { ok: false, reason: "busy" });
});

test("canCall refuses a caller who is already queueing or in a call", () => {
  assert.deepEqual(canCall(facts({ callerBusy: true })), { ok: false, reason: "caller_busy" });
});

test("canCall reports the caller's own state before the friend's availability", () => {
  const verdict = canCall(facts({ callerBusy: true, calleeOnline: false, calleeBusy: true }));
  assert.deepEqual(verdict, { ok: false, reason: "caller_busy" });
});

const view = (over: Partial<FriendshipView> = {}): FriendshipView => ({
  status: "none",
  iAmRequester: false,
  ...over,
});

test("send creates a pending request only when there is no relationship", () => {
  assert.deepEqual(nextFriendshipState(view(), "send"), { next: "pending", allowed: true });
  assert.deepEqual(nextFriendshipState(view({ status: "pending" }), "send"), { next: "pending", allowed: false });
  assert.deepEqual(nextFriendshipState(view({ status: "accepted" }), "send"), { next: "accepted", allowed: false });
});

test("only the recipient can accept a pending request", () => {
  assert.deepEqual(nextFriendshipState(view({ status: "pending" }), "accept"), { next: "accepted", allowed: true });
  assert.deepEqual(
    nextFriendshipState(view({ status: "pending", iAmRequester: true }), "accept"),
    { next: "pending", allowed: false },
  );
});

test("accept is rejected when there is nothing to accept", () => {
  assert.deepEqual(nextFriendshipState(view(), "accept"), { next: "none", allowed: false });
  assert.deepEqual(nextFriendshipState(view({ status: "accepted" }), "accept"), { next: "accepted", allowed: false });
});

test("decline removes a pending request from either side", () => {
  assert.deepEqual(nextFriendshipState(view({ status: "pending" }), "decline"), { next: "none", allowed: true });
  assert.deepEqual(
    nextFriendshipState(view({ status: "pending", iAmRequester: true }), "decline"),
    { next: "none", allowed: true },
  );
  assert.deepEqual(nextFriendshipState(view({ status: "accepted" }), "decline"), { next: "accepted", allowed: false });
});

test("unfriend clears an accepted or pending relationship but not an absent one", () => {
  assert.deepEqual(nextFriendshipState(view({ status: "accepted" }), "unfriend"), { next: "none", allowed: true });
  assert.deepEqual(nextFriendshipState(view({ status: "pending" }), "unfriend"), { next: "none", allowed: true });
  assert.deepEqual(nextFriendshipState(view(), "unfriend"), { next: "none", allowed: false });
});

test("block is allowed from every state and always clears the relationship", () => {
  for (const status of ["none", "pending", "accepted"] as const) {
    assert.deepEqual(nextFriendshipState(view({ status }), "block"), { next: "none", allowed: true });
  }
});
