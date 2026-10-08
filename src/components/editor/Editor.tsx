"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ExportDialog } from "@/components/editor/ExportDialog";
import { Inspector } from "@/components/editor/Inspector";
import { Timeline } from "@/components/editor/Timeline";
import { ToolRail, type Tool } from "@/components/editor/ToolRail";
import { Button } from "@/components/ui/button";
import { Stage } from "@/components/video/Stage";
import type { EditorSegment, Project } from "@/lib/ai/schemas/analysis";
import { SAMPLE_VIDEO } from "@/lib/demo/projects";
import { mn } from "@/lib/i18n/mn";
import { formatClock } from "@/utils/time";

export function Editor({
  project,
  uploadedName,
  mediaUrl,
  reelUrl,
  sampleNote,
}: {
  project: Project;
  uploadedName?: string;
  mediaUrl?: string;
  reelUrl?: string;
  sampleNote?: boolean;
}) {
  const [segments, setSegments] = useState(project.segments);
  const [selectedId, setSelectedId] = useState(project.segments[0]?.id ?? "");
  const [tool, setTool] = useState<Tool>("visual");
  const [playhead, setPlayhead] = useState(project.segments[0]?.startTime ?? 0);
  const [playing, setPlaying] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!playing || mediaUrl) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;
      let finished = false;
      setPlayhead((time) => {
        const next = time + delta;
        if (next >= project.duration) {
          finished = true;
          return 0;
        }
        return next;
      });
      if (finished) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, mediaUrl, project.duration]);

  const selected = segments.find((segment) => segment.id === selectedId) ?? segments[0];
  const live = segments.find((segment) => playhead >= segment.startTime && playhead < segment.endTime);
  const shown = playing ? live : selected;

  function patch(partial: Partial<EditorSegment>) {
    if (!selected) return;
    setSegments((all) => all.map((segment) => (segment.id === selected.id ? { ...segment, ...partial } : segment)));
  }

  function select(id: string) {
    const segment = segments.find((item) => item.id === id);
    setSelectedId(id);
    setPlaying(false);
    if (segment) {
      setPlayhead(segment.startTime);
      if (videoRef.current) videoRef.current.currentTime = segment.startTime;
    }
  }

  if (!selected) {
    return <p className="p-8 text-mute">{mn.editor.empty}</p>;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 pt-4">
        <div className="flex h-14 items-center justify-between gap-4 rounded-full border border-white/80 bg-white/80 px-3 shadow-[0_10px_30px_rgba(70,40,140,0.06)] backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-4">
            <Logo href="/dashboard" />
            <p className="truncate text-sm text-mute">{uploadedName || project.title}</p>
          </div>
          <Button onClick={() => setExportOpen(true)}>{mn.editor.export}</Button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[88px_minmax(0,1fr)_340px]">
        <ToolRail tool={tool} onChange={setTool} />
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-1 items-center justify-center px-4 py-6">
            {mediaUrl ? (
              <div className="relative aspect-[9/16] h-[min(62vh,620px)] overflow-hidden rounded-2xl bg-black">
                <video
                  ref={videoRef}
                  src={mediaUrl}
                  className="h-full w-full object-cover"
                  playsInline
                  onTimeUpdate={(event) => setPlayhead(event.currentTarget.currentTime)}
                  onEnded={() => setPlaying(false)}
                />
                {shown?.imageUrl && shown.visualRecommendation.type !== "NONE" ? (
                  <Image
                    src={shown.imageUrl}
                    alt=""
                    width={280}
                    height={210}
                    unoptimized
                    className="absolute right-[6%] top-[16%] w-[38%] rounded-md border border-white/10 object-cover"
                  />
                ) : null}
                {shown?.overlayText && shown.visualRecommendation.type !== "NONE" ? (
                  <p className="absolute right-[6%] top-[42%] w-[38%] text-[10px] font-semibold tracking-[0.08em] text-white">
                    {shown.overlayText}
                  </p>
                ) : null}
                {shown?.text ? (
                  <p className="absolute inset-x-3 bottom-3 rounded-md bg-black/72 px-2.5 py-2 text-center text-sm font-semibold leading-snug">
                    {shown.text}
                  </p>
                ) : null}
              </div>
            ) : (
              <Stage
                className="h-[min(62vh,620px)] w-auto"
                subtitle={shown?.text}
                overlay={shown && shown.visualRecommendation.type !== "NONE" ? shown.overlayText : undefined}
                topic={shown?.topic ?? selected.topic}
                visualType={shown?.visualRecommendation.type ?? "NONE"}
                position={shown?.visualRecommendation.position}
                scale={shown?.scale}
                opacity={shown?.opacity}
                imageUrl={shown?.imageUrl}
              />
            )}
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              aria-label={playing ? mn.editor.pause : mn.editor.play}
              onClick={() => {
                const video = videoRef.current;
                if (video) {
                  if (playing) video.pause();
                  else void video.play();
                }
                setPlaying((value) => !value);
              }}
              className="grid h-10 w-10 place-items-center rounded-full bg-white text-paper shadow-[0_8px_20px_rgba(70,40,140,0.1)] transition duration-200 hover:scale-105"
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <span className="text-xs tabular-nums text-mute">
              {formatClock(playhead)} / {formatClock(project.duration)}
            </span>
          </div>
        </div>
        <Inspector
          tool={tool}
          onOpenMedia={() => setTool("media")}
          projectDuration={project.duration}
          segments={segments}
          selected={selected}
          sampleNote={sampleNote ?? Boolean(uploadedName && uploadedName !== SAMPLE_VIDEO.name && !mediaUrl)}
          onSelect={select}
          onPatch={patch}
          onPosition={(position) =>
            patch({
              visualRecommendation: { ...selected.visualRecommendation, position },
            })
          }
          onClearVisual={() =>
            patch({
              visualRecommendation: { ...selected.visualRecommendation, type: "NONE" },
              overlayText: "",
            })
          }
        />
      </div>
      <Timeline
        duration={project.duration}
        playhead={playhead}
        segments={segments}
        selectedId={selected.id}
        onSeek={(time) => {
          setPlaying(false);
          setPlayhead(time);
          if (videoRef.current) videoRef.current.pause();
          if (videoRef.current) videoRef.current.currentTime = time;
        }}
        onSelect={select}
      />
      {exportOpen ? (
        <ExportDialog
          segments={segments}
          title={uploadedName || project.title}
          reelUrl={reelUrl}
          onClose={() => setExportOpen(false)}
        />
      ) : null}
    </div>
  );
}
