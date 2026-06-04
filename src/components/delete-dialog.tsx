"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

interface DeleteDialogProps {
  open: boolean;
  onClose: () => void;
  skillName: string;
  skillSlug: string;
  onConfirm: () => Promise<void>;
}

export function DeleteDialog({ open, onClose, skillName, skillSlug, onConfirm }: DeleteDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canDelete = confirmText === skillSlug;

  const handleDelete = async () => {
    if (!canDelete) return;
    setLoading(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#111118] p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Delete &ldquo;{skillName}&rdquo;?</h3>
            <p className="text-sm text-zinc-500">This action cannot be undone.</p>
          </div>
        </div>

        <p className="text-sm text-zinc-400 mb-4">
          Type <code className="px-1.5 py-0.5 rounded bg-white/5 text-indigo-400 font-mono text-xs">{skillSlug}</code> to confirm:
        </p>

        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={skillSlug}
          spellCheck={false}
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-mono text-zinc-200 placeholder:text-zinc-600 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/40 mb-4"
          aria-label="Type skill slug to confirm deletion"
        />

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400 mb-4">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete || loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Deleting..." : "Delete Forever"}
          </button>
        </div>
      </div>
    </div>
  );
}
