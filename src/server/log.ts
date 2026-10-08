export function logJob(jobId: string, event: string, detail?: string): void {
  const suffix = detail ? ` ${detail}` : "";
  console.log(`[job:${jobId}] ${event}${suffix}`);
}
