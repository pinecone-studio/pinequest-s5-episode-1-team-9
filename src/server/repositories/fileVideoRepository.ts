import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CreateVideo, VideoRecord, VideoRepository } from "@/server/repositories/types";

export class MemoryVideoRepository implements VideoRepository {
  private readonly records = new Map<string, VideoRecord>();

  async create(input: CreateVideo): Promise<VideoRecord> {
    const record = blank(input);
    this.records.set(record.id, record);
    return record;
  }

  async update(id: string, patch: Partial<VideoRecord>): Promise<VideoRecord> {
    const current = this.records.get(id);
    if (!current) throw new Error("Video not found");
    const next = { ...current, ...patch, id: current.id };
    this.records.set(id, next);
    return next;
  }

  async get(id: string): Promise<VideoRecord | null> {
    return this.records.get(id) ?? null;
  }

  async list(): Promise<VideoRecord[]> {
    return [...this.records.values()];
  }
}

export class FileVideoRepository implements VideoRepository {
  constructor(private readonly directory: string) {}

  async create(input: CreateVideo): Promise<VideoRecord> {
    const record = blank(input);
    await this.write(record);
    return record;
  }

  async update(id: string, patch: Partial<VideoRecord>): Promise<VideoRecord> {
    const current = await this.get(id);
    if (!current) throw new Error("Video not found");
    const next = { ...current, ...patch, id: current.id };
    await this.write(next);
    return next;
  }

  async get(id: string): Promise<VideoRecord | null> {
    try {
      const raw = await readFile(this.file(id), "utf8");
      return JSON.parse(raw) as VideoRecord;
    } catch {
      return null;
    }
  }

  async list(): Promise<VideoRecord[]> {
    try {
      const names = await readdir(this.directory);
      const records = await Promise.all(
        names.filter((name) => name.endsWith(".json")).map((name) => this.get(name.replace(/\.json$/, ""))),
      );
      return records.filter((record): record is VideoRecord => record !== null);
    } catch {
      return [];
    }
  }

  private file(id: string): string {
    if (!/^[\w-]+$/.test(id)) throw new Error("Invalid video id");
    return path.join(this.directory, `${id}.json`);
  }

  private async write(record: VideoRecord): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const destination = this.file(record.id);
    const temporary = `${destination}.tmp`;
    await writeFile(temporary, JSON.stringify(record));
    await rename(temporary, destination);
  }
}

function blank(input: CreateVideo): VideoRecord {
  return {
    ...input,
    status: "UPLOADING",
    errorMessage: null,
    audioKey: null,
    processedKey: null,
    processedUrl: null,
    createdAt: new Date().toISOString(),
    fullText: "",
    segments: [],
  };
}

const directory = path.join(process.cwd(), "data", "videos");
let files: FileVideoRepository | null = null;

export function fileVideoRepository(): FileVideoRepository {
  files ??= new FileVideoRepository(directory);
  return files;
}
