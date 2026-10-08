import { PipelineError, messages } from "@/lib/pipeline/messages";
import { parseChimegeBody, transcriptFromText } from "@/lib/speech/chimege/parse";
import type { SpeechToTextProvider, SpeechTranscript } from "@/lib/speech/types";

const endpoint = "https://api.chimege.com/v1.2";
const directLimit = 2_800_000;

type ChimegeOptions = {
  key?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxDirectBytes?: number;
};

export function createChimegeProvider(options: ChimegeOptions = {}): SpeechToTextProvider {
  const key = options.key ?? process.env.CHIMEGE_API_KEY ?? "";
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const maxDirectBytes = options.maxDirectBytes ?? directLimit;

  return {
    async transcribe(audio: Uint8Array, durationHint: number): Promise<SpeechTranscript> {
      if (!key) throw new PipelineError("CHIMEGE", messages.chimegeMissing);
      try {
        const text =
          audio.byteLength <= maxDirectBytes
            ? await transcribeDirect(fetchImpl, key, audio)
            : await transcribeLong(fetchImpl, key, audio, sleep);
        const duration = durationHint > 0 ? durationHint : Math.max(4, text.split(/\s+/).length * 0.45);
        return transcriptFromText(text, duration);
      } catch (error) {
        if (error instanceof PipelineError) throw error;
        throw new PipelineError("CHIMEGE", messages.transcribe);
      }
    },
  };
}

async function transcribeDirect(fetchImpl: typeof fetch, key: string, audio: Uint8Array): Promise<string> {
  const response = await fetchImpl(`${endpoint}/transcribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      Punctuate: "true",
      Token: key,
    },
    body: audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer,
  });
  const text = await response.text();
  if (!response.ok) throw new PipelineError("CHIMEGE", messages.transcribe);
  const parsed = parseChimegeBody(text, response.headers.get("content-type") ?? "text/plain");
  if (!parsed || "pending" in parsed || !parsed.text.trim()) throw new PipelineError("CHIMEGE", messages.transcribe);
  return parsed.text;
}

async function transcribeLong(
  fetchImpl: typeof fetch,
  key: string,
  audio: Uint8Array,
  sleep: (ms: number) => Promise<void>,
): Promise<string> {
  const submitted = await fetchImpl(`${endpoint}/stt-long`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      Token: key,
    },
    body: audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer,
  });
  const submittedText = await submitted.text();
  if (!submitted.ok) throw new PipelineError("CHIMEGE", messages.transcribe);
  const payload = JSON.parse(submittedText) as { uuid?: string };
  if (!payload.uuid) throw new PipelineError("CHIMEGE", messages.transcribe);
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await sleep(2000);
    const response = await fetchImpl(`${endpoint}/stt-long-transcript`, {
      headers: { Token: key, UUID: payload.uuid },
    });
    const body = await response.text();
    if (!response.ok) throw new PipelineError("CHIMEGE", messages.transcribe);
    const parsed = parseChimegeBody(body, "application/json");
    if (parsed && "pending" in parsed) continue;
    if (parsed && !("pending" in parsed) && parsed.text.trim()) return parsed.text;
  }
  throw new PipelineError("CHIMEGE", messages.transcribe);
}
