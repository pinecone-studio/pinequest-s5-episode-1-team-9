import { afterEach, describe, expect, it, vi } from "vitest";
import { PipelineError, demoModeBlock, messages } from "@/lib/pipeline/messages";
import { createDuudlagaProvider, transcriptFromResponse, transcribeWithDuudlaga } from "@/lib/speech/providers/duudlaga";

const key = "dk_live_test_key";
const payload = {
  id: "7d6b9f3a-2c4e-4c1f-9a0b-1e2f3a4b5c6d",
  text: "Улаанбаатарын түгжрэл сүүлийн жилүүдэд маш их нэмэгдсэн. Startup growth continues.",
  duration_seconds: 4.86,
  model: "duudlaga-stt-1",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Duudlaga speech provider", () => {
  it("initializes a provider without calling the network", () => {
    const fetchImpl = vi.fn();
    const provider = createDuudlagaProvider({ key, fetchImpl });
    expect(typeof provider.transcribe).toBe("function");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses to transcribe when the API key is missing", async () => {
    const fetchImpl = vi.fn();
    await expect(transcribeWithDuudlaga(new Uint8Array([1, 2, 3]), 4, { key: "  ", fetchImpl })).rejects.toMatchObject({
      code: "DUUDLAGA_KEY",
      userMessage: messages.duudlagaMissing,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps a successful response and keeps mixed language text", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      logs.push(String(message));
    });
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const form = init?.body as FormData;
      expect(String(_url)).toBe("https://api.duudlaga.dev/v1/stt/transcriptions");
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${key}`);
      expect(form.get("languages")).toBe("mn-MN,en-US");
      expect(form.get("file")).toBeInstanceOf(Blob);
      expect(form.get("model")).toBeNull();
      return jsonResponse(payload);
    });

    const transcript = await transcribeWithDuudlaga(new Uint8Array([1, 2, 3, 4]), 8, { key, fetchImpl });

    expect(transcript.text).toBe(payload.text);
    expect(transcript.text).toContain("Startup");
    expect(transcript.language).toBe("mn");
    expect(transcript.words).toEqual([]);
    expect(transcript.timing).toBe("estimated");
    expect(transcript.segments[0]?.start).toBe(0);
    expect(transcript.segments.at(-1)?.end).toBeGreaterThan(4);
    expect(logs).toEqual([
      "[STT] Starting Duudlaga transcription",
      "[STT] Audio duration: 8",
      "[STT] Duudlaga transcription completed",
      `[STT] Transcript length: ${payload.text.length}`,
    ]);
    expect(logs.join(" ")).not.toContain(key);
  });

  it("rejects a response that does not match the provider contract", () => {
    expect(() => transcriptFromResponse({ transcription: "Монгол яриа" }, 3)).toThrow(PipelineError);
    expect(() => transcriptFromResponse({ ...payload, model: "other-model" }, 3)).toThrow(messages.transcribe);
    expect(() => transcriptFromResponse({ ...payload, text: "  " }, 3)).toThrow(messages.transcribe);
  });

  it("maps authentication, rate limit, and provider failures without exposing the key", async () => {
    await expect(statusError(401)).rejects.toMatchObject({ code: "DUUDLAGA_AUTH", userMessage: messages.transcribe });
    await expect(statusError(403)).rejects.toMatchObject({ code: "DUUDLAGA_AUTH" });
    await expect(statusError(400)).rejects.toMatchObject({ code: "DUUDLAGA_AUDIO" });
    await expect(statusError(413)).rejects.toMatchObject({ code: "DUUDLAGA_SIZE" });
    await expect(statusError(429)).rejects.toMatchObject({ code: "DUUDLAGA_RATE" });
    await expect(statusError(500)).rejects.toMatchObject({ code: "DUUDLAGA_PROVIDER" });
    await expect(statusError(503)).rejects.toMatchObject({ code: "DUUDLAGA_PROVIDER" });
    await expect(statusError(401)).rejects.toThrow(messages.transcribe);
    await expect(statusError(500)).rejects.not.toThrow(key);
  });

  it("treats a dropped connection and a timeout as transcription failures", async () => {
    const network = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(transcribeWithDuudlaga(new Uint8Array([1]), 2, { key, fetchImpl: network })).rejects.toMatchObject({
      code: "DUUDLAGA_NETWORK",
      userMessage: messages.transcribe,
    });

    const timeout = vi.fn(async () => {
      const error = new Error("timed out");
      error.name = "TimeoutError";
      throw error;
    });
    await expect(transcribeWithDuudlaga(new Uint8Array([1]), 2, { key, fetchImpl: timeout })).rejects.toMatchObject({
      code: "DUUDLAGA_TIMEOUT",
    });
  });

  it("does not need a Duudlaga key while demo mode is on", () => {
    const previousPublic = process.env.NEXT_PUBLIC_DEMO_MODE;
    const previousServer = process.env.DEMO_MODE;
    const previousKey = process.env.DUUDLAGA_API_KEY;
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    delete process.env.DEMO_MODE;
    delete process.env.DUUDLAGA_API_KEY;
    expect(demoModeBlock()).toBe(messages.demo);
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    expect(demoModeBlock()).toBe(messages.demo);
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    expect(demoModeBlock()).toBeNull();
    restore("NEXT_PUBLIC_DEMO_MODE", previousPublic);
    restore("DEMO_MODE", previousServer);
    restore("DUUDLAGA_API_KEY", previousKey);
  });
});

function statusError(status: number) {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "upstream", message: key }), { status }));
  return transcribeWithDuudlaga(new Uint8Array([1, 2]), 3, { key, fetchImpl });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function restore(name: "NEXT_PUBLIC_DEMO_MODE" | "DEMO_MODE" | "DUUDLAGA_API_KEY", value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
