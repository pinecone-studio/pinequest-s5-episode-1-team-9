import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { currentUser, requireAuth } from "../middleware/auth";
import { USERNAME_RE } from "../models/User";
import { isOnline } from "../services/friends/friendCalls";
import {
  acceptRequest,
  blockUser,
  declineRequest,
  listFriends,
  listRequests,
  searchUsers,
  sendRequest,
  unfriend,
} from "../services/friends/friendsService";
import { matchmaker } from "../socket";
import { parseBody } from "../utils/http";

export const friendsRouter = Router();
friendsRouter.use(requireAuth);

const presence = {
  online: isOnline,
  queued: (id: string) => matchmaker.isWaiting(id),
};

friendsRouter.get("/", async (req, res) => {
  res.json({ friends: await listFriends(currentUser(req).id, presence) });
});

friendsRouter.get("/requests", async (req, res) => {
  res.json({ requests: await listRequests(currentUser(req).id) });
});

friendsRouter.get("/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  res.json({ results: await searchUsers(currentUser(req).id, q) });
});

const SendSchema = z.object({ username: z.string().trim().regex(USERNAME_RE, "Enter a valid username") });

friendsRouter.post("/requests", rateLimit({ windowMs: 3600_000, limit: 60 }), async (req, res) => {
  const body = parseBody(SendSchema, req.body);
  const target = await sendRequest(currentUser(req).id, body.username);
  res.status(201).json({ friend: target });
});

friendsRouter.post("/requests/:userId/accept", async (req, res) => {
  await acceptRequest(currentUser(req).id, req.params.userId as string);
  res.json({ ok: true });
});

friendsRouter.post("/requests/:userId/decline", async (req, res) => {
  await declineRequest(currentUser(req).id, req.params.userId as string);
  res.json({ ok: true });
});

friendsRouter.delete("/:userId", async (req, res) => {
  await unfriend(currentUser(req).id, req.params.userId as string);
  res.status(204).end();
});

friendsRouter.post("/:userId/block", async (req, res) => {
  await blockUser(currentUser(req).id, req.params.userId as string);
  res.status(201).json({ ok: true });
});
