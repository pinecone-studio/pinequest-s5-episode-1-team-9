import type { CefrLevel, Topic } from "@linguamatch/shared";
import { env } from "../../config/env";
import { AnthropicProvider } from "../ai/anthropicProvider";
import { pickRandomTopic } from "./topicBank";

const TOPIC_MODEL = "claude-haiku-5-5";
const QUESTION_COUNT = 3;

let provider: AnthropicProvider | null = null;

function topicProvider(): AnthropicProvider | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  provider ??= new AnthropicProvider(env.ANTHROPIC_API_KEY, TOPIC_MODEL);
  return provider;
}

export async function pickTopic(input: {
  targetLanguage: string;
  level: CefrLevel;
  avoid: readonly string[];
  current?: string;
  startedAt: Date | null;
}): Promise<Topic> {
  const fallback = () => pickRandomTopic(input.level, input.avoid, input.current);

  const ai = topicProvider();
  if (!ai) return fallback();

  try {
    const topic = await ai.generateTopic({
      targetLanguage: input.targetLanguage,
      level: input.level,
      previousTopics: [...input.avoid],
      minutesElapsed: input.startedAt ? (Date.now() - input.startedAt.getTime()) / 60_000 : 0,
    });
    const questions = topic.questions.slice(0, QUESTION_COUNT);
    if (!topic.title.trim() || questions.length === 0) return fallback();
    return { ...topic, questions };
  } catch (err) {
    console.error("[topic] AI topic unavailable, using the static bank:", err);
    return fallback();
  }
}
