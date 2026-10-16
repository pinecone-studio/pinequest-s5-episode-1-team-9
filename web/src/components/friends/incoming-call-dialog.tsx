"use client";

import { languageName, levelShort, type FriendCallInvite } from "@linguamatch/shared";
import { Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getSocket } from "@/lib/socket";

export function IncomingCallDialog() {
  const { user } = useAuth();
  const router = useRouter();
  const [invite, setInvite] = useState<FriendCallInvite | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!user?.onboarded) return;
    const socket = getSocket();

    const onIncoming = (payload: FriendCallInvite) => {
      setInvite(payload);
      setSecondsLeft(payload.expiresInSeconds);
    };
    const onCancelled = ({ inviteId }: { inviteId: string }) =>
      setInvite((current) => (current && current.inviteId === inviteId ? null : current));
    const onStatus = ({ inviteId, status, roomId }: { inviteId: string; status: string; roomId?: string }) => {
      if (status === "accepted" && roomId) {
        setInvite(null);
        router.push(`/room/${roomId}`);
        return;
      }
      if (status !== "ringing") onCancelled({ inviteId });
    };

    socket.on("friend:incoming", onIncoming);
    socket.on("friend:incoming-cancelled", onCancelled);
    socket.on("friend:call-status", onStatus);
    return () => {
      socket.off("friend:incoming", onIncoming);
      socket.off("friend:incoming-cancelled", onCancelled);
      socket.off("friend:call-status", onStatus);
    };
  }, [user?.onboarded, router]);

  useEffect(() => {
    if (!invite) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [invite]);

  useEffect(() => {
    if (invite && secondsLeft === 0) setInvite(null);
  }, [invite, secondsLeft]);

  if (!invite) return null;

  const respond = (accept: boolean) => {
    getSocket().emit(accept ? "friend:accept" : "friend:decline", { inviteId: invite.inviteId });
    if (!accept) setInvite(null);
  };

  const pct = invite.expiresInSeconds ? (secondsLeft / invite.expiresInSeconds) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,9,32,0.55)] p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="friend-call-title"
        aria-describedby="friend-call-desc"
        className="text-ink flex w-full max-w-[420px] flex-col items-center gap-4 rounded-[28px] bg-white px-7 pt-8 pb-6 text-center"
      >
        <span
          aria-hidden="true"
          className="lm-pulse bg-brand-partner text-ink font-display grid size-26 place-items-center rounded-full text-[40px] font-bold"
        >
          {invite.from.username.charAt(0).toUpperCase()}
        </span>
        <h2 id="friend-call-title" className="font-display m-0 text-2xl font-bold">
          {invite.from.username} is calling
        </h2>
        <p id="friend-call-desc" className="text-dim m-0 leading-[1.5]">
          Video call in {languageName(invite.targetLanguage)}. {invite.from.username} is your friend at{" "}
          {levelShort(invite.targetLanguage, invite.from.level)}.
        </p>

        <div className="flex w-full flex-col gap-1.5">
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-sm bg-[#EEF0F7]">
            <span
              className="bg-brand-partner block h-full transition-[width] duration-1000 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[14px] text-[#5B6085]">Answer within {secondsLeft} seconds</span>
        </div>

        <div className="grid w-full grid-cols-2 gap-2.5 pt-1.5">
          <button
            type="button"
            onClick={() => respond(false)}
            className="text-ink min-h-13.5 rounded-2xl border border-[#D6DAEA] bg-white text-[17px] font-bold"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => respond(true)}
            className="bg-fix inline-flex min-h-13.5 items-center justify-center gap-2 rounded-2xl border-0 text-[17px] font-bold text-white"
          >
            <Video aria-hidden="true" className="size-5" />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
