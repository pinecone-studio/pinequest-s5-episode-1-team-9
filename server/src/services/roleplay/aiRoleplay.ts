import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { languageName, type CefrLevel } from "@linguamatch/shared";
import { z } from "zod";
import { env } from "../../config/env";
import { pickRandomScenario, type Scenario } from "./scenarioBank";

const ROLEPLAY_MODEL = "claude-haiku-5-5";
const MAX_TOKENS = 2000;

const RoleSchema = z.object({
  roleName: z.string().describe("Short name of the role, in the target language"),
  situation: z.string().describe("One or two sentences telling this person who they are and where they are"),
  secretGoal: z.string().describe("One sentence: what this person is privately trying to achieve"),
});

const ScenarioSchema = z.object({
  title: z.string().describe("Short title for the scenario, in the target language"),
  roles: z.tuple([RoleSchema, RoleSchema]).describe("Exactly two complementary roles"),
});

const ROLEPLAY_SYSTEM = `You design two-person role-play scenarios for strangers practicing a foreign language together over video chat. Both speakers are learners at roughly the same CEFR level; neither is a teacher.

Create one everyday scenario with exactly two complementary roles that need each other to talk, such as a receptionist and a guest, a shop assistant and a customer, a landlord and a tenant.

Match difficulty to the level you are given:
- A1/A2: simple transactions with concrete, high-frequency vocabulary — buying something, ordering food, asking for a room. Short sentences, present and simple past.
- B1: everyday problems that need explaining and negotiating — a complaint, a booking that went wrong, planning something together.
- B2: scenarios with a trade-off, where the two sides want different things and must justify their position.
- C1/C2: professional or ethical situations that reward precise, nuanced argument and diplomatic disagreement.

Each role gets a situation of one or two sentences and exactly one secret goal. The secret goal is private to that role: it must give them something concrete to pursue in the conversation, and it must be achievable by talking. Never write a secret goal that depends on information the other person cannot possibly give, and never make a goal that requires lying about anything harmful.

Write every field in the target language. Keep roles non-sexual, non-violent, and free of anything that pressures either speaker to reveal real personal details such as their address, full name or contact information.`;

let client: Anthropic | null = null;

function anthropic(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

function userPrompt(targetLanguage: string, level: CefrLevel, avoid: readonly string[]): string {
  const lines = [
    `Target language: ${languageName(targetLanguage)}`,
    `CEFR level: ${level}`,
    `Already used (do not repeat): ${avoid.length ? avoid.map((t) => `"${t}"`).join(", ") : "none"}`,
    "Create one fresh scenario with exactly two roles.",
  ];
  return lines.join("\n");
}

export async function pickScenario(input: {
  targetLanguage: string;
  level: CefrLevel;
  avoid?: readonly string[];
}): Promise<Scenario> {
  const avoid = input.avoid ?? [];
  const fallback = () => pickRandomScenario(input.level, avoid);

  const ai = anthropic();
  if (!ai) return fallback();

  try {
    const response = await ai.beta.messages.parse({
      model: ROLEPLAY_MODEL,
      max_tokens: MAX_TOKENS,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: ROLEPLAY_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt(input.targetLanguage, input.level, avoid) }],
      output_config: { effort: "low", format: betaZodOutputFormat(ScenarioSchema) },
    });

    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return fallback();
    const out = response.parsed_output;
    if (!out) return fallback();

    const roles = out.roles.map((r) => ({
      roleName: r.roleName.trim(),
      situation: r.situation.trim(),
      secretGoal: r.secretGoal.trim(),
    }));
    const complete = roles.every((r) => r.roleName && r.situation && r.secretGoal);
    if (!out.title.trim() || !complete) return fallback();

    return {
      title: out.title.trim(),
      level: input.level,
      roles: [roles[0]!, roles[1]!],
    };
  } catch (err) {
    console.error("[roleplay] AI scenario unavailable, using the static bank:", err);
    return fallback();
  }
}
