"use client";

import { languageName, type FriendCallInvite } from "@linguamatch/shared";
import { PhoneIncoming } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
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
    <Dialog open>
      <DialogContent
        className="[&>button:last-child]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneIncoming className="text-primary size-5" /> {invite.from.username} is calling
          </DialogTitle>
          <DialogDescription>
            A {languageName(invite.targetLanguage)} practice call. Answering within {secondsLeft}s.
          </DialogDescription>
        </DialogHeader>
        <Progress value={pct} aria-label={`${secondsLeft} seconds left to answer`} />
        <DialogFooter>
          <Button variant="outline" onClick={() => respond(false)}>
            Decline
          </Button>
          <Button onClick={() => respond(true)}>Accept</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
