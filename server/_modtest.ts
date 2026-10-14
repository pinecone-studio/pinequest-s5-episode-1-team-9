/**
 * End-to-end check of real-time AI video moderation without a second user or a real camera.
 *
 * It seeds two throwaway users and an active consented session, buffers one camera frame, then runs
 * the real sweep. The AI provider is faked at the network layer (global fetch) so the result is
 * deterministic, burns no quota and never sends a real image. Finally it asserts that an AI report,
 * an automatic ban and the session end were all produced, then deletes every row it created.
 *
 * Run from server/:  npx tsx --env-file-if-exists=../.env _modtest.ts
 */
import { eq, inArray, or } from "drizzle-orm";
import { db, pool } from "./src/db/client";
import { bans, reports, sessions, users } from "./src/db/schema";
import { SYSTEM_MODERATOR_ID, ensureSystemModerator, runAIModerationSweep } from "./src/services/moderation/aiModeration";
import { recordFrameForModeration } from "./src/services/moderation/aiModerationQueue";
import { setIO, type IO } from "./src/socket/io";

const USER_A = "test_mod_a";
const USER_B = "test_mod_b";
// 1x1 transparent PNG; its pixels are irrelevant because the AI call itself is faked below.
const FRAME_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || detail === undefined ? "" : ` -> ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}

/** Removes anything a previous run (including a crashed one) may have left behind. */
async function cleanup() {
  const ids = [USER_A, USER_B];
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(or(inArray(sessions.userA, ids), inArray(sessions.userB, ids)));
  const sessionIds = rows.map((r) => r.id);
  await db.delete(bans).where(inArray(bans.userId, ids));
  await db.delete(reports).where(inArray(reports.reportedId, ids));
  if (sessionIds.length) await db.delete(sessions).where(inArray(sessions.id, sessionIds));
  await db.delete(users).where(inArray(users.id, ids));
}

async function main() {
  await cleanup();
  await ensureSystemModerator(); // the AI report's reporter_id references this account

  // A fake Socket.IO so endSession() (which emits "room:ended") does not throw "not initialized".
  setIO({
    to: () => ({ emit: () => {} }),
    in: () => ({ socketsLeave: () => {} }),
  } as unknown as IO);

  // Fake only the moderation call; any other AI call (e.g. feedback) gets a 500 and fails gracefully.
  let moderationCalls = 0;
  globalThis.fetch = (async (_input: unknown, init?: { body?: unknown }) => {
    const body = init?.body ? String(init.body) : "";
    if (body.includes('"findings"')) {
      moderationCalls++;
      const finding = {
        speaker: "a",
        category: "sexual",
        severity: "high",
        confidence: "high",
        quote: "test quote",
        reason: "test reason",
      };
      const payload = {
        candidates: [{ content: { parts: [{ text: JSON.stringify({ findings: [finding] }) }] }, finishReason: "STOP" }],
      };
      return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: { message: "mock: blocked non-moderation AI call" } }), { status: 500 });
  }) as typeof fetch;

  await db.insert(users).values([
    { id: USER_A, name: "TestModA", isAdult: true, transcriptionConsent: true },
    { id: USER_B, name: "TestModB", isAdult: true, transcriptionConsent: true },
  ]);

  const [session] = await db
    .insert(sessions)
    .values({
      userA: USER_A,
      userB: USER_B,
      lang: "en",
      userALevel: "B1",
      userBLevel: "B1",
      matchingMode: "exact_level",
      levelDistance: 0,
      userATranscriptionConsent: true,
      userBTranscriptionConsent: true,
      status: "active",
      startedAt: new Date(),
    })
    .returning();
  const sessionId = session!.id;
  console.log(`session: ${sessionId}`);

  // Feed one frame from user A (speaker "a") into the moderation window.
  recordFrameForModeration(sessionId, USER_A, "image/jpeg", FRAME_B64, new Date());

  await runAIModerationSweep();

  const reportRows = await db.select().from(reports).where(eq(reports.sessionId, sessionId));
  const banRows = await db.select().from(bans).where(eq(bans.userId, USER_A));
  const [after] = await db.select().from(sessions).where(eq(sessions.id, sessionId));

  console.log(`\nAI vision calls: ${moderationCalls}`);
  check("the AI vision check ran", moderationCalls === 1, moderationCalls);
  check("exactly one report filed", reportRows.length === 1, reportRows.length);
  check("report comes from the AI system account", reportRows[0]?.reporterId === SYSTEM_MODERATOR_ID, reportRows[0]?.reporterId);
  check("report targets the offending user", reportRows[0]?.reportedId === USER_A, reportRows[0]?.reportedId);
  check("report is flagged as AI", reportRows[0]?.aiFlag === true, reportRows[0]?.aiFlag);
  check("report reason matches the category", reportRows[0]?.reason === "sexual", reportRows[0]?.reason);
  check("exactly one ban issued", banRows.length === 1, banRows.length);
  check("ban is automatic", banRows[0]?.source === "automatic", banRows[0]?.source);
  check("ban links back to the report", banRows[0]?.reportId === reportRows[0]?.id, banRows[0]?.reportId);
  check("ban was created by the AI account", banRows[0]?.createdBy === SYSTEM_MODERATOR_ID, banRows[0]?.createdBy);
  const banDays = banRows[0] ? Math.round((banRows[0].endsAt!.getTime() - Date.now()) / 86_400_000) : 0;
  check("ban ends in ~14 days", banDays >= 13 && banDays <= 14, banDays);
  check("session was ended", after?.status === "ended", after?.status);
  check("session end reason is reported", after?.endReason === "reported", after?.endReason);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    failures++;
  })
  .finally(async () => {
    await cleanup().catch((err) => console.error("cleanup failed:", err));
    await pool.end();
    process.exit(failures === 0 ? 0 : 1);
  });
