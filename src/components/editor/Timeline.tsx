"use client";

import type { MouseEvent, ReactNode } from "react";
import type { EditorSegment } from "@/lib/ai/schemas/analysis";
import { mn } from "@/lib/i18n/mn";
import { formatClock } from "@/utils/time";

type TimelineProps = {
  duration: number;
  playhead: number;
  segments: EditorSegment[];
  selectedId: string;
  onSeek: (time: number) => void;
  onSelect: (id: string) => void;
};

export function Timeline({ duration, playhead, segments, selectedId, onSeek, onSelect }: TimelineProps) {
  const ratio = duration > 0 ? Math.min(1, Math.max(0, playhead / duration)) : 0;

  function seek(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const next = ((event.clientX - rect.left) / rect.width) * duration;
    onSeek(Math.min(duration, Math.max(0, next)));
  }

  return (
    <section className="mx-3 mb-3 rounded-3xl border border-white/80 bg-white px-4 py-3 shadow-[0_12px_36px_rgba(70,40,140,0.06)]">
      <div className="mb-2 flex items-center justify-between text-xs text-faint">
        <span className="font-medium text-mute">{mn.timeline.title}</span>
        <span className="tabular-nums text-mute">{formatClock(playhead)}</span>
      </div>
      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3">
        <div className="space-y-1.5">
          <TrackLabel>{mn.timeline.video}</TrackLabel>
          <TrackLabel>{mn.timeline.captions}</TrackLabel>
          <TrackLabel>{mn.timeline.visuals}</TrackLabel>
          <TrackLabel>{mn.timeline.text}</TrackLabel>
        </div>
        <div className="relative space-y-1.5">
          <Track onClick={seek}>
            <div className="absolute inset-y-1 left-1 right-1 rounded-md bg-[#ddd6f3]" />
          </Track>
          <ClipTrack duration={duration} segments={segments} selectedId={selectedId} label={(segment) => segment.text} onSeek={seek} onSelect={onSelect} tone="caption" />
          <ClipTrack
            duration={duration}
            segments={segments.filter((segment) => segment.visualRecommendation.type !== "NONE")}
            selectedId={selectedId}
            label={(segment) => segment.visualRecommendation.type}
            onSeek={seek}
            onSelect={onSelect}
            tone="visual"
          />
          <ClipTrack
            duration={duration}
            segments={segments.filter((segment) => segment.overlayText.length > 0)}
            selectedId={selectedId}
            label={(segment) => segment.overlayText}
            onSeek={seek}
            onSelect={onSelect}
            tone="text"
          />
          <div className="pointer-events-none absolute inset-y-0 w-0.5 rounded-full bg-paper" style={{ left: `${ratio * 100}%` }} />
        </div>
      </div>
    </section>
  );
}

function TrackLabel({ children }: { children: string }) {
  return <span className="flex h-7 items-center text-[11px] font-medium text-faint">{children}</span>;
}

function Track({ children, onClick }: { children?: ReactNode; onClick: (event: MouseEvent<HTMLDivElement>) => void }) {
  return (
    <div className="relative h-7 cursor-pointer rounded-md bg-ink-2" onClick={onClick}>
      {children}
    </div>
  );
}

function ClipTrack({
  duration,
  segments,
  selectedId,
  label,
  onSeek,
  onSelect,
  tone = "caption",
}: {
  duration: number;
  segments: EditorSegment[];
  selectedId: string;
  label: (segment: EditorSegment) => string;
  onSeek: (event: MouseEvent<HTMLDivElement>) => void;
  onSelect: (id: string) => void;
  tone?: "caption" | "visual" | "text";
}) {
  return (
    <Track onClick={onSeek}>
      {segments.map((segment) => {
        const left = (segment.startTime / duration) * 100;
        const width = ((segment.endTime - segment.startTime) / duration) * 100;
        const selected = segment.id === selectedId;
        return (
          <button
            key={segment.id}
            type="button"
            title={label(segment)}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(segment.id);
            }}
            className={`absolute inset-y-1 truncate rounded-md px-1.5 text-left text-[10px] font-medium text-white ${
              tone === "visual" ? "bg-cyan" : tone === "text" ? "bg-pink" : "bg-accent"
            } ${selected ? "ring-2 ring-paper" : ""}`}
            style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
          >
            {label(segment)}
          </button>
        );
      })}
    </Track>
  );
}
