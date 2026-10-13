import { Router } from "express";
import { currentUser, requireAuth } from "../middleware/auth";
import { toUserDTO } from "../models/User";

/** Sign-in, sign-up and sessions are handled by Clerk; this only returns the app profile. */
export const authRouter = Router();

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: toUserDTO(currentUser(req)) });
});
