import { mn } from "@/lib/i18n/mn";

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-5 py-8 lg:py-16">
      <p className="text-sm font-medium text-accent">{mn.how.eyebrow}</p>
      <h2 className="mt-3 max-w-xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{mn.how.title}</h2>
      <ol className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {mn.how.steps.map((step) => (
          <li key={step.number} className="rounded-3xl border border-white/80 bg-white p-6 shadow-[0_12px_40px_rgba(70,40,140,0.06)]">
            <p className="bg-gradient-to-r from-accent to-cyan bg-clip-text text-2xl font-semibold text-transparent">{step.number}</p>
            <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-mute">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
