import { Logo } from "@/components/brand/Logo";
import { mn } from "@/lib/i18n/mn";

export function SiteFooter() {
  return (
    <footer className="mt-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
        <Logo />
        <p className="text-sm text-faint">{mn.footer}</p>
      </div>
    </footer>
  );
}
