import { readFile } from "node:fs/promises";
import type { EditorSegment } from "@/lib/ai/schemas/analysis";
import { GeminiVisualRecommendationModel } from "@/lib/ai/gemini/model";
import type { VisualRecommendationModel } from "@/lib/ai/recommend";
import { messages, PipelineError } from "@/lib/pipeline/messages";
import { segmentsFromAnalysis } from "@/lib/pipeline/timeline";
import { localStorage } from "@/lib/storage/local";
import { uploadPath } from "@/lib/storage/paths";
import { createDuudlagaProvider } from "@/lib/speech/providers/duudlaga";
import type { SpeechToTextProvider } from "@/lib/speech/types";
import { createPexelsProvider } from "@/lib/visuals/pexels";
import { chooseVisual } from "@/lib/visuals/rank";
import type { VisualSearchProvider } from "@/lib/visuals/types";
import { extractAudio, probeDuration, renderVideo } from "@/lib/video/ffmpeg/extract";
import { buildAss, buildRenderArgs, type RenderOverlay } from "@/lib/video/ffmpeg/renderPlan";
import { fileVideoRepository } from "@/server/repositories/fileVideoRepository";
import type { VideoRepository } from "@/server/repositories/types";
import { logJob } from "@/server/log";

const pictureTypes = new Set(["IMAGE", "BROLL", "GRAPHIC", "CHART"]);

export type PipelineDeps = {
  repo: VideoRepository;
  speech: SpeechToTextProvider;
  recommend: VisualRecommendationModel | null;
  search: VisualSearchProvider | null;
  extractAudio: (input: string, output: string) => Promise<void>;
  probeDuration: (input: string) => Promise<number>;
  render: (args: string[]) => Promise<void>;
  readBytes: (key: string) => Promise<Uint8Array>;
  writeBytes: (key: string, body: Uint8Array, contentType: string) => Promise<string>;
  pathFor: (key: string) => string;
  download: (url: string) => Promise<Uint8Array | null>;
};

export async function processVideo(id: string, deps: PipelineDeps): Promise<void> {
  try {
    const record = await deps.repo.get(id);
    if (!record) return;
    await deps.repo.update(id, { status: "EXTRACTING_AUDIO", errorMessage: null });
    logJob(id, "AUDIO_EXTRACTION_STARTED");
    const audioKey = `${id}/audio.wav`;
    await deps.extractAudio(deps.pathFor(record.originalKey), deps.pathFor(audioKey));
    const probed = await deps.probeDuration(deps.pathFor(record.originalKey));
    const duration = Math.max(record.duration, probed);
    await deps.repo.update(id, { status: "TRANSCRIBING", audioKey, duration: duration || record.duration });
    logJob(id, "TRANSCRIPTION_STARTED");
    const audio = await deps.readBytes(audioKey);
    const speech = await deps.speech.transcribe(audio, duration || record.duration);
    const spoken = speech.segments.map((segment, index) => speechSegment(segment, index));
    const spokenDuration = Math.max(duration, speech.segments.at(-1)?.end ?? 0, 1);
    await deps.repo.update(id, {
      status: "ANALYZING",
      duration: spokenDuration,
      fullText: speech.text,
      segments: spoken,
    });
    logJob(id, "TRANSCRIPTION_COMPLETED");
    if (!deps.recommend) throw new PipelineError("GEMINI", messages.geminiMissing);
    logJob(id, "GEMINI_ANALYSIS_STARTED");
    const analysis = await deps.recommend.recommend(speech.segments);
    logJob(id, "GEMINI_ANALYSIS_COMPLETED");
    await deps.repo.update(id, { status: "FINDING_VISUALS" });
    const images: (string | undefined)[] = [];
    const used = new Set<string>();
    for (const [index, segment] of analysis.segments.entries()) {
      images.push(await findImage(id, index, segment, deps, used));
    }
    const segments = segmentsFromAnalysis(analysis, (index) => images[index]);
    await deps.repo.update(id, { status: "BUILDING_TIMELINE", segments, fullText: speech.text });
    logJob(id, "TIMELINE_CREATED");
    await deps.repo.update(id, { status: "RENDERING" });
    logJob(id, "RENDER_STARTED");
    const assKey = `${id}/captions.ass`;
    await deps.writeBytes(assKey, new TextEncoder().encode(buildAss(segments)), "text/plain");
    const overlays = await overlayFiles(segments, deps);
    const reelKey = `${id}/reel.mp4`;
    await deps.render(buildRenderArgs(deps.pathFor(record.originalKey), deps.pathFor(assKey), overlays, deps.pathFor(reelKey)));
    const processedUrl = await deps.writeBytes(reelKey, await deps.readBytes(reelKey), "video/mp4");
    await deps.repo.update(id, {
      status: "READY",
      processedKey: reelKey,
      processedUrl,
      errorMessage: null,
    });
    logJob(id, "RENDER_COMPLETED");
  } catch (error) {
    const userMessage = error instanceof PipelineError ? error.userMessage : messages.generic;
    logJob(id, "FAILED", error instanceof Error ? error.message : "unknown");
    await deps.repo.update(id, { status: "FAILED", errorMessage: userMessage }).catch(() => undefined);
  }
}

async function findImage(
  id: string,
  index: number,
  segment: { visualRecommendation: { type: string; description: string; duration: number }; keywords: string[] },
  deps: PipelineDeps,
  used: Set<string>,
): Promise<string | undefined> {
  if (!pictureTypes.has(segment.visualRecommendation.type) || !deps.search) return undefined;
  try {
    const candidates = await deps.search.search({
      type: segment.visualRecommendation.type,
      keywords: segment.keywords,
      description: segment.visualRecommendation.description,
    });
    const chosen = chooseVisual(candidates, {
      keywords: segment.keywords,
      description: segment.visualRecommendation.description,
      duration: segment.visualRecommendation.duration,
    }, used);
    if (!chosen) return undefined;
    const bytes = await deps.download(chosen.thumbnail || chosen.url);
    if (!bytes) return undefined;
    used.add(chosen.id);
    const key = `${id}/asset-${index}.jpg`;
    logJob(id, "VISUAL_SELECTED", chosen.id);
    return deps.writeBytes(key, bytes, "image/jpeg");
  } catch {
    logJob(id, "VISUAL_SEARCH_FAILED", segment.visualRecommendation.description);
    return undefined;
  }
}

async function overlayFiles(segments: EditorSegment[], deps: PipelineDeps): Promise<RenderOverlay[]> {
  const overlays: RenderOverlay[] = [];
  for (const segment of segments) {
    if (!segment.imageUrl || segment.visualRecommendation.type === "NONE") continue;
    const key = keyFromMediaUrl(segment.imageUrl);
    if (!key) continue;
    overlays.push({
      file: deps.pathFor(key),
      start: segment.startTime,
      end: segment.endTime,
      position: segment.visualRecommendation.position,
      kind: "image",
    });
  }
  return overlays;
}

function keyFromMediaUrl(url: string): string | null {
  const prefix = "/api/media/";
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length).split("/").map(decodeURIComponent).join("/");
}

function speechSegment(segment: { start: number; end: number; text: string }, index: number): EditorSegment {
  return {
    id: `t${index}`,
    startTime: segment.start,
    endTime: Math.max(segment.start + 0.3, segment.end),
    text: segment.text,
    topic: "speech",
    keywords: [],
    importance: 0.4,
    visualRecommendation: {
      type: "NONE",
      description: "",
      duration: Math.max(0.3, segment.end - segment.start),
      position: "right",
    },
    overlayText: "",
    scale: 1,
    opacity: 1,
  };
}

export function productionDeps(repo: VideoRepository): PipelineDeps {
  return {
    repo,
    speech: createDuudlagaProvider(),
    recommend: process.env.GEMINI_API_KEY ? new GeminiVisualRecommendationModel() : null,
    search: process.env.PEXELS_API_KEY ? createPexelsProvider() : null,
    extractAudio,
    probeDuration,
    render: renderVideo,
    pathFor: uploadPath,
    readBytes: async (key) => new Uint8Array(await readFile(uploadPath(key))),
    writeBytes: async (key, body, contentType) => {
      const stored = await localStorage.put({ key, body, contentType });
      return stored.url;
    },
    download: async (url) => {
      const response = await fetch(url);
      if (!response.ok) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      return bytes.byteLength > 25 * 1024 * 1024 ? null : bytes;
    },
  };
}

export async function getVideoRepository(): Promise<VideoRepository> {
  if (process.env.DATABASE_URL) {
    const { PrismaVideoRepository } = await import("@/server/repositories/prismaVideoRepository");
    return new PrismaVideoRepository();
  }
  return fileVideoRepository();
}

const running = new Set<string>();

export function enqueueVideo(id: string): void {
  if (running.has(id)) return;
  running.add(id);
  void (async () => {
    const repo = await getVideoRepository();
    await processVideo(id, productionDeps(repo));
  })()
    .catch((error: unknown) => logJob(id, "FAILED", error instanceof Error ? error.message : "unknown"))
    .finally(() => running.delete(id));
}
