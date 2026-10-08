import type { EditorSegment } from "@/lib/ai/schemas/analysis";
import { formatVtt } from "@/utils/time";

export type RenderOverlay = {
  file: string;
  start: number;
  end: number;
  position: EditorSegment["visualRecommendation"]["position"];
  kind: "image" | "video";
};

export function buildAss(segments: EditorSegment[]): string {
  const events = segments.flatMap((segment, index) => {
    const caption = dialogue(index + 1, segment.startTime, segment.endTime, "Caption", segment.text);
    if (!segment.overlayText || segment.visualRecommendation.type === "NONE") return [caption];
    return [caption, dialogue(index + 1, segment.startTime, segment.endTime, "Overlay", segment.overlayText)];
  });
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Arial,58,&H00FFFFFF,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,3,0,2,70,70,150,1
Style: Overlay,Arial,42,&H004AA4E0,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,2,0,8,80,80,220,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join("\n")}
`;
}

export function buildRenderArgs(input: string, assFile: string, overlays: RenderOverlay[], output: string): string[] {
  const args = ["-y", "-i", input];
  overlays.forEach((overlay) => {
    args.push("-itsoffset", overlay.start.toFixed(3));
    if (overlay.kind === "image") {
      args.push("-loop", "1", "-framerate", "25", "-t", Math.max(0.5, overlay.end - overlay.start).toFixed(3));
    }
    args.push("-i", overlay.file);
  });
  const filters: string[] = ["[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[base]"];
  let current = "base";
  overlays.forEach((overlay, index) => {
    const next = `v${index}`;
    const scaled = `img${index}`;
    filters.push(`[${index + 1}:v]scale=420:-1[${scaled}]`);
    filters.push(`[${current}][${scaled}]${overlayExpression(overlay)}[${next}]`);
    current = next;
  });
  filters.push(`[${current}]ass=${escapeFilterPath(assFile)}[out]`);
  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[out]",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    output,
  );
  return args;
}

function overlayExpression(overlay: RenderOverlay): string {
  const place =
    overlay.position === "left"
      ? "48:220"
      : overlay.position === "bottom" || overlay.position === "background"
        ? "(W-w)/2:H-h-320"
        : "W-w-48:220";
  return `overlay=${place}:enable='between(t,${overlay.start.toFixed(2)},${overlay.end.toFixed(2)})'`;
}

function dialogue(layer: number, start: number, end: number, style: string, text: string): string {
  return `Dialogue: ${layer},${assTime(start)},${assTime(end)},${style},,0,0,0,,${escapeAss(text)}`;
}

function assTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const centis = Math.min(99, Math.round((safe - Math.floor(safe)) * 100));
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${hours}:${pad(minutes)}:${pad(secs)}.${pad(centis)}`;
}

function escapeAss(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}").replace(/\n/g, "\\N");
}

function escapeFilterPath(file: string): string {
  return file.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export function captionVtt(segments: { startTime: number; endTime: number; text: string }[]): string {
  const cues = segments.map((segment, index) => {
    return `${index + 1}\n${formatVtt(segment.startTime)} --> ${formatVtt(segment.endTime)}\n${segment.text}`;
  });
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}
