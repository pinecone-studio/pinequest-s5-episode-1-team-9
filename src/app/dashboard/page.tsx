import type { Metadata } from "next";
import Link from "next/link";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { AppHeader } from "@/components/studio/AppHeader";
import { buttonVariants } from "@/components/ui/button";
import { listProjects } from "@/lib/demo/projects";
import { mn } from "@/lib/i18n/mn";
import { getVideoRepository } from "@/server/pipeline/processVideo";
import { toProject } from "@/server/repositories/types";

export const metadata: Metadata = {
  title: mn.dashboard.title,
};

export default async function DashboardPage() {
  const stored = await listStored();
  const projects = [...stored, ...listProjects()];

  return (
    <div className="min-h-dvh pb-16">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <p className="text-base text-mute">{mn.dashboard.greeting}</p>
        <h1 className="mt-2 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">{mn.dashboard.subtitle}</h1>
        <Link
          href="/upload"
          className="mt-8 flex flex-col items-start gap-4 rounded-[28px] border border-white/80 bg-white p-8 shadow-[0_18px_50px_rgba(70,40,140,0.08)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(70,40,140,0.12)]"
        >
          <span className="rounded-full bg-gradient-to-r from-accent/15 to-cyan/20 px-3 py-1 text-xs font-semibold text-accent">
            {mn.dashboard.cardKicker}
          </span>
          <span className="text-3xl font-semibold tracking-tight">{mn.dashboard.cardTitle}</span>
          <span className="max-w-md text-sm leading-relaxed text-mute">{mn.dashboard.cardBody}</span>
          <span className={buttonVariants({ size: "lg" })}>{mn.dashboard.choose}</span>
        </Link>
        <h2 className="mt-14 text-2xl font-semibold tracking-tight">{mn.dashboard.recent}</h2>
        {projects.length === 0 ? (
          <div className="mt-8 max-w-md">
            <p className="text-lg text-mute">{mn.dashboard.empty}</p>
            <p className="mt-2 text-sm text-faint">{mn.dashboard.emptyHome}</p>
            <Link href="/upload" className={`${buttonVariants({ size: "lg" })} mt-6`}>
              {mn.nav.createReel}
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

async function listStored() {
  try {
    const records = await (await getVideoRepository()).list();
    return records.flatMap((record) => {
      const project = toProject(record);
      return project ? [project] : [];
    });
  } catch {
    return [];
  }
}
