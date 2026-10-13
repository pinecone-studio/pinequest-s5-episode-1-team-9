
export const XP_TIERS = [
  { minutes: 60, xp: 100 },
  { minutes: 40, xp: 70 },
  { minutes: 20, xp: 30 },
  { minutes: 8, xp: 15 },
] as const;

export const DAILY_XP_CAP = 200;
export const STREAK_BONUS_XP = 10;
export const MIN_CALL_SECONDS = 8 * 60;
export const XP_TIMEZONE = "Asia/Ulaanbaatar";

export function xpForTalkTime(seconds: number): number {
  for (const t of XP_TIERS) {
    if (seconds >= t.minutes * 60) return t.xp;
  }
  return 0;
}

export function applyDailyCap(amount: number, earnedToday: number): number {
  return Math.max(0, Math.min(amount, DAILY_XP_CAP - earnedToday));
}

/** Cumulative XP to reach each level. Index is the level; L1 needs 0. */
const LEVEL_GOALS = [0, 0, 400, 900, 1500, 2200, 3000] as const;
/** Last explicit tier (L6). Indexing with this literal keeps the type `number`. */
const TOP_TIER = 6;
const TOP_TIER_GOAL = LEVEL_GOALS[TOP_TIER];
const GOAL_STEP_AFTER_L6 = 900;

export function levelGoal(level: number): number {
  if (level <= 1) return 0;
  // Past L6 the goal grows by a fixed step. `??` only fires for out-of-range levels.
  return LEVEL_GOALS[level] ?? TOP_TIER_GOAL + (level - TOP_TIER) * GOAL_STEP_AFTER_L6;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xp >= levelGoal(level + 1)) level++;
  return level;
}

export function levelProgress(xp: number) {
  const level = levelForXp(xp);
  const currentGoal = levelGoal(level);
  const nextGoal = levelGoal(level + 1);
  return {
    level,
    xp,
    currentGoal,
    nextGoal,
    xpIntoLevel: xp - currentGoal,
    xpToNext: nextGoal - xp,
    progress: (xp - currentGoal) / (nextGoal - currentGoal),
  };
}

export function localDate(d: Date = new Date(), timeZone: string = XP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function previousDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function nextStreak(lastCallDate: string | null, currentStreak: number, today: string) {
  if (lastCallDate === today) return { streak: currentStreak, bonus: false };
  if (lastCallDate === previousDate(today)) return { streak: currentStreak + 1, bonus: true };
  return { streak: 1, bonus: true };
}

export function displayStreak(lastCallDate: string | null, streak: number, today: string = localDate()): number {
  if (lastCallDate === today || lastCallDate === previousDate(today)) return streak;
  return 0;
}

export const EMOJI_UNLOCKS: Record<number, readonly string[]> = {
  1: ["👍", "😂", "❤️", "👋"],
  2: ["🔥", "👏", "😮"],
  3: ["🎉", "💯", "🤔"],
  4: ["😎", "🙌", "⭐"],
  5: ["🚀", "🏆", "🌟"],
  6: ["👑", "💎"],
};

export const ALL_EMOJIS: readonly string[] = Object.values(EMOJI_UNLOCKS).flat();

export function unlockLevelOf(emoji: string): number | null {
  for (const [level, list] of Object.entries(EMOJI_UNLOCKS)) {
    if (list.includes(emoji)) return Number(level);
  }
  return null;
}

export function unlockedEmojis(level: number): string[] {
  return ALL_EMOJIS.filter((e) => (unlockLevelOf(e) ?? Infinity) <= level);
}

export function newlyUnlocked(oldLevel: number, newLevel: number): string[] {
  return ALL_EMOJIS.filter((e) => {
    const l = unlockLevelOf(e)!;
    return l > oldLevel && l <= newLevel;
  });
}

export function canUseEmoji(emoji: string, level: number): boolean {
  const l = unlockLevelOf(emoji);
  return l !== null && l <= level;
}