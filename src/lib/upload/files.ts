const extensions = [".mp4", ".mov", ".webm"];

export function safeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "video.mp4";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 80);
  return cleaned.length > 0 ? cleaned : "video.mp4";
}

export function fileExtension(name: string): string {
  const lower = safeFilename(name).toLowerCase();
  return extensions.find((extension) => lower.endsWith(extension)) ?? "";
}

export function looksLikeVideo(bytes: Uint8Array, name: string): boolean {
  const extension = fileExtension(name);
  if (!extension || bytes.byteLength < 12) return false;
  if (extension === ".webm") {
    return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  }
  return String.fromCharCode(bytes[4] ?? 0, bytes[5] ?? 0, bytes[6] ?? 0, bytes[7] ?? 0) === "ftyp";
}
