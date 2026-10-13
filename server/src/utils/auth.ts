import { verifyToken } from "@clerk/backend";
import { clerkAuthorizedParties, env } from "../config/env";

export type AuthFailureReason = "missing" | "invalid_token" | "wrong_origin" | "unknown_user" | "deleted_user";

export type VerifyResult = { ok: true; userId: string } | { ok: false; reason: AuthFailureReason };

/**
 * Verifies a Clerk session token (the browser gets it from `getToken()`), used for the Socket.IO
 * handshake. REST requests go through `clerkMiddleware` instead.
 */
export async function verifySessionToken(token: string | null | undefined): Promise<VerifyResult> {
  if (!token) return { ok: false, reason: "missing" };
  try {
    const claims = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY, authorizedParties: clerkAuthorizedParties });
    return { ok: true, userId: claims.sub };
  } catch {
    return { ok: false, reason: "invalid_token" };
  }
}

/** One log line per rejected request. Never pass tokens, cookies or secrets in `context`. */
export function logAuthFailure(channel: "http" | "socket", reason: AuthFailureReason, context: Record<string, string | undefined> = {}) {
  const extra = Object.entries(context)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.warn(`[auth] ${channel} rejected reason=${reason}${extra ? ` ${extra}` : ""}`);
}
