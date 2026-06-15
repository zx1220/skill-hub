"use client";

import { useState, useMemo } from "react";
import { X, Copy, Check, Terminal } from "lucide-react";
import type { SkillMeta, LocalSyncAgent } from "@/lib/types";

interface InstallLocalDialogProps {
  open: boolean;
  onClose: () => void;
  skills: SkillMeta[];
  /** Pre-selected slugs (e.g. from detail page) */
  defaultSelected?: string[];
}

const AGENT_OPTIONS: { value: LocalSyncAgent; label: string; path: string }[] = [
  { value: "claude", label: "Claude Code", path: "~/.claude/skills" },
  { value: "hermes", label: "Hermes", path: "~/.hermes/skills" },
];

export function InstallLocalDialog({
  open,
  onClose,
  skills,
  defaultSelected,
}: InstallLocalDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(
    defaultSelected ? new Set(defaultSelected) : new Set(skills.map((s) => s.slug))
  );
  const [agent, setAgent] = useState<LocalSyncAgent>("claude");
  const [copied, setCopied] = useState(false);

  const agentPath = AGENT_OPTIONS.find((a) => a.value === agent)!.path;

  const toggleSkill = (slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === skills.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(skills.map((s) => s.slug)));
    }
  };

  const script = useMemo(() => {
    const hubUrl = typeof window !== "undefined" ? window.location.origin : "";
    const slugs = skills
      .filter((s) => selected.has(s.slug))
      .map((s) => s.slug);
    if (slugs.length === 0) return "";

    const slugsStr = slugs.map((s) => `"${s}"`).join(" ");

    return `#!/bin/bash
# Skill Hub - 批量安装技能到本地
# 目标目录: ${agentPath}

HUB_URL="${hubUrl}"
TARGET_DIR="$HOME/${agentPath.replace("~/", "")}"
SKILLS=(${slugsStr})

mkdir -p "\$TARGET_DIR"

for slug in "\${SKILLS[@]}"; do
  echo "⬇  Installing \$slug..."
  curl -sL "\$HUB_URL/api/skills/\$slug/download" -o "/tmp/skill-hub-\$slug.zip"
  if unzip -qo "/tmp/skill-hub-\$slug.zip" -d "\$TARGET_DIR" 2>/dev/null; then
    rm -f "/tmp/skill-hub-\$slug.zip"
    echo "  ✅ \$slug installed"
  else
    rm -f "/tmp/skill-hub-\$slug.zip"
    echo "  ❌ \$slug failed"
  fi
done

echo ""
echo "Done! \${#SKILLS[@]} skill(s) installed to \$TARGET_DIR"`;
  }, [skills, selected, agent, agentPath]);

  const handleCopy = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm pt-8 pb-8 animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#111118] shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Terminal className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">安装到本地</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Agent selector */}
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-2 block">安装到</label>
            <div className="flex gap-2">
              {AGENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAgent(opt.value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-all duration-200 ${
                    agent === opt.value
                      ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                      : "border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="block font-medium">{opt.label}</span>
                  <span className="text-[11px] text-zinc-500 font-mono">{opt.path}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Skill list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-zinc-300">选择技能</label>
              <button
                onClick={toggleAll}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {selected.size === skills.length ? "取消全选" : "全选"}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
              {skills.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">暂无技能</p>
              ) : (
                skills.map((skill) => (
                  <label
                    key={skill.slug}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                      selected.has(skill.slug)
                        ? "bg-indigo-500/10"
                        : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(skill.slug)}
                      onChange={() => toggleSkill(skill.slug)}
                      className="rounded border-zinc-600 bg-transparent accent-indigo-600"
                    />
                    <span className="text-sm text-zinc-200 truncate flex-1">{skill.name}</span>
                    <span className="text-[11px] text-zinc-600 font-mono">{skill.slug}</span>
                  </label>
                ))
              )}
            </div>
            <p className="text-xs text-zinc-600 mt-1.5">
              已选 {selected.size} / {skills.length} 个技能
            </p>
          </div>

          {/* Generated script */}
          {selected.size > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-zinc-300">复制以下脚本到终端执行</label>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      复制脚本
                    </>
                  )}
                </button>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[#0a0a12] p-4 max-h-52 overflow-auto">
                <pre className="text-xs font-mono text-zinc-400 leading-relaxed whitespace-pre-wrap">
                  {script}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
