import { EMOJI_UNLOCKS } from "@linguamatch/shared";
import { Router } from "express";
import { currentUser, requireAuth } from "../middleware/auth";
import { getSessionXp, getXpSummary } from "../services/xp/xpService";
import { HttpError } from "../utils/http";

export const xpRouter = Router();
xpRouter.use(requireAuth);

xpRouter.get("/me", async (req, res) => {
  const summary = await getXpSummary(currentUser(req).id);
  if (!summary) throw new HttpError(404, "Account not found");
  res.json({ ...summary, emojiUnlocks: EMOJI_UNLOCKS });
});

xpRouter.get("/session/:sessionId", async (req, res) => {
  const data = await getSessionXp(currentUser(req).id, req.params.sessionId as string);
  if (!data) throw new HttpError(404, "Account not found");
  res.json(data);
});