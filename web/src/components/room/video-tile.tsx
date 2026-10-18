"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function VideoTile({
  stream,
  label,
  side,
  initial,
  mirrored = false,
  muted = false,
  showVideo = true,
  blurred = false,
  placeholder,
  children,
}: {
  stream: MediaStream | null;
  label: string;
  side: "you" | "partner";
  initial: string;
  mirrored?: boolean;
  muted?: boolean;
  showVideo?: boolean;
  blurred?: boolean;
  placeholder?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = video.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);

  const you = side === "you";
  const live = Boolean(stream) && showVideo;

  return (
    <div
      className={cn(
        "relative flex aspect-[4/3] min-w-0 items-center justify-center overflow-hidden rounded-[18px] border-2 shadow-sm",
        you ? "border-brand-you bg-brand-you-soft" : "border-brand-partner/70 bg-panel",
      )}
    >
      {live ? (
        <video
          ref={video}
          autoPlay
          playsInline
          muted={muted}
          className={cn(
            "size-full object-cover transition-[filter]",
            mirrored && "-scale-x-100",
            blurred && "scale-110 blur-2xl",
          )}
        />
      ) : (
        (placeholder ?? (
          <span
            aria-hidden="true"
            className={cn(
              "font-display grid size-24 place-items-center rounded-full text-[36px] font-bold",
              you ? "bg-brand-you text-white" : "bg-brand-partner text-ink",
            )}
          >
            {initial}
          </span>
        ))
      )}
      <span
        className={cn(
          "absolute top-3.5 left-3.5 max-w-[calc(100%-28px)] truncate rounded-full px-3 py-1.5 text-sm font-bold",
          you ? "bg-brand-you text-white" : "bg-brand-partner text-ink",
        )}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
