"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Clapperboard, Film, ImageIcon, Sparkles, Upload, Waves } from "lucide-react";
import { Stage } from "@/components/video/Stage";
import { Button } from "@/components/ui/button";
import { demoMode } from "@/lib/config";
import { getProject, SAMPLE_VIDEO } from "@/lib/demo/projects";
import { mn } from "@/lib/i18n/mn";
import { stageStep } from "@/lib/pipeline/messages";
import { uploadFileSchema } from "@/lib/upload/schema";
import { formatBytes, formatClock } from "@/utils/time";

const steps = [
  { label: mn.upload.stages[0], icon: Upload },
  { label: mn.upload.stages[1], icon: Waves },
  { label: mn.upload.stages[2], icon: Sparkles },
  { label: mn.upload.stages[3], icon: ImageIcon },
  { label: mn.upload.stages[4], icon: Clapperboard },
  { label: mn.upload.stages[5], icon: Film },
] as const;

type Phase = "idle" | "processing" | "ready" | "failed";

type FileMeta = {
  name: string;
  duration: number;
  size?: number;
  sample: boolean;
};

export function UploadStudio() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [meta, setMeta] = useState<FileMeta | null>(null);
  const [jobId, setJobId] = useState("");
  const preview = getProject(SAMPLE_VIDEO.projectId)?.segments[0];

  useEffect(() => {
    if (!demoMode || phase !== "processing") return;
    setStep(0);
    let current = 0;
    let timeout = 0;
    const interval = window.setInterval(() => {
      current += 1;
      if (current >= steps.length) {
        window.clearInterval(interval);
        timeout = window.setTimeout(() => setPhase("ready"), 650);
        return;
      }
      setStep(current);
    }, 800);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [phase]);

  useEffect(() => {
    if (demoMode || phase !== "processing" || !jobId) return;
    let stopped = false;
    async function tick() {
      try {
        const response = await fetch(`/api/videos/${jobId}`);
        const payload = (await response.json()) as { stage?: string; error?: string | null; transcriptReady?: boolean };
        if (stopped) return;
        if (!response.ok) {
          setError(payload.error ?? mn.errors.processing);
          setPhase("failed");
          return;
        }
        setStep(stageStep(payload.stage ?? ""));
        if (payload.stage === "READY") setPhase("ready");
        if (payload.stage === "FAILED") {
          setError(payload.error ?? mn.errors.processing);
          setPhase(payload.transcriptReady ? "ready" : "failed");
        }
      } catch {
        if (!stopped) {
          setError(mn.errors.network);
          setPhase("failed");
        }
      }
    }
    void tick();
    const timer = window.setInterval(() => void tick(), 1200);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [phase, jobId]);

  async function acceptFile(file: File | undefined) {
    if (!file) return;
    const parsed = uploadFileSchema.safeParse({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? mn.errors.type);
      return;
    }
    setError("");
    try {
      const duration = await readDuration(file);
      setMeta({ name: file.name, duration, size: file.size, sample: false });
      if (demoMode) {
        setPhase("processing");
        return;
      }
      const body = new FormData();
      body.set("file", file);
      body.set("duration", String(duration));
      const response = await fetch("/api/videos", { method: "POST", body });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) {
        setError(payload.error ?? mn.errors.upload);
        return;
      }
      setJobId(payload.id);
      setPhase("processing");
    } catch {
      setError(mn.errors.upload);
    }
  }

  function useSample() {
    setError("");
    setMeta({
      name: SAMPLE_VIDEO.name,
      duration: SAMPLE_VIDEO.duration,
      sample: true,
    });
    setPhase("processing");
  }

  function openEditor() {
    if (jobId) {
      router.push(`/editor/${jobId}`);
      return;
    }
    const name = meta?.name ?? SAMPLE_VIDEO.name;
    router.push(`/editor/${SAMPLE_VIDEO.projectId}?file=${encodeURIComponent(name)}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-10">
      <AnimatePresence mode="wait">
        {phase === "idle" ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex flex-1 flex-col"
          >
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void acceptFile(event.dataTransfer.files[0]);
              }}
              className={`grid min-h-[460px] flex-1 cursor-pointer place-items-center rounded-[32px] border bg-white px-6 text-center shadow-[0_20px_60px_rgba(70,40,140,0.08)] transition duration-200 ${
                dragging ? "scale-[1.01] border-accent" : "border-white/80 hover:-translate-y-0.5"
              }`}
            >
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                className="sr-only"
                onChange={(event) => {
                  void acceptFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <span>
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-accent to-cyan text-white shadow-[0_12px_30px_rgba(109,74,255,0.28)]">
                  <Upload size={28} />
                </span>
                <span className="mt-5 block text-sm font-medium text-accent">{mn.upload.title}</span>
                <span className="mt-3 block text-4xl font-semibold tracking-tight sm:text-5xl">{mn.upload.drop}</span>
                <span className="mx-auto mt-3 block max-w-md text-base leading-relaxed text-mute">{mn.upload.description}</span>
                <span className="mt-3 block text-sm text-faint">{mn.upload.files}</span>
                <span className="mt-5 inline-flex h-10 items-center rounded-full border border-line bg-panel-2 px-4 text-sm font-semibold text-paper">
                  {mn.upload.choose}
                </span>
              </span>
            </label>
            {error ? <p className="mt-4 text-center text-sm text-danger">{error}</p> : null}
            {demoMode ? (
              <button type="button" onClick={useSample} className="mt-6 self-center text-sm font-semibold text-accent hover:text-paper">
                {mn.upload.sample}
              </button>
            ) : null}
          </motion.div>
        ) : (
          <motion.div
            key="work"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid items-center gap-10 rounded-[32px] border border-white/80 bg-white p-6 shadow-[0_20px_60px_rgba(70,40,140,0.08)] lg:grid-cols-[280px_minmax(0,1fr)] lg:p-8"
          >
            <div>
              {preview ? (
                <Stage
                  subtitle={phase === "ready" ? preview.text : undefined}
                  overlay={phase === "ready" ? preview.overlayText : undefined}
                  topic={preview.topic}
                  visualType={phase === "ready" ? preview.visualRecommendation.type : "NONE"}
                  className="mx-auto max-w-[240px]"
                />
              ) : null}
              {meta ? (
                <p className="mt-4 text-center text-sm text-mute">
                  {meta.name}
                  {meta.duration > 0 ? ` · ${formatClock(meta.duration)}` : ""}
                  {meta.size ? ` · ${formatBytes(meta.size)}` : ""}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-sm font-medium text-accent">{phase === "ready" ? mn.upload.readyKicker : mn.upload.working}</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                {phase === "ready" ? mn.upload.readyTitle : steps[step]?.label}
              </h1>
              <ol className="mt-8 space-y-3">
                {steps.map((item, index) => {
                  const done = phase === "ready" || index < step;
                  const current = phase === "processing" && index === step;
                  const Icon = item.icon;
                  return (
                    <motion.li
                      key={item.label}
                      layout
                      className="flex items-center gap-3 text-sm"
                      animate={{ opacity: done || current ? 1 : 0.55 }}
                      transition={{ duration: 0.2 }}
                    >
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-full ${
                          done
                            ? "bg-gradient-to-br from-accent to-cyan text-white"
                            : current
                              ? "bg-accent/10 text-accent"
                              : "bg-ink-2 text-faint"
                        }`}
                      >
                        {done ? "✓" : <Icon size={15} />}
                      </span>
                      <span className={done || current ? "font-medium text-paper" : "text-faint"}>{item.label}</span>
                    </motion.li>
                  );
                })}
              </ol>
              {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
              {phase === "ready" ? (
                <Button className="mt-8" size="lg" onClick={openEditor}>
                  {mn.upload.preview}
                </Button>
              ) : null}
              {phase === "failed" ? (
                <Button
                  className="mt-8"
                  variant="quiet"
                  onClick={() => {
                    setPhase("idle");
                    setError("");
                    setJobId("");
                    setMeta(null);
                  }}
                >
                  {mn.upload.retry}
                </Button>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    video.src = url;
  });
}
