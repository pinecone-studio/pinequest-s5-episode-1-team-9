"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { EditorSegment, VisualPosition } from "@/lib/ai/schemas/analysis";
import { VISUAL_LABEL } from "@/lib/ai/schemas/analysis";
import type { Tool } from "@/components/editor/ToolRail";
import { mn, topicLabel } from "@/lib/i18n/mn";
import { formatClock } from "@/utils/time";

const positions: VisualPosition[] = ["left", "right", "bottom", "background"];

type InspectorProps = {
  tool: Tool;
  onOpenMedia?: () => void;
  projectDuration: number;
  segments: EditorSegment[];
  selected: EditorSegment;
  sampleNote: boolean;
  onSelect: (id: string) => void;
  onPatch: (partial: Partial<EditorSegment>) => void;
  onPosition: (position: VisualPosition) => void;
  onClearVisual: () => void;
};

export function Inspector(props: InspectorProps) {
  const { tool, selected } = props;

  return (
    <aside className="m-3 rounded-3xl border border-white/80 bg-white shadow-[0_12px_36px_rgba(70,40,140,0.06)] lg:my-4 lg:mr-3 lg:ml-0">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${tool}-${selected.id}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex h-full flex-col p-4"
        >
          {tool === "visual" ? <VisualTool {...props} /> : null}
          {tool === "text" ? <TextTool {...props} /> : null}
          {tool === "media" ? <MediaTool {...props} /> : null}
          {tool === "audio" ? <AudioTool {...props} /> : null}
          {props.sampleNote ? (
            <p className="mt-6 text-xs leading-relaxed text-faint">
              {mn.editor.sampleNote}
            </p>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}

function VisualTool({ selected, projectDuration, onPatch, onPosition, onClearVisual, onOpenMedia }: InspectorProps) {
  const visual = selected.visualRecommendation;
  const hasVisual = visual.type !== "NONE";
  return (
    <div>
      <p className="text-sm font-semibold text-accent">{mn.editor.suggestions}</p>
      <div className="mt-3 rounded-2xl bg-gradient-to-br from-[#f4efff] to-[#eef9fc] p-4">
        <p className="text-sm font-semibold">{hasVisual ? mn.editor.picked : mn.editor.speakerOnly}</p>
        <p className="mt-2 text-base font-semibold">{topicLabel(selected.topic)}</p>
        <p className="mt-2 text-sm leading-relaxed text-mute">{hasVisual ? mn.editor.because : mn.editor.stays}</p>
        {hasVisual ? <p className="mt-2 text-sm text-paper">“{selected.text}”</p> : null}
        {visual.description ? <p className="mt-2 text-sm">{visual.description}</p> : null}
        {selected.reason ? <p className="mt-2 text-sm leading-relaxed">{selected.reason}</p> : null}
        <p className="mt-3 text-xs font-semibold text-accent">
          {mn.editor.confidence} {Math.round(selected.importance * 100)}%
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onOpenMedia} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-paper shadow-sm">
            {hasVisual ? mn.editor.replace : mn.editor.add}
          </button>
          {hasVisual ? (
            <button type="button" onClick={onClearVisual} className="rounded-full px-3 py-1.5 text-xs font-semibold text-mute">
              {mn.editor.remove}
            </button>
          ) : null}
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-xs text-faint">{mn.editor.type}</dt>
          <dd className="mt-1">{VISUAL_LABEL[visual.type]}</dd>
        </div>
        <div>
          <dt className="text-xs text-faint">{mn.editor.importance}</dt>
          <dd className="mt-1">{Math.round(selected.importance * 100)}%</dd>
        </div>
      </dl>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full bg-accent" style={{ width: `${selected.importance * 100}%` }} />
      </div>
      <Field label={mn.editor.position}>
        <div className="flex gap-2">
          {positions.map((position) => (
            <button
              key={position}
              type="button"
              onClick={() => onPosition(position)}
              className={`h-8 flex-1 rounded-md border text-xs capitalize ${
                visual.position === position ? "border-accent text-paper" : "border-line text-mute"
              }`}
            >
              {mn.editor.positions[position]}
            </button>
          ))}
        </div>
      </Field>
      <Field label={mn.editor.scale}>
        <input
          aria-label={mn.editor.scale}
          type="range"
          min={0.85}
          max={1.2}
          step={0.01}
          value={selected.scale}
          onChange={(event) => onPatch({ scale: Number(event.target.value) })}
          className="w-full accent-[#6d4aff]"
        />
      </Field>
      <Field label={mn.editor.opacity}>
        <input
          aria-label={mn.editor.opacity}
          type="range"
          min={0.45}
          max={1}
          step={0.01}
          value={selected.opacity}
          onChange={(event) => onPatch({ opacity: Number(event.target.value) })}
          className="w-full accent-[#6d4aff]"
        />
      </Field>
      <Timing selected={selected} duration={projectDuration} onPatch={onPatch} />
      <button type="button" onClick={onClearVisual} className="mt-5 text-sm text-mute hover:text-paper">
        {mn.editor.removeVisual}
      </button>
    </div>
  );
}

function TextTool({ selected, onPatch }: InspectorProps) {
  return (
    <div>
      <p className="text-sm font-semibold text-accent">{mn.editor.subtitle}</p>
      <Field label={mn.editor.subtitle}>
        <textarea
          aria-label={mn.editor.subtitle}
          value={selected.text}
          onChange={(event) => onPatch({ text: event.target.value })}
          rows={4}
          className="w-full resize-none rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm leading-relaxed outline-none focus:border-accent"
        />
      </Field>
      <Field label={mn.editor.overlay}>
        <input
          aria-label={mn.editor.overlay}
          value={selected.overlayText}
          onChange={(event) => onPatch({ overlayText: event.target.value })}
          className="h-10 w-full rounded-lg border border-line bg-ink-2 px-3 text-sm outline-none focus:border-accent"
        />
      </Field>
    </div>
  );
}

function MediaTool({ segments, selected, onSelect }: InspectorProps) {
  const visuals = segments.filter((segment) => segment.visualRecommendation.type !== "NONE");
  return (
    <div>
      <p className="text-sm font-semibold text-accent">{mn.editor.media}</p>
      <ul className="mt-4 space-y-2">
        {visuals.map((segment) => (
          <li key={segment.id}>
            <button
              type="button"
              onClick={() => onSelect(segment.id)}
              className={`w-full rounded-lg border px-3 py-3 text-left ${
                segment.id === selected.id ? "border-accent" : "border-line"
              }`}
            >
              <span className="block text-xs text-accent">{VISUAL_LABEL[segment.visualRecommendation.type]}</span>
              <span className="mt-1 block text-sm leading-snug">{segment.visualRecommendation.description}</span>
              <span className="mt-2 block text-xs font-semibold text-mute">{mn.editor.apply}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AudioTool({ segments, selected, onSelect }: InspectorProps) {
  return (
    <div>
      <p className="text-sm font-semibold text-accent">{mn.editor.speech}</p>
      <ul className="mt-4 space-y-3">
        {segments.map((segment) => (
          <li key={segment.id}>
            <button type="button" onClick={() => onSelect(segment.id)} className="w-full text-left">
              <span className="text-[11px] tabular-nums text-faint">{formatClock(segment.startTime)}</span>
              <span className={`mt-1 block text-sm leading-relaxed ${segment.id === selected.id ? "text-paper" : "text-mute"}`}>
                {segment.text}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Timing({
  selected,
  duration,
  onPatch,
}: {
  selected: EditorSegment;
  duration: number;
  onPatch: (partial: Partial<EditorSegment>) => void;
}) {
  function setStart(value: number) {
    const start = Math.max(0, Math.min(value, selected.endTime - 0.5));
    onPatch({ startTime: Number(start.toFixed(1)) });
  }

  function setEnd(value: number) {
    const end = Math.min(duration, Math.max(value, selected.startTime + 0.5));
    onPatch({ endTime: Number(end.toFixed(1)) });
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <Field label={mn.editor.start}>
        <input
          aria-label={mn.editor.start}
          type="number"
          min={0}
          max={duration}
          step={0.1}
          value={selected.startTime}
          onChange={(event) => setStart(Number(event.target.value))}
          className="h-10 w-full rounded-lg border border-line bg-ink-2 px-3 text-sm outline-none focus:border-accent"
        />
      </Field>
      <Field label={mn.editor.end}>
        <input
          aria-label={mn.editor.end}
          type="number"
          min={0}
          max={duration}
          step={0.1}
          value={selected.endTime}
          onChange={(event) => setEnd(Number(event.target.value))}
          className="h-10 w-full rounded-lg border border-line bg-ink-2 px-3 text-sm outline-none focus:border-accent"
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <span className="block text-xs text-faint">{label}</span>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
