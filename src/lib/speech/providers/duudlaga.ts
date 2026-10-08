import { z } from "zod";
import { PipelineError, messages } from "@/lib/pipeline/messages";
import { transcriptFromText } from "@/lib/speech/transcript";
import type { SpeechToTextProvider, SpeechTranscript } from "@/lib/speech/types";

const endpoint = "https://api.duudlaga.dev/v1/stt/transcriptions";
const responseModel = "duudlaga-stt-1";
const languages = "mn-MN,en-US";
const maxAudioBytes = 64 * 1024 * 1024;

const duudlagaResponseSchema = z.object({
  id: z.string().uuid(),
  text: z.string().trim().min(1),
  duration_seconds: z.number().finite().nonnegative(),
  model: z.literal(responseModel),
});

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type DuudlagaOptions = {
  key?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  maxBytes?: number;
};

export function createDuudlagaProvider(options: DuudlagaOptions = {}): SpeechToTextProvider {
  return {
    transcribe(audio, durationHint) {
      return transcribeWithDuudlaga(audio, durationHint, options);
    },
  };
}

export async function transcribeWithDuudlaga(
  audio: Uint8Array,
  durationHint: number,
  options: DuudlagaOptions = {},
): Promise<SpeechTranscript> {
  const key = (options.key ?? process.env.DUUDLAGA_API_KEY ?? "").trim();
  if (!key) throw new PipelineError("DUUDLAGA_KEY", messages.duudlagaMissing);

  const limit = options.maxBytes ?? maxAudioBytes;
  if (audio.byteLength > limit) throw new PipelineError("DUUDLAGA_SIZE", messages.transcribe);

  const duration = durationHint > 0 ? durationHint : 0;
  logStt("[STT] Starting Duudlaga transcription");
  logStt(`[STT] Audio duration: ${duration}`);

  const fetchImpl: FetchLike = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: audioForm(audio),
      signal: AbortSignal.timeout(options.timeoutMs ?? 120_000),
    });
    if (!response.ok) throw failureForStatus(response.status);
    const transcript = transcriptFromResponse(await readJson(response), durationHint);
    logStt("[STT] Duudlaga transcription completed");
    logStt(`[STT] Transcript length: ${transcript.text.length}`);
    return transcript;
  } catch (error) {
    if (error instanceof PipelineError) throw error;
    if (isTimeout(error)) throw new PipelineError("DUUDLAGA_TIMEOUT", messages.transcribe);
    throw new PipelineError("DUUDLAGA_NETWORK", messages.transcribe);
  }
}

export function transcriptFromResponse(payload: unknown, durationHint: number): SpeechTranscript {
  const parsed = duudlagaResponseSchema.safeParse(payload);
  if (!parsed.success) throw new PipelineError("DUUDLAGA_RESPONSE", messages.transcribe);
  const duration = parsed.data.duration_seconds > 0 ? parsed.data.duration_seconds : durationHint;
  return transcriptFromText(parsed.data.text, duration);
}

function audioForm(audio: Uint8Array): FormData {
  const bytes = audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer;
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "audio/wav" }), "audio.wav");
  // The recogniser defaults to Mongolian plus English. The response model is always duudlaga-stt-1, so the request has no model field.
  form.append("languages", languages);
  return form;
}

function failureForStatus(status: number): PipelineError {
  if (status === 401 || status === 403) return new PipelineError("DUUDLAGA_AUTH", messages.transcribe);
  if (status === 400 || status === 422) return new PipelineError("DUUDLAGA_AUDIO", messages.transcribe);
  if (status === 413) return new PipelineError("DUUDLAGA_SIZE", messages.transcribe);
  if (status === 429) return new PipelineError("DUUDLAGA_RATE", messages.transcribe);
  if (status >= 500) return new PipelineError("DUUDLAGA_PROVIDER", messages.transcribe);
  return new PipelineError("DUUDLAGA_RESPONSE", messages.transcribe);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new PipelineError("DUUDLAGA_RESPONSE", messages.transcribe);
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function logStt(message: string): void {
  console.log(message);
}
