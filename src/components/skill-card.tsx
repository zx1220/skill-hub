"use client";

import Link from "next/link";
import { AgentBadge } from "./agent-badge";
import { TriggerTags } from "./trigger-tags";
import type { SkillMeta } from "@/lib/types";

const AGENT_ACCENT: Record<string, string> = {
  claude: "from-purple-500/60 via-purple-500/20 to-transparent",
  hermes: "from-orange-500/60 via-orange-500/20 to-transparent",
  both: "from-indigo-500/60 via-indigo-500/20 to-transparent",
};

export function SkillCard({ skill, onDragStart }: { skill: SkillMeta; onDragStart?: (e: React.DragEvent, slug: string) => void }) {
  const accentGradient = AGENT_ACCENT[skill.agent] || AGENT_ACCENT.both;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", skill.slug);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(e, skill.slug);
      }}
      className="cursor-grab active:cursor-grabbing"
    >
    <Link href={`/skills/${skill.slug}`} className="group block">
      <div
        className="relative rounded-xl border border-white/[0.06] bg-[#111118] overflow-hidden transition-all duration-300 hover:border-white/[0.12] hover:bg-[#16161f] hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5"
      >
        {/* Top accent gradient bar */}
        <div className={`h-[2px] bg-gradient-to-r ${accentGradient} opacity-60 group-hover:opacity-100 transition-opacity duration-300`} />

        <div className="p-5">
          {/* Header row: badge + version */}
          <div className="flex items-center justify-between mb-3">
            <AgentBadge agent={skill.agent} />
            {skill.version && (
              <span className="text-[10px] text-zinc-600 font-mono tracking-wide">v{skill.version}</span>
            )}
          </div>

          {/* Name */}
          <h3 className="text-[15px] font-semibold text-zinc-200 mb-1.5 group-hover:text-white transition-colors truncate leading-snug">
            {skill.name}
          </h3>

          {/* Description */}
          <p className="text-[13px] text-zinc-500 mb-3.5 line-clamp-2 leading-relaxed group-hover:text-zinc-400 transition-colors">
            {skill.description}
          </p>

          {/* Trigger tags */}
          <TriggerTags triggers={skill.triggers} />

          {/* Footer */}
          <div className="mt-3.5 pt-3 border-t border-white/[0.04] group-hover:border-white/[0.06] transition-colors flex items-center justify-between">
            <span className="text-[11px] text-zinc-600 font-mono">{skill.slug}</span>
            <span className="text-[11px] text-zinc-600">
              {skill.files.length} file{skill.files.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    </Link>
    </div>
  );
}
