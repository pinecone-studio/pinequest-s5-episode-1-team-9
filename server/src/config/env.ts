import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  /** Comma-separated list of exact web origins allowed to call the API and open sockets. */
  CLIENT_ORIGIN: z.string().default("http://localhost:3000"),

  /** Pooled Postgres connection string (Neon `-pooler` host) used for app queries. */
  DATABASE_URL: z.string({ error: "DATABASE_URL is missing. Run `neon env pull` or set it to your Neon connection string." }).min(1),
  /** Direct (unpooled) connection used for migrations. Falls back to DATABASE_URL. */
  DATABASE_URL_UNPOOLED: z.string().min(1).optional(),

  /** Clerk keys. @clerk/express reads them from process.env; they're validated here so startup fails early. */
  CLERK_SECRET_KEY: z.string({ error: "CLERK_SECRET_KEY is missing. Run `clerk env pull --file .env`." }).startsWith("sk_"),
  CLERK_PUBLISHABLE_KEY: z
    .string({ error: "CLERK_PUBLISHABLE_KEY is missing. Run `clerk env pull --file .env`." })
    .startsWith("pk_"),

  /** Which AI provider to use. `gemini` has a free tier (set GEMINI_API_KEY). */
  AI_PROVIDER: z.enum(["anthropic", "gemini"]).default("anthropic"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),

  STUN_URLS: z.string().default("stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302"),
  TURN_URL: z.string().optional(),
  TURN_USERNAME: z.string().optional(),
  TURN_CREDENTIAL: z.string().optional(),

  /** Max CEFR distance the matcher will ever accept after expanding (1 = A2↔B1 allowed). */
  MATCH_MAX_LEVEL_DISTANCE: z.coerce.number().int().min(0).max(5).default(1),
  /** Seconds a user waits before the matcher accepts partners one level away. */
  MATCH_EXPAND_AFTER_SECONDS: z.coerce.number().int().min(0).default(10),
  /** Number of recent partners to avoid rematching with. */
  MATCH_RECENT_PARTNER_WINDOW: z.coerce.number().int().min(0).default(3),

  /** Distinct reporters within 24h that trigger an automatic temporary suspension. */
  MODERATION_AUTO_SUSPEND_REPORTS: z.coerce.number().int().positive().default(3),

  /** Real-time AI moderation of conversation transcripts (auto-report + temporary suspension). */
  AI_MODERATION_ENABLED: z
    .enum(["true", "false", "1", "0"])
    .default("true")
    .transform((v) => v === "true" || v === "1"),
  /** How often each active conversation's new transcript is scanned, in seconds. */
  AI_MODERATION_INTERVAL_SECONDS: z.coerce.number().int().min(5).default(30),
  /** Minimum new utterances since the last scan before a conversation is checked. */
  AI_MODERATION_MIN_SEGMENTS: z.coerce.number().int().min(1).default(4),
  /** Suspension length applied automatically when AI flags a violation. */
  AI_MODERATION_SUSPEND_DAYS: z.coerce.number().int().positive().default(14),
  /** Minimum severity for an AI finding to be acted on. */
  AI_MODERATION_MIN_SEVERITY: z.enum(["low", "medium", "high"]).default("medium"),
  /** Minimum model confidence required before acting on a finding. */
  AI_MODERATION_MIN_CONFIDENCE: z.enum(["low", "medium", "high"]).default("medium"),

  /** Real-time AI vision review of camera frames. The browser samples its own camera (no media
   *  server); frames are analyzed in memory and never stored. */
  AI_MODERATION_VIDEO_ENABLED: z
    .enum(["true", "false", "1", "0"])
    .default("true")
    .transform((v) => v === "true" || v === "1"),
  /** Minimum sampled frames buffered since the last scan before a vision check runs. */
  AI_MODERATION_VIDEO_MIN_FRAMES: z.coerce.number().int().min(1).default(1),
  /** Vision findings must be at least this severe/confident; imagery false positives are costly. */
  AI_MODERATION_VIDEO_MIN_SEVERITY: z.enum(["low", "medium", "high"]).default("medium"),
  AI_MODERATION_VIDEO_MIN_CONFIDENCE: z.enum(["low", "medium", "high"]).default("high"),

  /**
   * Comma-separated emails that are promoted to admin at first sign-in (and on every auth
   * check until they have the role), so you can bootstrap the first administrator.
   */
  ADMIN_EMAILS: z.string().default(""),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  console.error("Copy .env.example to .env and fill in the required values.");
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";

/** Lowercased admin emails from ADMIN_EMAILS (bootstrap admins). */
export const adminEmails: ReadonlySet<string> = new Set(
  env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
);

/** Exact origins allowed for CORS and Socket.IO. localhost:3000 is added in development only. */
export const allowedOrigins: ReadonlySet<string> = new Set([
  ...env.CLIENT_ORIGIN.split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean),
  ...(isProd ? [] : ["http://localhost:3000"]),
]);

/**
 * Origins a Clerk session token must have been minted for (its `azp` claim). Enforced in production
 * only: tokens minted through Clerk's Backend API for tests and scripts carry no `azp` at all.
 */
export const clerkAuthorizedParties: string[] | undefined = isProd ? [...allowedOrigins] : undefined;

/** Requests without an Origin header (same-origin GETs, curl, health checks) are not cross-site and are allowed. */
export const isAllowedOrigin = (origin: string | undefined) => !origin || allowedOrigins.has(origin);

export function iceServers() {
  const servers: { urls: string | string[]; username?: string; credential?: string }[] = [
    { urls: env.STUN_URLS.split(",").map((s) => s.trim()).filter(Boolean) },
  ];
  if (env.TURN_URL) {
    servers.push({ urls: env.TURN_URL, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL });
  }
  return servers;
}
