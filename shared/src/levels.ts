import { CEFR_LEVELS, type CefrLevel } from "./cefr";

export type LevelScale = "cefr" | "hsk" | "jlpt" | "topik";

const SCALE_BY_LANGUAGE: Record<string, LevelScale> = {
  zh: "hsk",
  ja: "jlpt",
  ko: "topik",
};

const CEFR_NAMES: Record<CefrLevel, string> = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper intermediate",
  C1: "Advanced",
  C2: "Proficient",
};

const HSK: Record<CefrLevel, string> = {
  A1: "HSK 1",
  A2: "HSK 2",
  B1: "HSK 3",
  B2: "HSK 4",
  C1: "HSK 5",
  C2: "HSK 6",
};

const JLPT: Record<CefrLevel, string> = {
  A1: "N5",
  A2: "N4",
  B1: "N3",
  B2: "N2",
  C1: "N1",
  C2: "N1",
};

const TOPIK: Record<CefrLevel, string> = {
  A1: "TOPIK 1",
  A2: "TOPIK 2",
  B1: "TOPIK 3",
  B2: "TOPIK 4",
  C1: "TOPIK 5",
  C2: "TOPIK 6",
};

const SCALE_NOTE: Record<LevelScale, string | null> = {
  cefr: null,
  hsk: "HSK levels are approximate CEFR equivalents.",
  jlpt: "JLPT levels are approximate CEFR equivalents. C1 and C2 both map to N1.",
  topik: "TOPIK levels are approximate CEFR equivalents.",
};

export function levelScale(language: string | null | undefined): LevelScale {
  if (!language) return "cefr";
  return SCALE_BY_LANGUAGE[language] ?? "cefr";
}

export function levelShort(language: string | null | undefined, level: CefrLevel): string {
  switch (levelScale(language)) {
    case "hsk":
      return HSK[level];
    case "jlpt":
      return `JLPT ${JLPT[level]}`;
    case "topik":
      return TOPIK[level];
    default:
      return level;
  }
}

export function levelLabel(language: string | null | undefined, level: CefrLevel): string {
  const scale = levelScale(language);
  if (scale === "cefr") return `${level} ${CEFR_NAMES[level]}`;
  return `${levelShort(language, level)} (${level})`;
}

export interface LevelOption {
  value: CefrLevel;
  label: string;
  short: string;
}

export function levelOptions(language: string | null | undefined): LevelOption[] {
  return CEFR_LEVELS.map((value) => ({
    value,
    label: levelLabel(language, value),
    short: levelShort(language, value),
  }));
}

export function levelScaleNote(language: string | null | undefined): string | null {
  return SCALE_NOTE[levelScale(language)];
}

const VOWEL_SOUND = /^[AEIOU]/i;
const LETTER_NAME_VOWEL = /^[FHLMNRSX](?![a-z])/;

export function levelWithArticle(language: string | null | undefined, level: CefrLevel): string {
  const short = levelShort(language, level);
  const needsAn = VOWEL_SOUND.test(short) || LETTER_NAME_VOWEL.test(short);
  return `${needsAn ? "an" : "a"} ${short}`;
}
