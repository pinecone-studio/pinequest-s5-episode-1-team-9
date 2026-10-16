"use client";

import { useEffect, useRef } from "react";

export interface SampledFrame {
  mimeType: string;
  /** Base64-encoded JPEG (no data: URL prefix). */
  data: string;
  capturedAt: number;
}

const SAMPLE_INTERVAL_MS = 1_000;
const MAX_DIMENSION = 320;
const JPEG_QUALITY = 0.55;
/** Kept comfortably under the server/socket payload cap (~60k chars). */
const MAX_FRAME_CHARS = 60_000;

/** Draws the current video frame to an offscreen canvas and returns a compressed JPEG. */
function captureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): SampledFrame | null {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;

  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const comma = dataUrl.indexOf(",");
  const data = comma >= 0 ? dataUrl.slice(comma + 1) : "";
  if (!data || data.length > MAX_FRAME_CHARS) return null;
  return { mimeType: "image/jpeg", data, capturedAt: Date.now() };
}

/**
 * Periodically samples still frames from the local camera (never the remote partner's stream) and
 * hands them to `onFrame` for safety review. The frames are compressed thumbnails that are sent to
 * the server's moderation sweep and are never recorded or stored in the browser.
 */
export function useFrameSampler(opts: {
  stream: MediaStream | null;
  enabled: boolean;
  onFrame: (frame: SampledFrame) => void;
}) {
  const onFrameRef = useRef(opts.onFrame);
  onFrameRef.current = opts.onFrame;

  useEffect(() => {
    if (!opts.enabled || !opts.stream) return;
    const track = opts.stream.getVideoTracks()[0];
    if (!track) return;

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([track]);
    const canvas = document.createElement("canvas");

    let stopped = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const sample = () => {
      if (stopped || video.readyState < 2) return;
      const frame = captureFrame(video, canvas);
      if (frame) onFrameRef.current(frame);
    };

    video
      .play()
      .then(() => {
        if (stopped) return;
        sample();
        interval = setInterval(sample, SAMPLE_INTERVAL_MS);
      })
      .catch(() => {
        /* Autoplay blocked or track unavailable: skip sampling rather than crash. */
      });

    return () => {
      stopped = true;
      if (interval) clearInterval(interval);
      video.srcObject = null;
      video.pause();
    };
  }, [opts.enabled, opts.stream]);
}
