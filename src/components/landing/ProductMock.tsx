import { Stage } from "@/components/video/Stage";
import { getProject } from "@/lib/demo/projects";
import { mn } from "@/lib/i18n/mn";

export function ProductMock() {
  const segment = getProject("traffic")?.segments[0];
  if (!segment) return null;

  return (
    <div className="relative mx-auto w-full max-w-[340px] pb-4">
      <div className="rounded-[28px] bg-white p-3 shadow-[0_24px_70px_rgba(70,40,140,0.14)]">
        <Stage
          subtitle={segment.text}
          overlay={segment.overlayText}
          topic={segment.topic}
          visualType={segment.visualRecommendation.type}
          position={segment.visualRecommendation.position}
        />
      </div>
      <aside className="relative z-10 -mt-14 ml-3 w-[min(100%,230px)] rounded-2xl border border-white/80 bg-white/90 p-4 shadow-[0_16px_40px_rgba(70,40,140,0.12)] backdrop-blur-md sm:absolute sm:-left-10 sm:bottom-16 sm:ml-0 sm:mt-0">
        <p className="text-xs font-semibold text-accent">{mn.hero.understood}</p>
        <p className="mt-3 text-xs text-faint">{mn.hero.topic}</p>
        <p className="text-sm font-semibold">{mn.hero.topicValue}</p>
        <p className="mt-2 text-xs text-faint">{mn.hero.visual}</p>
        <p className="text-sm font-semibold">{mn.hero.visualValue}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-2">
          <div className="h-full w-[94%] rounded-full bg-gradient-to-r from-accent to-cyan" />
        </div>
        <p className="mt-2 text-xs text-mute">{mn.hero.confidence}</p>
      </aside>
    </div>
  );
}
