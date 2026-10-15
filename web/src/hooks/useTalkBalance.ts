"use client";

import {
  BALANCE_REPORT_MS,
  BALANCE_WINDOW_MS,
  balanceOf,
  tipFor,
  trimSamples,
  windowDelta,
  type BalanceSample,
  type TalkBalance,
  type TalkTip,
} from "@linguamatch/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppSocket } from "@/lib/socket";

const SAMPLE_MS = 1000;
const TIP_VISIBLE_MS = 20_000;

export interface TalkBalanceState {
  balance: TalkBalance;
  tip: TalkTip | null;
  dismissTip: () => void;
}

export function useTalkBalance(input: {
  socket: AppSocket | null;
  roomId: string;
  ready: boolean;
  startedAt: number | null;
  mineMs: number;
  questions: readonly string[];
}): TalkBalanceState {
  const { socket, roomId, ready, startedAt, mineMs, questions } = input;

  const [balance, setBalance] = useState<TalkBalance>({ minePct: 50, partnerPct: 50, totalMs: 0 });
  const [tip, setTip] = useState<TalkTip | null>(null);

  const mineRef = useRef(0);
  mineRef.current = mineMs;
  const questionsRef = useRef(questions);
  questionsRef.current = questions;

  const mineSamples = useRef<BalanceSample[]>([]);
  const partnerWindow = useRef(0);
  const partnerTotal = useRef(0);
  const lastTipAt = useRef<number | null>(null);
  const tipCount = useRef(0);

  const dismissTip = useCallback(() => setTip(null), []);

  useEffect(() => {
    if (!socket || !ready) return;
    const onPartner = ({ windowMs, totalMs }: { windowMs: number; totalMs: number }) => {
      partnerWindow.current = windowMs;
      partnerTotal.current = totalMs;
    };
    socket.on("balance:partner", onPartner);
    return () => {
      socket.off("balance:partner", onPartner);
    };
  }, [socket, ready]);

  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      const now = Date.now();
      mineSamples.current = trimSamples(
        [...mineSamples.current, { at: now, cumulativeMs: mineRef.current }],
        now,
        BALANCE_WINDOW_MS,
      );

      setBalance(balanceOf(mineRef.current, partnerTotal.current));
      if (startedAt === null) return;

      const next = tipFor({
        mineWindowMs: windowDelta(mineSamples.current, now, BALANCE_WINDOW_MS),
        partnerWindowMs: partnerWindow.current,
        callElapsedMs: now - startedAt,
        lastTipAt: lastTipAt.current,
        now,
        questions: questionsRef.current,
        tipCount: tipCount.current,
      });
      if (next) {
        lastTipAt.current = now;
        tipCount.current += 1;
        setTip(next);
      }
    };
    const timer = setInterval(tick, SAMPLE_MS);
    return () => clearInterval(timer);
  }, [ready, startedAt]);

  useEffect(() => {
    if (!tip) return;
    const timer = setTimeout(() => setTip(null), TIP_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [tip]);

  useEffect(() => {
    if (!socket || !ready) return;
    const report = () => {
      const now = Date.now();
      socket.emit("balance:report", {
        roomId,
        windowMs: windowDelta(mineSamples.current, now, BALANCE_WINDOW_MS),
        totalMs: mineRef.current,
      });
    };
    report();
    const timer = setInterval(report, BALANCE_REPORT_MS);
    return () => clearInterval(timer);
  }, [socket, roomId, ready]);

  return { balance, tip, dismissTip };
}
