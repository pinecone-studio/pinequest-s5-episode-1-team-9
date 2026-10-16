"use client";

import Link from "next/link";
import { LogoMark, LogoWord } from "@/components/brand/logo-mark";

export function PaperHeader({ cta = "Start a call" }: { cta?: string }) {
  return (
    <header className="border-hairline mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 border-b px-6 py-3.5">
      <Link href="/" className="text-ink flex items-center gap-3 no-underline">
        <LogoMark />
        <LogoWord className="text-xl" />
      </Link>
      <nav aria-label="Main" className="flex flex-wrap items-center gap-1.5">
        <Link href="/friends" className="text-ink min-h-11 px-3 py-3 font-medium no-underline">
          Friends
        </Link>
        <Link href="/profile" className="text-ink min-h-11 px-3 py-3 font-medium no-underline">
          Profile
        </Link>
        <Link
          href="/"
          className="bg-brand-you inline-flex min-h-12 items-center rounded-[14px] px-5 font-bold text-white no-underline"
        >
          {cta}
        </Link>
      </nav>
    </header>
  );
}
