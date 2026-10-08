import Link from "next/link";
import { ProductMock } from "@/components/landing/ProductMock";
import { Reveal } from "@/components/landing/Reveal";
import { buttonVariants } from "@/components/ui/button";
import { mn } from "@/lib/i18n/mn";

export function Hero() {
  return (
    <section
      id="product"
      className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(280px,440px)] lg:py-20"
    >
      <div>
        <Reveal>
          <p className="text-sm font-medium text-accent">{mn.hero.eyebrow}</p>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="mt-4 max-w-[14ch] text-5xl font-semibold leading-[1.02] tracking-tight text-balance sm:text-6xl">
            {mn.hero.title}
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-5 max-w-md text-base leading-relaxed text-mute sm:text-lg">
            {mn.hero.body}
          </p>
        </Reveal>
        <Reveal delay={0.18} className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/upload" className={buttonVariants({ size: "lg" })}>
            {mn.hero.primary}
          </Link>
          <a href="#how" className={buttonVariants({ variant: "quiet", size: "lg" })}>
            {mn.hero.secondary}
          </a>
        </Reveal>
      </div>
      <Reveal delay={0.1}>
        <ProductMock />
      </Reveal>
    </section>
  );
}
