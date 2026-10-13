import type { EvidenceFrame } from "@linguamatch/shared";

/** Width/height of the stored evidence frame. Small on purpose: less data, less detail. */
const FRAME_WIDTH = 320;
const FRAME_HEIGHT = 180;
/** Intermediate canvas size — drawing through it pixelates the frame irreversibly. */
const THUMB_WIDTH = 64;
const THUMB_HEIGHT = 36;
const BLUR_PX = 14;

/**
 * Grabs a few stills of the partner's video as report evidence. Every frame is destroyed twice
 * before it leaves the browser — pixelated through a tiny canvas and blurred — so a report can be
 * reviewed without storing or transmitting an identifiable (or explicit) image. Returns [] when
 * there is no video to capture, so reporting still works receive-only.
 */
export async function captureBlurredFrames(stream: MediaStream | null, count = 3): Promise<EvidenceFrame[]> {
  if (!stream || typeof document === "undefined") return [];
  const liveVideo = stream.getVideoTracks().some((t) => t.readyState === "live" && t.enabled);
  if (!liveVideo) return [];

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;

  const ready = new Promise<void>((resolve) => {
    if (video.readyState >= 2) return resolve();
    const done = () => resolve();
    video.onloadeddata = done;
    video.oncanplay = done;
    setTimeout(done, 1500);
  });

  try {
    await video.play().catch(() => {});
    await ready;
    // Let the element paint at least one frame before reading pixels.
    await new Promise((r) => setTimeout(r, 120));
  } catch {
    return [];
  }

  const thumb = document.createElement("canvas");
  thumb.width = THUMB_WIDTH;
  thumb.height = THUMB_HEIGHT;
  const thumbCtx = thumb.getContext("2d");

  const out = document.createElement("canvas");
  out.width = FRAME_WIDTH;
  out.height = FRAME_HEIGHT;
  const outCtx = out.getContext("2d");
  if (!thumbCtx || !outCtx) return [];

  const frames: EvidenceFrame[] = [];
  for (let i = 0; i < count; i++) {
    thumbCtx.drawImage(video, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);
    outCtx.imageSmoothingEnabled = false;
    if ("filter" in outCtx) outCtx.filter = `blur(${BLUR_PX}px)`;
    outCtx.drawImage(thumb, 0, 0, THUMB_WIDTH, THUMB_HEIGHT, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    if ("filter" in outCtx) outCtx.filter = "none";
    try {
      frames.push({ url: out.toDataURL("image/jpeg", 0.6), capturedAt: new Date().toISOString() });
    } catch {
      break;
    }
    if (i < count - 1) await new Promise((r) => setTimeout(r, 700));
  }

  video.srcObject = null;
  video.remove();
  return frames;
}
