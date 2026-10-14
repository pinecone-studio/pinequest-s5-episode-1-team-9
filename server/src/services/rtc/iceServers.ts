import { createHmac } from "node:crypto";
import { env } from "../../config/env";

export type IceServer = { urls: string | string[]; username?: string; credential?: string };

const CLOUDFLARE_TTL_SECONDS = 86_400;
/** Credentials are reused across rooms, but never handed out when a call could outlive them. */
const REFRESH_BEFORE_EXPIRY_MS = 4 * 60 * 60 * 1000;
const CLOUDFLARE_TIMEOUT_MS = 5_000;

let cloudflareCache: { servers: IceServer[]; expiresAt: number } | null = null;
let cloudflareInFlight: Promise<IceServer[]> | null = null;

function stunServers(): IceServer[] {
  return [{ urls: env.STUN_URLS.split(",").map((s) => s.trim()).filter(Boolean) }];
}

/** Browsers block port 53, so a TURN URL on it only adds a timeout before ICE gives up on it. */
function withoutPort53(server: IceServer): IceServer {
  const urls = (Array.isArray(server.urls) ? server.urls : [server.urls]).filter((u) => !/:53(\?|$)/.test(u));
  return { ...server, urls };
}

async function fetchCloudflareServers(keyId: string, apiToken: string): Promise<IceServer[]> {
  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: CLOUDFLARE_TTL_SECONDS }),
      signal: AbortSignal.timeout(CLOUDFLARE_TIMEOUT_MS),
    },
  );
  if (!res.ok) throw new Error(`Cloudflare TURN responded ${res.status}`);
  const body = (await res.json()) as { iceServers?: IceServer[] };
  if (!body.iceServers?.length) throw new Error("Cloudflare TURN returned no ICE servers");
  const servers = body.iceServers.map(withoutPort53);
  cloudflareCache = { servers, expiresAt: Date.now() + CLOUDFLARE_TTL_SECONDS * 1000 };
  return servers;
}

async function cloudflareServers(keyId: string, apiToken: string): Promise<IceServer[]> {
  if (cloudflareCache && cloudflareCache.expiresAt - Date.now() > REFRESH_BEFORE_EXPIRY_MS) {
    return cloudflareCache.servers;
  }
  cloudflareInFlight ??= fetchCloudflareServers(keyId, apiToken).finally(() => {
    cloudflareInFlight = null;
  });
  return cloudflareInFlight;
}

/**
 * STUN alone fails when either peer is behind a strict NAT (most mobile networks), so a TURN relay
 * is added when configured: Cloudflare Realtime TURN, or a Coturn-style TURN REST shared secret.
 * If Cloudflare can't be reached the call still starts with STUN only.
 */
export async function iceServers(): Promise<IceServer[]> {
  if (env.CLOUDFLARE_TURN_KEY_ID && env.CLOUDFLARE_TURN_API_TOKEN) {
    try {
      return await cloudflareServers(env.CLOUDFLARE_TURN_KEY_ID, env.CLOUDFLARE_TURN_API_TOKEN);
    } catch (err) {
      console.error("[turn] Couldn't get Cloudflare TURN credentials; using STUN only:", (err as Error).message);
      return stunServers();
    }
  }
  const servers = stunServers();
  if (env.TURN_URL && env.TURN_SHARED_SECRET) {
    const username = `${Math.floor(Date.now() / 1000) + 86_400}:linguamatch`;
    const credential = createHmac("sha1", env.TURN_SHARED_SECRET).update(username).digest("base64");
    servers.push({ urls: env.TURN_URL, username, credential });
  }
  return servers;
}
