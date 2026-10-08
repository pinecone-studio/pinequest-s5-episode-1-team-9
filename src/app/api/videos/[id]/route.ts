import { NextResponse } from "next/server";
import { mn } from "@/lib/i18n/mn";
import { getVideoRepository } from "@/server/pipeline/processVideo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!/^[\w-]+$/.test(id)) return NextResponse.json({ error: mn.errors.missing }, { status: 404 });
  const repo = await getVideoRepository();
  const record = await repo.get(id);
  if (!record) return NextResponse.json({ error: mn.errors.missing }, { status: 404 });
  return NextResponse.json({
    id: record.id,
    filename: record.filename,
    duration: record.duration,
    stage: record.status,
    error: record.errorMessage,
    transcriptReady: record.segments.length > 0,
    reelReady: Boolean(record.processedUrl),
  });
}
