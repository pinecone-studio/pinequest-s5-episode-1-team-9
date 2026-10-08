import { useId } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  const raw = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden>
      <defs>
        <linearGradient id={raw} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7a5cff" />
          <stop offset="0.55" stopColor="#3b6cff" />
          <stop offset="1" stopColor="#22b8d6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill={`url(#${raw})`} />
      <path d="M10 21.5 16 9l6 12.5" fill="none" stroke="white" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.4 17.2h7.2" fill="none" stroke="white" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-paper">
      <Mark />
      <span className="text-lg font-semibold tracking-tight">Ayan</span>
    </Link>
  );
}
