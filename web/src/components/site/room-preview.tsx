"use client";

import { CEFR_LEVELS, languageName, type CefrLevel, type PartnerInfo } from "@linguamatch/shared";
import { Loader2, PhoneOff, SkipForward, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { VideoTile } from "@/components/room/video-tile";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getSocket, useSocketStatus, type AppSocket } from "@/lib/socket";
import { useWebRTC } from "@/hooks/useWebRTC";

/** Clerk's sign-in sends the user back to `redirect_url`, so they land here again ready to press Start. */
const SIGN_IN_URL = `/login?redirect_url=${encodeURIComponent("/")}`;

type SessionPhase =
  | "idle"
  | "starting"
  | "searching"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "partner-left"
  | "stopped"
  | "error";

export function RoomPreview() {
  const { user, loading: authLoading, setUser } = useAuth();
  const router = useRouter();
  const socketStatus = useSocketStatus();
  const activeLanguage = user?.activeTargetLanguage ?? "";
  const activeLevel = user?.targetLanguages.find((target) => target.language === activeLanguage)?.level ?? "";
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [waitingCount, setWaitingCount] = useState<number | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const rtc = useWebRTC(socket, roomId ?? "", localStream);
  const phaseRef = useRef(phase);
  const sessionActiveRef = useRef(false);
  const mediaRequestRef = useRef(false);
  const mountedRef = useRef(false);
  const queueJoinSentRef = useRef(false);
  const roomIdRef = useRef<string | null>(null);
  const socketRef = useRef<AppSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const partnerSeenRef = useRef(false);
  const searchStartedAtRef = useRef(0);
  const languageRef = useRef(activeLanguage);
  const rtcStartRef = useRef(rtc.start);
  const rtcCloseRef = useRef(rtc.close);

  phaseRef.current = phase;
  languageRef.current = activeLanguage;
  rtcStartRef.current = rtc.start;
  rtcCloseRef.current = rtc.close;

  const updatePhase = useCallback((next: SessionPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const joinQueue = useCallback(
    (activeSocket: AppSocket) => {
      const language = languageRef.current;
      if (!sessionActiveRef.current || !language || queueJoinSentRef.current || roomIdRef.current) return;
      queueJoinSentRef.current = true;
      searchStartedAtRef.current = Date.now();
      setWaitSeconds(0);
      setWaitingCount(null);
      setErrorMessage("");
      updatePhase("searching");
      activeSocket.emit("queue:join", { targetLanguage: language });
    },
    [updatePhase],
  );

  const stopSession = useCallback(() => {
    sessionActiveRef.current = false;
    const activeSocket = socketRef.current;
    if (queueJoinSentRef.current) activeSocket?.emit("queue:leave");
    queueJoinSentRef.current = false;
    const activeRoomId = roomIdRef.current;
    if (activeRoomId) activeSocket?.emit("room:leave", { roomId: activeRoomId, reason: "ended" });
    roomIdRef.current = null;
    setRoomId(null);
    partnerSeenRef.current = false;
    setPartner(null);
    rtcCloseRef.current();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLocalStream(null);
    setWaitingCount(null);
    setErrorMessage("");
    updatePhase("stopped");
  }, [updatePhase]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sessionActiveRef.current = false;
      const activeSocket = socketRef.current;
      if (queueJoinSentRef.current) activeSocket?.emit("queue:leave");
      if (roomIdRef.current) {
        activeSocket?.emit("room:leave", { roomId: roomIdRef.current, reason: "ended" });
      }
      queueJoinSentRef.current = false;
      roomIdRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      if (!sessionActiveRef.current) return;
      if (roomIdRef.current) {
        updatePhase("connecting");
        socket.emit("room:join", { roomId: roomIdRef.current });
      } else {
        joinQueue(socket);
      }
    };
    const onDisconnect = () => {
      if (sessionActiveRef.current) {
        if (!roomIdRef.current) queueJoinSentRef.current = false;
        updatePhase("reconnecting");
      }
    };
    const onQueueStatus = (status: { waiting: number }) => setWaitingCount(status.waiting);
    const onQueueMatched = ({ roomId: matchedRoomId }: { roomId: string }) => {
      if (!sessionActiveRef.current) {
        socket.emit("room:leave", { roomId: matchedRoomId, reason: "ended" });
        return;
      }
      queueJoinSentRef.current = false;
      roomIdRef.current = matchedRoomId;
      partnerSeenRef.current = false;
      setRoomId(matchedRoomId);
      setPartner(null);
      updatePhase("connecting");
      socket.emit("room:join", { roomId: matchedRoomId });
    };
    const onQueueError = ({ message }: { message: string }) => {
      queueJoinSentRef.current = false;
      sessionActiveRef.current = false;
      setErrorMessage(message);
      updatePhase("error");
    };
    const onRoomReady = (ready: Parameters<import("@linguamatch/shared").ServerToClientEvents["room:ready"]>[0]) => {
      if (!sessionActiveRef.current || ready.roomId !== roomIdRef.current) return;
      partnerSeenRef.current = true;
      setPartner(ready.partner);
      updatePhase("connecting");
      void rtcStartRef.current(ready.role, ready.iceServers).catch(() => {
        rtcCloseRef.current();
        setErrorMessage("Could not establish the video connection. Try Next to find another partner.");
        updatePhase("partner-left");
      });
    };
    const onRoomWaiting = () => {
      if (!sessionActiveRef.current) return;
      rtcCloseRef.current();
      setPartner(null);
      if (partnerSeenRef.current) {
        partnerSeenRef.current = false;
        setErrorMessage("Your partner disconnected. Choose Next to find someone else, or Start to try again.");
        updatePhase("partner-left");
      } else {
        updatePhase("connecting");
      }
    };
    const onRoomEnded = (ended: { conversationId: string; byPartner: boolean }) => {
      if (ended.conversationId !== roomIdRef.current) return;
      roomIdRef.current = null;
      setRoomId(null);
      partnerSeenRef.current = false;
      setPartner(null);
      rtcCloseRef.current();
      if (sessionActiveRef.current) {
        setErrorMessage(
          ended.byPartner
            ? "Your partner disconnected. Choose Next to find someone else, or Start to try again."
            : "The connection ended before a partner could join. Choose Next or Start to search again.",
        );
        updatePhase("partner-left");
      }
    };
    const onRoomError = ({ message }: { message: string }) => {
      sessionActiveRef.current = false;
      if (roomIdRef.current) {
        socket.emit("room:leave", { roomId: roomIdRef.current, reason: "ended" });
        roomIdRef.current = null;
        setRoomId(null);
      }
      partnerSeenRef.current = false;
      setPartner(null);
      setErrorMessage(message);
      rtcCloseRef.current();
      updatePhase("error");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("queue:status", onQueueStatus);
    socket.on("queue:matched", onQueueMatched);
    socket.on("queue:error", onQueueError);
    socket.on("room:ready", onRoomReady);
    socket.on("room:waiting-partner", onRoomWaiting);
    socket.on("room:ended", onRoomEnded);
    socket.on("room:error", onRoomError);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("queue:status", onQueueStatus);
      socket.off("queue:matched", onQueueMatched);
      socket.off("queue:error", onQueueError);
      socket.off("room:ready", onRoomReady);
      socket.off("room:waiting-partner", onRoomWaiting);
      socket.off("room:ended", onRoomEnded);
      socket.off("room:error", onRoomError);
    };
  }, [socket, joinQueue, updatePhase]);

  useEffect(() => {
    if (phase !== "searching") return;
    const timer = setInterval(() => {
      setWaitSeconds(Math.floor((Date.now() - searchStartedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!sessionActiveRef.current) return;
    if (rtc.state === "connected") updatePhase("connected");
    else if (rtc.state === "reconnecting") updatePhase("reconnecting");
    else if (rtc.state === "failed") {
      rtcCloseRef.current();
      partnerSeenRef.current = false;
      setPartner(null);
      setErrorMessage("The video connection failed. Choose Next to find another partner.");
      updatePhase("partner-left");
    }
  }, [rtc.state, updatePhase]);

  async function startSession() {
    if (mediaRequestRef.current || ["searching", "connecting", "connected", "reconnecting"].includes(phaseRef.current)) return;
    if (authLoading) {
      setErrorMessage("Your account is still connecting. Try Start again in a moment.");
      updatePhase("error");
      return;
    }
    if (!user) {
      router.push(SIGN_IN_URL);
      return;
    }
    if (!user.onboarded || !activeLanguage) {
      setErrorMessage("Finish setting up a practice language before matching.");
      updatePhase("error");
      return;
    }
    if (phaseRef.current === "partner-left" && streamRef.current && socketRef.current) {
      nextPartner();
      return;
    }

    mediaRequestRef.current = true;
    sessionActiveRef.current = true;
    setErrorMessage("");
    if (!streamRef.current) updatePhase("starting");
    try {
      if (!streamRef.current) {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(window.isSecureContext ? "MEDIA_UNAVAILABLE" : "HTTPS_REQUIRED");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!mountedRef.current || !sessionActiveRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setLocalStream(stream);
      }

      const activeSocket = socketRef.current ?? getSocket();
      if (socketRef.current) {
        if (activeSocket.connected) joinQueue(activeSocket);
        else updatePhase("searching");
      } else {
        socketRef.current = activeSocket;
        setSocket(activeSocket);
        updatePhase("searching");
      }
    } catch (error) {
      sessionActiveRef.current = false;
      const name = error instanceof DOMException ? error.name : (error as Error).message;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setErrorMessage("Camera or microphone permission was denied. Allow access in your browser site settings, then try Start again.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setErrorMessage("No camera or microphone was found. Connect a device and try again.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setErrorMessage("Your camera or microphone is already in use by another app.");
      } else if (name === "HTTPS_REQUIRED") {
        setErrorMessage("Camera access requires HTTPS, or localhost during development.");
      } else if (name === "MEDIA_UNAVAILABLE") {
        setErrorMessage("This browser does not support camera and microphone access.");
      } else {
        setErrorMessage("Could not access your camera or microphone. Check browser permissions and try again.");
      }
      updatePhase("error");
    } finally {
      mediaRequestRef.current = false;
    }
  }

  function nextPartner() {
    const activeSocket = socketRef.current;
    if (!activeSocket || !localStream || mediaRequestRef.current) return;
    sessionActiveRef.current = true;
    if (queueJoinSentRef.current) activeSocket.emit("queue:leave");
    queueJoinSentRef.current = false;
    if (roomIdRef.current) {
      activeSocket.emit("room:leave", { roomId: roomIdRef.current, reason: "next" });
    }
    roomIdRef.current = null;
    setRoomId(null);
    partnerSeenRef.current = false;
    setPartner(null);
    rtcCloseRef.current();
    joinQueue(activeSocket);
  }

  async function saveLanguage(language: string) {
    if (!user || !language || savingSettings) return;
    setSavingSettings(true);
    setSettingsMessage("Saving language…");
    try {
      const result = await api.updateSettings({ activeTargetLanguage: language });
      setUser(result.user);
      setSettingsMessage("Language saved");
    } catch {
      setSettingsMessage("Could not save language");
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveLevel(level: CefrLevel) {
    if (!user || !activeLanguage || savingSettings) return;
    setSavingSettings(true);
    setSettingsMessage("Saving level…");
    try {
      const result = await api.setLanguage(activeLanguage, level);
      setUser(result.user);
      setSettingsMessage("Level saved");
    } catch {
      setSettingsMessage("Could not save level");
    } finally {
      setSavingSettings(false);
    }
  }

  const statusText = getStatusText({ phase, authLoading, socketStatus, waitingCount, waitSeconds, errorMessage });
  const busy = ["starting", "searching", "connecting", "connected", "reconnecting"].includes(phase);
  const canStop = busy || Boolean(localStream);
  const canNext = Boolean(localStream) && phase !== "starting" && phase !== "stopped";
  const settingsLocked = busy || Boolean(localStream) || savingSettings;

  return (
    <div className="w-full">
      <div className="grid gap-3 sm:grid-cols-2">
        <VideoTile
          stream={rtc.remoteStream}
          label="Partner"
          sublabel={partner ? `· ${partner.level}` : undefined}
          className="aspect-video sm:aspect-[4/3] lg:aspect-auto lg:min-h-[min(65svh,680px)]"
          placeholder={
            <div className="flex flex-col items-center gap-3 px-4 text-center text-sm text-neutral-300">
              {phase === "searching" || phase === "connecting" || phase === "reconnecting" ? (
                <Loader2 className="size-6 animate-spin" />
              ) : null}
              {phase === "searching"
                ? "Searching for a partner…"
                : phase === "connecting" || phase === "reconnecting"
                  ? "Connecting to your partner…"
                  : phase === "partner-left"
                    ? "Partner disconnected"
                    : "Your partner's live video will appear here"}
            </div>
          }
        />
        <VideoTile
          stream={localStream}
          label="You"
          sublabel={activeLevel || undefined}
          muted
          mirrored
          className="aspect-video sm:aspect-[4/3] lg:aspect-auto lg:min-h-[min(65svh,680px)]"
          placeholder={<span className="px-4 text-center text-sm text-neutral-300">Your camera preview appears after you start</span>}
        />
      </div>

      <div className="mt-3 rounded-xl border bg-card p-3 sm:mt-4 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            <div className="min-w-0 sm:w-40">
              <label htmlFor="home-language" className="text-muted-foreground mb-1 block text-xs font-medium">
                Practice language
              </label>
              <NativeSelect
                id="home-language"
                aria-label="Practice language"
                value={activeLanguage}
                disabled={!user?.onboarded || !user.targetLanguages.length || settingsLocked}
                onChange={(event) => void saveLanguage(event.target.value)}
              >
                {!activeLanguage && <option value="">Set up profile</option>}
                {user?.targetLanguages.map((target) => (
                  <option key={target.language} value={target.language}>
                    {languageName(target.language)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="sm:w-24">
              <label htmlFor="home-level" className="text-muted-foreground mb-1 block text-xs font-medium">
                Level
              </label>
              <NativeSelect
                id="home-level"
                aria-label="Proficiency level"
                value={activeLevel}
                disabled={!user?.onboarded || !activeLanguage || settingsLocked}
                onChange={(event) => void saveLevel(event.target.value as CefrLevel)}
              >
                {!activeLevel && <option value="">Set up</option>}
                {CEFR_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void startSession()} disabled={busy}>
              <Video /> Start
            </Button>
            <Button variant="secondary" onClick={nextPartner} disabled={!canNext}>
              <SkipForward /> Next
            </Button>
            <Button variant="destructive" onClick={stopSession} disabled={!canStop}>
              <PhoneOff /> Stop
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              How it works
            </Button>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:w-full" role="status" aria-live="polite">
            <span className={`size-2 shrink-0 rounded-full ${phase === "connected" ? "bg-emerald-500" : phase === "error" ? "bg-red-500" : "bg-amber-500"}`} />
            <span className="text-muted-foreground">{statusText}</span>
            {localStream && <span className="text-success">Camera and microphone active</span>}
            {!user && !authLoading && phase === "error" && (
              <Link className="text-primary hover:underline" href={SIGN_IN_URL}>Sign in</Link>
            )}
            {user && !user.onboarded && phase === "error" && (
              <Link className="text-primary hover:underline" href="/onboarding">Finish setup</Link>
            )}
            {settingsMessage && <span className="text-muted-foreground">{settingsMessage}</span>}
          </div>
          {errorMessage && <p role="alert" className="text-destructive text-sm sm:w-full">{errorMessage}</p>}
        </div>
      </div>
    </div>
  );
}

function getStatusText({
  phase,
  authLoading,
  socketStatus,
  waitingCount,
  waitSeconds,
  errorMessage,
}: {
  phase: SessionPhase;
  authLoading: boolean;
  socketStatus: ReturnType<typeof useSocketStatus>;
  waitingCount: number | null;
  waitSeconds: number;
  errorMessage: string;
}) {
  if (phase === "error") return "Action needed";
  if (phase === "starting") return "Starting your camera and microphone…";
  if (phase === "searching") {
    if (socketStatus === "unreachable" || socketStatus === "reconnecting") return "Signaling server unavailable. Retrying connection…";
    if (socketStatus === "auth_error") return "Signaling server authentication failed. Sign in again to continue.";
    if (waitSeconds >= 30) return "No partner available yet. Still searching…";
    return waitingCount === null
      ? "Connecting to matchmaking…"
      : `Searching for a partner · ${Math.max(0, waitingCount - 1)} other${waitingCount === 2 ? "" : "s"} waiting`;
  }
  if (phase === "connecting") return "Connecting to partner…";
  if (phase === "connected") return "Connected to a live partner";
  if (phase === "reconnecting") return "Reconnecting to the signaling server…";
  if (phase === "partner-left") return "Partner disconnected";
  if (phase === "stopped") return "Stopped · camera and microphone are off";
  if (authLoading) return "Checking your account…";
  return "Camera permission required · press Start to begin";
}