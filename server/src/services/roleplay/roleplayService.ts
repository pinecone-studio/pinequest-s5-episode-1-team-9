import { lowerLevel, type CefrLevel, type RoleplayCard } from "@linguamatch/shared";
import { findSession, participantOf } from "../../models/Session";
import { getIO, userRoom } from "../../socket/io";
import { pickScenario } from "./aiRoleplay";
import type { Scenario } from "./scenarioBank";

interface ActiveRoleplay {
  cards: Map<string, RoleplayCard>;
  titles: string[];
}

const active = new Map<string, ActiveRoleplay>();
const generating = new Set<string>();

function toCards(session: { userA: string; userB: string }, scenario: Scenario, level: CefrLevel) {
  const [first, second] = scenario.roles;
  const card = (role: typeof first, partner: typeof second): RoleplayCard => ({
    scenarioTitle: scenario.title,
    roleName: role.roleName,
    situation: role.situation,
    secretGoal: role.secretGoal,
    partnerRoleName: partner.roleName,
    level,
  });
  return new Map<string, RoleplayCard>([
    [session.userA, card(first, second)],
    [session.userB, card(second, first)],
  ]);
}

function sendCard(userId: string, card: RoleplayCard | null, loading = false, error?: string) {
  getIO()
    .to(userRoom(userId))
    .emit("roleplay:card", { card, loading, ...(error && { error }) });
}

export function syncRoleplay(sessionId: string, userId: string) {
  const state = active.get(sessionId);
  const card = state?.cards.get(userId) ?? null;
  if (card) sendCard(userId, card);
  else if (generating.has(sessionId)) sendCard(userId, null, true);
}

export async function startRoleplay(sessionId: string, userId: string) {
  if (generating.has(sessionId)) return;
  const session = await findSession(sessionId);
  if (!session || session.status !== "active" || !participantOf(session, userId)) return;

  const participants = [session.userA, session.userB];
  generating.add(sessionId);
  for (const id of participants) sendCard(id, null, true);

  try {
    const level = lowerLevel(session.userALevel as CefrLevel, session.userBLevel as CefrLevel);
    const previous = active.get(sessionId)?.titles ?? [];
    const scenario = await pickScenario({ targetLanguage: session.lang, level, avoid: previous });

    const still = await findSession(sessionId);
    if (!still || still.status !== "active") return;

    const cards = toCards(session, scenario, level);
    active.set(sessionId, { cards, titles: [...previous, scenario.title] });
    for (const id of participants) sendCard(id, cards.get(id) ?? null);
  } catch (err) {
    console.error(`[roleplay] Couldn't start role-play for session ${sessionId}:`, err);
    for (const id of participants) {
      sendCard(id, null, false, "Couldn't start role-play right now. Try again in a moment.");
    }
  } finally {
    generating.delete(sessionId);
  }
}

export async function endRoleplay(sessionId: string, userId: string) {
  const session = await findSession(sessionId);
  if (!session || !participantOf(session, userId)) return;
  const state = active.get(sessionId);
  active.delete(sessionId);
  if (!state) return;
  for (const id of [session.userA, session.userB]) sendCard(id, null);
}

export function clearRoleplay(sessionId: string) {
  active.delete(sessionId);
  generating.delete(sessionId);
}
