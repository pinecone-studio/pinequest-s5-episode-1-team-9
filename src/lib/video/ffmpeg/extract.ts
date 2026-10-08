import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PipelineError, messages } from "@/lib/pipeline/messages";

const exec = promisify(execFile);

export function extractAudioArgs(input: string, output: string): string[] {
  return ["-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", output];
}

export async function ffmpegAvailable(): Promise<boolean> {
  try {
    await exec("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

export async function extractAudio(input: string, output: string): Promise<void> {
  if (!(await ffmpegAvailable())) throw new PipelineError("FFMPEG", messages.ffmpegMissing);
  try {
    await exec("ffmpeg", extractAudioArgs(input, output));
  } catch {
    throw new PipelineError("FFMPEG", messages.ffmpegMissing);
  }
}

export async function probeDuration(input: string): Promise<number> {
  try {
    const { stdout } = await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", input]);
    const duration = Number(stdout.trim());
    return Number.isFinite(duration) ? duration : 0;
  } catch {
    return 0;
  }
}

export async function renderVideo(args: string[]): Promise<void> {
  if (!(await ffmpegAvailable())) throw new PipelineError("RENDER", messages.render);
  try {
    await exec("ffmpeg", args, { maxBuffer: 10 * 1024 * 1024 });
  } catch {
    throw new PipelineError("RENDER", messages.render);
  }
}
