# LinguaMatch

Omegle-style language exchange: get matched with a stranger practicing the same language at your CEFR level, talk over peer-to-peer video, and get an AI report afterwards.

> Meet a real person at your level, talk naturally, and let AI tell you exactly how to improve.

## Quick start

Requirements: Node.js 22 or newer, and Chrome or Edge (for speech-to-text).

```bash
npm install
cp .env.example .env        # then fill in the Neon, Clerk and (optional) Anthropic values
npm run db:migrate -w server
npm run dev                 # API on :4000, web on :3000
```

- **Database:** Neon Postgres through Drizzle ORM. The schema is `server/src/db/schema.ts`. Migrations live in `server/drizzle`: `npm run db:generate -w server` writes a new one from schema changes, and `npm run db:migrate -w server` applies pending ones via `DATABASE_URL_UNPOOLED`. Point your local `.env` at a Neon dev branch, not production.
- **Auth:** Clerk. `clerk env pull --file .env` fills `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. A `users` row (keyed by the Clerk user ID) is created on a user's first authenticated request.
- **AI:** without `ANTHROPIC_API_KEY` the app still runs. Topics, assessment and reports say plainly that AI isn't configured; nothing is faked.
- **Testing a match alone:** open two browser profiles (or one normal and one incognito window), create two accounts with the same target language and level, and click **Start practicing** in both.

```bash
npm test                                   # matchmaking + metrics unit tests
npm start -w server &                      # then, in another shell:
(cd server && npx tsx --env-file=../.env scripts/smoke.ts)  # two-user end-to-end run (needs an sk_test_ Clerk key)
npm run typecheck && npm run build
```

## Deployment (Render + Vercel)

The API (Express + Socket.IO) needs a process that stays running, so it runs on **Render**. The web app runs on **Vercel**. Vercel proxies `/api/*` to Render, so normal API calls stay on the web app's own domain. Socket.IO connects straight to Render. The database is Neon; run `npm run db:migrate -w server` against production before deploying code that needs a new migration.

### How sign-in works

- **Clerk** owns accounts, passwords, social sign-in and the `/login` and `/signup` pages. Clerk's own short-lived session token (about 60 seconds, refreshed by Clerk's SDK) is sent as `Authorization: Bearer …` and in the Socket.IO handshake `auth`.
- **The server** verifies the token with `CLERK_SECRET_KEY`. In production it also checks that the token was issued for one of the `CLIENT_ORIGIN` origins.
- **When the server returns 401:** the web app fetches a fresh token and retries once. The socket does the same on an `unauthorized` error. Network errors and cold starts never sign anyone out.
- **Deleting an account** anonymizes the `users` row, removes the person's transcripts, reports and partner history, then deletes the Clerk user.
- **Logging:** the server writes `[auth] http|socket rejected reason=missing|invalid_token|wrong_origin|unknown_user|deleted_user`. Tokens are never logged.

### 1. Render (API)

**New → Blueprint**, then pick this repo. `render.yaml` sets up the following (or enter it by hand under **New → Web Service**):

| Setting | Value |
|---|---|
| Runtime | Node, version 22 (`NODE_VERSION=22`) |
| Root directory | `server` |
| Build command | `cd .. && npm ci --workspace server --include-workspace-root=false` |
| Start command | `npm start` |
| Health check path | `/health` |
| Instances | 1. The matchmaking queue is in memory. |

Environment variables on Render:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `CLIENT_ORIGIN` | `https://linguamatch.vercel.app`. For preview URLs, add them comma-separated. |
| `DATABASE_URL` | Neon pooled connection string (the `-pooler` host) for the production branch. |
| `CLERK_SECRET_KEY` | Clerk production instance secret key (`sk_live_…`). |
| `CLERK_PUBLISHABLE_KEY` | Clerk production instance publishable key (`pk_live_…`). |
| `ANTHROPIC_API_KEY` | Optional |
| `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL` | Optional, recommended |

Don't set `PORT`; Render provides it.

### 2. Vercel (web)

- **Project → Settings → General → Root Directory:** `web`. Vercel installs the npm workspaces from the repo root by itself.
- **Environment variables (Production, and Preview if you use it):**
  - `API_URL` = `https://<your-service>.onrender.com`
  - `NEXT_PUBLIC_SOCKET_URL` = `https://<your-service>.onrender.com`
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` = the same Clerk production keys as Render

  A Vercel build fails if `API_URL` or `NEXT_PUBLIC_SOCKET_URL` is missing.
- **Clerk:** add the Vercel domain to the Clerk production instance (`clerk deploy` walks through domain and DNS setup).
- **Redeploy** after any change to these variables. `NEXT_PUBLIC_SOCKET_URL` and the `/api` proxy target are fixed at build time.

### Cold starts

Render's free plan sleeps after about 15 minutes idle and takes up to a minute to wake. While it wakes, the web app shows "Waking up the server, this can take up to a minute..." and retries with exponential backoff, for both API calls and the socket. It never treats this as an expired session.

### Manual test checklist

Run through this after each deploy:

- [ ] **Normal window:** sign up, onboard, click **Start practicing**. /match shows the waiting count and the timer runs.
- [ ] **Incognito window:** same flow. Reload /match and you stay signed in.
- [ ] **Two windows match:** a normal and an Incognito window with the same language and level get matched into a room. Reloading the room page reconnects to the same room.
- [ ] **Token expiry while waiting:** stay on /match for a few minutes (well past the 60-second Clerk token), then switch Wi-Fi off and on to force a reconnect. No "session expired" message appears; the socket reconnects with a fresh token and you rejoin the queue.
- [ ] **Real sign-out:** sign out from the menu, then open /match. You land on `/login?redirect_url=…`.
- [ ] **Cold start:** with the Render service asleep (or suspended and resumed), open /match. You see the waking-up message, and it connects on its own within about a minute.
- [ ] **Cancel/leave cleanup:** press **Cancel** or navigate away. Render logs show no further `queue:join` for you, the waiting count in a second window drops, and the timer stops.
- [ ] **Render logs:** `[auth] … reason=…` lines show the reason for any rejection and contain no tokens.

Automated: `npm test` covers token verification reasons and the origin allowlist. `server/scripts/smoke.ts <url>` creates two throwaway Clerk test users and runs sign-in → onboarding → socket auth → match → room → feedback → block/report against a running server, then deletes the Clerk users.

## Architecture

```
shared/   Types, CEFR levels, language list, socket event contracts (used by both apps)
server/   Express + Socket.IO + Drizzle ORM (Neon Postgres) + Clerk
  drizzle           SQL migrations (generated by drizzle-kit, plus hand-written triggers)
  src/config        env validation (zod)
  src/db            schema and connection pool
  src/models        User, Session, FeedbackReport query helpers
  src/routes        auth (/me), users (onboarding/settings/profile/blocks/delete), conversations (feedback/report/block), assessment
  src/socket        Socket.IO handshake auth (Clerk session token) + event wiring
  src/services
    ai/             provider-agnostic interface + Anthropic/Gemini implementations, prompts, schemas
    speech/         speech-to-text layer (separate from AI analysis), segment sanitizing
    matchmaking/    pure pairing algorithm (unit-tested) + in-memory queue service
    rooms/          room lifecycle, WebRTC signaling relay, topics, transcript ingestion
    feedback/       deterministic fluency metrics + AI analysis → per-user reports
    moderation/     reports, blocks, crowd-based and real-time AI auto-suspension
    profile/        stats and progress trends
web/      Next.js (App Router) + Tailwind v4 + shadcn/ui
  src/app           /, /login, /signup, /onboarding, /assessment, /match, /room/[roomId],
                    /feedback/[conversationId], /profile, /settings, /rules
  src/hooks         useWebRTC, useSpeechRecognition, useLocalMedia
  src/lib           api client, socket singleton, auth context
```

### Conversation flow

1. A client sends `queue:join`. Every second (and on each join) the matchmaker pairs entries with the same target language. It tries exact CEFR level first, then allows ±1 level after `MATCH_EXPAND_AFTER_SECONDS`, never going past `MATCH_MAX_LEVEL_DISTANCE`. It never pairs blocked users or the user's most recent partner, and avoids other recent partners until both people have waited 60 seconds. Native language is never used.
2. A match creates a `sessions` row, and topic generation starts in the background. Both clients go to `/room/:id` and emit `room:join`. Once both are present, the server sends `room:ready` with a caller or callee role and the ICE servers.
3. WebRTC offer, answer and ICE messages are relayed only to the other participant. Media flows peer to peer.
4. Each browser transcribes **only its own microphone** (Web Speech API) and sends final phrases as `transcript:segment`. Consent is snapshotted at match time.
5. On End, Next, Block, Report, or a disconnect lasting more than 20 seconds, the conversation ends once. Stats update, and a separate report is generated for each participant from that person's own speech only.
6. After reports are settled, transcripts are deleted unless *both* users chose to keep them. An hourly sweep catches anything left over.

### AI layer

Everything goes through `AIProvider` in `server/src/services/ai/types.ts`. To switch providers, implement that interface and add a case in `ai/index.ts`. The Anthropic implementation uses `claude-opus-5-5` (configurable via `ANTHROPIC_MODEL`). It returns structured output validated against Zod schemas and sets `fallbacks: "default"`, so the API can retry a safety-classifier refusal on another model instead of failing. Effort is set per task: `low` for live topics, `medium` for analysis.

Fluency numbers are computed in code, not by the model. These are word or character count, speaking rate, filler words, repetitions and overused words. The model gets those numbers as input for its judgment and its exercises.

## Honest limitations

- **Pronunciation is not scored.** The browser recognizer gives no phoneme-level data, so the report shows "Not assessed" with an explanation. A real pronunciation API (for example Azure Pronunciation Assessment) would plug into `services/speech` behind `SpeechToTextProvider.supportsPronunciationAssessment`.
- **Speech-to-text quality depends on the browser.** Chrome and Edge work, using the browser vendor's cloud service, which the consent text discloses. Firefox has no Web Speech API, and the room tells such users they won't get a report. Recognizers also hide some mistakes and drop filler words, so the AI is told to ignore likely recognition artifacts, and filler counts are labeled as a lower bound.
- **Speaking rate is approximate.** It's based on when the recognizer first and last heard each phrase.
- **NAT traversal:** STUN alone fails on some corporate or mobile networks. Set `TURN_URL`, `TURN_USERNAME` and `TURN_CREDENTIAL` for production.
- **Single process:** the matchmaking queue and room state live in memory. To scale out, move them to Redis and add the Socket.IO Redis adapter.
- **Moderation combines human reports with real-time AI text review.** Users can report or block a partner, reporting also blocks, and several distinct reporters within a day trigger a 24-hour automatic suspension. At the same time, a background sweep scans each active conversation's fresh transcript with the AI provider and, when it clearly detects harassment, sexual, hate, minor-solicitation or spam content, files a report (as the reserved `LinguaMatch_AI` account, marked with an `aiFlag`) and suspends the offender for `AI_MODERATION_SUSPEND_DAYS` days, ending the call. **Only text is moderated** — video and audio are peer-to-peer and never reach the server, so visual content cannot be checked without adding a media pipeline. AI moderation is conservative (severity/confidence thresholds) but not perfect; human review of every AI report remains the backstop.

## Roadmap (after MVP)

Pronunciation API, Redis-backed queue, interest-based topics, streaks and gamification, more languages, video/audio content moderation (needs a media pipeline), and a Clerk `user.deleted` webhook so accounts deleted from the Clerk dashboard are cleaned up too.
# LinguaMatch
