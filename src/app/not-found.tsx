import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { mn } from "@/lib/i18n/mn";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-5xl font-semibold tracking-tight">{mn.editor.noPage}</h1>
        <Link href="/dashboard" className={`${buttonVariants({ variant: "quiet" })} mt-8`}>
          {mn.editor.backRecent}
        </Link>
      </div>
    </main>
  );
}
