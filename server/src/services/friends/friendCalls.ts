import { activeLanguageProfile } from "../../models/User";
import { levelDistance, type CefrLevel } from "@linguamatch/shared";
import { randomUUID } from "node:crypto";
import { findUserById } from "../../models/User";
import { hasOpenSession } from "../../models/Session";
import { getIO, userRoom } from "../../socket/io";
import { blockedUserIds } from "../moderation/moderationService";
import { createSessionForFriends } from "../rooms/roomService";
import { canCall, UNAVAILABLE_MESSAGE, type CallRejection } from "./friendRules";
import { friendshipBetween } from "./friendsService";

const INVITE_TTL_MS = 30_000;
export const INVITE_TTL_SECONDS = INVITE_TTL_MS / 1000;

interface Invite {
  callerId: string;
  calleeId: string;
  lang: string;
  callerLevel: CefrLevel;
  calleeLevel: CefrLevel;
  timer: NodeJS.Timeout;
}

const invites = new Map<string, Invite>();

let isQueued: (userId: string) => boolean = () => false;

export function setQueuedCheck(check: (userId: string) => boolean) {
  isQueued = check;
}

export async function isOnline(userId: string): Promise<boolean> {
  const sockets = await getIO().in(userRoom(userId)).fetchSockets();
  return sockets.length > 0;
}

export async function isBusy(userId: string): Promise<boolean> {
  return isQueued(userId) || (await hasOpenSession(userId));
}

function resolveLevel(
  profile: { level: CefrLevel } | null,
  fallback: { level: CefrLevel } | null,
): CefrLevel {
  return profile?.level ?? fallback?.level ?? "A1";
}

function hasPendingInviteFor(userId: string): boolean {
  for (const invite of invites.values()) {
    if (invite.calleeId === userId || invite.callerId === userId) return true;
  }
  return false;
}

function clearInvite(inviteId: string): Invite | undefined {
  const invite = invites.get(inviteId);
  if (!invite) return undefined;
  clearTimeout(invite.timer);
  invites.delete(inviteId);
  return invite;
}

function tellCaller(callerId: string, inviteId: string, status: "unavailable" | "declined" | "timeout" | "cancelled") {
  getIO()
    .to(userRoom(callerId))
    .emit("friend:call-status", { inviteId, status, message: UNAVAILABLE_MESSAGE });
}

export async function startCall(callerId: string, calleeId: string): Promise<void> {
  const io = getIO();
  const reject = (reason: CallRejection) => {
    io.to(userRoom(callerId)).emit("friend:call-status", {
      inviteId: "",
      status: "unavailable",
      message: reason === "caller_busy" ? "Finish your current call first" : UNAVAILABLE_MESSAGE,
    });
  };

  const [caller, callee] = await Promise.all([findUserById(callerId), findUserById(calleeId)]);
  if (!caller || !callee || callee.deletedAt) return reject("not_friends");

  const lang = caller.targetLang;
  if (!lang) return reject("caller_busy");

  const [friendship, blocked, calleeOnline, calleeBusy, callerBusy] = await Promise.all([
    friendshipBetween(callerId, calleeId),
    blockedUserIds(callerId),
    isOnline(calleeId),
    isBusy(calleeId),
    isBusy(callerId),
  ]);

  const verdict = canCall({
    callerId,
    calleeId,
    friendship: friendship.status,
    blockedEitherWay: blocked.has(calleeId),
    calleeOnline,
    calleeBusy: calleeBusy || hasPendingInviteFor(calleeId),
    callerBusy: callerBusy || hasPendingInviteFor(callerId),
  });
  if (!verdict.ok) return reject(verdict.reason);

  const callerLevel = resolveLevel(activeLanguageProfile(caller, lang), activeLanguageProfile(caller));
  const calleeLevel = resolveLevel(activeLanguageProfile(callee, lang), activeLanguageProfile(callee));

  const inviteId = randomUUID();
  const timer = setTimeout(() => {
    const expired = clearInvite(inviteId);
    if (!expired) return;
    io.to(userRoom(expired.calleeId)).emit("friend:incoming-cancelled", { inviteId });
    tellCaller(expired.callerId, inviteId, "timeout");
  }, INVITE_TTL_MS);

  invites.set(inviteId, { callerId, calleeId, lang, callerLevel, calleeLevel, timer });

  io.to(userRoom(calleeId)).emit("friend:incoming", {
    inviteId,
    from: { id: caller.id, username: caller.name },
    targetLanguage: lang,
    expiresInSeconds: INVITE_TTL_SECONDS,
  });
  io.to(userRoom(callerId)).emit("friend:call-status", { inviteId, status: "ringing" });
}

export async function acceptCall(calleeId: string, inviteId: string): Promise<void> {
  const invite = invites.get(inviteId);
  if (!invite || invite.calleeId !== calleeId) return;
  clearInvite(inviteId);

  const io = getIO();
  const stillFree = !(await isBusy(invite.callerId)) && !(await isBusy(invite.calleeId));
  if (!stillFree) {
    tellCaller(invite.callerId, inviteId, "unavailable");
    io.to(userRoom(calleeId)).emit("friend:call-status", {
      inviteId,
      status: "unavailable",
      message: UNAVAILABLE_MESSAGE,
    });
    return;
  }

  const roomId = await createSessionForFriends({
    callerId: invite.callerId,
    calleeId: invite.calleeId,
    lang: invite.lang,
    callerLevel: invite.callerLevel,
    calleeLevel: invite.calleeLevel,
    levelDistance: levelDistance(invite.callerLevel, invite.calleeLevel),
  });

  for (const userId of [invite.callerId, invite.calleeId]) {
    io.to(userRoom(userId)).emit("friend:call-status", { inviteId, status: "accepted", roomId });
  }
}

export function declineCall(calleeId: string, inviteId: string): void {
  const invite = invites.get(inviteId);
  if (!invite || invite.calleeId !== calleeId) return;
  clearInvite(inviteId);
  tellCaller(invite.callerId, inviteId, "declined");
}

export function cancelCall(callerId: string, inviteId: string): void {
  const invite = invites.get(inviteId);
  if (!invite || invite.callerId !== callerId) return;
  clearInvite(inviteId);
  getIO().to(userRoom(invite.calleeId)).emit("friend:incoming-cancelled", { inviteId });
}

export function cancelCallsFor(userId: string): void {
  for (const [inviteId, invite] of [...invites]) {
    if (invite.callerId !== userId && invite.calleeId !== userId) continue;
    clearInvite(inviteId);
    const other = invite.callerId === userId ? invite.calleeId : invite.callerId;
    if (invite.callerId === userId) {
      getIO().to(userRoom(other)).emit("friend:incoming-cancelled", { inviteId });
    } else {
      tellCaller(other, inviteId, "cancelled");
    }
  }
}
