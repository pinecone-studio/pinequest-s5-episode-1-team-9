"use client";

import {
  TARGET_LANGUAGES,
  languageName,
  levelLabel,
  levelOptions,
  levelScaleNote,
  type CefrLevel,
} from "@linguamatch/shared";
import { ChevronDown, Play, Square } from "lucide-react";

const SHELL =
  "min-h-16 flex items-center justify-center gap-2.5 rounded-[16px] text-[18px] font-bold transition-colors focus-visible:ring-4 focus-visible:ring-brand-partner/30";

export function IdleControls({
  language,
  level,
  canStop,
  onStart,
  onStop,
  onLanguage,
  onLevel,
}: {
  language: string | null;
  level: CefrLevel | null;
  canStop: boolean;
  onStart: () => void;
  onStop: () => void;
  onLanguage: (code: string) => void;
  onLevel: (level: CefrLevel) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
      <button
        type="button"
        onClick={onStart}
        className={`${SHELL} bg-brand-partner text-ink cursor-pointer border-0 shadow-sm hover:brightness-105 hover:shadow-md active:scale-[0.99]`}
      >
        <Play className="size-5.5 fill-current" />
        Start
      </button>

      <button
        type="button"
        onClick={onStop}
        disabled={!canStop}
        className={`${SHELL} border border-border bg-card/70 text-muted-foreground enabled:cursor-pointer enabled:text-foreground enabled:hover:bg-accent disabled:opacity-55`}
      >
        <Square className="size-5 fill-current" />
        Stop
      </button>

      <Picker label="Language" value={language ? languageName(language) : "Choose"} tinted={false}>
        <select
          aria-label={`Language: ${language ? languageName(language) : "not set"}`}
          value={language ?? ""}
          onChange={(e) => onLanguage(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        >
          {!language && <option value="">Choose a language</option>}
          {TARGET_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </Picker>

      <LevelControl language={language} level={level} onLevel={onLevel} />
    </div>
  );
}

export function LevelControl({
  language,
  level,
  onLevel,
}: {
  language: string | null;
  level: CefrLevel | null;
  onLevel: (level: CefrLevel) => void;
}) {
  return (
    <Picker
      label="Proficiency level"
      value={level ? levelLabel(language, level) : "Choose"}
      tinted
      note={levelScaleNote(language)}
    >
      <select
        aria-label={`Proficiency level: ${level ? levelLabel(language, level) : "not set"}`}
        value={level ?? ""}
        onChange={(e) => onLevel(e.target.value as CefrLevel)}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      >
        {!level && <option value="">Choose a level</option>}
        {levelOptions(language).map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </Picker>
  );
}

function Picker({
  label,
  value,
  tinted,
  note,
  children,
}: {
  label: string;
  value: string;
  tinted: boolean;
  note?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex min-h-16 items-center justify-between gap-2.5 rounded-2xl border px-4 text-left ${
        tinted ? "border-brand-you/45 bg-brand-you/10" : "border-border bg-card/70"
      }`}
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-muted-foreground text-[13px] font-medium">{label}</span>
        <span className="text-[17px] font-bold text-foreground">{value}</span>
      </span>
      <ChevronDown aria-hidden="true" className="text-muted-foreground size-4.5 shrink-0" />
      {note && <span className="sr-only">{note}</span>}
      {children}
    </div>
  );
}

export function SearchingControls({
  language,
  level,
  mode,
  waiting,
  onStop,
}: {
  language: string | null;
  level: CefrLevel | null;
  mode: string;
  waiting: number | null;
  onStop: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-foreground">
          {[language ? languageName(language) : null, level ? levelLabel(language, level) : null, mode]
            .filter(Boolean)
            .join(", ")}
        </span>
        <span className="text-dim-dark text-[15px]">
          {waiting === null ? "Looking for a partner…" : `${waiting} learners waiting right now`}
        </span>
      </div>
      <button
        type="button"
        onClick={onStop}
        className="min-h-13 cursor-pointer rounded-[14px] border border-border bg-card/70 px-6.5 text-base font-bold text-foreground transition-colors hover:bg-accent"
      >
        Stop searching
      </button>
    </div>
  );
}
