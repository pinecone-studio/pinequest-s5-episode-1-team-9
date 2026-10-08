import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { buttonVariants } from "@/components/ui/button";
import { mn } from "@/lib/i18n/mn";

export const metadata: Metadata = {
  title: mn.login.title,
};

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-md rounded-3xl border border-white/80 bg-white p-8 text-center shadow-[0_20px_60px_rgba(70,40,140,0.1)]">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">{mn.login.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-mute">{mn.login.body}</p>
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/upload" className={buttonVariants({ size: "lg" })}>
            {mn.nav.createReel}
          </Link>
          <Link href="/dashboard" className={buttonVariants({ variant: "quiet", size: "lg" })}>
            {mn.login.recent}
          </Link>
        </div>
      </div>
    </main>
  );
}
