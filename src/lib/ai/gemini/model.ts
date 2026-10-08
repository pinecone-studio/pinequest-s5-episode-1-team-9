import { parseAnalysis, type Analysis } from "@/lib/ai/schemas/analysis";
import { PipelineError, messages } from "@/lib/pipeline/messages";
import { buildAnalyzePrompt } from "@/lib/ai/prompts/analyzeTranscript";
import type { VisualRecommendationModel } from "@/lib/ai/recommend";
import type { TimedSegment } from "@/lib/speech/types";

const modelName = "gemini-2.5-flash";

export class GeminiVisualRecommendationModel implements VisualRecommendationModel {
  constructor(
    private readonly key = process.env.GEMINI_API_KEY ?? "",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async recommend(segments: TimedSegment[]): Promise<Analysis> {
    if (!this.key) throw new PipelineError("GEMINI", messages.geminiMissing);
    const prompt = buildAnalyzePrompt(segments);
    const first = await this.complete(prompt);
    const parsed = readAnalysis(first);
    if (parsed) return parsed;
    const repaired = await this.complete(`${prompt}\n\nThe previous JSON did not match the schema. Return only valid JSON.`);
    const second = readAnalysis(repaired);
    if (!second) throw new PipelineError("GEMINI", messages.analyze);
    return second;
  }

  private async complete(prompt: string): Promise<string> {
    const response = await this.fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      },
    );
    if (!response.ok) throw new PipelineError("GEMINI", messages.analyze);
    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text.trim()) throw new PipelineError("GEMINI", messages.analyze);
    return text;
  }
}

export function readAnalysis(text: string): Analysis | null {
  const match = text.trim().match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = match?.[1] ?? text.trim();
  try {
    const result = parseAnalysis(normalizeAnalysis(JSON.parse(raw)));
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
}

export function normalizeAnalysis(input: unknown): unknown {
  if (!input || typeof input !== "object" || !("segments" in input) || !Array.isArray(input.segments)) return input;
  const segments = input.segments.flatMap((segment) => {
    if (!segment || typeof segment !== "object") return [];
    const row = segment as Record<string, unknown>;
    const visual = (row.visualRecommendation ?? {}) as Record<string, unknown>;
    const start = numberOr(row.startTime, 0);
    const end = numberOr(row.endTime, start + 1);
    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (!text || end <= start) return [];
    const type = typeof visual.type === "string" ? visual.type : "NONE";
    const position = typeof visual.position === "string" ? visual.position : "right";
    return [
      {
        startTime: start,
        endTime: end,
        text,
        topic: typeof row.topic === "string" && row.topic.trim() ? row.topic : "speech",
        keywords: Array.isArray(row.keywords) ? row.keywords.filter((item) => typeof item === "string") : [],
        importance: clamp(numberOr(row.importance, 0.5), 0, 1),
        reason: typeof row.reason === "string" ? row.reason : undefined,
        visualRecommendation: {
          type: ["NONE", "IMAGE", "BROLL", "GRAPHIC", "TEXT", "CHART", "HIGHLIGHT", "ZOOM"].includes(type) ? type : "NONE",
          description: typeof visual.description === "string" ? visual.description : "",
          duration: Math.max(0, numberOr(visual.duration, end - start)),
          position: ["left", "right", "bottom", "background"].includes(position) ? position : "right",
        },
        overlayText: typeof row.overlayText === "string" ? row.overlayText : "",
      },
    ];
  });
  return { segments };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
