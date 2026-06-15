"use client";

import { useState, useEffect, useMemo, useDeferredValue, useCallback } from "react";
import { Upload, ChevronDown, ChevronRight, Settings, Terminal } from "lucide-react";
import { NavBar } from "@/components/nav-bar";
import { SkillCard } from "@/components/skill-card";
import { SkillCardSkeleton } from "@/components/skill-skeleton";
import { EmptyState } from "@/components/empty-state";
import { SkillForm } from "@/components/skill-form";
import { ImportDialog } from "@/components/import-dialog";
import { CategoryManager } from "@/components/category-manager";
import { InstallLocalDialog } from "@/components/install-local-dialog";
import type { SkillMeta, CreateSkillInput } from "@/lib/types";

export default function Dashboard() {
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [skillFormOpen, setSkillFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [installLocalOpen, setInstallLocalOpen] = useState(false);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [draggingSlug, setDraggingSlug] = useState<string | null>(null);

  // Check auth status on mount
  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => setAuthenticated(data.authenticated === true))
      .catch(() => setAuthenticated(false));
  }, []);

  const loadSkills = useCallback(() => {
    setLoading(true);
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data) => {
        setSkills(data.skills || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadCategories = useCallback(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data.map((c: { name: string }) => c.name));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadSkills();
    loadCategories();
  }, [loadSkills, loadCategories]);

  const deferredSearch = useDeferredValue(search);

  const filteredSkills = useMemo(() => {
    if (!deferredSearch.trim()) return skills;
    const q = deferredSearch.toLowerCase();
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        s.triggers?.some((t) => t.toLowerCase().includes(q))
    );
  }, [skills, deferredSearch]);

  // Group skills by category
  const groupedSkills = useMemo(() => {
    const groups: { category: string; skills: SkillMeta[] }[] = [];
    const uncategorized: SkillMeta[] = [];
    const categorized = new Map<string, SkillMeta[]>();

    for (const skill of filteredSkills) {
      if (skill.category) {
        const list = categorized.get(skill.category) || [];
        list.push(skill);
        categorized.set(skill.category, list);
      } else {
        uncategorized.push(skill);
      }
    }

    // Ordered by categories from DB (show even if empty)
    const nonEmpty: { category: string; skills: SkillMeta[] }[] = [];
    const empty: { category: string; skills: SkillMeta[] }[] = [];
    for (const cat of categories) {
      const items = categorized.get(cat);
      const group = { category: cat, skills: items || [] };
      if (items && items.length > 0) {
        nonEmpty.push(group);
      } else {
        empty.push(group);
      }
    }
    groups.push(...nonEmpty);
    // Also include categories not in the DB list (edge case)
    for (const [cat, items] of categorized) {
      if (!categories.includes(cat)) {
        groups.push({ category: cat, skills: items });
      }
    }
    // Empty categories at the bottom
    groups.push(...empty);
    // Store uncategorized separately (no group header, flat display)
    if (uncategorized.length > 0) {
      groups.push({ category: "__uncategorized__", skills: uncategorized });
    }

    return groups;
  }, [filteredSkills, categories]);

  const hasAnyCategory = useMemo(
    () => skills.some((s) => s.category),
    [skills]
  );

  const toggleGroup = (category: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleCreateSkill = async (input: CreateSkillInput) => {
    const res = await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      try {
        const err = await res.json();
        throw new Error(err.error || `Request failed (${res.status})`);
      } catch (e) {
        if (e instanceof Error) throw e;
        throw new Error(`Request failed (${res.status})`);
      }
    }
    const data = await fetch("/api/skills").then((r) => r.json());
    setSkills(data.skills || []);
  };

  // --- Drag and Drop ---
  const handleDragStart = (e: React.DragEvent, slug: string) => {
    setDraggingSlug(slug);
  };

  const handleDragEnd = () => {
    setDraggingSlug(null);
    setDragOverCategory(null);
  };

  const handleDragOver = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCategory(category);
  };

  const handleDragLeave = () => {
    setDragOverCategory(null);
  };

  const handleDrop = async (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    const slug = e.dataTransfer.getData("text/plain");
    if (!slug) return;

    const categoryValue = targetCategory === "__uncategorized__" ? null : targetCategory;

    // Optimistic update
    setSkills((prev) =>
      prev.map((s) => (s.slug === slug ? { ...s, category: categoryValue ?? undefined } : s))
    );

    setDragOverCategory(null);
    setDraggingSlug(null);

    // Persist to server
    try {
      const res = await fetch(`/api/skills/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: categoryValue }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      // Revert on failure
      loadSkills();
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]" onDragOver={(e) => e.preventDefault()} onDrop={handleDragEnd}>
      <NavBar
        searchQuery={search}
        onSearchChange={setSearch}
        itemCount={filteredSkills.length}
      />

      <main className="mx-auto max-w-7xl px-6 py-8 animate-fade-in-up">
        {/* Stats bar */}
        <div className="flex items-center justify-between mb-8">
          <div />

          <div className="flex items-center gap-2">
            {authenticated && (
              <button
                onClick={() => setCategoryManagerOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-2 text-sm font-medium text-white hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-200"
              >
                <Settings className="h-4 w-4" />
                分类管理
              </button>
            )}
            {authenticated && (
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-2 text-sm font-medium text-white hover:from-amber-500 hover:to-amber-400 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all duration-200"
              >
                <Upload className="h-4 w-4" />
                导入技能
              </button>
            )}
            {skills.length > 0 && (
              <button
                onClick={() => setInstallLocalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 text-sm font-medium text-white hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-200"
              >
                <Terminal className="h-4 w-4" />
                安装到本地
              </button>
            )}
          </div>
        </div>

        {/* Drag hint */}
        {draggingSlug && (
          <div className="mb-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 text-xs text-indigo-300 text-center">
            拖拽技能到目标分类标题上松开即可移动
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkillCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredSkills.length === 0 ? (
          <EmptyState query={search} />
        ) : hasAnyCategory || groupedSkills.some((g) => g.category !== "__uncategorized__") ? (
          // Grouped display
          <div className="space-y-6">
            {groupedSkills.map(({ category, skills: groupSkills }) => {
              // Uncategorized skills: flat grid, no group header
              if (category === "__uncategorized__") {
                return (
                  <div
                    key="__uncategorized__"
                    onDragOver={(e) => handleDragOver(e, category)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, category)}
                    className={`rounded-xl transition-colors p-1 -m-1 ${
                      dragOverCategory === category && draggingSlug
                        ? "bg-white/[0.03] border-2 border-dashed border-white/[0.15]"
                        : ""
                    }`}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {groupSkills.map((skill) => (
                        <SkillCard key={skill.slug} skill={skill} onDragStart={handleDragStart} />
                      ))}
                    </div>
                  </div>
                );
              }
              const isCollapsed = collapsedGroups.has(category);
              const isDragOver = dragOverCategory === category && draggingSlug;
              return (
                <div
                  key={category}
                  onDragOver={(e) => handleDragOver(e, category)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, category)}
                  className={`rounded-xl transition-colors ${isDragOver ? "bg-indigo-500/[0.04] ring-1 ring-indigo-500/20 ring-inset" : ""}`}
                >
                  <button
                    onClick={() => toggleGroup(category)}
                    className={`flex items-center gap-2 mb-3 group cursor-pointer w-full rounded-lg px-2 py-1 -mx-2 transition-colors ${
                      isDragOver
                        ? "bg-indigo-500/10"
                        : "hover:bg-white/[0.02]"
                    }`}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                    )}
                    <h3 className="text-sm font-semibold text-zinc-300 group-hover:text-white transition-colors">
                      {category}
                    </h3>
                    <span className="text-xs text-zinc-600 bg-zinc-800/50 rounded-full px-2 py-0.5">
                      {groupSkills.length}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {groupSkills.map((skill) => (
                        <SkillCard key={skill.slug} skill={skill} onDragStart={handleDragStart} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // Flat grid when no categories exist
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSkills.map((skill) => (
              <SkillCard key={skill.slug} skill={skill} onDragStart={handleDragStart} />
            ))}
          </div>
        )}
      </main>

      <SkillForm
        open={skillFormOpen}
        onClose={() => setSkillFormOpen(false)}
        mode="create"
        onSubmit={handleCreateSkill}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          fetch("/api/skills")
            .then((r) => r.json())
            .then((data) => setSkills(data.skills || []));
        }}
      />

      <CategoryManager
        open={categoryManagerOpen}
        onClose={() => {
          setCategoryManagerOpen(false);
          loadCategories();
          loadSkills();
        }}
      />

      <InstallLocalDialog
        open={installLocalOpen}
        onClose={() => setInstallLocalOpen(false)}
        skills={skills}
      />
    </div>
  );
}
