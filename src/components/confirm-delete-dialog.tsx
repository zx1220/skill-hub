"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmDeleteDialogProps {
  open: boolean;
  skillName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmDeleteDialog({ open, skillName, onClose, onConfirm }: ConfirmDeleteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setLoading(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#111118] p-6 shadow-2xl animate-scale-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 shrink-0 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">删除「{skillName}」?</h3>
            <p className="text-sm text-zinc-500">此操作不可撤销。</p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400 mb-4">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "删除中..." : "确认删除"}
          </button>
        </div>
      </div>
    </div>
  );
}
