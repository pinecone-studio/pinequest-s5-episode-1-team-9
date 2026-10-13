import { ArrowRight, BarChart3, Brain, MessageCircle, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/site/header";
import { RoomPreview } from "@/components/site/room-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Users,
    title: "Level-based matching",
    body: "We pair you with someone practicing the same language at your CEFR level — never by nationality.",
  },
  {
    icon: MessageCircle,
    title: "Real conversations",
    body: "Face-to-face video or voice with a real person. No scripts, no bots on the other end.",
  },
  {
    icon: Brain,
    title: "AI-powered topics",
    body: "A quiet AI coach suggests topics tuned to your level, so the conversation never stalls.",
  },
  {
    icon: BarChart3,
    title: "Personalized feedback",
    body: "After the call: your real mistakes, better phrasing, vocabulary upgrades and exercises.",
  },
];

const STEPS = [
  { n: "01", title: "Set your level", body: "Pick your target language and CEFR level, or let AI assess you in a few questions." },
  { n: "02", title: "Get matched", body: "Join the queue and we find someone at your level who's practicing right now." },
  { n: "03", title: "Talk, then improve", body: "Chat naturally. When you hang up, AI shows exactly what to work on next." },
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-[480px] max-w-4xl rounded-full bg-[radial-gradient(closest-side,oklch(0.85_0.12_275/0.45),transparent)] blur-2xl"
          />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
            <div>
              <Badge variant="secondary" className="mb-5">
                <Sparkles /> Omegle-style language exchange, with an AI coach
              </Badge>
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Practice languages with real people, <span className="text-primary">powered by AI.</span>
              </h1>
              <p className="text-muted-foreground mt-5 max-w-xl text-lg text-pretty">
                Meet a stranger at your level, talk naturally, and let AI tell you exactly how to improve.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button size="lg" asChild>
                  <Link href="/signup">
                    Start practicing <ArrowRight />
                  </Link>
                </Button>
                <Button size="lg" variant="ghost" asChild>
                  <Link href="#how">How it works</Link>
                </Button>
              </div>
              <p className="text-muted-foreground mt-6 text-sm">
                Free · 18+ · Audio and video are never recorded
              </p>
            </div>
            <RoomPreview />
          </div>
        </section>

        <section className="border-y bg-card/50">
          <div className="mx-auto grid max-w-6xl gap-px px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="p-4">
                <div className="bg-primary/10 text-primary mb-4 grid size-10 place-items-center rounded-lg">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-medium">{title}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-xl border p-6">
                <div className="text-primary font-mono text-sm">{s.n}</div>
                <h3 className="mt-3 text-lg font-medium">{s.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="grid gap-10 rounded-2xl border bg-card p-8 md:grid-cols-2 md:p-12">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Feedback that's actually about you</h2>
              <p className="text-muted-foreground mt-4 leading-relaxed">
                The AI stays quiet during your call. Afterwards you get a report built from your own words: the
                mistakes you really made, more natural ways to say them, words you overused, and short exercises
                targeting exactly those gaps.
              </p>
              <p className="text-muted-foreground mt-4 text-sm">
                We're upfront about limits: we score grammar, vocabulary and fluency from the transcript, but we don't
                pretend to grade pronunciation the browser can't measure.
              </p>
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border p-4">
                <div className="text-muted-foreground text-xs">You said</div>
                <div className="mt-1 line-through decoration-destructive/60">I am agree with him.</div>
                <div className="text-muted-foreground mt-3 text-xs">Better</div>
                <div className="font-medium text-success">I agree with him.</div>
                <div className="text-muted-foreground mt-2 text-xs">"Agree" is already a verb, so it doesn't need "am".</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-muted-foreground text-xs">Instead of "very good", try</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["excellent", "impressive", "effective", "valuable"].map((w) => (
                    <Badge key={w} variant="accent">
                      {w}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm sm:flex-row sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} LinguaMatch</span>
          <span>Be kind. Report abuse. Never share personal details with strangers.</span>
        </div>
      </footer>
    </>
  );
}

