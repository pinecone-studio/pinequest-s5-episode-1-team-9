import { CEFR_LEVELS, isTargetLanguage } from "@linguamatch/shared";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { currentUser, requireAuth } from "../middleware/auth";
import { toUserDTO, updateUser, withLanguageLevel } from "../models/User";
import { AIResponseError, AIUnavailableError, getAI } from "../services/ai";
import { HttpError, parseBody } from "../utils/http";

/**
 * Stateless placement test: nothing is stored. The browser keeps the questions and sends them
 * back with the answers. The result only affects the learner's own self-reported level, which
 * they can already set freely, so there is nothing to gain by tampering with it.
 */
export const assessmentRouter = Router();
assessmentRouter.use(requireAuth);
const aiLimiter = rateLimit({ windowMs: 3600_000, limit: 10, standardHeaders: true, legacyHeaders: false });

const targetLanguage = z.string().refine(isTargetLanguage, "Unsupported language");

function aiError(err: unknown): never {
  if (err instanceof AIUnavailableError) throw new HttpError(503, err.message);
  if (err instanceof AIResponseError) throw new HttpError(502, err.message);
  console.error("[assessment] AI call failed:", err);
  throw new HttpError(502, "The AI service is unavailable right now. Please try again.");
}

assessmentRouter.post("/", aiLimiter, async (req, res) => {
  const body = parseBody(z.object({ targetLanguage }), req.body);
  const user = currentUser(req);
  try {
    const questions = await getAI().createAssessment({
      targetLanguage: body.targetLanguage,
      nativeLanguage: user.nativeLanguage ?? null,
      selfReportedLevel: user.targetLanguages.find((t) => t.language === body.targetLanguage)?.level ?? null,
    });
    res.status(201).json({ targetLanguage: body.targetLanguage, questions });
  } catch (err) {
    aiError(err);
  }
});

const SubmitSchema = z.object({
  targetLanguage,
  questions: z
    .array(
      z.object({
        id: z.string().max(64),
        prompt: z.string().max(1000),
        focus: z.string().max(200),
        targetLevel: z.enum(CEFR_LEVELS),
      }),
    )
    .min(1)
    .max(10),
  answers: z.array(z.object({ questionId: z.string().max(64), answer: z.string().max(2000) })).max(10),
});

assessmentRouter.post("/submit", aiLimiter, async (req, res) => {
  const body = parseBody(SubmitSchema, req.body);
  if (body.answers.filter((a) => a.answer.trim()).length === 0) throw new HttpError(400, "Answer at least one question");
  try {
    res.json({ result: await getAI().evaluateAssessment(body) });
  } catch (err) {
    aiError(err);
  }
});

/** Applies an AI-estimated level to the user's profile — only when the user chooses to. */
assessmentRouter.post("/apply", async (req, res) => {
  const body = parseBody(z.object({ targetLanguage, level: z.enum(CEFR_LEVELS) }), req.body);
  const user = currentUser(req);
  if (body.targetLanguage === user.nativeLanguage) throw new HttpError(400, "That's your native language");
  const updated = await updateUser(user.id, {
    targetLanguages: withLanguageLevel(user, body.targetLanguage, body.level, "assessment"),
    activeTargetLanguage: user.activeTargetLanguage ?? body.targetLanguage,
  });
  res.json({ user: toUserDTO(updated) });
});
