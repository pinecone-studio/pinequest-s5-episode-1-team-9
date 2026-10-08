import { NextResponse } from "next/server";
import { mn } from "@/lib/i18n/mn";
import { demoModeBlock, messages } from "@/lib/pipeline/messages";
import { localStorage } from "@/lib/storage/local";
import { fileExtension, looksLikeVideo, safeFilename } from "@/lib/upload/files";
import { uploadFileSchema } from "@/lib/upload/schema";
import { enqueueVideo, getVideoRepository } from "@/server/pipeline/processVideo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = demoModeBlock();
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: mn.errors.choose }, { status: 400 });
    }
    const parsed = uploadFileSchema.safeParse({ name: file.name, type: file.type, size: file.size });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? mn.errors.type }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!looksLikeVideo(bytes, file.name)) {
      return NextResponse.json({ error: mn.errors.type }, { status: 400 });
    }
    const id = crypto.randomUUID();
    const extension = fileExtension(file.name) || ".mp4";
    const key = `${id}/original${extension}`;
    const stored = await localStorage.put({
      key,
      body: bytes,
      contentType: file.type || "video/mp4",
    });
    const duration = Number(form.get("duration"));
    const filename = safeFilename(file.name);
    const repo = await getVideoRepository();
    await repo.create({
      id,
      filename,
      title: filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
      duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
      originalKey: key,
      originalUrl: stored.url,
    });
    enqueueVideo(id);
    return NextResponse.json({ id });
  } catch {
    return NextResponse.json({ error: messages.generic }, { status: 500 });
  }
}
