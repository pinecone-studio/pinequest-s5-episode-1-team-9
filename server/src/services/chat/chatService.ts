import {
  lowerLevel,
  type ChatEvidenceLine,
  type ChatMessageDTO,
  type CefrLevel,
  type SuggestedWord,
} from "@linguamatch/shared";
import { randomUUID } from "node:crypto";
import { findSession, participantOf } from "../../models/Session";
import { conversationRoom, getIO, userRoom } from "../../socket/io";
import { awardWordXp } from "../xp/wordXp";
import { assistDraft, isChatAiAvailable, suggestWords } from "./aiChatAssist";
import { ASSIST_RATE_MS, SUGGEST_RATE_MS, allowedNow, validateMessage, wordsUsedIn } from "./chatRules";

const MAX_LOG = 50;
const EVIDENCE_LINES = 30;
const RECENT_CONTEXT = 6;

interface ChatState {
  log: ChatMessageDTO[];
  lastSentAt: Map<string, number>;
  lastAssistAt: Map<string, number>;
  lastSuggestAt: Map<string, number>;
  issued: Map<string, string[]>;
}

const chats = new Map<string, ChatState>();

function state(sessionId: string): ChatState {
  let s = chats.get(sessionId);
  if (!s) {
    s = {
      log: [],
      lastSentAt: new Map(),
      lastAssistAt: new Map(),
      lastSuggestAt: new Map(),
      issued: new Map(),
    };
    chats.set(sessionId, s);
  }
  return s;
}

export function clearChat(sessionId: string) {
  chats.delete(sessionId);
}

export function chatEvidence(sessionId: string): ChatEvidenceLine[] | null {
  const s = chats.get(sessionId);
  if (!s || s.log.length === 0) return null;
  return s.log.slice(-EVIDENCE_LINES).map((m) => ({
    userId: m.userId,
    text: m.text,
    at: new Date(m.at).toISOString(),
  }));
}

export function syncChat(sessionId: string, userId: string) {
  const s = chats.get(sessionId);
  getIO()
    .to(userRoom(userId))
    .emit("chat:state", {
      messages: s?.log ?? [],
      suggestions: [],
      aiAvailable: isChatAiAvailable(),
    });
}

async function levelFor(sessionId: string, userId: string): Promise<{ lang: string; level: CefrLevel } | null> {
  const session = await findSession(sessionId);
  if (!session || session.status !== "active" || !participantOf(session, userId)) return null;
  return {
    lang: session.lang,
    level: lowerLevel(session.userALevel as CefrLevel, session.userBLevel as CefrLevel),
  };
}

async function creditWords(sessionId: string, userId: string, text: string) {
  const s = state(sessionId);
  const issued = s.issued.get(userId) ?? [];
  if (issued.length === 0) return;

  for (const word of wordsUsedIn(text, issued)) {
    const award = await awardWordXp(userId, sessionId, word);
    if (award) getIO().to(userRoom(userId)).emit("chat:word-credited", award);
  }
}

export async function sendMessage(sessionId: string, userId: string, raw: unknown) {
  const s = state(sessionId);
  const now = Date.now();
  const result = validateMessage(raw, s.lastSentAt.get(userId), now);
  if (!result.ok) {
    getIO().to(userRoom(userId)).emit("chat:error", { reason: result.reason });
    return;
  }

  const session = await findSession(sessionId);
  if (!session || session.status !== "active" || !participantOf(session, userId)) return;

  s.lastSentAt.set(userId, now);
  const message: ChatMessageDTO = { id: randomUUID(), userId, text: result.text, at: now };
  s.log.push(message);
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);

  getIO().to(conversationRoom(sessionId)).emit("chat:message", message);
  await creditWords(sessionId, userId, result.text);
}

export async function creditCaption(sessionId: string, userId: string, raw: unknown) {
  if (typeof raw !== "string" || !raw.trim()) return;
  const session = await findSession(sessionId);
  if (!session || session.status !== "active" || !participantOf(session, userId)) return;
  await creditWords(sessionId, userId, raw);
}

export async function assist(sessionId: string, userId: string, draft: unknown) {
  const s = state(sessionId);
  const now = Date.now();
  if (typeof draft !== "string" || !draft.trim()) return;
  if (!allowedNow(s.lastAssistAt.get(userId), now, ASSIST_RATE_MS)) {
    getIO().to(userRoom(userId)).emit("chat:error", { reason: "rate_limited" });
    return;
  }

  const context = await levelFor(sessionId, userId);
  if (!context) return;
  s.lastAssistAt.set(userId, now);

  const io = getIO();
  io.to(userRoom(userId)).emit("chat:assist", { assist: null, loading: true });
  const assisted = await assistDraft({
    draft: draft.slice(0, 1000),
    targetLanguage: context.lang,
    level: context.level,
  });
  io.to(userRoom(userId)).emit("chat:assist", { assist: assisted, loading: false });
}

export async function refreshSuggestions(
  sessionId: string,
  userId: string,
  input: { topic?: unknown; recent?: unknown; force?: unknown },
) {
  if (!isChatAiAvailable()) return;
  const s = state(sessionId);
  const now = Date.now();
  if (!allowedNow(s.lastSuggestAt.get(userId), now, SUGGEST_RATE_MS)) return;

  const context = await levelFor(sessionId, userId);
  if (!context) return;
  s.lastSuggestAt.set(userId, now);

  const recent = Array.isArray(input.recent)
    ? input.recent.filter((r): r is string => typeof r === "string").slice(-RECENT_CONTEXT)
    : [];
  const ownMessages = s.log.filter((m) => m.userId === userId).slice(-RECENT_CONTEXT).map((m) => m.text);

  const words: SuggestedWord[] = await suggestWords({
    targetLanguage: context.lang,
    level: context.level,
    context: typeof input.topic === "string" ? input.topic.slice(0, 200) : "",
    recent: [...recent, ...ownMessages],
  });

  if (words.length > 0) s.issued.set(userId, words.map((w) => w.word));
  getIO().to(userRoom(userId)).emit("chat:suggestions", { words });
}
