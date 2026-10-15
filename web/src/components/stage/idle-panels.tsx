"use client";

const FIRST_QUESTIONS = [
  "Where are you calling from?",
  "Why are you learning English?",
  "What did you do last weekend?",
];

export function IdleChat() {
  return (
    <section aria-label="Chat" className="bg-panel flex flex-col gap-3.5 rounded-[22px] p-4.5">
      <div className="text-dim-dark flex min-h-24 items-center justify-center rounded-[14px] border border-dashed border-white/18 p-4 text-center leading-[1.5]">
        Chat opens when you&apos;re matched. Stuck on a word? Write it in Mongolian and press Fix.
      </div>
      <div className="flex flex-wrap items-center gap-2 opacity-55">
        <span className="text-dim-dark text-sm">Words to try</span>
        <span className="inline-flex min-h-10 items-center rounded-full border border-dashed border-white/25 px-3.5 text-[15px] text-white">
          appear after the match
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          disabled
          placeholder="Type a message"
          aria-label="Message"
          className="bg-stage min-h-12 flex-1 rounded-xl border border-white/12 px-3.5 text-base text-white placeholder:text-[#6F74A6]"
        />
        <button
          type="button"
          disabled
          className="min-h-12 rounded-xl border border-[rgba(127,224,176,0.35)] bg-transparent px-3.5 text-[15px] font-bold text-[rgba(127,224,176,0.6)]"
        >
          Fix
        </button>
        <button
          type="button"
          disabled
          className="text-brand-you-text min-h-12 rounded-xl border-0 bg-[rgba(59,99,232,0.4)] px-4.5 text-[15px] font-bold"
        >
          Send
        </button>
      </div>
    </section>
  );
}

export function IdleCoach() {
  return (
    <aside
      aria-label="Coach"
      className="bg-panel flex min-w-0 flex-1 basis-80 flex-col gap-5 rounded-[22px] p-5.5"
    >
      <div className="flex flex-col gap-2.5">
        <span className="text-dim-dark text-sm">Your first topic</span>
        <h2 className="font-display m-0 text-[22px] leading-[1.25] font-bold text-white">
          Getting to know each other
        </h2>
        <ul className="m-0 flex list-disc flex-col gap-2 pl-4.5 leading-[1.45] text-[#D7DAF2]">
          {FIRST_QUESTIONS.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
        <span className="text-dim-darker text-sm leading-[1.5]">
          The coach picks a new topic for your level once you&apos;re matched.
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            className="min-h-11 rounded-xl border border-white/14 bg-transparent px-3.5 text-[15px] font-semibold text-[#8A8FC0]"
          >
            New topic
          </button>
          <button
            type="button"
            disabled
            className="min-h-11 rounded-xl border border-[rgba(240,165,50,0.4)] bg-transparent px-3.5 text-[15px] font-bold text-[rgba(247,201,120,0.7)]"
          >
            Start role-play
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-dim-dark text-sm">Who&apos;s talking</span>
        <div aria-hidden="true" className="h-3 rounded-md bg-white/8" />
        <span className="text-dim-darker text-sm">Fills in as you both talk.</span>
      </div>
      <p className="text-dim-darker m-0 mt-auto text-[13px] leading-[1.5]">
        18+ only. Calls are checked for safety, and you can report a partner with one tap.
      </p>
    </aside>
  );
}

export function WarmupCoach() {
  return (
    <aside
      aria-label="Warm-up"
      className="bg-panel flex min-w-0 flex-1 basis-80 flex-col gap-4.5 rounded-[22px] p-5.5"
    >
      <span className="text-dim-dark text-sm">Warm up while you wait</span>
      <p className="font-display m-0 text-xl leading-[1.35] font-bold text-white">
        Say it out loud: &ldquo;I&apos;ve been learning English for…&rdquo;
      </p>
      <div className="flex flex-col gap-2.5">
        <span className="font-semibold text-white">Good first questions</span>
        {FIRST_QUESTIONS.map((q) => (
          <span key={q} className="rounded-xl bg-white/6 px-3.5 py-3 leading-[1.45] text-white">
            {q}
          </span>
        ))}
      </div>
      <p className="text-dim-darker m-0 text-sm leading-[1.5]">
        Your partner&apos;s video stays blurred until the safety check passes.
      </p>
    </aside>
  );
}
