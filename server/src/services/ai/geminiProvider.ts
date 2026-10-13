import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ANALYSIS_SYSTEM,
  ASSESSMENT_EVAL_SYSTEM,
  ASSESSMENT_SYSTEM,
  MODERATION_SYSTEM,
  TOPIC_SYSTEM,
  VIDEO_MODERATION_SYSTEM,
  analysisUserPrompt,
  assessmentEvalUserPrompt,
  assessmentUserPrompt,
  moderationUserPrompt,
  topicUserPrompt,
  videoModerationUserPrompt,
} from "./prompts";
import {
  AssessmentQuestionsSchema,
  AssessmentResultSchema,
  ConversationAnalysisSchema,
  ModerationSchema,
  TopicSchema,
  clampScore,
} from "./schemas";
import { AIResponseError, type AIProvider } from "./types";

type Effort = "low" | "medium" | "high";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Tried in order when a model is overloaded (503) or rate-limited (429). */
const GEMINI_FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.5-flash"];

/** Keys Gemini's responseSchema accepts (a subset of OpenAPI 3.0 Schema). */
const SCHEMA_KEYS = new Set([
  "type",
  "format",
  "description",
  "nullable",
  "enum",
  "items",
  "properties",
  "required",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "propertyOrdering",
]);

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

/** Convert a Zod schema to the restricted schema object Gemini accepts for structured output. */
function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  const clean = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(clean);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (!SCHEMA_KEYS.has(key)) continue;
        // Drop the sentinel ±Number.MAX_SAFE_INTEGER bounds Zod emits for plain numbers.
        if ((key === "minimum" || key === "maximum") && Math.abs(value as number) >= MAX_SAFE) continue;
        out[key] = key === "properties" ? cleanProperties(value) : clean(value);
      }
      return out;
    }
    return node;
  };
  const cleanProperties = (node: unknown): Record<string, unknown> =>
    Object.fromEntries(Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, clean(v)]));
  return clean(json) as Record<string, unknown>;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Google Gemini implementation of AIProvider using the Generative Language REST API.
 * Free tier friendly: uses JSON output mode and validates with the same Zod schemas.
 */
export class GeminiProvider implements AIProvider {
  readonly name = "gemini";

  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  private async structured<S extends z.ZodType>(opts: {
    system: string;
    user: string;
    schema: S;
    effort: Effort;
    maxTokens: number;
    images?: { mimeType: string; dataBase64: string; label?: string }[];
  }): Promise<z.infer<S>> {
    const responseSchema = toGeminiSchema(opts.schema);
    const models = [...new Set([this.model, ...GEMINI_FALLBACK_MODELS])];
    const parts: Record<string, unknown>[] = [{ text: opts.user }];
    for (const img of opts.images ?? []) {
      if (img.label) parts.push({ text: img.label });
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.dataBase64 } });
    }

    let lastError: AIResponseError | null = null;
    for (const [i, model] of models.entries()) {
      const body = {
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
          maxOutputTokens: opts.maxTokens,
          temperature: opts.effort === "low" ? 0.9 : 0.4,
          ...(model.startsWith("gemini-2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      };

      const res = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent?key=${this.apiKey}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json().catch(() => ({}))) as GeminiResponse;
      if (!res.ok) {
        lastError = new AIResponseError(`Gemini request failed (${res.status}): ${data.error?.message ?? "unknown error"}`);
        const transient =
          res.status === 503 ||
          res.status === 429 ||
          data.error?.status === "UNAVAILABLE" ||
          data.error?.status === "RESOURCE_EXHAUSTED";
        if (transient && i < models.length - 1) continue;
        throw lastError;
      }
      if (data.promptFeedback?.blockReason) {
        throw new AIResponseError("The AI declined to process this request.");
      }

      const candidate = data.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== "STOP") {
        if (candidate.finishReason === "MAX_TOKENS") {
          throw new AIResponseError("The AI response was cut off before it finished.");
        }
        throw new AIResponseError("The AI declined to process this request.");
      }

      const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      const json = text ? tryParseJson(text) : undefined;
      const parsed = json === undefined ? null : opts.schema.safeParse(json);
      if (parsed?.success) return parsed.data as z.infer<S>;

      lastError = new AIResponseError("The AI returned an unexpected response format.");
      if (i < models.length - 1) continue;
    }
    throw lastError ?? new AIResponseError("The AI returned an unexpected response format.");
  }

  async generateTopic(req: Parameters<AIProvider["generateTopic"]>[0]) {
    const out = await this.structured({
      system: TOPIC_SYSTEM,
      user: topicUserPrompt(req),
      schema: TopicSchema,
      effort: "low",
      maxTokens: 4000,
    });
    return {
      title: out.title.trim(),
      description: out.description.trim(),
      questions: out.questions.slice(0, 4).map((q) => q.trim()).filter(Boolean),
      level: req.level,
    };
  }

  async createAssessment(req: Parameters<AIProvider["createAssessment"]>[0]) {
    const out = await this.structured({
      system: ASSESSMENT_SYSTEM,
      user: assessmentUserPrompt(req),
      schema: AssessmentQuestionsSchema,
      effort: "low",
      maxTokens: 6000,
    });
    return out.questions.slice(0, 8).map((q) => ({ id: randomUUID(), ...q }));
  }

  async evaluateAssessment(req: Parameters<AIProvider["evaluateAssessment"]>[0]) {
    return this.structured({
      system: ASSESSMENT_EVAL_SYSTEM,
      user: assessmentEvalUserPrompt(req),
      schema: AssessmentResultSchema,
      effort: "medium",
      maxTokens: 8000,
    });
  }

  async analyzeConversation(req: Parameters<AIProvider["analyzeConversation"]>[0]) {
    const out = await this.structured({
      system: ANALYSIS_SYSTEM,
      user: analysisUserPrompt(req),
      schema: ConversationAnalysisSchema,
      effort: "medium",
      maxTokens: 16000,
    });
    return {
      ...out,
      grammarScore: clampScore(out.grammarScore),
      vocabularyScore: clampScore(out.vocabularyScore),
      fluencyScore: clampScore(out.fluencyScore),
      mistakes: out.mistakes.slice(0, 10),
      exercises: out.exercises.slice(0, 5),
    };
  }

  async moderateConversation(req: Parameters<AIProvider["moderateConversation"]>[0]) {
    const out = await this.structured({
      system: MODERATION_SYSTEM,
      user: moderationUserPrompt(req),
      schema: ModerationSchema,
      effort: "medium",
      maxTokens: 4000,
    });
    return { findings: out.findings.slice(0, 20) };
  }

  async moderateVideo(req: Parameters<AIProvider["moderateVideo"]>[0]) {
    const out = await this.structured({
      system: VIDEO_MODERATION_SYSTEM,
      user: videoModerationUserPrompt(req),
      schema: ModerationSchema,
      effort: "medium",
      maxTokens: 4000,
      images: req.frames.map((f) => ({
        mimeType: f.mimeType,
        dataBase64: f.dataBase64,
        label: `[Frame from speaker "${f.speaker}" at ${f.offsetSeconds.toFixed(1)}s]`,
      })),
    });
    return { findings: out.findings.slice(0, 20) };
  }
}
