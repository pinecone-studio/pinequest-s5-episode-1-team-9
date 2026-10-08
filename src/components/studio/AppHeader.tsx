import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { buttonVariants } from "@/components/ui/button";
import { mn } from "@/lib/i18n/mn";

export function AppHeader({ action }: { action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 px-4 pt-4">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between rounded-full border border-white/80 bg-white/75 px-2.5 shadow-[0_10px_40px_rgba(70,40,140,0.06)] backdrop-blur-md">
        <div className="flex items-center gap-6">
          <Logo href="/dashboard" />
          <Link href="/dashboard" className="hidden text-sm text-mute transition-colors hover:text-paper sm:inline">
            {mn.nav.recent}
          </Link>
        </div>
        {action ?? (
          <Link href="/upload" className={buttonVariants()}>
            {mn.nav.createReel}
          </Link>
        )}
      </div>
    </header>
  );
}
