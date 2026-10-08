import Link from "next/link";
import { Stage } from "@/components/video/Stage";
import type { Project } from "@/lib/ai/schemas/analysis";
import { primarySegment } from "@/lib/demo/projects";
import { mn } from "@/lib/i18n/mn";
import { formatClock, formatDate } from "@/utils/time";

const statusCopy = mn.status;

export function ProjectCard({ project }: { project: Project }) {
  const segment = primarySegment(project);
  if (!segment) return null;

  return (
    <Link
      href={`/editor/${project.id}`}
      className="group block rounded-[24px] border border-white/80 bg-white p-3 shadow-[0_14px_40px_rgba(70,40,140,0.07)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgba(70,40,140,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Stage
        poster
        subtitle={segment.text}
        overlay={segment.overlayText}
        topic={segment.topic}
        visualType={segment.visualRecommendation.type}
        position={segment.visualRecommendation.position}
        className="mx-auto max-w-[220px] transition-transform duration-300 group-hover:scale-[1.015]"
      />
      <div className="px-1 pb-1 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base">{project.title}</h2>
          <span className={project.status === "READY" ? "text-xs font-semibold text-success" : "text-xs text-mute"}>
            {statusCopy[project.status]}
          </span>
        </div>
        <p className="mt-1 text-sm text-mute">
          {formatClock(project.duration)} · {formatDate(project.createdAt)}
        </p>
      </div>
    </Link>
  );
}
