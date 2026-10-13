import type {
  AdminActionDTO,
  AdminBanDTO,
  AdminReportDTO,
  AdminStatsDTO,
  AdminUserDTO,
  AssessmentQuestion,
  AssessmentResult,
  FeedbackDTO,
  ProfileStats,
  UserDTO,
} from "@linguamatch/shared";

export class ApiError extends Error {
  constructor(
    /** HTTP status, or 0 when the server couldn't be reached at all. */
    public status: number,
    message: string,
    public details?: Record<string, string[] | undefined>,
  ) {
    super(message);
  }
}

// ─── Server reachability ────────────────────────────────────────────────────
// The API runs on Render's free tier, which sleeps when idle and takes up to a minute to wake.
// While it does, the Vercel proxy answers 502/503/504 or the request fails outright.

export type ServerStatus = "ok" | "waking";
let serverStatus: ServerStatus = "ok";
const statusListeners = new Set<() => void>();

function setServerStatus(next: ServerStatus) {
  if (next === serverStatus) return;
  serverStatus = next;
  statusListeners.forEach((l) => l());
}

export const serverStatusStore = {
  get: () => serverStatus,
  subscribe: (listener: () => void) => {
    statusListeners.add(listener);
    return () => statusListeners.delete(listener);
  },
};

// 502/503 mean the request never reached the app. A 504 may have, so only safe requests retry it.
const isWakingStatus = (status: number, retrySafe: boolean) => status === 502 || status === 503 || (status === 504 && retrySafe);
const WAKE_GIVE_UP_MS = 90_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch() that retries with exponential backoff while the server is unreachable or waking up. */
async function fetchWithWake(path: string, init: RequestInit, retrySafe = !init.method || init.method === "GET"): Promise<Response> {
  const started = Date.now();
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`/api${path}`, init);
      if (!isWakingStatus(res.status, retrySafe)) {
        setServerStatus("ok");
        return res;
      }
    } catch {
      // Network error: the server is down or asleep, not an auth problem. Keep trying below.
    }
    if (Date.now() - started > WAKE_GIVE_UP_MS) {
      setServerStatus("ok");
      throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
    }
    setServerStatus("waking");
    await sleep(Math.min(1000 * 2 ** attempt, 10_000) * (0.75 + Math.random() * 0.5));
  }
}

// ─── Session ────────────────────────────────────────────────────────────────
// Clerk owns the session. The auth provider registers Clerk's `getToken`, which returns a
// short-lived session token (cached and refreshed by Clerk), or null when signed out.

type TokenGetter = (opts?: { skipCache?: boolean }) => Promise<string | null>;
let tokenGetter: TokenGetter = async () => null;

export function setTokenGetter(getter: TokenGetter) {
  tokenGetter = getter;
}

/** A valid session token for the socket handshake. `force` bypasses Clerk's cache. */
export function getFreshAccessToken(force = false): Promise<string | null> {
  return tokenGetter(force ? { skipCache: true } : undefined);
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}, isRetry = false): Promise<T> {
  const token = await getFreshAccessToken(isRetry);
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetchWithWake(path, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
  });

  // The token can expire in flight (they live about a minute): retry once with a fresh one.
  if (res.status === 401 && !isRetry && token) return request<T>(path, init, true);

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = data.details as Record<string, string[] | undefined> | undefined;
    const firstDetail = details ? Object.values(details).flat().find(Boolean) : undefined;
    throw new ApiError(res.status, firstDetail ?? data.error ?? `Request failed (${res.status})`, details);
  }
  return data as T;
}

export const api = {
  health: () =>
    request<{ ok: boolean; ai: { configured: boolean }; speech: { mode: string; pronunciation: { supported: boolean; note: string } } }>(
      "/health",
    ),

  me: () => request<{ user: UserDTO }>("/auth/me"),

  onboarding: (body: {
    username?: string;
    nativeLanguage: string;
    targetLanguage: string;
    level: string;
    acceptRules: boolean;
    transcriptionConsent: boolean;
  }) => request<{ user: UserDTO }>("/me/onboarding", { body }),
  updateSettings: (body: {
    username?: string;
    nativeLanguage?: string;
    activeTargetLanguage?: string;
    privacy?: { transcriptionConsent?: boolean; retainTranscripts?: boolean };
  }) => request<{ user: UserDTO }>("/me/settings", { method: "PATCH", body }),
  setLanguage: (code: string, level: string) =>
    request<{ user: UserDTO }>(`/me/languages/${code}`, { method: "PUT", body: { level } }),
  removeLanguage: (code: string) => request<{ user: UserDTO }>(`/me/languages/${code}`, { method: "DELETE" }),
  profile: () => request<{ profile: ProfileStats }>("/me/profile"),
  blocked: () => request<{ blocked: { id: string; username: string }[] }>("/me/blocked"),
  unblock: (id: string) => request<void>(`/me/blocked/${id}`, { method: "DELETE" }),
  deleteAccount: () => request<void>("/me", { method: "DELETE" }),

  feedback: (conversationId: string) => request<{ feedback: FeedbackDTO }>(`/conversations/${conversationId}/feedback`),
  retryFeedback: (conversationId: string) =>
    request<{ ok: true }>(`/conversations/${conversationId}/feedback/retry`, { body: {} }),
  report: (conversationId: string, reason: string, details: string) =>
    request<{ ok: true }>(`/conversations/${conversationId}/report`, { body: { reason, details } }),
  block: (conversationId: string) => request<{ ok: true }>(`/conversations/${conversationId}/block`, { body: {} }),

  // The assessment is stateless: the page keeps the questions and sends them back with the answers.
  startAssessment: (targetLanguage: string) =>
    request<{ targetLanguage: string; questions: AssessmentQuestion[] }>("/assessment", { body: { targetLanguage } }),
  submitAssessment: (body: {
    targetLanguage: string;
    questions: AssessmentQuestion[];
    answers: { questionId: string; answer: string }[];
  }) => request<{ result: AssessmentResult }>("/assessment/submit", { body }),
  applyAssessment: (targetLanguage: string, level: string) =>
    request<{ user: UserDTO }>("/assessment/apply", { body: { targetLanguage, level } }),
};

/** Builds a query string, dropping empty/undefined values, for typed filter objects. */
function toQuery(params: Record<string, string | number | undefined>): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") out.set(k, String(v));
  return out.toString();
}

export const adminApi = {
  stats: () => request<{ stats: AdminStatsDTO }>("/admin/stats"),
  reports: (params: { status?: string; limit?: number; offset?: number } = {}) =>
    request<{ reports: AdminReportDTO[]; total: number }>(`/admin/reports?${toQuery(params)}`),
  reviewReport: (id: number, body: { action: "dismiss" | "suspend"; days?: number | null; reason: string }) =>
    request<{ report: AdminReportDTO; ok: true }>(`/admin/reports/${id}/review`, { body }),
  users: (params: { q?: string; role?: string; banned?: string; deleted?: string; limit?: number; offset?: number } = {}) =>
    request<{ users: AdminUserDTO[]; total: number }>(`/admin/users?${toQuery(params)}`),
  changeRole: (id: string, role: string) =>
    request<{ user: AdminUserDTO }>(`/admin/users/${id}/role`, { method: "PATCH", body: { role } }),
  banUser: (id: string, body: { reason: string; days?: number | null }) =>
    request<{ ban: AdminBanDTO }>(`/admin/users/${id}/ban`, { body }),
  unbanUser: (id: string, reason: string) =>
    request<{ ok: true }>(`/admin/users/${id}/unban`, { body: { reason } }),
  actions: (params: { limit?: number; offset?: number } = {}) =>
    request<{ actions: AdminActionDTO[]; total: number }>(`/admin/actions?${toQuery(params)}`),
};
