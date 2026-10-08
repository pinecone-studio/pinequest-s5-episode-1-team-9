import type { VisualPosition, VisualType } from "@/lib/ai/schemas/analysis";
import { cn } from "@/lib/utils";
import Image from "next/image";

type StageProps = {
  subtitle?: string;
  overlay?: string;
  topic?: string;
  visualType?: VisualType;
  position?: VisualPosition;
  scale?: number;
  opacity?: number;
  imageUrl?: string;
  poster?: boolean;
  className?: string;
};

export function Stage({
  subtitle,
  overlay,
  topic = "startup",
  visualType = "IMAGE",
  position = "right",
  scale = 1,
  opacity = 1,
  imageUrl,
  poster = false,
  className,
}: StageProps) {
  const showVisual = visualType !== "NONE" && Boolean(overlay);
  const side =
    position === "bottom" || position === "background"
      ? "inset-x-[8%] bottom-[22%]"
      : position === "left"
        ? "left-[6%] top-[16%] w-[40%]"
        : "right-[6%] top-[16%] w-[40%]";

  return (
    <div
      className={cn(
        "@container relative aspect-[9/16] overflow-hidden bg-[#161221] text-white",
        poster ? "rounded-xl" : "rounded-2xl",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_28%,rgba(224,164,74,0.16),transparent_42%)]" />
      <Motif topic={topic} poster={poster} />
      <div className="absolute inset-x-0 bottom-0 top-[18%] flex items-end justify-center">
        <Silhouette />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.62)_100%)]" />
      {showVisual ? (
        <div
          className={cn("absolute overflow-hidden rounded-md border border-white/10 bg-[#16130f]/90 shadow-[0_12px_30px_rgba(0,0,0,0.35)]", side)}
          style={{
            opacity,
            transform: `scale(${scale})`,
            transformOrigin: position === "left" ? "left center" : position === "bottom" || position === "background" ? "center bottom" : "right center",
          }}
        >
          <div className={cn("relative", position === "bottom" || position === "background" ? "h-14" : "aspect-[4/3]")}>
            {imageUrl ? (
              <Image src={imageUrl} alt="" fill unoptimized className="object-cover" />
            ) : (
              <Motif topic={topic} framed />
            )}
          </div>
          <p className="px-2 py-1.5 text-[clamp(8px,2.3cqw,12px)] font-semibold uppercase leading-tight tracking-[0.12em]">
            {overlay}
          </p>
        </div>
      ) : null}
      {subtitle ? (
        <p className="absolute inset-x-3 bottom-3 rounded-md bg-black/72 px-2.5 py-2 text-center text-[clamp(11px,3.5cqw,17px)] font-semibold leading-snug text-white">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function Silhouette() {
  return (
    <svg viewBox="0 0 200 250" className="h-[78%] w-auto" aria-hidden>
      <ellipse cx="100" cy="78" rx="34" ry="40" fill="#2c261f" />
      <path d="M28 250c10-78 36-112 72-112s62 34 72 112" fill="#241f19" />
    </svg>
  );
}

function Motif({ topic, poster = false, framed = false }: { topic: string; poster?: boolean; framed?: boolean }) {
  const className = framed
    ? "absolute inset-0 h-full w-full"
    : poster
      ? "absolute inset-0 h-full w-full opacity-80"
      : "absolute right-0 top-0 h-[46%] w-[52%] opacity-70";

  if (topic === "traffic") {
    return (
      <svg viewBox="0 0 160 120" className={className} aria-hidden>
        <rect width="160" height="120" fill="#121418" />
        <path d="M0 38h160M0 62h160M0 86h160" stroke="#3c4148" strokeWidth="8" />
        <path d="M18 38h28M70 62h36M40 86h22" stroke="#e0a44a" strokeWidth="8" />
      </svg>
    );
  }

  if (topic === "funding") {
    return (
      <svg viewBox="0 0 160 120" className={className} aria-hidden>
        <rect width="160" height="120" fill="#14120f" />
        <rect x="28" y="68" width="18" height="28" fill="#3a342c" />
        <rect x="56" y="50" width="18" height="46" fill="#5c5348" />
        <rect x="84" y="36" width="18" height="60" fill="#e0a44a" />
        <rect x="112" y="58" width="18" height="38" fill="#3a342c" />
      </svg>
    );
  }

  if (topic === "customers") {
    return (
      <svg viewBox="0 0 160 120" className={className} aria-hidden>
        <rect width="160" height="120" fill="#141310" />
        <circle cx="46" cy="58" r="16" fill="#3a342c" />
        <circle cx="80" cy="52" r="18" fill="#e0a44a" />
        <circle cx="114" cy="58" r="16" fill="#3a342c" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <rect width="160" height="120" fill="#16130f" />
      <rect x="18" y="22" width="70" height="52" fill="#2a241c" />
      <path d="M18 48h70M53 22v52" stroke="#e0a44a" strokeWidth="2" />
      <circle cx="118" cy="78" r="16" fill="#e0a44a" opacity="0.85" />
    </svg>
  );
}
