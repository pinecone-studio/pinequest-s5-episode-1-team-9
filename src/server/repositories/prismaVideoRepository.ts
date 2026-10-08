import { PrismaClient, type VideoStatus } from "@prisma/client";
import type { EditorSegment } from "@/lib/ai/schemas/analysis";
import type { CreateVideo, VideoRecord, VideoRepository, VideoStage } from "@/server/repositories/types";

const globalForPrisma = globalThis as { prisma?: PrismaClient };

function client(): PrismaClient {
  globalForPrisma.prisma ??= new PrismaClient();
  return globalForPrisma.prisma;
}

export class PrismaVideoRepository implements VideoRepository {
  async create(input: CreateVideo): Promise<VideoRecord> {
    const video = await client().video.create({
      data: {
        id: input.id,
        filename: input.filename,
        title: input.title,
        duration: input.duration,
        originalKey: input.originalKey,
        originalUrl: input.originalUrl,
        status: "UPLOADING",
      },
    });
    return toRecord(video, "", []);
  }

  async update(id: string, patch: Partial<VideoRecord>): Promise<VideoRecord> {
    const video = await client().video.update({
      where: { id },
      data: {
        filename: patch.filename,
        title: patch.title,
        duration: patch.duration,
        status: patch.status as VideoStatus | undefined,
        errorMessage: patch.errorMessage,
        originalKey: patch.originalKey,
        originalUrl: patch.originalUrl,
        audioKey: patch.audioKey,
        processedKey: patch.processedKey,
        processedUrl: patch.processedUrl,
      },
    });
    if (patch.fullText !== undefined || patch.segments) {
      await replaceTranscript(id, patch.fullText ?? "", patch.segments ?? []);
    }
    return this.require(id, video.createdAt);
  }

  async get(id: string): Promise<VideoRecord | null> {
    const video = await client().video.findUnique({
      where: { id },
      include: {
        transcript: {
          include: {
            segments: {
              include: { analysis: true, edits: { include: { visualAsset: true } } },
              orderBy: { startTime: "asc" },
            },
          },
        },
      },
    });
    if (!video) return null;
    return toRecord(video, video.transcript?.fullText ?? "", segmentsFrom(video.transcript?.segments ?? []));
  }

  async list(): Promise<VideoRecord[]> {
    const videos = await client().video.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        transcript: {
          include: {
            segments: {
              include: { analysis: true, edits: { include: { visualAsset: true } } },
              orderBy: { startTime: "asc" },
            },
          },
        },
      },
    });
    return videos.map((video) => toRecord(video, video.transcript?.fullText ?? "", segmentsFrom(video.transcript?.segments ?? [])));
  }

  private async require(id: string, createdAt: Date): Promise<VideoRecord> {
    const record = await this.get(id);
    if (!record) throw new Error("Video not found");
    return { ...record, createdAt: createdAt.toISOString() };
  }
}

async function replaceTranscript(videoId: string, fullText: string, segments: EditorSegment[]): Promise<void> {
  const prisma = client();
  await prisma.transcript.deleteMany({ where: { videoId } });
  if (!fullText && segments.length === 0) return;
  await prisma.transcript.create({
    data: {
      videoId,
      language: "mn",
      fullText,
      segments: {
        create: segments.map((segment) => ({
          id: segment.id,
          startTime: segment.startTime,
          endTime: segment.endTime,
          text: segment.text,
          topic: segment.topic,
          importance: segment.importance,
          analysis: {
            create: {
              topic: segment.topic,
              keywords: segment.keywords,
              visualType: segment.visualRecommendation.type,
              visualDescription: segment.visualRecommendation.description,
              suggestedText: segment.overlayText,
              confidence: segment.importance,
              reason: segment.reason ?? "",
            },
          },
          edits: segment.imageUrl
            ? {
                create: {
                  video: { connect: { id: videoId } },
                  startTime: segment.startTime,
                  endTime: segment.endTime,
                  position: segment.visualRecommendation.position,
                  scale: segment.scale,
                  opacity: segment.opacity,
                  editType: segment.visualRecommendation.type,
                  visualAsset: {
                    create: {
                      type: segment.visualRecommendation.type,
                      url: segment.imageUrl,
                      title: segment.visualRecommendation.description || segment.overlayText || segment.topic,
                      description: segment.visualRecommendation.description,
                      keywords: segment.keywords,
                      source: "pexels",
                      license: "Pexels License",
                    },
                  },
                },
              }
            : undefined,
        })),
      },
    },
  });
}

type VideoRow = {
  id: string;
  filename: string;
  title: string;
  duration: number;
  status: VideoStatus;
  errorMessage: string | null;
  originalKey: string | null;
  originalUrl: string | null;
  audioKey: string | null;
  processedKey: string | null;
  processedUrl: string | null;
  createdAt: Date;
};

function toRecord(video: VideoRow, fullText: string, segments: EditorSegment[]): VideoRecord {
  return {
    id: video.id,
    filename: video.filename,
    title: video.title,
    duration: video.duration,
    status: video.status as VideoStage,
    errorMessage: video.errorMessage,
    originalKey: video.originalKey ?? "",
    originalUrl: video.originalUrl ?? "",
    audioKey: video.audioKey,
    processedKey: video.processedKey,
    processedUrl: video.processedUrl,
    createdAt: video.createdAt.toISOString(),
    fullText,
    segments,
  };
}

type SegmentRow = {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  topic: string | null;
  importance: number;
  analysis: {
    topic: string;
    keywords: string[];
    visualType: EditorSegment["visualRecommendation"]["type"];
    visualDescription: string;
    suggestedText: string;
    reason: string;
  } | null;
  edits?: { visualAsset: { url: string } | null; position: string; scale: number; opacity: number }[];
};

function segmentsFrom(rows: SegmentRow[]): EditorSegment[] {
  return rows.map((row) => {
    const edit = row.edits?.[0];
    return {
      id: row.id,
      startTime: row.startTime,
      endTime: row.endTime,
      text: row.text,
      topic: row.analysis?.topic ?? row.topic ?? "speech",
      keywords: row.analysis?.keywords ?? [],
      importance: row.importance,
      reason: row.analysis?.reason || undefined,
      imageUrl: edit?.visualAsset?.url,
      visualRecommendation: {
        type: row.analysis?.visualType ?? "NONE",
        description: row.analysis?.visualDescription ?? "",
        duration: Math.max(0, row.endTime - row.startTime),
        position: (edit?.position as EditorSegment["visualRecommendation"]["position"]) ?? "right",
      },
      overlayText: row.analysis?.suggestedText ?? "",
      scale: edit?.scale ?? 1,
      opacity: edit?.opacity ?? 1,
    };
  });
}
