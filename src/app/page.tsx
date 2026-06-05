"use client";

import { useState, useEffect, useMemo, useDeferredValue } from "react";
import { Plus } from "lucide-react";
import { NavBar } from "@/components/nav-bar";
import { SkillCard } from "@/components/skill-card";
import { SkillCardSkeleton } from "@/components/skill-skeleton";
import { EmptyState } from "@/components/empty-state";
import { SkillForm } from "@/components/skill-form";
import type { SkillMeta, CreateSkillInput, AgentType } from "@/lib/types";

export default function Dashboard() {
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data) => {
        setSkills(data.skills || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(() => {
    let result = skills;

    // Agent filter
    if (agentFilter !== "all") {
      result = result.filter((s) => s.agent === agentFilter);
    }

    // Search filter (uses deferred value for performance)
    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          s.triggers?.some((t) => t.toLowerCase().includes(q))
      );
    }

    return result;
  }, [skills, agentFilter, deferredSearch]);

  const handleCreate = async (input: CreateSkillInput) => {
    const res = await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await res.text());

    // Refresh
    const data = await fetch("/api/skills").then((r) => r.json());
    setSkills(data.skills || []);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <NavBar
        searchQuery={search}
        onSearchChange={setSearch}
        agentFilter={agentFilter}
        onAgentFilterChange={setAgentFilter}
        skillCount={filtered.length}
      />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Stats bar */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-white">Skills</h1>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                {skills.filter((s) => s.agent === "claude" || s.agent === "both").length} Claude
              </span>
              <span className="text-zinc-700">·</span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                {skills.filter((s) => s.agent === "hermes" || s.agent === "both").length} Hermes
              </span>
            </div>
          </div>

          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Skill
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkillCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState query={search} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((skill) => (
              <SkillCard key={skill.slug} skill={skill} />
            ))}
          </div>
        )}
      </main>

      <SkillForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        mode="create"
        onSubmit={handleCreate}
      />
    </div>
  );
}
