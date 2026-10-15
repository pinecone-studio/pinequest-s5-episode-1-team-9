import { findSession, partnerIdOf } from "../../models/Session";
import { getIO, userRoom } from "../../socket/io";

const MAX_MS = 24 * 3600 * 1000;

function sane(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > MAX_MS) return null;
  return Math.round(value);
}

export async function relayBalance(
  sessionId: string,
  userId: string,
  payload: { windowMs: unknown; totalMs: unknown },
) {
  const windowMs = sane(payload.windowMs);
  const totalMs = sane(payload.totalMs);
  if (windowMs === null || totalMs === null) return;

  const session = await findSession(sessionId);
  if (!session || session.status !== "active") return;
  const partnerId = partnerIdOf(session, userId);
  if (!partnerId) return;

  getIO().to(userRoom(partnerId)).emit("balance:partner", { windowMs, totalMs });
}
