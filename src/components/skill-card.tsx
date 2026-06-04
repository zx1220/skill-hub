"use client";

import Link from "next/link";
import { AgentBadge } from "./agent-badge";
import { TriggerTags } from "./trigger-tags";
import type { SkillMeta } from "@/lib/types";

export function SkillCard({ skill }: { skill: SkillMeta }) {
  return (
    <Link href={`/skills/${skill.slug}`}>
      <div className="group relative rounded-lg border border-white/[0.06] bg-[#111118] p-5 transition-all duration-200 hover:border-indigo-500/20 hover:bg-[#1a1a24] hover:shadow-[0_0_0_1px_rgba(99,102,241,0.1)]">
        {/* Agent + Version row */}
        <div className="flex items-center justify-between mb-3">
          <AgentBadge agent={skill.agent} />
          {skill.version && (
            <span className="text-xs text-zinc-500 font-mono">v{skill.version}</span>
          )}
        </div>

        {/* Name */}
        <h3 className="text-lg font-semibold text-zinc-100 mb-1 group-hover:text-white transition-colors truncate">
          {skill.name}
        </h3>

        {/* Description */}
        <p className="text-sm text-zinc-400 mb-3 line-clamp-2 leading-relaxed">
          {skill.description}
        </p>

        {/* Trigger tags */}
        <TriggerTags triggers={skill.triggers} />

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between">
          <span className="text-xs text-zinc-600 font-mono">{skill.slug}</span>
          <span className="text-xs text-zinc-600">
            {skill.files.length} file{skill.files.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}
