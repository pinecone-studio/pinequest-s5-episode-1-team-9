"use client";

import {
  REPORT_REASONS,
  USER_ROLE_LABELS,
  USER_ROLES,
  languageName,
  type AdminActionDTO,
  type AdminReportDTO,
  type AdminStatsDTO,
  type AdminUserDTO,
} from "@linguamatch/shared";
import { Ban, FileWarning, ScrollText, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FullPageSpinner, PageShell } from "@/components/site/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { adminApi } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

const REASON_LABELS = new Map(REPORT_REASONS.map((r) => [r.value, r.label]));

const REPORT_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  under_review: "Under review",
  actioned: "Actioned",
  dismissed: "Dismissed",
};

const ACTION_LABELS: Record<string, string> = {
  ban_user: "Banned user",
  revoke_ban: "Revoked ban",
  review_report: "Reviewed report",
  dismiss_report: "Dismissed report",
  change_role: "Changed role",
  view_transcript: "Viewed transcript",
  view_evidence: "Viewed evidence",
  delete_user_data: "Deleted user data",
};

const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleString() : "—");

export default function AdminPage() {
  const user = useRequireUser({ onboarded: false });

  if (!user) return <FullPageSpinner />;
  if (user.role === "user") {
    return (
      <PageShell
        className="min-h-[calc(100dvh-4rem)] max-w-none bg-[#191970] text-white"
        headerClassName="border-[#191970] bg-[#191970] text-white [&_a]:text-white [&_button]:text-white [&_a>span:first-child]:bg-white [&_a>span:first-child]:text-[#191970]"
      >
        <div className="admin-theme mx-auto w-full max-w-[1240px]">
          <Card className="rounded-3xl border-hairline bg-white">
            <CardHeader>
              <CardTitle>No access</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              This area is for LinguaMatch staff. If you think this is a mistake, contact an administrator.
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  return <AdminShell role={user.role} isAdmin={user.role === "admin"} />;
}

function AdminShell({ role, isAdmin }: { role: "moderator" | "admin"; isAdmin: boolean }) {
  const [tab, setTab] = useState<"overview" | "reports" | "users" | "audit">("overview");

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "reports", label: "Reports" },
    { id: "users", label: "Users" },
    ...(isAdmin ? [{ id: "audit" as const, label: "Audit log" }] : []),
  ];

  return (
    <PageShell
      className="min-h-[calc(100dvh-4rem)] max-w-none bg-[#191970] text-white"
      headerClassName="border-[#191970] bg-[#191970] text-white [&_a]:text-white [&_button]:text-white [&_a>span:first-child]:bg-white [&_a>span:first-child]:text-[#191970]"
    >
      <div className="admin-theme mx-auto w-full max-w-[1240px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="m-0 text-xs font-bold tracking-[0.16em] text-white/80 uppercase">LinguaMatch safety</p>
            <h1 className="font-display mt-2 text-[clamp(30px,4vw,42px)] leading-tight font-bold tracking-[-0.02em]">
              Admin dashboard
            </h1>
            <p className="mt-2 text-sm text-white/85">
              Signed in as <span className="font-semibold">{USER_ROLE_LABELS[role]}</span>
            </p>
          </div>
          <Badge variant="accent" className="rounded-full px-3 py-1.5">
            <ShieldCheck /> {USER_ROLE_LABELS[role]}
          </Badge>
        </div>

        <nav aria-label="Admin sections" className="mt-8 flex flex-wrap gap-2 border-b border-white/25">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn(
                "rounded-t-xl border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
                tab === t.id
                  ? "border-white bg-white text-brand-you-deep"
                  : "border-transparent text-white/85 hover:bg-white/10 hover:text-white",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="mt-7">
          {tab === "overview" && <OverviewTab />}
          {tab === "reports" && <ReportsTab />}
          {tab === "users" && <UsersTab isAdmin={isAdmin} />}
          {tab === "audit" && isAdmin && <AuditTab />}
        </div>
      </div>
    </PageShell>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card className="rounded-3xl border-hairline bg-white py-5 shadow-none">
      <CardContent className="flex items-center gap-4">
        <div className="bg-brand-you-tint text-brand-you-deep grid size-11 place-items-center rounded-xl">
          <Icon className="size-5" />
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
          <div className="text-dim text-xs">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Overview ───────────────────────────────────────────────────────────────

function OverviewTab() {
  const [stats, setStats] = useState<AdminStatsDTO | null>(null);
  const [recent, setRecent] = useState<AdminReportDTO[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .stats()
      .then((r) => setStats(r.stats))
      .then(() => adminApi.reports({ limit: 5 }))
      .then((r) => setRecent(r.reports))
      .catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!stats) return <div className="text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileWarning} label="Open reports" value={String(stats.openReports)} />
        <StatCard icon={Ban} label="Active bans" value={String(stats.activeBans)} />
        <StatCard icon={Users} label="Total users" value={String(stats.totalUsers)} />
        <StatCard icon={UserPlus} label="New users (24h)" value={String(stats.usersLast24h)} />
      </div>

      <Card className="rounded-3xl border-hairline bg-white shadow-none">
        <CardHeader>
          <CardTitle className="font-display text-lg">Newest open reports</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-dim text-sm">The queue is clear. 🎉</p>
          ) : (
            <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-paper">
              {recent.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span>
                    <span className="font-medium">{REASON_LABELS.get(r.reason)}</span> — {r.reporter.username} → {r.reported.username}
                  </span>
                  <span className="text-dim text-xs">{fmt(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Reports ────────────────────────────────────────────────────────────────

function ReportsTab() {
  const [filter, setFilter] = useState("");
  const [reports, setReports] = useState<AdminReportDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<AdminReportDTO | null>(null);

  const load = useCallback((status = "") => {
    setError(null);
    adminApi
      .reports({ status: status || undefined })
      .then((r) => {
        setReports(r.reports);
        setTotal(r.total);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => load(filter), [filter, load]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value)} className="w-48" aria-label="Filter reports">
            <option value="">Open queue</option>
            <option value="under_review">Under review</option>
            <option value="actioned">Actioned</option>
            <option value="dismissed">Dismissed</option>
          </NativeSelect>
          <span className="text-muted-foreground text-sm">{total} result{total === 1 ? "" : "s"}</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => load(filter)}>
          Refresh
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {reports.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing here.</p>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-white">
          {reports.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-4 text-sm transition-colors hover:bg-paper">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{REASON_LABELS.get(r.reason)}</span>
                  {r.aiFlag && <Badge variant="destructive">AI flag</Badge>}
                  {r.activeBan && <Badge variant="outline">Banned</Badge>}
                </div>
                <div className="text-muted-foreground mt-0.5 truncate">
                  {r.reporter.username} reported {r.reported.username} · {languageName(r.sessionLang)} · {fmt(r.createdAt)}
                </div>
                {r.details && <p className="text-muted-foreground mt-1 line-clamp-2">{r.details}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={r.status === "dismissed" ? "secondary" : r.status === "actioned" ? "default" : "outline"}>
                  {REPORT_STATUS_LABELS[r.status]}
                </Badge>
                {r.status === "open" || r.status === "under_review" ? (
                  <Button size="sm" onClick={() => setReviewing(r)}>
                    Review
                  </Button>
                ) : (
                  <span className="text-muted-foreground text-xs">Reviewed</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ReviewDialog report={reviewing} onClose={() => setReviewing(null)} onReviewed={(id) => setReports((list) => list.filter((r) => r.id !== id))} onError={(msg) => setError(msg)} />
    </div>
  );
}

function ReviewDialog({
  report,
  onClose,
  onReviewed,
  onError,
}: {
  report: AdminReportDTO | null;
  onClose: () => void;
  onReviewed: (id: number) => void;
  onError: (msg: string) => void;
}) {
  const [action, setAction] = useState<"dismiss" | "24h" | "7d" | "30d" | "permanent">("dismiss");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (report) {
      setAction("dismiss");
      setReason("");
    }
  }, [report]);

  return (
    <Dialog open={!!report} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review report #{report?.id}</DialogTitle>
          <DialogDescription>
            {report?.reporter.username} reported {report?.reported.username} for “{report ? REASON_LABELS.get(report.reason) : ""}”.
            The video call is peer-to-peer; nothing about it is stored except the report itself.
          </DialogDescription>
        </DialogHeader>

        {report?.details && (
          <p className="bg-muted/60 rounded-lg p-3 text-sm">
            <span className="font-medium">Details:</span> {report.details}
          </p>
        )}

        {report?.chatEvidence && report.chatEvidence.length > 0 && (
          <div className="bg-muted/60 rounded-lg p-3 text-sm">
            <div className="font-medium">In-call chat</div>
            <ul className="mt-2 grid gap-1">
              {report.chatEvidence.map((line, i) => (
                <li key={i} className="grid grid-cols-[auto_1fr] gap-2">
                  <span className={line.userId === report.reported.id ? "text-destructive font-medium" : "text-muted-foreground"}>
                    {line.userId === report.reported.id ? report.reported.username : report.reporter.username}
                  </span>
                  <span className="break-words">{line.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="review-action">Decision</Label>
            <NativeSelect
              id="review-action"
              value={action}
              onChange={(e) => setAction(e.target.value as typeof action)}
              aria-label="Decision"
            >
              <option value="dismiss">Dismiss — no action</option>
              <option value="24h">Suspend for 24 hours</option>
              <option value="7d">Suspend for 7 days</option>
              <option value="30d">Suspend for 30 days</option>
              <option value="permanent">Permanent ban</option>
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="review-reason">Note for the audit log</Label>
            <Textarea
              id="review-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={action === "dismiss" ? "What changed your mind?" : "e.g. Explicit content, matched a minor…"}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={action === "dismiss" ? "outline" : "destructive"}
            disabled={busy || !reason.trim()}
            onClick={async () => {
              if (!report) return;
              setBusy(true);
              try {
                const days = action === "24h" ? 1 : action === "7d" ? 7 : action === "30d" ? 30 : action === "permanent" ? null : undefined;
                await adminApi.reviewReport(report.id, { action: action === "dismiss" ? "dismiss" : "suspend", days, reason: reason.trim() });
                onReviewed(report.id);
                onClose();
              } catch (err) {
                onError((err as Error).message);
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {action === "dismiss" ? "Dismiss report" : "Suspend account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Users ──────────────────────────────────────────────────────────────────

function UsersTab({ isAdmin }: { isAdmin: boolean }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [banned, setBanned] = useState("");
  const [users, setUsers] = useState<AdminUserDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banning, setBanning] = useState<AdminUserDTO | null>(null);

  const load = useCallback((query: string, roleFilter: string, bannedFilter: string) => {
    setLoading(true);
    setError(null);
    adminApi
      .users({ q: query || undefined, role: roleFilter || undefined, banned: bannedFilter || undefined, limit: 50 })
      .then((r) => setUsers(r.users))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q, role, banned), 250);
    return () => clearTimeout(t);
  }, [q, role, banned, load]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by username or email…"
          className="w-64"
          aria-label="Search users"
        />
        <NativeSelect value={role} onChange={(e) => setRole(e.target.value)} className="w-36" aria-label="Role filter">
          <option value="">Any role</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {USER_ROLE_LABELS[r]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={banned} onChange={(e) => setBanned(e.target.value)} className="w-40" aria-label="Ban filter">
          <option value="">Anyone</option>
          <option value="true">Banned</option>
          <option value="false">Not banned</option>
        </NativeSelect>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {loading && <p className="text-muted-foreground text-sm">Searching…</p>}
      {!loading && users.length === 0 && <p className="text-muted-foreground text-sm">No users found.</p>}

      <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-white">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-4 text-sm transition-colors hover:bg-paper">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{u.deletedAt ? <span className="text-muted-foreground">{u.username} (deleted)</span> : u.username}</span>
                {u.activeBan && (
                  <Badge variant="destructive">
                    <Ban /> Banned
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground mt-0.5 truncate">
                {u.email ?? "no email"} · {u.nativeLanguage ? languageName(u.nativeLanguage) : "—"} · joined {fmt(u.createdAt)}
                {u.activeBan && u.activeBan.endsAt && <span> · until {fmt(u.activeBan.endsAt)}</span>}
                {u.openReportsCount > 0 && (
                  <span className="text-warning"> · {u.openReportsCount} open report{u.openReportsCount > 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <NativeSelect
                  value={u.role}
                  className="w-32"
                  aria-label="Role"
                  onChange={async (e) => {
                    const next = e.target.value;
                    if (next === u.role) return;
                    try {
                      const res = await adminApi.changeRole(u.id, next);
                      setUsers((list) => list.map((x) => (x.id === u.id ? res.user : x)));
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                >
                  {USER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {USER_ROLE_LABELS[r]}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <Badge variant="secondary">{USER_ROLE_LABELS[u.role]}</Badge>
              )}
              {u.activeBan ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await adminApi.unbanUser(u.id, "");
                      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, activeBan: null } : x)));
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                >
                  Unban
                </Button>
              ) : (
                !u.deletedAt && (
                  <Button size="sm" variant="destructive" onClick={() => setBanning(u)}>
                    <Ban /> Ban
                  </Button>
                )
              )}
            </div>
          </li>
        ))}
      </ul>

      <BanDialog
        user={banning}
        onClose={() => setBanning(null)}
        onBanned={(id, ban) => setUsers((list) => list.map((x) => (x.id === id ? { ...x, activeBan: ban } : x)))}
        onError={(msg) => setError(msg)}
      />
    </div>
  );
}

function BanDialog({
  user,
  onClose,
  onBanned,
  onError,
}: {
  user: AdminUserDTO | null;
  onClose: () => void;
  onBanned: (id: string, ban: AdminUserDTO["activeBan"]) => void;
  onError: (msg: string) => void;
}) {
  const [duration, setDuration] = useState("7d");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setDuration("7d");
      setReason("");
    }
  }, [user]);

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ban {user?.username}?</DialogTitle>
          <DialogDescription>
            They&apos;re removed from the queue and any live conversation immediately. The ban is logged in the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ban-duration">Duration</Label>
            <NativeSelect id="ban-duration" value={duration} onChange={(e) => setDuration(e.target.value)} aria-label="Duration">
              <option value="1d">24 hours</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="permanent">Permanent</option>
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ban-reason">Reason</Label>
            <Textarea
              id="ban-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Required — shown to the audit log"
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !reason.trim()}
            onClick={async () => {
              if (!user) return;
              setBusy(true);
              try {
                const days = duration === "1d" ? 1 : duration === "7d" ? 7 : duration === "30d" ? 30 : duration === "permanent" ? null : null;
                const res = await adminApi.banUser(user.id, { reason: reason.trim(), days });
                onBanned(user.id, res.ban);
                onClose();
              } catch (err) {
                onError((err as Error).message);
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            Ban account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Audit log ──────────────────────────────────────────────────────────────

function AuditTab() {
  const [actions, setActions] = useState<AdminActionDTO[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .actions({ limit: 50 })
      .then((r) => setActions(r.actions))
      .catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <p className="text-destructive text-sm">{error}</p>;

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2 text-sm">
        <ScrollText className="text-muted-foreground size-4" />
        <span className="text-muted-foreground">
          {actions.length > 0 ? "Latest staff activity" : "No staff activity yet."}
        </span>
      </div>
      <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-white">
        {actions.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm transition-colors hover:bg-paper">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{ACTION_LABELS[a.action] ?? a.action}</div>
              <div className="text-muted-foreground mt-0.5">
                {a.admin.username}
                {a.targetUser && <> → {a.targetUser.username}</>}
                {a.reportId && <> · report #{a.reportId}</>}
              </div>
              {a.reason && <p className="text-muted-foreground mt-0.5 text-xs">{a.reason}</p>}
            </div>
            <span className="text-muted-foreground text-xs">{fmt(a.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}