"use client";

import { useState } from "react";
import { X, FileText } from "lucide-react";
import { TagInput } from "./tag-input";
import type { AgentType, CreateSkillInput } from "@/lib/types";

interface SkillFormProps {
  open: boolean;
  onClose: () => void;
  initial?: Partial<CreateSkillInput>;
  mode: "create" | "edit";
  onSubmit: (data: CreateSkillInput) => Promise<void>;
}

const INPUT_CLASS = "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/50 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200";

export function SkillForm({ open, onClose, initial, mode, onSubmit }: SkillFormProps) {
  const [name, setName] = useState(initial?.name || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [triggers, setTriggers] = useState<string[]>(initial?.triggers || []);
  const [agent, setAgent] = useState<AgentType>(initial?.agent || "claude");
  const [content, setContent] = useState(initial?.content || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto-generate slug from name
  const handleNameChange = (v: string) => {
    setName(v);
    if (mode === "create") {
      setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSubmit({ name, slug, description, triggers, agent, content });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm pt-8 pb-8 animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-[#111118] shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            {mode === "create" ? "Add New Skill" : `Edit: ${name}`}
          </h2>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name + Slug row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="My Awesome Skill"
                required
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Slug <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-awesome-skill"
                required
                spellCheck={false}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Description <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this skill does..."
              required
              className={INPUT_CLASS}
            />
          </div>

          {/* Trigger words */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Trigger Words
            </label>
            <TagInput tags={triggers} onChange={setTriggers} placeholder="Type a trigger word and press Enter..." />
          </div>

          {/* Agent */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Agent <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-3">
              {(["claude", "hermes", "both"] as const).map((a) => (
                <label
                  key={a}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm cursor-pointer transition-all duration-200 ${
                    agent === a
                      ? "border-indigo-500/40 bg-indigo-500/10 text-white shadow-sm shadow-indigo-500/10"
                      : "border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:bg-white/[0.03]"
                  }`}
                >
                  <input
                    type="radio"
                    name="agent"
                    value={a}
                    checked={agent === a}
                    onChange={() => setAgent(a)}
                    className="sr-only"
                  />
                  {a === "claude" ? "Claude Code" : a === "hermes" ? "Hermes" : "Both"}
                </label>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              SKILL.md Content <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`---\nname: ${name || "my-skill"}\ndescription: "${description || "..."}"\n---\n\n# My Skill\n\nInstructions here...`}
                required
                rows={12}
                spellCheck={false}
                className={`${INPUT_CLASS} font-mono resize-y min-h-[200px]`}
              />
            </div>
            <p className="mt-1.5 text-xs text-zinc-600 flex items-center gap-1.5">
              <FileText className="h-3 w-3" />
              Frontmatter (---) will be auto-generated from fields above. Write the body content here.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.08] px-4 py-2.5 text-sm text-red-400 animate-scale-in">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-2 text-sm font-medium text-white hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-500/20 disabled:shadow-none disabled:opacity-50 transition-all duration-200"
            >
              {loading
                ? "Saving..."
                : mode === "create"
                ? "Create Skill"
                : "Update Skill"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
