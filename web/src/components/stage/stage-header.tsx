"use client";

import Link from "next/link";
import { LogoMark, LogoWord } from "@/components/brand/logo-mark";

export function StageHeader({
  online,
  compact = false,
  onHome,
  children,
}: {
  online: number | null;
  compact?: boolean;
  onHome?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-3.5 sm:px-6">
      {onHome ? (
        <button type="button" onClick={onHome} className="flex items-center gap-3 bg-transparent text-white">
          <LogoMark />
          <LogoWord />
        </button>
      ) : (
        <Link href="/" className="flex items-center gap-3 text-white no-underline">
          <LogoMark />
          <LogoWord />
        </Link>
      )}
      <div className="flex flex-wrap items-center gap-1.5 text-[15px]">
        {children}
        {online !== null && (
          <span className="text-fix-glow rounded-full bg-[rgba(35,168,107,0.18)] px-3 py-2 font-semibold">
            {online} learners online
          </span>
        )}
        {!compact && (
          <>
            <Link href="/friends" className="min-h-11 px-3 py-3 font-medium text-white no-underline">
              Call a friend
            </Link>
            <Link href="/profile" className="min-h-11 px-3 py-3 font-medium text-white no-underline">
              Profile
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
