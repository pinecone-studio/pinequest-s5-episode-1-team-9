import { TARGET_LANGUAGES } from "@linguamatch/shared";
import { AdminSettings, SETTINGS_KEY } from "../../models/AdminSettings";

/**
 * Which languages are currently open for practice. Cached briefly so the socket hot path does not
 * hit Mongo on every queue join. Lives outside adminService to avoid a route <-> socket import cycle.
 */
let cache: { codes: Set<string>; at: number } | null = null;
const TTL_MS = 30_000;

export async function enabledLanguageCodes(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.codes;
  const doc = await AdminSettings.findOne({ key: SETTINGS_KEY }).lean<{ languages?: { code: string; enabled: boolean }[] }>();
  const disabled = new Set((doc?.languages ?? []).filter((l) => l.enabled === false).map((l) => l.code));
  const codes = new Set(TARGET_LANGUAGES.filter((l) => !disabled.has(l.code)).map((l) => l.code));
  cache = { codes, at: Date.now() };
  return codes;
}

export function invalidateLanguageCache() {
  cache = null;
}
