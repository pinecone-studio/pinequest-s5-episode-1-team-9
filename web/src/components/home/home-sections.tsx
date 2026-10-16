import { Check, Sparkles } from "lucide-react";
import Link from "next/link";

const STEPS = [
  { title: "Pick your level", body: "A1 to C2. Not sure? Take the five-question check." },
  { title: "Press Start", body: "Meet a random learner at your level, or call a friend by username." },
  {
    title: "Talk with a coach beside you",
    body: "Topics, role-play cards, live captions and a chat that fixes your sentences.",
  },
  {
    title: "Practice what you missed",
    body: "A report with scores, your top mistakes and a short quiz built from them.",
  },
];

export function HomeSections() {
  return (
    <>
      <main id="about" className="bg-paper text-ink">
        <section className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-14 px-6 pt-20 pb-18">
          <div className="flex min-w-0 flex-1 basis-110 flex-col gap-6">
            <h1 className="font-display m-0 text-[clamp(34px,4.6vw,56px)] leading-[1.08] font-bold tracking-[-0.02em]">
              Talk to a real person. Get coached while you speak.
            </h1>
            <p className="text-dim m-0 max-w-[34em] text-[19px] leading-[1.55]">
              Meet another English learner at your level on video. An AI coach gives you topics, fixes your
              sentences as you type, and turns your mistakes into practice after the call.
            </p>
          </div>
          <div className="min-w-0 flex-1 basis-110">
            <DemoConversation />
          </div>
        </section>

        <section
          aria-labelledby="how"
          className="border-hairline border-y bg-white"
        >
          <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-6 py-16">
            <h2 id="how" className="font-display m-0 text-3xl font-bold tracking-[-0.01em]">
              How a session works
            </h2>
            <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-7 p-0">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex flex-col gap-2.5">
                  <span
                    aria-hidden="true"
                    className="bg-brand-you-tint text-brand-you-deep font-display grid size-10 place-items-center rounded-xl font-bold"
                  >
                    {i + 1}
                  </span>
                  <h3 className="m-0 text-[19px] font-semibold">{step.title}</h3>
                  <p className="text-dim m-0 leading-[1.55]">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          aria-labelledby="coach"
          className="mx-auto flex max-w-[1240px] flex-col gap-8 px-6 py-18"
        >
          <h2 id="coach" className="font-display m-0 text-3xl font-bold tracking-[-0.01em]">
            What the coach does during a call
          </h2>
          <div className="flex flex-wrap items-stretch gap-6">
            <div className="border-hairline flex min-w-0 shrink basis-90 flex-col gap-4 rounded-3xl border bg-white p-7 grow-[1.3]">
              <h3 className="m-0 text-[21px] font-semibold">Stuck on a word? Write it in Mongolian.</h3>
              <div className="flex flex-col gap-2.5">
                <div className="bg-paper rounded-[14px] px-4 py-3.5 text-[17px]">Би өчигдөр кино үзсэн</div>
                <div className="text-fix-ink flex items-center gap-2.5 rounded-[14px] bg-[#E7F6EE] px-4 py-3.5 text-[17px] font-semibold">
                  <Sparkles aria-hidden="true" className="size-4.5 shrink-0" />
                  I watched a movie yesterday.
                </div>
              </div>
              <p className="text-dim m-0 leading-[1.55]">
                The same button checks your English sentences and explains each fix at your level. Only you see it.
              </p>
            </div>

            <div className="bg-brand-partner-tint flex min-w-0 flex-1 basis-75 flex-col gap-3.5 rounded-3xl p-7">
              <h3 className="m-0 text-[21px] font-semibold">Role-play with a secret goal</h3>
              <div className="border-brand-partner flex flex-col gap-2 rounded-2xl border-2 bg-white p-4.5">
                <span className="text-[17px] font-bold">You are the guest</span>
                <span className="text-dim leading-[1.5]">
                  Your hotel room is noisy and the receptionist says the hotel is full.
                </span>
                <span className="font-semibold leading-[1.5] text-[#8A5300]">Your goal: get a free breakfast.</span>
              </div>
              <p className="m-0 leading-[1.55] text-[#5C4A26]">
                Your partner gets the other role and a different goal. Neither of you sees the other&apos;s.
              </p>
            </div>

            <div className="bg-brand-you-tint flex min-w-0 flex-1 basis-75 flex-col gap-3.5 rounded-3xl p-7">
              <h3 className="m-0 text-[21px] font-semibold">Words to try</h3>
              <div className="flex flex-wrap gap-2">
                {["scenery", "unexpected"].map((w) => (
                  <span key={w} className="rounded-full bg-white px-3.5 py-2.5 font-semibold">
                    {w}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1B8A57] px-3.5 py-2.5 font-bold text-white">
                  <Check aria-hidden="true" className="size-3.5" strokeWidth={2.6} />
                  crystal clear
                </span>
                <span className="rounded-full bg-white px-3.5 py-2.5 font-semibold">get lost</span>
              </div>
              <p className="m-0 leading-[1.55] text-[#2F3566]">
                Picked for your topic and level. Use one when you speak or type and it turns green: +2 XP.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-hairline bg-paper text-ink border-t">
        <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-4 px-6 py-7 text-[15px] text-[#5B6085]">
          <span>18+ only. Camera checks and one-tap reporting keep every call safe.</span>
          <span className="flex gap-5">
            <Link href="/rules" className="text-brand-you">
              Community rules
            </Link>
            <Link href="/rules" className="text-brand-you">
              Privacy
            </Link>
          </span>
        </div>
      </footer>
    </>
  );
}

function DemoConversation() {
  return (
    <div className="bg-ink flex flex-col gap-4.5 rounded-[28px] p-7 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-dim-dark text-sm">Topic</span>
        <span className="rounded-full bg-white/8 px-3.5 py-2 text-[15px] font-semibold">
          A trip that surprised you
        </span>
      </div>

      <div className="lm-in lm-d1 flex max-w-[86%] flex-col gap-1.5 self-start">
        <span className="text-[13px] font-semibold text-[#9FB4FF]">You</span>
        <p className="bg-brand-you m-0 rounded-[6px_20px_20px_20px] px-4.5 py-3.5 text-[18px] leading-[1.45]">
          Last summer I <span className="line-through decoration-2 opacity-70">go</span>{" "}
          <span className="lm-fixword inline-block rounded-md bg-white px-1.5 font-bold text-[#17804F]">went</span> to
          Khövsgöl with my family.
        </p>
        <span className="lm-fixword text-fix-glow inline-flex items-center gap-1.5 text-[13px]">
          <Check aria-hidden="true" className="size-3.5" strokeWidth={2.2} />
          Coach: past tense for &ldquo;last summer&rdquo;
        </span>
      </div>

      <div className="lm-in lm-d2 flex max-w-[86%] flex-col items-end gap-1.5 self-end">
        <span className="text-brand-partner-text text-[13px] font-semibold">Partner</span>
        <p className="bg-brand-partner text-ink m-0 rounded-[20px_6px_20px_20px] px-4.5 py-3.5 text-[18px] leading-[1.45]">
          I&apos;ve never been there! What surprised you the most?
        </p>
      </div>

      <div className="lm-in lm-d3 flex max-w-[86%] flex-col gap-1.5 self-start">
        <span className="text-[13px] font-semibold text-[#9FB4FF]">You</span>
        <p className="bg-brand-you m-0 rounded-[6px_20px_20px_20px] px-4.5 py-3.5 text-[18px] leading-[1.45]">
          The water was so clear that we could see the stones.
        </p>
      </div>

      <div className="lm-in lm-d4 flex flex-col gap-2 pt-1.5">
        <div aria-hidden="true" className="bg-brand-partner flex h-3 overflow-hidden rounded-md">
          <span className="lm-bar-you bg-brand-you border-ink block h-full border-r-[3px]" />
        </div>
        <div className="text-dim-dark flex justify-between text-sm">
          <span>You 58%</span>
          <span>Partner 42%</span>
        </div>
      </div>
    </div>
  );
}
