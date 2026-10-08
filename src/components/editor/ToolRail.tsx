"use client";

import { AudioLines, ImageIcon, Layers3, Type } from "lucide-react";
import { mn } from "@/lib/i18n/mn";

export type Tool = "media" | "text" | "visual" | "audio";

const tools: { id: Tool; label: string; icon: typeof Type }[] = [
  { id: "media", label: mn.editor.tools.media, icon: ImageIcon },
  { id: "text", label: mn.editor.tools.text, icon: Type },
  { id: "visual", label: mn.editor.tools.visual, icon: Layers3 },
  { id: "audio", label: mn.editor.tools.audio, icon: AudioLines },
];

export function ToolRail({ tool, onChange }: { tool: Tool; onChange: (tool: Tool) => void }) {
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-col lg:px-3 lg:py-4">
      {tools.map((item) => {
        const Icon = item.icon;
        const active = tool === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-xs transition duration-200 lg:flex-col lg:gap-1 lg:px-1 ${
              active ? "bg-white text-accent shadow-[0_8px_20px_rgba(70,40,140,0.08)]" : "text-mute hover:bg-white/70 hover:text-paper"
            }`}
          >
            <Icon size={18} strokeWidth={1.6} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
