"use client";

import { useState, useEffect, use } from "react";
import { ArrowLeft, Edit, Trash2, File, FolderOpen } from "lucide-react";
import Link from "next/link";
import { AgentBadge } from "@/components/agent-badge";
import { TriggerTags } from "@/components/trigger-tags";
import { CodeBlock } from "@/components/code-block";
import { SkillForm } from "@/components/skill-form";
import { DeleteDialog } from "@/components/delete-dialog";
import type { SkillDetail, CreateSkillInput } from "@/lib/types";

export default function SkillDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/skills/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setSkill(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  const handleUpdate = async (input: CreateSkillInput) => {
    const res = await fetch(`/api/skills/${slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await res.text());
    // Refresh
    const data = await fetch(`/api/skills/${slug}`).then((r) => r.json());
    setSkill(data);
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/skills/${slug}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4">
        <h1 className="text-xl text-white">Skill not found</h1>
        <Link href="/" className="text-sm text-indigo-400 hover:text-indigo-300">
          ← Back to Skills
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Nav */}
      <div className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Skills
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Edit className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <AgentBadge agent={skill.agent} />
            {skill.version && (
              <span className="text-xs text-zinc-500 font-mono">v{skill.version}</span>
            )}
          </div>
          <h1 className="text-3xl font-semibold text-white mb-2">{skill.name}</h1>
          <p className="text-zinc-400 text-lg">{skill.description}</p>
        </div>

        {/* Install command */}
        <div className="mb-8">
          <CodeBlock code={skill.installCmd} label="Install" />
        </div>

        {/* Trigger words */}
        {skill.triggers?.length && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Trigger Words</h3>
            <div className="flex flex-wrap gap-2">
              {skill.triggers.map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-white/5 border border-white/[0.06] px-3 py-1 text-sm font-mono text-zinc-300"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Separator */}
        <div className="border-t border-white/[0.04] my-8" />

        {/* SKILL.md preview */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">SKILL.md</h3>
          <div className="rounded-lg border border-white/[0.06] bg-[#0a0a0f] p-6 overflow-auto max-h-[600px]">
            <pre className="text-sm font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {skill.content}
            </pre>
          </div>
        </div>

        {/* Files */}
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Files</h3>
          <div className="rounded-lg border border-white/[0.06] bg-[#111118] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-zinc-500" />
              <span className="text-sm font-mono text-zinc-400">{skill.slug}/</span>
            </div>
            {skill.files.map((f) => (
              <div key={f} className="px-4 py-2 flex items-center gap-2 hover:bg-white/[0.02]">
                <File className="h-4 w-4 text-zinc-600" />
                <span className="text-sm font-mono text-zinc-400">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <SkillForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        mode="edit"
        initial={{
          name: skill.name,
          slug: skill.slug,
          description: skill.description,
          triggers: skill.triggers || [],
          agent: skill.agent,
          content: skill.content,
        }}
        onSubmit={handleUpdate}
      />

      <DeleteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        skillName={skill.name}
        skillSlug={skill.slug}
        onConfirm={handleDelete}
      />
    </div>
  );
}
