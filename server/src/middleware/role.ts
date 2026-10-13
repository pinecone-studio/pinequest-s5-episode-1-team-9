import type { UserRole } from "@linguamatch/shared";
import type { NextFunction, Request, Response } from "express";
import { currentUser } from "./auth";
import { HttpError } from "../utils/http";

const ROLE_RANK: Record<UserRole, number> = { user: 0, moderator: 1, admin: 2 };

/** True when `role` is `min` or higher on the user → moderator → admin ladder. */
export function roleAtLeast(role: UserRole, min: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Mount behind requireAuth. Rejects anyone below the required rank with 403. */
export function requireRole(min: UserRole) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    if (!roleAtLeast(currentUser(_req).role, min)) {
      throw new HttpError(403, "You don't have permission to do that");
    }
    next();
  };
}