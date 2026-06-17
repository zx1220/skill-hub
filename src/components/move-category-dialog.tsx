"use client";

import { useState } from "react";
import { X, FolderInput, Check, Loader2 } from "lucide-react";
import type { SkillMeta } from "@/lib/types";

interface MoveCategoryDialogProps {
  open: boolean;
  skill: SkillMeta | null;
  categories: string[];
  onClose: () => void;
  onMoved: () => void;
}

const UNCATEGORIZED = "__uncategorized__";

export function MoveCategoryDialog({ open, skill, categories, onClose, onMoved }: MoveCategoryDialogProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  // No reset effect: the parent mounts this with key={moveTarget?.slug ?? "closed"},
  // so every open is a fresh instance with clean loading/error state.
  if (!open || !skill) return null;

  const current = skill.category ?? null;

  const moveTo = async (category: string | null) => {
    const key = category ?? UNCATEGORIZED;
    if (loading) return;
    setLoading(key);
    setError("");
    try {
      const res = await fetch(`/api/skills/${skill.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "移动失败");
      }
      onMoved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(null);
    }
  };

  const options: (string | null)[] = [...categories, null];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#111118] shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <FolderInput className="h-5 w-5 text-indigo-400" />
            移动分类
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className="text-sm text-zinc-500">
            将「<span className="text-zinc-300">{skill.name}</span>」移动到：
          </p>

          {error && (
            <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="mt-3 max-h-72 overflow-y-auto space-y-1.5">
            {options.map((cat) => {
              const key = cat ?? UNCATEGORIZED;
              const isActive = current === cat;
              const isLoading = loading === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => moveTo(cat)}
                  disabled={loading !== null}
                  className={`flex items-center justify-between w-full rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "border-indigo-500/40 bg-indigo-500/10 text-white"
                      : "border-white/[0.06] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05] hover:text-white"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {isLoading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-400" />}
                    {cat === null ? (
                      <span className="text-zinc-500 italic">未分类</span>
                    ) : (
                      <span className="truncate">{cat}</span>
                    )}
                  </span>
                  {isActive && <Check className="h-4 w-4 shrink-0 text-indigo-400" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
