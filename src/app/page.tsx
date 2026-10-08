import { Compare } from "@/components/landing/Compare";
import { Heard } from "@/components/landing/Heard";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Heard />
        <Compare />
      </main>
      <SiteFooter />
    </>
  );
}
