"use client";

import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useEffect, useRef } from "react";
import type { MediaStatus } from "@/hooks/useLocalMedia";

export function SelfTile({
  stream,
  status,
  initial,
  micOn,
  camOn,
  onToggleMic,
  onToggleCam,
  showControls = true,
}: {
  stream: MediaStream | null;
  status: MediaStatus;
  initial: string;
  micOn: boolean;
  camOn: boolean;
  onToggleMic?: () => void;
  onToggleCam?: () => void;
  showControls?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = video.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);

  const live = Boolean(stream) && camOn && status !== "audio-only";

  return (
    <div className="border-brand-you bg-brand-you-soft relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-[22px] border-[3px]">
      {live ? (
        <video ref={video} autoPlay playsInline muted className="size-full -scale-x-100 object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="bg-brand-you font-display flex size-24 items-center justify-center rounded-full text-[36px] font-bold text-white"
        >
          {initial}
        </span>
      )}
      <span className="bg-brand-you absolute top-3.5 left-3.5 rounded-full px-3 py-1.5 text-sm font-bold text-white">
        {stream ? (camOn && status !== "audio-only" ? "You, camera on" : "You, camera off") : "You"}
      </span>
      {showControls && stream && (
        <div className="absolute right-3 bottom-3 flex gap-2">
          <button
            type="button"
            onClick={onToggleMic}
            aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
            className="grid size-11 place-items-center rounded-full bg-[rgba(20,18,58,0.75)] text-white"
          >
            {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </button>
          <button
            type="button"
            onClick={onToggleCam}
            aria-label={camOn ? "Turn camera off" : "Turn camera on"}
            className="grid size-11 place-items-center rounded-full bg-[rgba(20,18,58,0.75)] text-white"
          >
            {camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
          </button>
        </div>
      )}
    </div>
  );
}
