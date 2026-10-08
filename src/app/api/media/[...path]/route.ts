import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { mn } from "@/lib/i18n/mn";
import { uploadPath } from "@/lib/storage/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const types: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".wav": "audio/wav",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".ass": "text/plain",
};

type Context = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, context: Context) {
  const { path } = await context.params;
  const key = path.map(decodeURIComponent).join("/");
  if (!key || key.includes("..")) return NextResponse.json({ error: mn.errors.missing }, { status: 404 });
  try {
    const file = uploadPath(key);
    const bytes = await readFile(file);
    const extension = key.slice(key.lastIndexOf(".")).toLowerCase();
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": types[extension] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: mn.errors.missing }, { status: 404 });
  }
}
