export type FriendshipState = "none" | "pending" | "accepted";

export type CallRejection = "self" | "not_friends" | "blocked" | "offline" | "busy" | "caller_busy";

export interface CallFacts {
  callerId: string;
  calleeId: string;
  friendship: FriendshipState;
  blockedEitherWay: boolean;
  calleeOnline: boolean;
  calleeBusy: boolean;
  callerBusy: boolean;
}

export type CallVerdict = { ok: true } | { ok: false; reason: CallRejection };

export function canCall(facts: CallFacts): CallVerdict {
  if (facts.callerId === facts.calleeId) return { ok: false, reason: "self" };
  if (facts.blockedEitherWay) return { ok: false, reason: "blocked" };
  if (facts.friendship !== "accepted") return { ok: false, reason: "not_friends" };
  if (facts.callerBusy) return { ok: false, reason: "caller_busy" };
  if (!facts.calleeOnline) return { ok: false, reason: "offline" };
  if (facts.calleeBusy) return { ok: false, reason: "busy" };
  return { ok: true };
}

export const UNAVAILABLE_MESSAGE = "Your friend isn't available";

export type FriendAction = "send" | "accept" | "decline" | "unfriend" | "block";

export interface FriendshipView {
  status: FriendshipState;
  iAmRequester: boolean;
}

export interface FriendshipTransition {
  next: FriendshipState;
  allowed: boolean;
}

export function nextFriendshipState(current: FriendshipView, action: FriendAction): FriendshipTransition {
  if (action === "block") return { next: "none", allowed: true };

  switch (action) {
    case "send":
      if (current.status === "none") return { next: "pending", allowed: true };
      return { next: current.status, allowed: false };

    case "accept":
      if (current.status === "pending" && !current.iAmRequester) return { next: "accepted", allowed: true };
      return { next: current.status, allowed: false };

    case "decline":
      if (current.status === "pending") return { next: "none", allowed: true };
      return { next: current.status, allowed: false };

    case "unfriend":
      if (current.status === "none") return { next: "none", allowed: false };
      return { next: "none", allowed: true };
  }
}
