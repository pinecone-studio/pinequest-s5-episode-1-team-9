"use client";

import {
  EMOJI_UNLOCKS,
  languageName,
  unlockLevelOf,
  type ProfileStats,
  type XpSummaryDTO,
} from "@linguamatch/shared";
import { Flame, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FullPageSpinner } from "@/components/site/header";
import { PaperHeader } from "@/components/site/paper-header";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useAuth, useRequireUser } from "@/lib/auth";
import { cn, formatDuration } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  pending: "Writing…",
  insufficient_data: "Too short",
  no_consent: "No transcript",
  failed: "Failed",
};

export default function ProfilePage() {
  const user = useRequireUser();
  const { refresh, logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileStats | null>(null);
  const [xp, setXp] = useState<XpSummaryDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.profile().then((r) => setProfile(r.profile)).catch((e) => setError(e.message));
    api.xpMe().then(setXp).catch(() => setXp(null));
  }, [user]);

  const save = useCallback(
    async (run: () => Promise<unknown>) => {
      setSaving(true);
      setError(null);
      try {
        await run();
        await refresh();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  if (!user) return <FullPageSpinner />;

  return (
    <div className="bg-paper text-ink min-h-dvh">
      <PaperHeader />

      <main className="mx-auto flex max-w-[1240px] flex-col gap-6 px-6 pt-6 pb-18">
        <section aria-label="Your profile" className="border-hairline flex flex-wrap items-center gap-5 rounded-3xl border bg-white p-7">
          <span
            aria-hidden="true"
            className="bg-brand-you font-display grid size-20 place-items-center rounded-full text-[32px] font-bold text-white"
          >
            {user.username.charAt(0).toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-display m-0 text-[26px] font-bold">{user.username}</h1>
            <p className="text-dim m-0">
              {user.nativeLanguage ? `Native ${languageName(user.nativeLanguage)}` : "Native language not set"}
              {user.activeTargetLanguage && ` · Learning ${languageName(user.activeTargetLanguage)}`}
              {profile && ` · Member since ${new Date(profile.memberSince).toLocaleDateString()}`}
            </p>
          </div>
          {xp && xp.streakCount > 0 && (
            <span className="text-fix-ink ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#E7F6EE] px-3.5 py-2 font-semibold">
              <Flame aria-hidden="true" className="size-4" />
              {xp.streakCount}-day streak
            </span>
          )}
        </section>

        {xp && (
          <section aria-labelledby="xp" className="bg-ink flex flex-col gap-5 rounded-3xl p-7 text-white">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="xp" className="font-display m-0 text-2xl font-bold">
                Level {xp.level}
              </h2>
              <span className="text-dim-dark tabular-nums">
                {xp.xp.toLocaleString()} of {xp.nextGoal.toLocaleString()} XP
              </span>
            </div>
            <div aria-hidden="true" className="h-3 overflow-hidden rounded-md bg-white/12">
              <span className="bg-fix block h-full" style={{ width: `${Math.round(xp.progress * 100)}%` }} />
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="font-semibold">Your reactions</span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(EMOJI_UNLOCKS).flatMap(([lvl, list]) =>
                  list.map((emoji) => {
                    const locked = Number(lvl) > xp.level;
                    return (
                      <span
                        key={emoji}
                        aria-label={locked ? `Locked until Level ${lvl}` : emoji}
                        className={cn(
                          "relative grid size-11 place-items-center rounded-full bg-white/8 text-[22px]",
                          locked && "opacity-40",
                        )}
                      >
                        {emoji}
                        {locked && (
                          <Lock aria-hidden="true" className="text-dim-dark absolute right-0.5 bottom-0.5 size-3" />
                        )}
                      </span>
                    );
                  }),
                )}
              </div>
              <span className="text-dim-dark text-sm">
                {(() => {
                  const next = Object.keys(EMOJI_UNLOCKS)
                    .map(Number)
                    .filter((l) => l > xp.level)
                    .sort((a, b) => a - b)[0];
                  const count = next ? (EMOJI_UNLOCKS[next]?.length ?? 0) : 0;
                  return next
                    ? `${count} more unlock at Level ${next}.`
                    : "You've unlocked every reaction.";
                })()}
              </span>
            </div>
          </section>
        )}

        {profile && (
          <div className="flex flex-wrap gap-4">
            <Stat label="Calls" value={String(profile.totals.conversations)} />
            <Stat label="Time talking" value={formatDuration(profile.totals.practiceSeconds)} />
            <Stat
              label="Average score"
              value={profile.totals.averageScore === null ? "—" : `${profile.totals.averageScore}/100`}
            />
          </div>
        )}

        {profile && (
          <section aria-labelledby="reports" className="border-hairline rounded-3xl border bg-white p-7">
            <h2 id="reports" className="m-0 mb-2.5 text-[22px] font-semibold">
              Your reports
            </h2>
            {profile.recent.length === 0 ? (
              <p className="text-dim m-0">No calls yet. Your reports will appear here.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {profile.recent.map((c) => (
                  <li key={c.conversationId} className="border-b border-[#EEF0F7] last:border-0">
                    <Link
                      href={`/feedback/${c.conversationId}`}
                      className="text-ink flex min-h-14 flex-wrap items-center justify-between gap-3 py-3 no-underline"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span aria-hidden="true" className="bg-brand-partner size-2.5 shrink-0 rounded-full" />
                        <span className="flex min-w-0 flex-col">
                          <span className="font-semibold">
                            {languageName(c.targetLanguage)}, {formatDuration(c.durationSeconds)}
                          </span>
                          <span className="text-sm text-[#5B6085]">
                            {c.endedAt ? new Date(c.endedAt).toLocaleDateString() : "—"}
                          </span>
                        </span>
                      </span>
                      <span className="tabular-nums">
                        {c.overallScore !== null ? `${c.overallScore}/100` : (STATUS_LABEL[c.status] ?? "—")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section aria-labelledby="settings" className="border-hairline flex flex-col gap-5 rounded-3xl border bg-white p-7">
          <h2 id="settings" className="m-0 text-[22px] font-semibold">
            Settings
          </h2>

          <Row
            title="Live captions and reports"
            hint="Your own speech is turned into text for captions and your report. Audio is never stored."
          >
            <Switch
              checked={user.privacy.transcriptionConsent}
              disabled={saving}
              aria-label="Live captions and reports"
              onCheckedChange={(v) => void save(() => api.updateSettings({ privacy: { transcriptionConsent: v } }))}
            />
          </Row>

          <Row title="Start calls with video" hint="Turn off to join voice-only calls by default.">
            <Switch
              checked={user.prefersVideo}
              disabled={saving}
              aria-label="Start calls with video"
              onCheckedChange={(v) => void save(() => api.updateSettings({ prefersVideo: v }))}
            />
          </Row>

          <Row title="Keep transcripts" hint="Off by default: transcripts are deleted once your report is written.">
            <Switch
              checked={user.privacy.retainTranscripts}
              disabled={saving}
              aria-label="Keep transcripts"
              onCheckedChange={(v) => void save(() => api.updateSettings({ privacy: { retainTranscripts: v } }))}
            />
          </Row>

          {error && <p className="m-0 text-[#8C1A21]">{error}</p>}

          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/settings"
              className="text-ink inline-flex min-h-12 items-center rounded-[14px] border border-[#D6DAEA] bg-white px-5 font-semibold no-underline"
            >
              Languages and account
            </Link>
            <button
              type="button"
              onClick={() => void logout().then(() => router.push("/"))}
              className="text-ink min-h-12 rounded-[14px] border border-[#D6DAEA] bg-white px-5 font-semibold"
            >
              Sign out
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-hairline flex min-w-0 flex-1 basis-50 flex-col gap-1 rounded-3xl border bg-white p-6">
      <span className="text-dim text-sm">{label}</span>
      <span className="font-display text-2xl font-bold tabular-nums">{value}</span>
    </div>
  );
}

function Row({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-[#5B6085]">{hint}</span>
      </div>
      {children}
    </div>
  );
}
