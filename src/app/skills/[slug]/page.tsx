"use client";

import { useState, useEffect, use } from "react";
import { ArrowLeft, Edit, Trash2, File, FolderOpen, Download, Copy, Check, Terminal } from "lucide-react";
import Link from "next/link";
import { AgentBadge } from "@/components/agent-badge";
import { CodeBlock } from "@/components/code-block";
import { SkillForm } from "@/components/skill-form";
import { DeleteDialog } from "@/components/delete-dialog";
import { InstallLocalDialog } from "@/components/install-local-dialog";
import type { SkillDetail, CreateSkillInput } from "@/lib/types";

const AGENT_BG_ACCENT: Record<string, string> = {
  claude: "from-purple-500/[0.08] via-transparent to-transparent",
  hermes: "from-orange-500/[0.08] via-transparent to-transparent",
  both: "from-indigo-500/[0.08] via-transparent to-transparent",
};

export default function SkillDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [installLocalOpen, setInstallLocalOpen] = useState(false);

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
    const data = await fetch(`/api/skills/${slug}`).then((r) => r.json());
    setSkill(data);
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/skills/${slug}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    window.location.href = "/";
  };

  const handleDownload = async () => {
    const res = await fetch(`/api/skills/${slug}/download`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySyncCmd = () => {
    const cmd = `skill-sync pull ${slug}`;
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4 animate-fade-in-up">
        <h1 className="text-xl text-white">Skill not found</h1>
        <Link href="/" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
          ← Back to Skills
        </Link>
      </div>
    );
  }

  const bgAccent = AGENT_BG_ACCENT[skill.agent] || AGENT_BG_ACCENT.both;

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
            {skill && (
              <button
                onClick={() => setInstallLocalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-200"
                title="安装到本地"
              >
                <Terminal className="h-3.5 w-3.5" />
                安装到本地
              </button>
            )}
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-3 py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-200"
              title="Download skill files"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-3 py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-200"
            >
              <Edit className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-red-500/20 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all duration-200"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-10 animate-fade-in-up">
        {/* Header with gradient accent */}
        <div className={`relative mb-10 rounded-2xl bg-gradient-to-br ${bgAccent} border border-white/[0.04] p-8 overflow-hidden`}>
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <AgentBadge agent={skill.agent} />
              {skill.version && (
                <span className="text-xs text-zinc-500 font-mono px-2 py-0.5 rounded-md bg-white/[0.04]">v{skill.version}</span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">{skill.name}</h1>
            <p className="text-zinc-400 text-lg leading-relaxed">{skill.description}</p>
          </div>
        </div>

        {/* Install command */}
        <div className="mb-8">
          <CodeBlock code={skill.installCmd} label="Install" />
        </div>

        {/* CLI Sync command */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-medium text-zinc-300">CLI Sync</h3>
            <button
              onClick={handleCopySyncCmd}
              className="rounded-lg p-1.5 text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
              title="Copy command"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-[#111118] px-4 py-3 hover:border-white/[0.1] transition-colors">
            <code className="text-sm font-mono text-indigo-400">skill-sync pull {slug}</code>
          </div>
        </div>

        {/* Trigger words */}
        {skill.triggers?.length && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Trigger Words</h3>
            <div className="flex flex-wrap gap-2">
              {skill.triggers.map((t) => (
                <span
                  key={t}
                  className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-1 text-sm font-mono text-zinc-300 hover:bg-white/[0.06] transition-colors"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Separator */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent my-10" />

        {/* SKILL.md preview */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
            <span className="h-1 w-4 rounded-full bg-indigo-500/50" />
            SKILL.md
          </h3>
          <div className="rounded-xl border border-white/[0.06] bg-[#0d0d14] p-6 overflow-auto max-h-[600px] hover:border-white/[0.1] transition-colors">
            <pre className="text-sm font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {skill.content}
            </pre>
          </div>
        </div>

        {/* Files */}
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
            <span className="h-1 w-4 rounded-full bg-indigo-500/50" />
            Files
          </h3>
          <div className="rounded-xl border border-white/[0.06] bg-[#111118] overflow-hidden hover:border-white/[0.1] transition-colors">
            <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center gap-2 bg-white/[0.01]">
              <FolderOpen className="h-4 w-4 text-zinc-500" />
              <span className="text-sm font-mono text-zinc-400">{skill.slug}/</span>
            </div>
            {skill.files.map((f) => (
              <div key={f} className="px-4 py-2.5 flex items-center gap-2 hover:bg-white/[0.02] transition-colors">
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

      {skill && (
        <InstallLocalDialog
          open={installLocalOpen}
          onClose={() => setInstallLocalOpen(false)}
          skills={[{
            name: skill.name,
            slug: skill.slug,
            description: skill.description,
            version: skill.version,
            triggers: skill.triggers,
            agent: skill.agent,
            path: skill.path,
            updatedAt: skill.updatedAt,
            files: skill.files,
            category: skill.category,
          }]}
          defaultSelected={[skill.slug]}
        />
      )}
    </div>
  );
}
