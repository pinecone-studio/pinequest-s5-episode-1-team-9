import { clerkMiddleware } from "@clerk/nextjs/server";

// Keeps the Clerk session in sync on page loads. Routes aren't protected here: pages guard
// themselves (useRequireUser) and the API verifies every request's token.
export default clerkMiddleware();

export const config = {
  // Pages only. /api/* is proxied to the Express server, which does its own verification.
  matcher: ["/((?!_next|api/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)"],
};
