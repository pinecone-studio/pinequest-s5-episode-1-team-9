import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageAdapter, StoredObject } from "@/lib/storage/types";
import { uploadPath } from "@/lib/storage/paths";

export function publicMediaUrl(key: string): string {
  return `/api/media/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export const localStorage: StorageAdapter = {
  async put(input): Promise<StoredObject> {
    const full = uploadPath(input.key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, input.body);
    return {
      key: input.key,
      url: publicMediaUrl(input.key),
      contentType: input.contentType,
      size: input.body.byteLength,
    };
  },
  getUrl(key: string): string {
    return publicMediaUrl(key);
  },
};
