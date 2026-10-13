"use client";

import {
  CEFR_LEVELS,
  languageName,
  type AdminActionType,
  type AdminDashboard,
  type AdminReportDetail,
  type AdminReportSummary,
  type AdminSessionSummary,
  type AdminSettingsDTO,
  type AdminUserSummary,
  type BanDTO,
  type QueueBucket,
} from "@linguamatch/shared";
import { useEffect, useState } from "react";
import { FullPageSpinner, PageShell } from "@/components/site/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

const TABS = ["dashboard", "reports", "users", "bans", "sessions", "settings"] as const;
type Tab = (typeof TABS)[number];

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");
const formatDuration = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

export default function AdminPage() {
  const user = useRequireUser({ onboarded: false });
  const [tab, setTab] = useState<Tab>("dashboard");

  if (!user) return <FullPageSpinner />;
  if (user.role !== "admin") {
    return (
      <PageShell className="max-w-2xl">
        <h1 className="text-2xl font-semibold">403 — Admins only</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          This area handles reports and bans. Ask an existing admin to promote your account.
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-6xl">
      <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
      <p className="text-muted-foreground mt-1 text-sm">Reports, bans and moderation. Plain tables, no decoration.</p>

      <div className="mt-6 flex flex-wrap gap-2 border-b pb-2">
        {TABS.map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "ghost"} onClick={() => setTab(t)} className="capitalize">
            {t}
          </Button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "dashboard" && <DashboardTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "users" && <UsersTab />}
        {tab === "bans" && <BansTab />}
        {tab === "sessions" && <SessionsTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </PageShell>
  );
}

function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    load()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error, setData };
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className="text-3xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function DashboardTab() {
  const { data, error } = useAsync(() => api.admin.dashboard());
  const queue = useAsync(() => api.admin.queue());
  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!data) return <p className="text-muted-foreground text-sm">Loading…</p>;

  const d: AdminDashboard = data.dashboard;
  const buckets: QueueBucket[] = queue.data?.buckets ?? [];

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Users online" value={d.usersOnline} />
        <Stat label="In queue" value={d.inQueue} />
        <Stat label="Calls today" value={d.callsToday} />
        <Stat label="Open reports" value={d.openReports} />
        <Stat label="Bans this week" value={d.bansThisWeek} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queue by language + level</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left">
              <tr className="border-b">
                <th className="py-2">Language</th>
                <th>Level</th>
                <th>Waiting</th>
                <th>Longest wait</th>
              </tr>
            </thead>
            <tbody>
              {buckets.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted-foreground py-3">
                    Nobody is waiting right now.
                  </td>
                </tr>
              )}
              {buckets.map((b) => (
                <tr key={`${b.targetLanguage}-${b.level}`} className="border-b last:border-0">
                  <td className="py-2">{languageName(b.targetLanguage)}</td>
                  <td>{b.level}</td>
                  <td>{b.waiting}</td>
                  <td>{formatDuration(b.longestWaitSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsTab() {
  const [status, setStatus] = useState("open");
  const { data, error, setData } = useAsync(() => api.admin.reports(status), [status]);
  const [selected, setSelected] = useState<AdminReportDetail | null>(null);

  async function open(id: string) {
    setSelected((await api.admin.report(id)).report);
  }
  function refresh() {
    void api.admin.reports(status).then(setData);
  }

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  const reports: AdminReportSummary[] = data?.reports ?? [];

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-3">
        <Label htmlFor="status">Show</Label>
        <div className="w-40">
          <NativeSelect id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {["open", "reviewed", "dismissed", "actioned", "all"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left">
              <tr className="border-b">
                <th className="py-2">Time</th>
                <th>Reason</th>
                <th>Reporter</th>
                <th>Reported</th>
                <th>AI flag</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted-foreground py-3">
                    No reports.
                  </td>
                </tr>
              )}
              {reports.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2">{formatDate(r.createdAt)}</td>
                  <td>{r.reason}</td>
                  <td>{r.reporter.username}</td>
                  <td>
                    {r.reported.username} <span className="text-muted-foreground">({r.reported.strikes} strikes)</span>
                  </td>
                  <td>{r.aiFlag === "none" ? "—" : r.aiFlag}</td>
                  <td>{r.status}</td>
                  <td>
                    <Button size="sm" variant="outline" onClick={() => open(r.id)}>
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>Report {selected.id}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1 text-sm">
              <div>
                <span className="text-muted-foreground">Reported user:</span> {selected.reportedUser.username} ·{" "}
                {selected.reportedUser.strikes} strikes · {selected.reportedUser.reportsAgainst} reports against · status{" "}
                {selected.reportedUser.moderation.status}
              </div>
              <div>
                <span className="text-muted-foreground">Details:</span> {selected.details || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Evidence deletes:</span> {formatDate(selected.evidence.expiresAt)}
              </div>
            </div>

            <div>
              <div className="text-muted-foreground mb-2 text-xs">Evidence frames (blurred)</div>
              {selected.evidence.frames.length === 0 ? (
                <p className="text-muted-foreground text-sm">No frames captured.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selected.evidence.frames.map((f, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={f.url} alt="evidence frame" className="h-24 w-32 rounded border object-cover" />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-muted-foreground mb-2 text-xs">Transcript lines</div>
              <div className="max-h-48 overflow-auto rounded border p-2 text-sm">
                {selected.evidence.transcript.length === 0 ? (
                  <span className="text-muted-foreground">No transcript captured for this conversation.</span>
                ) : (
                  selected.evidence.transcript.map((l, i) => (
                    <div key={i} className="border-b py-1 last:border-0">
                      <span className="text-muted-foreground">{formatDate(l.spokenAt)}</span> {l.text}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="text-muted-foreground mb-2 text-xs">Past strikes</div>
              <ul className="text-sm">
                {selected.strikesHistory.length === 0 && <li className="text-muted-foreground">None.</li>}
                {selected.strikesHistory.map((a) => (
                  <li key={a.id}>
                    {formatDate(a.createdAt)} — {a.action} ({a.note})
                  </li>
                ))}
              </ul>
            </div>

            <ReportActionForm reportId={selected.id} onDone={(r) => (setSelected(r), refresh())} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReportActionForm({ reportId, onDone }: { reportId: string; onDone: (r: AdminReportDetail) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: AdminActionType) {
    setBusy(true);
    setError(null);
    try {
      onDone((await api.admin.reportAction(reportId, action, note)).report);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2 rounded border p-3">
      <Label htmlFor="note">Note (saved to admin_actions)</Label>
      <Textarea id="note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => act("dismiss")}>
          Dismiss
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => act("warn")}>
          Warn
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => act("ban_24h")}>
          Ban 24h
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => act("ban_7d")}>
          Ban 7 days
        </Button>
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => act("ban_permanent")}>
          Ban permanently
        </Button>
      </div>
    </div>
  );
}

function UsersTab() {
  const [q, setQ] = useState("");
  const { data, error, setData } = useAsync(() => api.admin.users(q), [q]);
  const users: AdminUserSummary[] = data?.users ?? [];

  async function refresh() {
    setData(await api.admin.users(q));
  }

  if (error) return <p className="text-destructive text-sm">{error}</p>;

  return (
    <div className="grid gap-4">
      <div className="w-72">
        <Input placeholder="Search email or name…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Card>
        <CardContent className="pt-6">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left">
              <tr className="border-b">
                <th className="py-2">Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Strikes</th>
                <th>Calls</th>
                <th>Reports</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2">{u.username}</td>
                  <td>{u.email}</td>
                  <td>
                    <NativeSelect
                      value={u.role}
                      onChange={async (e) => {
                        await api.admin.setRole(u.id, e.target.value as "user" | "admin");
                        await refresh();
                      }}
                      aria-label="Role"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </NativeSelect>
                  </td>
                  <td>{u.strikes}</td>
                  <td>{u.conversations}</td>
                  <td>{u.reportsAgainst}</td>
                  <td>{u.moderation.status}</td>
                  <td className="flex gap-2 py-2">
                    <BanButton userId={u.id} onDone={refresh} />
                    {u.moderation.status !== "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await api.admin.unbanUser(u.id);
                          await refresh();
                        }}
                      >
                        Unban
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function BanButton({ userId, onDone }: { userId: string; onDone: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("24");
  const [device, setDevice] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open)
    return (
      <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
        Ban
      </Button>
    );

  return (
    <div className="grid gap-2">
      <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      <NativeSelect value={duration} onChange={(e) => setDuration(e.target.value)} aria-label="Duration">
        <option value="24">24 hours</option>
        <option value="168">7 days</option>
        <option value="permanent">Permanent</option>
      </NativeSelect>
      <Input placeholder="Device fingerprint (optional)" value={device} onChange={(e) => setDevice(e.target.value)} />
      {error && <p className="text-destructive text-xs">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={reason.trim().length < 1}
          onClick={async () => {
            setError(null);
            try {
              await api.admin.banUser(userId, {
                reason,
                durationHours: duration === "permanent" ? null : Number(duration),
                ...(device ? { deviceFingerprint: device } : {}),
              });
              setOpen(false);
              await onDone();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Confirm
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function BansTab() {
  const { data, error, setData } = useAsync(() => api.admin.bans(true));
  const bans: BanDTO[] = data?.bans ?? [];
  if (error) return <p className="text-destructive text-sm">{error}</p>;
  return (
    <Card>
      <CardContent className="pt-6">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-left">
            <tr className="border-b">
              <th className="py-2">User</th>
              <th>Reason</th>
              <th>Ends</th>
              <th>Device</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {bans.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted-foreground py-3">
                  No active bans.
                </td>
              </tr>
            )}
            {bans.map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="py-2">{b.username}</td>
                <td>{b.reason}</td>
                <td>{b.endsAt ? formatDate(b.endsAt) : "Permanent"}</td>
                <td>{b.deviceFingerprint ?? "—"}</td>
                <td>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await api.admin.liftBan(b.id);
                      setData(await api.admin.bans(true));
                    }}
                  >
                    Lift ban
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function SessionsTab() {
  const { data, error } = useAsync(() => api.admin.sessions());
  const sessions: AdminSessionSummary[] = data?.sessions ?? [];
  if (error) return <p className="text-destructive text-sm">{error}</p>;
  return (
    <Card>
      <CardContent className="pt-6">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-left">
            <tr className="border-b">
              <th className="py-2">Started</th>
              <th>Users</th>
              <th>Language</th>
              <th>Level</th>
              <th>Length</th>
              <th>Ended</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="py-2">{formatDate(s.startTime)}</td>
                <td>{s.participants.map((p) => p.username).join(" ↔ ")}</td>
                <td>{languageName(s.targetLanguage)}</td>
                <td>{s.level}</td>
                <td>{formatDuration(s.durationSeconds)}</td>
                <td>{s.endReason ?? "active"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function SettingsTab() {
  const { data, error, setData } = useAsync(() => api.admin.settings());
  const [threshold, setThreshold] = useState<number | null>(null);
  const [topics, setTopics] = useState<Record<string, string> | null>(null);
  const settings: AdminSettingsDTO | null = data?.settings ?? null;

  useEffect(() => {
    if (!settings) return;
    setThreshold(settings.nudityThreshold);
    setTopics(Object.fromEntries(CEFR_LEVELS.map((l) => [l, (settings.topicsByLevel[l] ?? []).join(", ")])));
  }, [settings]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!settings || threshold === null || topics === null) return <p className="text-muted-foreground text-sm">Loading…</p>;

  async function save() {
    const topicsByLevel = Object.fromEntries(
      CEFR_LEVELS.map((l) => [l, (topics?.[l] ?? "").split(",").map((t) => t.trim()).filter(Boolean)]),
    );
    const res = await api.admin.updateSettings({ nudityThreshold: threshold ?? undefined, topicsByLevel });
    setData({ settings: res.settings });
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Languages</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {settings.languages.map((l) => (
            <div key={l.code} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
              <span>{languageName(l.code)}</span>
              <Switch
                checked={l.enabled}
                onCheckedChange={async (v) => {
                  const languages = settings.languages.map((x) => (x.code === l.code ? { ...x, enabled: v } : x));
                  setData({ settings: { ...settings, languages } });
                  const res = await api.admin.updateSettings({ languages });
                  setData({ settings: res.settings });
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Topics per level (comma separated)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {CEFR_LEVELS.map((l) => (
            <div key={l} className="grid gap-1">
              <Label htmlFor={`topics-${l}`}>{l}</Label>
              <Input
                id={`topics-${l}`}
                value={topics[l] ?? ""}
                onChange={(e) => setTopics({ ...topics, [l]: e.target.value })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nudity threshold</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-3">
          <div className="grid gap-1">
            <Label htmlFor="threshold">0 – 1 (frames at or above are treated as nudity)</Label>
            <Input
              id="threshold"
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-32"
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <Button onClick={save}>Save settings</Button>
      </div>
    </div>
  );
}
