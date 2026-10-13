import type { NextFunction, Request, Response } from "express";
import { User, type UserDoc } from "../models/User";
import { logAuthFailure, verifyToken } from "../utils/auth";
import { HttpError } from "../utils/http";

declare global {
  namespace Express {
    interface Request {
      user?: UserDoc;
    }
  }
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const result = verifyToken(bearerToken(req), "access");
  if (!result.ok) {
    logAuthFailure("http", result.reason, { path: req.originalUrl.split("?")[0] });
    throw new HttpError(401, "Not signed in");
  }
  const user = await User.findById(result.userId);
  if (!user) {
    logAuthFailure("http", "unknown_user", { path: req.originalUrl.split("?")[0] });
    throw new HttpError(401, "Account not found");
  }
  req.user = user;
  next();
}

/** Narrowing helper for handlers mounted behind requireAuth. */
export function currentUser(req: Request): UserDoc {
  if (!req.user) throw new HttpError(401, "Not signed in");
  return req.user;
}

/**
 * Admin gate. Must run after {@link requireAuth}. Rejects every /admin and /api/admin request
 * from a signed-in non-admin with 403, so the routes never run a moderation action by accident.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    logAuthFailure("http", "forbidden_admin", { path: req.originalUrl.split("?")[0] });
    throw new HttpError(403, "Admin access required");
  }
  next();
}
