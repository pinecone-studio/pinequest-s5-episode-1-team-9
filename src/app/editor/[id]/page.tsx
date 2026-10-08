import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Editor } from "@/components/editor/Editor";
import { buttonVariants } from "@/components/ui/button";
import { getProject } from "@/lib/demo/projects";
import { mn } from "@/lib/i18n/mn";
import { getVideoRepository } from "@/server/pipeline/processVideo";
import { toProject } from "@/server/repositories/types";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ file?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const project = getProject(id);
  if (project) return { title: project.title };
  return { title: "Reel" };
}

export default async function EditorPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { file } = await searchParams;
  const demo = getProject(id);
  if (demo) return <Editor project={demo} uploadedName={file} />;

  const record = await (await getVideoRepository()).get(id);
  if (!record) notFound();
  const project = toProject(record);
  if (!project) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-md">
          <p className="text-sm font-medium text-accent">{mn.export.rendering}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{mn.editor.still}</h1>
          <p className="mt-3 text-sm leading-relaxed text-mute">{record.errorMessage ?? mn.editor.stillBody}</p>
          <Link href="/upload" className={`${buttonVariants()} mt-8`}>
            {mn.editor.back}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <Editor
      project={project}
      uploadedName={record.filename}
      mediaUrl={record.originalUrl}
      reelUrl={record.processedUrl ?? undefined}
      sampleNote={false}
    />
  );
}
