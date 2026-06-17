"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MoreVertical, FolderInput, Trash2 } from "lucide-react";
import { AgentBadge } from "./agent-badge";
import { TriggerTags } from "./trigger-tags";
import type { SkillMeta } from "@/lib/types";

const AGENT_ACCENT: Record<string, string> = {
  claude: "from-purple-500/60 via-purple-500/20 to-transparent",
  hermes: "from-orange-500/60 via-orange-500/20 to-transparent",
  both: "from-indigo-500/60 via-indigo-500/20 to-transparent",
};

interface SkillCardProps {
  skill: SkillMeta;
  onDragStart?: (e: React.DragEvent, slug: string) => void;
  authenticated?: boolean;
  onRequestMove?: (skill: SkillMeta) => void;
  onRequestDelete?: (skill: SkillMeta) => void;
}

export function SkillCard({
  skill,
  onDragStart,
  authenticated = false,
  onRequestMove,
  onRequestDelete,
}: SkillCardProps) {
  const accentGradient = AGENT_ACCENT[skill.agent] || AGENT_ACCENT.both;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 只有认证且提供了回调时才显示操作菜单
  const showMenu = authenticated && (onRequestMove || onRequestDelete);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [menuOpen]);

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

        {/* 右上角操作菜单 */}
        {showMenu && (
          <div
            ref={menuRef}
            className="absolute top-2.5 right-2.5 z-10"
            // 阻止按下触发卡片拖拽
            onMouseDown={(e) => e.stopPropagation()}
            onDragStart={(e) => e.preventDefault()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className={`rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.1] transition-all duration-200 ${
                menuOpen ? "opacity-100 bg-white/[0.1] text-white" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              }`}
              aria-label="技能操作"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-32 overflow-hidden rounded-lg border border-white/[0.08] bg-[#16161f] py-1 shadow-xl shadow-black/40"
                role="menu"
              >
                {onRequestMove && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuOpen(false);
                      onRequestMove(skill);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors"
                    role="menuitem"
                  >
                    <FolderInput className="h-4 w-4" />
                    移动分类
                  </button>
                )}
                {onRequestDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuOpen(false);
                      onRequestDelete(skill);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    role="menuitem"
                  >
                    <Trash2 className="h-4 w-4" />
                    删除
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="p-5">
          {/* Header row: badge + version */}
          <div className="flex items-center justify-between mb-3">
            <AgentBadge agent={skill.agent} />
            {/* 认证模式下右上角让位给操作菜单，仅在未显示菜单时展示版本角标 */}
            {skill.version && !showMenu && (
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
