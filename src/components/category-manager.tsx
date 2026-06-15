"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Pencil, Trash2, Check, Loader2 } from "lucide-react";

interface CategoryItem {
  name: string;
  sort_order: number;
}

interface CategoryManagerProps {
  open: boolean;
  onClose: () => void;
}

export function CategoryManager({ open, onClose }: CategoryManagerProps) {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [newName, setNewName] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    fetchCategories();
  }, [open]);

  useEffect(() => {
    if (editingIdx !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingIdx]);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch { /* ignore */ }
  };

  if (!open) return null;

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        setNewName("");
        await fetchCategories();
      } else {
        const data = await res.json();
        alert(data.error || "添加失败");
      }
    } catch {
      alert("添加失败");
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (oldName: string) => {
    if (!editName.trim() || editName.trim() === oldName) {
      setEditingIdx(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(oldName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName: editName.trim() }),
      });
      if (res.ok) {
        setEditingIdx(null);
        await fetchCategories();
      } else {
        const data = await res.json();
        alert(data.error || "重命名失败");
      }
    } catch {
      alert("重命名失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`确定删除分类「${name}」？该分类下技能将变为未分类。`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchCategories();
      } else {
        const data = await res.json();
        alert(data.error || "删除失败");
      }
    } catch {
      alert("删除失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm pt-8 pb-8 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#111118] shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h2 className="text-lg font-semibold text-white">分类管理</h2>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Category list */}
        <div className="p-6 space-y-3">
          {categories.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-6">暂无分类</p>
          ) : (
            <div className="space-y-2">
              {categories.map((cat, idx) => (
                <div
                  key={cat.name}
                  className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 group"
                >
                  {editingIdx === idx ? (
                    <>
                      <input
                        ref={editInputRef}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(cat.name);
                          if (e.key === "Escape") setEditingIdx(null);
                        }}
                        className="flex-1 bg-transparent border-b border-indigo-500/50 text-sm text-white outline-none py-0.5"
                      />
                      <button
                        onClick={() => handleRename(cat.name)}
                        disabled={loading}
                        className="p-1 text-green-400 hover:text-green-300 transition-colors"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => setEditingIdx(null)}
                        className="p-1 text-zinc-500 hover:text-white transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-zinc-200 truncate">{cat.name}</span>
                      <button
                        onClick={() => {
                          setEditingIdx(idx);
                          setEditName(cat.name);
                        }}
                        className="p-1 text-zinc-600 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="重命名"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.name)}
                        className="p-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add new category */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/[0.06]">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="新分类名称..."
              className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || loading}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              添加
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
