export const BALANCE_WINDOW_MS = 120_000;
export const BALANCE_REPORT_MS = 10_000;
export const BALANCE_GRACE_MS = 60_000;
export const TIP_COOLDOWN_MS = 60_000;
export const DOMINANCE_RATIO = 0.75;
export const MIN_WINDOW_SPEECH_MS = 20_000;

export const LOUDER_TIP = "Give your partner a turn — try asking: What about you?";
export const QUIETER_TIP_FALLBACK = "Jump in — share your view on the topic";

export function quieterTip(question: string | null): string {
  const trimmed = question?.trim();
  return trimmed ? `Jump in! Try answering: ${trimmed}` : QUIETER_TIP_FALLBACK;
}

export interface BalanceSample {
  at: number;
  cumulativeMs: number;
}

export function windowDelta(
  samples: readonly BalanceSample[],
  now: number,
  windowMs: number = BALANCE_WINDOW_MS,
): number {
  if (samples.length === 0) return 0;
  const latest = samples[samples.length - 1]!;
  const cutoff = now - windowMs;

  let baseline = samples[0]!;
  for (const sample of samples) {
    if (sample.at <= cutoff) baseline = sample;
    else break;
  }
  return Math.max(0, latest.cumulativeMs - baseline.cumulativeMs);
}

export function trimSamples(
  samples: readonly BalanceSample[],
  now: number,
  windowMs: number = BALANCE_WINDOW_MS,
): BalanceSample[] {
  const cutoff = now - windowMs;
  const kept = samples.filter((s) => s.at > cutoff);
  const dropped = samples.filter((s) => s.at <= cutoff);
  const baseline = dropped[dropped.length - 1];
  return baseline ? [baseline, ...kept] : [...kept];
}

export interface TalkBalance {
  minePct: number;
  partnerPct: number;
  totalMs: number;
}

export function balanceOf(mineMs: number, partnerMs: number): TalkBalance {
  const mine = Math.max(0, mineMs);
  const partner = Math.max(0, partnerMs);
  const totalMs = mine + partner;
  if (totalMs === 0) return { minePct: 50, partnerPct: 50, totalMs: 0 };
  const minePct = Math.round((mine / totalMs) * 100);
  return { minePct, partnerPct: 100 - minePct, totalMs };
}

export type TipRole = "louder" | "quieter";

export interface TalkTip {
  role: TipRole;
  text: string;
}

export function tipFor(input: {
  mineWindowMs: number;
  partnerWindowMs: number;
  callElapsedMs: number;
  lastTipAt: number | null;
  now: number;
  questions?: readonly string[];
  tipCount?: number;
}): TalkTip | null {
  if (input.callElapsedMs < BALANCE_GRACE_MS) return null;
  if (input.lastTipAt !== null && input.now - input.lastTipAt < TIP_COOLDOWN_MS) return null;

  const mine = Math.max(0, input.mineWindowMs);
  const partner = Math.max(0, input.partnerWindowMs);
  const total = mine + partner;
  if (total < MIN_WINDOW_SPEECH_MS) return null;

  if (mine / total > DOMINANCE_RATIO) return { role: "louder", text: LOUDER_TIP };

  if (partner / total > DOMINANCE_RATIO) {
    const questions = input.questions ?? [];
    const index = questions.length > 0 ? (input.tipCount ?? 0) % questions.length : 0;
    return { role: "quieter", text: quieterTip(questions[index] ?? null) };
  }

  return null;
}
