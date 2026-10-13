import type { NextConfig } from "next";

// One .env at the repo root serves both apps.
try {
  process.loadEnvFile("../.env");
} catch {
  // No root .env — rely on the environment / web/.env.local.
}

// On Vercel both URLs must point at the Render API. Without them the browser would try to reach
// localhost:4000 on the visitor's own machine, so fail the build loudly instead.
if (process.env.VERCEL) {
  const missing = ["API_URL", "NEXT_PUBLIC_SOCKET_URL"].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing Vercel environment variable(s): ${missing.join(", ")}. Set them to the Render API URL and redeploy.`);
  }
}

const API_URL = (process.env.API_URL ?? "http://localhost:4000").trim().replace(/\/+$/, "");

const nextConfig: NextConfig = {
  transpilePackages: ["@linguamatch/shared"],
  // Proxy REST calls through this site's own domain so they stay same-origin. Both REST and
  // Socket.IO (which connects directly to the API) authenticate with a Clerk session token.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
