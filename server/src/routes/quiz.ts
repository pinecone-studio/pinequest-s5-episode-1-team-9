import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { currentUser, requireAuth } from "../middleware/auth";
import { answerQuiz, getQuiz } from "../services/quiz/quizService";
import { parseBody } from "../utils/http";

export const quizRouter = Router();
quizRouter.use(requireAuth);

quizRouter.get("/:id/quiz", rateLimit({ windowMs: 600_000, limit: 60 }), async (req, res) => {
  const quiz = await getQuiz(req.params.id as string, currentUser(req).id);
  res.json({ quiz });
});

const AnswerSchema = z.object({
  index: z.number().int().min(0).max(20),
  choice: z.number().int().min(0).max(10),
});

quizRouter.post("/:id/quiz/answer", async (req, res) => {
  const body = parseBody(AnswerSchema, req.body);
  res.json(await answerQuiz(req.params.id as string, currentUser(req).id, body.index, body.choice));
});
