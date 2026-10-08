import { getProject } from "@/lib/demo/projects";
import { mn } from "@/lib/i18n/mn";
import { VISUAL_LABEL } from "@/lib/ai/schemas/analysis";
import { formatClock } from "@/utils/time";

export function Heard() {
  const project = getProject("startup");
  if (!project) return null;

  return (
    <section id="examples" className="mx-auto max-w-6xl px-5 py-16">
      <p className="text-sm font-medium text-accent">{mn.examples.eyebrow}</p>
      <h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">{mn.examples.title}</h2>
      <ol className="mt-8 divide-y divide-line overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_12px_40px_rgba(70,40,140,0.06)]">
        {project.segments.map((segment) => (
          <li key={segment.id} className="grid gap-4 px-6 py-6 md:grid-cols-[7rem_1.3fr_0.9fr] md:items-start">
            <time className="text-sm text-faint">
              {formatClock(segment.startTime)}–{formatClock(segment.endTime)}
            </time>
            <p className="text-lg leading-snug">{segment.text}</p>
            <div>
              <p className="text-sm font-semibold text-accent">{segment.overlayText}</p>
              <p className="mt-2 text-sm leading-relaxed text-mute">
                {VISUAL_LABEL[segment.visualRecommendation.type]} · {segment.visualRecommendation.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
