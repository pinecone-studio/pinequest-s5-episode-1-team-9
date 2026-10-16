"use client";

import {
  getTargetLanguage,
  languageName,
  levelShort,
  type CefrLevel,
  type PartnerInfo,
  type RoomEndReason,
  type ServerToClientEvents,
  type Topic,
} from "@linguamatch/shared";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatPanel } from "@/components/room/chat-panel";
import { CoachPanel } from "@/components/room/coach-panel";
import { LiveCaptions } from "@/components/room/live-captions";
import { BlockDialog, ReportDialog } from "@/components/room/safety-dialogs";
import { VideoTile } from "@/components/room/video-tile";
import { LiveControls } from "@/components/stage/live-controls";
import { StageHeader } from "@/components/stage/stage-header";
import { LiveTranscript, type LiveTranscriptEntry } from "@/components/room/live-transcript";
import { EmojiReactions } from "@/components/xp/emoji-reactions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useChat } from "@/hooks/useChat";
import { useFrameSampler, type SampledFrame } from "@/hooks/useFrameSampler";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { useMicActivity } from "@/hooks/useMicActivity";
import { useRoleplay } from "@/hooks/useRoleplay";
import { useSpeechRecognition, type RecognizedSegment } from "@/hooks/useSpeechRecognition";
import { useTalkBalance } from "@/hooks/useTalkBalance";
import { useWebRTC } from "@/hooks/useWebRTC";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useOnlineCount } from "@/lib/online";
import { forgetRoom } from "@/lib/active-room";
import { currentSocket, getSocket, type AppSocket } from "@/lib/socket";
import { formatClock } from "@/lib/utils";

type RoomReady = Parameters<ServerToClientEvents["room:ready"]>[0];

export function LiveCall({
  roomId,
  onNext,
  onFeedback,
  onExit,
}: {
  roomId: string;
  onNext: () => void;
  onFeedback: (conversationId: string) => void;
  onExit: () => void;
}) {
  const { user, refresh } = useAuth();
  const online = useOnlineCount();
  const media = useLocalMedia();
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const rtc = useWebRTC(socket, roomId, media.stream);

  const [info, setInfo] = useState<{
    partner: PartnerInfo;
    targetLanguage: string;
    yourLevel: CefrLevel;
    startedAt: number;
  } | null>(null);
  const [partnerPresent, setPartnerPresent] = useState(false);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [topicLoading, setTopicLoading] = useState(true);
  const [topicError, setTopicError] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [ended, setEnded] = useState<{ reason: RoomEndReason } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [transcriptEntries, setTranscriptEntries] = useState<LiveTranscriptEntry[]>([]);
  const [dialog, setDialog] = useState<null | "report" | "block">(null);
  const [now, setNow] = useState(Date.now());
  const roleplay = useRoleplay(socket, roomId, Boolean(info) && !ended);

  const myAction = useRef<null | "ended" | "next" | "stop" | "moderation">(null);
  const joined = useRef(false);
  const mounted = useRef(false);
  const transcriptSequence = useRef(0);
  const floatLayer = useRef<HTMLDivElement>(null);
  const startRtc = rtc.start;

  useEffect(() => {
    if (user) setSocket(getSocket());
  }, [user]);

  useEffect(() => {
    if (!socket || !user || media.status === "pending" || joined.current) return;
    joined.current = true;
    if (socket.connected) socket.emit("room:join", { roomId });
  }, [socket, user, media.status, roomId]);

  useEffect(() => {
    if (!socket) return;
    const rejoin = () => joined.current && socket.emit("room:join", { roomId });
    socket.on("connect", rejoin);
    return () => {
      socket.off("connect", rejoin);
    };
  }, [socket, roomId]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      setTimeout(() => {
        if (mounted.current || myAction.current) return;
        forgetRoom();
        currentSocket()?.emit("room:leave", { roomId, reason: "ended" });
      }, 0);
    };
  }, [roomId]);

  useEffect(() => {
    if (!socket) return;
    const onReady = (r: RoomReady) => {
      setInfo({
        partner: r.partner,
        targetLanguage: r.targetLanguage,
        yourLevel: r.yourLevel,
        startedAt: Date.parse(r.startedAt),
      });
      setPartnerPresent(true);
      if (r.topic) {
        setTopic(r.topic);
        setTopicLoading(false);
      }
      void startRtc(r.role, r.iceServers);
    };
    const onWaiting = () => setPartnerPresent(false);
    const onTopic = (t: { topic: Topic | null; loading: boolean; error?: string }) => {
      if (t.topic) setTopic(t.topic);
      setTopicLoading(t.loading);
      setTopicError(t.error ?? null);
    };
    const onEnded = (e: { conversationId: string; reason: RoomEndReason; byPartner: boolean }) => {
      if (e.conversationId !== roomId) return;
      forgetRoom();
      myAction.current ??= "moderation";
      if (!e.byPartner) {
        if (myAction.current === "next") onNext();
        else if (myAction.current === "stop") onExit();
        else onFeedback(roomId);
      } else {
        setEnded({ reason: e.reason });
      }
    };
    const onError = ({ message }: { message: string }) => setRoomError(message);

    socket.on("room:ready", onReady);
    socket.on("room:waiting-partner", onWaiting);
    socket.on("topic:update", onTopic);
    socket.on("room:ended", onEnded);
    socket.on("room:error", onError);
    return () => {
      socket.off("room:ready", onReady);
      socket.off("room:waiting-partner", onWaiting);
      socket.off("topic:update", onTopic);
      socket.off("room:ended", onEnded);
      socket.off("room:error", onError);
    };
  }, [socket, roomId, startRtc, onNext, onFeedback, onExit]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const profileLevel =
    user?.targetLanguages.find((t) => t.language === user.activeTargetLanguage)?.level ?? null;
  const changeLevel = useCallback(
    (next: CefrLevel) => {
      const lang = user?.activeTargetLanguage;
      if (!lang) return;
      void api
        .setLanguage(lang, next)
        .then(refresh)
        .catch(() => {});
    },
    [user?.activeTargetLanguage, refresh],
  );

  const consent = Boolean(user?.privacy.transcriptionConsent);
  const speechLocale = getTargetLanguage(info?.targetLanguage ?? "")?.speechLocale ?? "en-US";
  const hasAudioTrack = Boolean(media.stream?.getAudioTracks().some((track) => track.readyState === "live"));
  const onSegment = useCallback(
    (segment: RecognizedSegment) => {
      setTranscriptEntries((entries) => [
        ...entries,
        { id: `you-${transcriptSequence.current++}`, speaker: "you", text: segment.text },
      ]);
      socket?.emit("transcript:segment", { roomId, ...segment });
    },
    [socket, roomId],
  );
  const speech = useSpeechRecognition({
    locale: speechLocale,
    enabled: consent && media.micOn && hasAudioTrack && Boolean(info) && !ended && !leaving,
    onSegment,
  });
  useEffect(() => {
    if (!socket || !info || ended || leaving) return;
    const onTranscript = (segment: { roomId: string; text: string }) => {
      if (segment.roomId !== roomId) return;
      setTranscriptEntries((entries) => [
        ...entries,
        { id: `partner-${transcriptSequence.current++}`, speaker: "partner", text: segment.text },
      ]);
    };
    socket.on("transcript:live", onTranscript);
    return () => {
      socket.off("transcript:live", onTranscript);
    };
  }, [socket, roomId, info, ended, leaving]);
  const micMs = useMicActivity(media.stream, Boolean(info) && !ended && speech.status !== "listening");
  const talk = useTalkBalance({
    socket,
    roomId,
    ready: Boolean(info) && !ended,
    startedAt: info?.startedAt ?? null,
    mineMs: speech.speakingMs > 0 ? speech.speakingMs : micMs,
    questions: roleplay.card ? [roleplay.card.situation] : (topic?.questions ?? []),
  });
  const chat = useChat(socket, roomId, Boolean(info) && !ended, {
    topic: roleplay.card?.scenarioTitle ?? topic?.title ?? "",
    recent: speech.finals,
  });

  const onFrame = useCallback(
    (f: SampledFrame) => socket?.emit("frame:sample", { roomId, ...f }),
    [socket, roomId],
  );
  useFrameSampler({
    stream: media.stream,
    enabled: consent && media.camOn && Boolean(info) && !ended,
    onFrame,
  });

  const leave = (reason: "ended" | "next" | "stop") => {
    myAction.current = reason;
    socket?.emit("room:leave", { roomId, reason: reason === "stop" ? "ended" : reason });
  };
  const afterModeration = () => {
    myAction.current = "moderation";
    setDialog(null);
  };

  if (roomError) {
    return (
      <section className="bg-stage grid min-h-dvh place-items-center px-6 text-center text-white">
        <div className="flex flex-col items-center gap-6">
          <p className="m-0 text-lg">{roomError}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={onNext}>Find a partner</Button>
            <Button variant="outline" onClick={onExit}>
              Back to start
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const elapsed = info ? (now - info.startedAt) / 1000 : 0;
  const partner = info?.partner;
  const partnerName = partner?.displayName ?? "Your partner";
  const partnerLevel = partner ? levelShort(info?.targetLanguage, partner.level) : "";
  const roleSuffix = roleplay.card ? ` as the ${roleplay.card.partnerRoleName}` : "";
  const myRole = roleplay.card ? ` as the ${roleplay.card.roleName}` : "";

  return (
    <section aria-label="In a call" className="bg-stage flex min-h-dvh flex-col text-white">
      <StageHeader online={online} compact onHome={onExit}>
        <span className="rounded-full bg-white/8 px-3 py-2">
          {info ? `${languageName(info.targetLanguage)}, ${levelShort(info.targetLanguage, info.yourLevel)}` : "Connecting…"}
        </span>
        <span className="rounded-full bg-white/8 px-3 py-2 tabular-nums">{formatClock(elapsed)}</span>
      </StageHeader>

      <main className="flex flex-1 flex-wrap items-start gap-5 px-5 py-5 sm:px-6">
        <div className="bg-panel flex min-w-0 shrink basis-160 flex-col gap-3.5 rounded-[22px] p-3.5 grow-[999]">
          <div ref={floatLayer} className="relative grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
            <VideoTile
              stream={rtc.remoteStream}
              side="partner"
              label={partner ? `${partnerName}${roleSuffix}, ${partnerLevel}` : "Connecting to your partner…"}
              initial={partnerName.charAt(0).toUpperCase()}
              placeholder={
                !partnerPresent ? (
                  <div className="text-dim-dark flex flex-col items-center gap-3 text-[15px]">
                    <Loader2 aria-hidden="true" className="size-6 animate-spin" />
                    {info ? "Your partner is reconnecting…" : "Connecting to your partner…"}
                  </div>
                ) : undefined
              }
            />
            <VideoTile
              stream={media.stream}
              side="you"
              label={`You${myRole}`}
              initial={(user?.username ?? "You").charAt(0).toUpperCase()}
              mirrored
              muted
              showVideo={media.camOn}
            />
          </div>

          <LiveCaptions speech={speech} consent={consent} />

          {socket && user && (
            <EmojiReactions socket={socket} roomId={roomId} myUserId={user.id} layer={floatLayer} />
          )}

          <LiveControls
            language={user?.activeTargetLanguage ?? null}
            level={profileLevel}
            onLevel={changeLevel}
            onNext={() => leave("next")}
            onStop={() => leave("stop")}
            onReport={() => setDialog("report")}
          />

          <ChatPanel chat={chat} myUserId={user?.id ?? ""} />
        </div>

        <CoachPanel
          topic={topic}
          loading={topicLoading}
          error={topicError}
          onNewTopic={() => socket?.emit("topic:request", { roomId })}
          roleplay={roleplay}
          talk={talk}
          partnerName={partnerName}
          transcript={
            <LiveTranscript
              entries={transcriptEntries}
              interim={speech.interim}
              status={speech.status}
              consent={consent}
              hasAudioTrack={hasAudioTrack}
              micOn={media.micOn}
              partnerName={partnerName}
            />
          }
        />
      </main>

      <div className="flex flex-wrap justify-center gap-3 px-6 pb-6">
        <Button variant="ghost" size="sm" className="text-dim-dark" onClick={() => setDialog("block")} disabled={!info}>
          Block this person
        </Button>
        <Button variant="ghost" size="sm" className="text-dim-dark" onClick={() => leave("ended")}>
          End and see my report
        </Button>
      </div>

      <ReportDialog
        conversationId={roomId}
        open={dialog === "report"}
        onOpenChange={(o) => setDialog(o ? "report" : null)}
        onDone={afterModeration}
      />
      <BlockDialog
        conversationId={roomId}
        partnerName={partnerName}
        open={dialog === "block"}
        onOpenChange={(o) => setDialog(o ? "block" : null)}
        onDone={afterModeration}
      />

      <Dialog open={Boolean(ended)}>
        <DialogContent
          className="[&>button:last-child]:hidden"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {ended?.reason === "disconnected" ? "Your partner lost connection" : "Your partner left the conversation"}
            </DialogTitle>
            <DialogDescription>
              Your AI report is being prepared. You can read it now or jump into another conversation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onFeedback(roomId)}>
              See my feedback
            </Button>
            <Button onClick={onNext}>Find another partner</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
