import { describe, expect, it } from "vitest";
import { parseAnalysis, type Analysis } from "@/lib/ai/schemas/analysis";
import { normalizeAnalysis, readAnalysis } from "@/lib/ai/gemini/model";
import { GeminiVisualRecommendationModel } from "@/lib/ai/gemini/model";
import { demoModeBlock, messages } from "@/lib/pipeline/messages";
import { segmentsFromAnalysis } from "@/lib/pipeline/timeline";
import { processVideo, type PipelineDeps } from "@/server/pipeline/processVideo";
import { MemoryVideoRepository } from "@/server/repositories/fileVideoRepository";
import { alignTranscript, splitCaption } from "@/lib/speech/align";
import { createChimegeProvider } from "@/lib/speech/chimege/client";
import { parseChimegeBody } from "@/lib/speech/chimege/parse";
import { chooseVisual, scoreCandidate } from "@/lib/visuals/rank";
import type { VisualCandidate } from "@/lib/visuals/types";

const sampleSpeech =
  "Сүүлийн жилүүдэд Монголд startup компаниуд нэмэгдэж байна. Гэхдээ startup хийхэд зөвхөн хөрөнгө оруулалт хангалтгүй. Хамгийн чухал зүйл бол хэрэглэгчээ ойлгох.";

function analysisSegment(text: string, type: "BROLL" | "NONE" = "BROLL") {
  return {
    startTime: 0,
    endTime: 6,
    text,
    topic: "startup",
    keywords: ["startup", "mongolia"],
    importance: 0.9,
    reason: "The speaker is discussing the growth of startups.",
    visualRecommendation: {
      type,
      description: "startup founders in an office",
      duration: 5,
      position: "right",
    },
    overlayText: "STARTUP",
  };
}

describe("transcript schema", () => {
  it("accepts timestamped Mongolian segments", () => {
    const result = parseAnalysis({ segments: [analysisSegment(sampleSpeech)] });
    expect(result.ok).toBe(true);
  });

  it("rejects a segment that ends before it starts", () => {
    const result = parseAnalysis({
      segments: [{ ...analysisSegment("Яриа"), startTime: 4, endTime: 2 }],
    });
    expect(result.ok).toBe(false);
  });
});

describe("Gemini response validation", () => {
  it("reads fenced JSON and repairs an unknown visual type", () => {
    const parsed = readAnalysis(
      "```json\n" +
        JSON.stringify({
          segments: [
            {
              ...analysisSegment("Улаанбаатарын түгжрэл нэмэгдсэн."),
              visualRecommendation: { type: "STOCK", description: "traffic", duration: 4, position: "middle" },
            },
          ],
        }) +
        "\n```",
    );
    expect(parsed?.segments[0]?.visualRecommendation.type).toBe("NONE");
    expect(parsed?.segments[0]?.visualRecommendation.position).toBe("right");
  });

  it("returns null for invalid JSON", () => {
    expect(readAnalysis("not json")).toBeNull();
    expect(normalizeAnalysis({ segments: [{ text: "" }] })).toEqual({ segments: [] });
  });

  it("reports a missing Gemini key without calling the network", async () => {
    const model = new GeminiVisualRecommendationModel("");
    await expect(model.recommend([{ start: 0, end: 2, text: "Яриа" }])).rejects.toThrow(messages.geminiMissing);
  });
});

describe("captions", () => {
  it("splits a long sentence into short chunks", () => {
    const chunks = splitCaption(sampleSpeech, 0, 12);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.text.split(/\s+/).length <= 5)).toBe(true);
    expect(chunks[0]?.start).toBe(0);
    expect(chunks.at(-1)?.end).toBeGreaterThan(chunks[0]?.end ?? 0);
  });

  it("aligns a plain transcript across the clip duration", () => {
    const segments = alignTranscript("Нэг хоёр гурав.", 9);
    expect(segments[0]?.text).toContain("Нэг");
    expect(segments.at(-1)?.end).toBeGreaterThan(0);
  });
});

describe("timeline", () => {
  it("keeps the visual on the first caption chunk and drops a picture without an asset", () => {
    const parsed = parseAnalysis({ segments: [analysisSegment(sampleSpeech)] });
    if (!parsed.ok) throw new Error(parsed.error);
    const withAsset = segmentsFromAnalysis(parsed.data, () => "/api/media/startup.jpg");
    expect(withAsset[0]?.imageUrl).toBe("/api/media/startup.jpg");
    expect(withAsset[0]?.reason).toContain("startups");
    expect(withAsset[1]?.visualRecommendation.type).toBe("NONE");
    const withoutAsset = segmentsFromAnalysis(parsed.data, () => undefined);
    expect(withoutAsset[0]?.visualRecommendation.type).toBe("TEXT");
  });
});

describe("visual ranking", () => {
  const related: VisualCandidate = {
    id: "traffic",
    type: "BROLL",
    url: "https://example.com/ulaanbaatar-traffic.mp4",
    thumbnail: "https://example.com/traffic.jpg",
    title: "Ulaanbaatar traffic cars",
    duration: 6,
    width: 720,
    height: 1280,
    source: "pexels",
    license: "Pexels License",
  };
  const unrelated: VisualCandidate = {
    id: "beach",
    type: "IMAGE",
    url: "https://example.com/beach.jpg",
    thumbnail: "https://example.com/beach-thumb.jpg",
    title: "Quiet beach",
    duration: 0,
    width: 1000,
    height: 800,
    source: "pexels",
    license: "Pexels License",
  };

  it("rejects a result that does not match the topic", () => {
    expect(scoreCandidate(unrelated, { keywords: ["traffic"], description: "busy cars" })).toBe(0);
    expect(
      chooseVisual([unrelated, related], { keywords: ["traffic", "cars"], description: "Ulaanbaatar traffic", duration: 5 }, new Set()),
    ).toMatchObject({ id: "traffic" });
  });

  it("skips an asset that was already used", () => {
    expect(chooseVisual([related], { keywords: ["traffic"], description: "cars" }, new Set(["traffic"]))).toBeNull();
  });
});

describe("providers and demo mode", () => {
  it("does not transcribe when the Chimege key is missing", async () => {
    const provider = createChimegeProvider({ key: "" });
    await expect(provider.transcribe(new Uint8Array([1, 2, 3]), 4)).rejects.toThrow(messages.chimegeMissing);
  });

  it("parses a short Chimege transcript and a pending long job", () => {
    expect(parseChimegeBody("Монгол яриа.", "text/plain")).toMatchObject({ done: true, text: "Монгол яриа." });
    expect(parseChimegeBody(JSON.stringify({ done: false }), "application/json")).toEqual({ pending: true });
  });

  it("keeps demo mode on unless it is explicitly disabled", () => {
    const previousPublic = process.env.NEXT_PUBLIC_DEMO_MODE;
    const previousServer = process.env.DEMO_MODE;
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    delete process.env.DEMO_MODE;
    expect(demoModeBlock()).toBe(messages.demo);
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    expect(demoModeBlock()).toBeNull();
    if (previousPublic === undefined) delete process.env.NEXT_PUBLIC_DEMO_MODE;
    else process.env.NEXT_PUBLIC_DEMO_MODE = previousPublic;
    if (previousServer === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previousServer;
  });
});

describe("processing job", () => {
  it("stores the transcript and a reasoned visual without calling external APIs", async () => {
    const repo = new MemoryVideoRepository();
    await repo.create({
      id: "job-1",
      filename: "talk.mp4",
      title: "talk",
      duration: 12,
      originalKey: "job-1/original.mp4",
      originalUrl: "/api/media/job-1/original.mp4",
    });
    const parsed = parseAnalysis({ segments: [analysisSegment("Сүүлийн жилүүдэд Монголд startup.")] });
    if (!parsed.ok) throw new Error(parsed.error);
    await processVideo("job-1", fakeDeps(repo, parsed.data));
    const saved = await repo.get("job-1");
    expect(saved?.status).toBe("READY");
    expect(saved?.segments[0]?.reason).toContain("startups");
    expect(saved?.processedUrl).toContain("/api/media/");
  });

  it("keeps the transcript when Gemini is not configured", async () => {
    const repo = new MemoryVideoRepository();
    await repo.create({
      id: "job-2",
      filename: "talk.mp4",
      title: "talk",
      duration: 8,
      originalKey: "job-2/original.mp4",
      originalUrl: "/api/media/job-2/original.mp4",
    });
    const deps = fakeDeps(repo, { segments: [] });
    deps.recommend = null;
    await processVideo("job-2", deps);
    const saved = await repo.get("job-2");
    expect(saved?.status).toBe("FAILED");
    expect(saved?.errorMessage).toBe(messages.geminiMissing);
    expect(saved?.segments.length).toBeGreaterThan(0);
  });
});

function fakeDeps(repo: MemoryVideoRepository, analysis: Analysis): PipelineDeps {
  return {
    repo,
    speech: {
      async transcribe() {
        return {
          language: "mn",
          text: "Сүүлийн жилүүдэд Монголд startup.",
          words: [],
          segments: [{ start: 0, end: 6, text: "Сүүлийн жилүүдэд Монголд startup." }],
        };
      },
    },
    recommend: {
      async recommend() {
        return analysis;
      },
    },
    search: {
      async search() {
        return [
          {
            id: "startup-office",
            type: "IMAGE",
            url: "https://example.com/startup-office.jpg",
            thumbnail: "https://example.com/startup-office-thumb.jpg",
            title: "startup office",
            duration: 0,
            width: 800,
            height: 1200,
            source: "pexels",
            license: "Pexels License",
          },
        ];
      },
    },
    extractAudio: async () => undefined,
    probeDuration: async () => 12,
    render: async () => undefined,
    readBytes: async () => new Uint8Array([1]),
    writeBytes: async (key) => `/api/media/${key}`,
    pathFor: (key) => key,
    download: async () => new Uint8Array([1, 2, 3]),
  };
}
