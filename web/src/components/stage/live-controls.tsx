"use client";

import { Flag, Mic, MicOff, SkipForward, Video, VideoOff } from "lucide-react";

export function LiveControls({
  micOn,
  camOn,
  hasVideo,
  onToggleMic,
  onToggleCam,
  onNext,
  onReport,
}: {
  micOn: boolean;
  camOn: boolean;
  hasVideo: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onNext: () => void;
  onReport: () => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
      <button
        type="button"
        onClick={onToggleMic}
        aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
        aria-pressed={!micOn}
        className="flex min-h-16 items-center justify-center gap-2.5 rounded-2xl border-0 bg-white/10 text-[17px] font-bold text-white"
      >
        {micOn ? <Mic aria-hidden="true" className="size-5.5" /> : <MicOff aria-hidden="true" className="size-5.5" />}
        {micOn ? "Mute" : "Unmute"}
      </button>

      <button
        type="button"
        onClick={onToggleCam}
        disabled={!hasVideo}
        aria-label={camOn ? "Turn camera off" : "Turn camera on"}
        aria-pressed={!camOn}
        className="flex min-h-16 items-center justify-center gap-2.5 rounded-2xl border-0 bg-white/10 text-[17px] font-bold text-white disabled:opacity-50"
      >
        {camOn ? (
          <Video aria-hidden="true" className="size-5.5" />
        ) : (
          <VideoOff aria-hidden="true" className="size-5.5" />
        )}
        {camOn ? "Camera" : "Camera off"}
      </button>

      <button
        type="button"
        onClick={onNext}
        className="text-ink flex min-h-16 items-center justify-center gap-2.5 rounded-2xl border-0 bg-white text-[19px] font-extrabold"
      >
        <SkipForward aria-hidden="true" className="size-5.5" />
        Next partner
      </button>

      <button
        type="button"
        onClick={onReport}
        className="flex min-h-16 items-center justify-center gap-2.5 rounded-2xl border border-[rgba(255,120,120,0.5)] bg-transparent text-[17px] font-semibold text-[#FFB4B4]"
      >
        <Flag aria-hidden="true" className="size-5" />
        Report
      </button>
    </div>
  );
}
