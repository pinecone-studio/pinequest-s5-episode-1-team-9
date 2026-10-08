import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { buttonVariants } from "@/components/ui/button";
import { mn } from "@/lib/i18n/mn";

const links = [
  { href: "#product", label: mn.nav.product },
  { href: "#how", label: mn.nav.howItWorks },
  { href: "#examples", label: mn.nav.examples },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 px-4 pt-4">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-full border border-white/80 bg-white/75 px-2.5 shadow-[0_10px_40px_rgba(70,40,140,0.06)] backdrop-blur-md">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-mute md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-paper">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <Link href="/login" className={`${buttonVariants({ variant: "ghost" })} px-3`}>
            {mn.nav.signIn}
          </Link>
          <Link href="/upload" className={buttonVariants()}>
            {mn.nav.createReel}
          </Link>
        </div>
      </div>
    </header>
  );
}
