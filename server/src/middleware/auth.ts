import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { findOrCreateUser, type User } from "../models/User";
import { logAuthFailure } from "../utils/auth";
import { HttpError } from "../utils/http";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/** Requires a Clerk session (verified by `clerkMiddleware`) and loads, or creates, the app's user row. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const path = req.originalUrl.split("?")[0];
  const { userId } = getAuth(req);
  if (!userId) {
    logAuthFailure("http", "missing", { path });
    throw new HttpError(401, "Not signed in");
  }
  const user = await findOrCreateUser(userId);
  if (user.deletedAt) {
    logAuthFailure("http", "deleted_user", { path });
    throw new HttpError(401, "This account was deleted");
  }
  req.user = user;
  next();
}

/** Narrowing helper for handlers mounted behind requireAuth. */
export function currentUser(req: Request): User {
  if (!req.user) throw new HttpError(401, "Not signed in");
  return req.user;
}
