"use client";

import { Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";

export function PendingState() {
  return (
    <section
      aria-labelledby="report-pending"
      className="border-hairline flex flex-col gap-3 rounded-3xl border bg-white p-7"
    >
      <Loader2 aria-hidden="true" className="text-brand-you size-7 animate-spin" />
      <h2 id="report-pending" className="m-0 text-[21px] font-semibold">
        Writing your report
      </h2>
      <p className="text-dim m-0 leading-[1.55]">
        The coach is reading what you said. This usually takes under a minute, and you can leave this page.
      </p>
    </section>
  );
}

export function ShortCallState({ message }: { message: string | null }) {
  return (
    <section
      aria-labelledby="report-short"
      className="border-hairline flex flex-col gap-3 rounded-3xl border bg-white p-7"
    >
      <h2 id="report-short" className="m-0 text-[21px] font-semibold">
        That call was short
      </h2>
      <p className="text-dim m-0 leading-[1.55]">
        {message ?? "A report needs a few minutes of your own speech, and XP starts at 8 minutes."}
      </p>
      <Link
        href="/"
        className="bg-brand-you inline-flex min-h-12 w-fit items-center rounded-[14px] px-5 font-bold text-white no-underline"
      >
        Find another partner
      </Link>
    </section>
  );
}

export function FailedState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <section
      aria-labelledby="report-failed"
      className="bg-brand-partner-tint flex flex-col gap-3 rounded-3xl p-7"
    >
      <TriangleAlert aria-hidden="true" className="size-7 text-[#8A5300]" />
      <h2 id="report-failed" className="m-0 text-[21px] font-semibold">
        We couldn&apos;t write your report
      </h2>
      <p className="m-0 leading-[1.55] text-[#5C4A26]">
        {message ?? "The AI coach isn't reachable right now. Your call and XP are saved, so nothing is lost. Try again in a minute."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="text-ink inline-flex min-h-12 w-fit items-center gap-2 rounded-[14px] border-0 bg-white px-5 font-bold"
      >
        <RefreshCw aria-hidden="true" className="size-4.5" />
        Try again
      </button>
    </section>
  );
}

export function NoConsentState() {
  return (
    <section
      aria-labelledby="report-consent"
      className="border-hairline flex flex-col gap-3 rounded-3xl border bg-white p-7"
    >
      <h2 id="report-consent" className="m-0 text-[21px] font-semibold">
        Captions were off, so there&apos;s no report
      </h2>
      <p className="text-dim m-0 leading-[1.55]">
        The coach can only review calls where you allowed transcription. Turn it on to get scores, fixes and a
        mistake quiz after each call.
      </p>
      <Link
        href="/settings"
        className="bg-brand-you inline-flex min-h-12 w-fit items-center rounded-[14px] px-5 font-bold text-white no-underline"
      >
        Turn on transcription
      </Link>
    </section>
  );
}
