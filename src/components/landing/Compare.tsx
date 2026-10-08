import { Stage } from "@/components/video/Stage";
import { getProject } from "@/lib/demo/projects";
import { mn } from "@/lib/i18n/mn";

export function Compare() {
  const segment = getProject("startup")?.segments[2];
  if (!segment) return null;

  return (
    <section className="mx-auto max-w-6xl px-5 py-8 pb-20">
      <p className="text-sm font-medium text-accent">{mn.compare.eyebrow}</p>
      <h2 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">{mn.compare.title}</h2>
      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <figure>
          <figcaption className="mb-3 text-sm text-mute">{mn.compare.raw}</figcaption>
          <Stage subtitle={segment.text} visualType="NONE" topic={segment.topic} className="mx-auto max-w-xs" />
        </figure>
        <figure>
          <figcaption className="mb-3 text-sm text-accent">{mn.compare.reel}</figcaption>
          <Stage
            subtitle={segment.text}
            overlay={segment.overlayText}
            topic={segment.topic}
            visualType={segment.visualRecommendation.type}
            position={segment.visualRecommendation.position}
            className="mx-auto max-w-xs"
          />
        </figure>
      </div>
    </section>
  );
}
