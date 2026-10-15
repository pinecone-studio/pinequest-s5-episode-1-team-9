"use client";

import type { CefrLevel } from "@linguamatch/shared";
import { ChevronDown, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IdleChat, IdleCoach, WarmupCoach } from "@/components/stage/idle-panels";
import { LiveCall } from "@/components/stage/live-call";
import { IdleControls, SearchingControls } from "@/components/stage/control-row";
import { PartnerIdleTile, PartnerSearchingTile } from "@/components/stage/partner-tile";
import { SelfTile } from "@/components/stage/self-tile";
import { StageHeader } from "@/components/stage/stage-header";
import { useCallStage } from "@/hooks/useCallStage";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useOnlineCount } from "@/lib/online";

const MEDIA_MESSAGE: Record<string, string> = {
  denied:
    "Camera and microphone are blocked. Allow them in your browser's site settings, then press Start again.",
  unavailable: "We couldn't find a camera or microphone on this device.",
  "audio-only": "No camera found, so you'll join with audio only.",
};

export function CallStage() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const online = useOnlineCount();

  const [language, setLanguage] = useState<string | null>(null);
  const [level, setLevel] = useState<CefrLevel | null>(null);

  useEffect(() => {
    if (!user) return;
    setLanguage(user.activeTargetLanguage);
    setLevel(user.targetLanguages.find((t) => t.language === user.activeTargetLanguage)?.level ?? null);
  }, [user]);

  const stage = useCallStage(language, level);
  const media = useLocalMedia(stage.wantsMedia);

  const chooseLanguage = useCallback(
    (code: string) => {
      setLanguage(code);
      const known = user?.targetLanguages.find((t) => t.language === code);
      setLevel(known?.level ?? level ?? "A1");
      if (!user) return;
      const save = known
        ? api.updateSettings({ activeTargetLanguage: code })
        : api.setLanguage(code, level ?? "A1").then(() => api.updateSettings({ activeTargetLanguage: code }));
      void save.then(refresh).catch(() => {});
    },
    [user, level, refresh],
  );

  const chooseLevel = useCallback(
    (next: CefrLevel) => {
      setLevel(next);
      if (!user || !language) return;
      void api.setLanguage(language, next).then(refresh).catch(() => {});
    },
    [user, language, refresh],
  );

  const toFeedback = useCallback((id: string) => router.push(`/feedback/${id}`), [router]);

  const mediaNote = stage.wantsMedia ? MEDIA_MESSAGE[media.status] : undefined;
  const searching = stage.phase === "searching";

  if (stage.phase === "live" && stage.roomId) {
    return <LiveCall roomId={stage.roomId} onNext={stage.start} onFeedback={toFeedback} />;
  }

  return (
    <section aria-label="Start a call" className="bg-stage flex min-h-dvh flex-col text-white">
      <StageHeader online={online} />

      <div className="flex flex-1 flex-wrap items-stretch gap-5 px-5 py-5 sm:px-6">
        <div className="bg-panel flex min-w-0 shrink basis-160 flex-col gap-3.5 rounded-[22px] p-3.5 grow-[999]">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5">
            {searching ? (
              <PartnerSearchingTile language={language} level={level ?? "B1"} elapsed={stage.elapsed} />
            ) : (
              <PartnerIdleTile />
            )}
            <SelfTile
              stream={media.stream}
              status={media.status}
              initial={(user?.username ?? "You").charAt(0).toUpperCase()}
              micOn={media.micOn}
              camOn={media.camOn}
              onToggleMic={media.toggleMic}
              onToggleCam={media.toggleCam}
            />
          </div>

          {(stage.error || mediaNote) && (
            <p
              role="status"
              className="text-brand-partner-text flex items-start gap-2 rounded-2xl border border-[rgba(240,165,50,0.35)] bg-[rgba(240,165,50,0.1)] px-4 py-3 text-[15px] leading-[1.5]"
            >
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" />
              {stage.error ?? mediaNote}
            </p>
          )}

          {searching ? (
            <SearchingControls
              language={language}
              level={level}
              mode="video"
              waiting={stage.waiting}
              onStop={stage.stop}
            />
          ) : (
            <IdleControls
              language={language}
              level={level}
              canStop={false}
              onStart={stage.start}
              onStop={stage.stop}
              onLanguage={chooseLanguage}
              onLevel={chooseLevel}
            />
          )}

          <IdleChat />
        </div>

        {searching ? <WarmupCoach /> : <IdleCoach />}
      </div>

      <a
        href="#about"
        className="text-dim-dark mx-auto mt-1 mb-5 inline-flex flex-col items-center gap-1 px-3 py-2 text-[15px] no-underline"
      >
        New here? See how it works
        <ChevronDown aria-hidden="true" className="size-5" />
      </a>
    </section>
  );
}
