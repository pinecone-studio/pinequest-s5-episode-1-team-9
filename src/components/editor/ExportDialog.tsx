"use client";

import { useState } from "react";
import type { EditorSegment } from "@/lib/ai/schemas/analysis";
import { Button, buttonVariants } from "@/components/ui/button";
import { mn } from "@/lib/i18n/mn";
import { formatVtt } from "@/utils/time";

export function ExportDialog({
  segments,
  title,
  reelUrl,
  onClose,
}: {
  segments: EditorSegment[];
  title: string;
  reelUrl?: string;
  onClose: () => void;
}) {
  const [missingReel, setMissingReel] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  function downloadCaptions() {
    const cues = segments.map((segment, index) => {
      return `${index + 1}\n${formatVtt(segment.startTime)} --> ${formatVtt(segment.endTime)}\n${segment.text}`;
    });
    const vtt = `WEBVTT\n\n${cues.join("\n\n")}\n`;
    const blob = new Blob([vtt], { type: "text/vtt" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/\s+/g, "-").toLowerCase()}.vtt`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-[#1b1633]/35 px-4 backdrop-blur-sm" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-labelledby="export-title"
        className="w-full max-w-md rounded-3xl border border-white/80 bg-white p-6 shadow-[0_24px_70px_rgba(70,40,140,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm font-medium text-accent">{mn.export.kicker}</p>
        <h2 id="export-title" className="mt-2 text-3xl font-semibold tracking-tight">
          {reelUrl ? mn.export.ready : title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-mute">{mn.export.body}</p>
        {missingReel ? <p className="mt-3 text-sm text-warning">{mn.export.missing}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={downloadCaptions}>{downloaded ? mn.export.captionsSaved : mn.export.captions}</Button>
          {reelUrl ? (
            <a href={reelUrl} download className={buttonVariants()}>
              {mn.export.download}
            </a>
          ) : (
            <Button variant="quiet" onClick={() => setMissingReel(true)}>
              {mn.export.reel}
            </Button>
          )}
          <Button variant="quiet" onClick={onClose}>
            {mn.export.close}
          </Button>
        </div>
      </div>
    </div>
  );
}
