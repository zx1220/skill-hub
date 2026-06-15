"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  RefreshCw,
  Loader2,
  Download,
  Trash2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import type { LocalSyncAgent, LocalSyncCompareResponse, AgentType } from "@/lib/types";

interface LocalSyncDialogProps {
  open: boolean;
  onClose: () => void;
  agent: LocalSyncAgent;
}

type Phase = "comparing" | "ready" | "deleting" | "installing" | "error";

const AGENT_CONFIG = {
  claude: { label: "Claude Code", accent: "purple" as const },
  hermes: { label: "Hermes", accent: "orange" as const },
};

export function LocalSyncDialog({ open, onClose, agent }: LocalSyncDialogProps) {
  const [phase, setPhase] = useState<Phase>("comparing");
  const [data, setData] = useState<LocalSyncCompareResponse | null>(null);
  const [selectedInstall, setSelectedInstall] = useState<Set<string>>(new Set());
  const [selectedDelete, setSelectedDelete] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [expandInstall, setExpandInstall] = useState(true);
  const [expandDelete, setExpandDelete] = useState(true);
  const [resultMsg, setResultMsg] = useState("");

  const compare = useCallback(async () => {
    setPhase("comparing");
    setError("");
    setResultMsg("");

    try {
      const res = await fetch("/api/skills/sync/local/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Compare failed");
      }

      const result = await res.json() as LocalSyncCompareResponse;
      setData(result);
      setSelectedInstall(new Set());
      setSelectedDelete(new Set());
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compare failed");
      setPhase("error");
    }
  }, [agent]);

  useEffect(() => {
    if (open) compare();
  }, [open, compare]);

  const handleInstall = async () => {
    const slugs = Array.from(selectedInstall);
    if (slugs.length === 0) return;

    setPhase("installing");
    setError("");

    try {
      const res = await fetch("/api/skills/sync/local/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent, slugs }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Install failed");

      const parts: string[] = [];
      if (result.installed > 0) parts.push(`Installed ${result.installed}`);
      if (result.errors?.length > 0) parts.push(`${result.errors.length} failed`);
      setResultMsg(parts.join(", "));
      compare();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Install failed");
      setPhase("ready");
    }
  };

  const handleDelete = async () => {
    const slugs = Array.from(selectedDelete);
    if (slugs.length === 0) return;

    setPhase("deleting");
    setError("");

    try {
      const res = await fetch("/api/skills/sync/local/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent, slugs }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Delete failed");

      const parts: string[] = [];
      if (result.deleted > 0) parts.push(`Deleted ${result.deleted}`);
      if (result.errors?.length > 0) parts.push(`${result.errors.length} failed`);
      setResultMsg(parts.join(", "));
      compare();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setPhase("ready");
    }
  };

  const toggleInstall = (slug: string) => {
    setSelectedInstall((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleDelete = (slug: string) => {
    setSelectedDelete((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleAllInstall = () => {
    if (!data) return;
    if (selectedInstall.size === data.hubOnly.length) {
      setSelectedInstall(new Set());
    } else {
      setSelectedInstall(new Set(data.hubOnly.map((s) => s.slug)));
    }
  };

  const toggleAllDelete = () => {
    if (!data) return;
    if (selectedDelete.size === data.localOnly.length) {
      setSelectedDelete(new Set());
    } else {
      setSelectedDelete(new Set(data.localOnly.map((s) => s.slug)));
    }
  };

  if (!open) return null;

  const config = AGENT_CONFIG[agent];
  const accentCls = config.accent === "purple"
    ? { badge: "bg-purple-500/15 text-purple-400", header: "text-purple-400" }
    : { badge: "bg-orange-500/15 text-orange-400", header: "text-orange-400" };

  const isWorking = phase === "comparing" || phase === "installing" || phase === "deleting";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm pt-8 pb-8 animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#111118] shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <RefreshCw className={`h-5 w-5 ${accentCls.header}`} />
            <h2 className="text-lg font-semibold text-white">
              Sync with {config.label}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isWorking}
            className="rounded-xl p-2 text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all duration-200 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 min-h-[280px] max-h-[70vh] overflow-y-auto">
          {/* Loading states */}
          {phase === "comparing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
              <p className="text-sm text-zinc-400">Comparing skills...</p>
            </div>
          )}

          {phase === "installing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
              <p className="text-sm text-zinc-400">
                Installing {selectedInstall.size} skill(s)...
              </p>
            </div>
          )}

          {phase === "deleting" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 text-red-400 animate-spin" />
              <p className="text-sm text-zinc-400">
                Deleting {selectedDelete.size} skill(s)...
              </p>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertTriangle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={compare}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                Retry
              </button>
            </div>
          )}

          {/* Ready: show comparison results */}
          {phase === "ready" && data && (
            <div className="space-y-4">
              {/* Result message from previous action */}
              {resultMsg && (
                <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-2 text-sm text-green-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {resultMsg}
                </div>
              )}

              {/* Hub Only - Install section */}
              {data.hubOnly.length > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.03] overflow-hidden">
                  <button
                    onClick={() => setExpandInstall(!expandInstall)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandInstall ? (
                        <ChevronDown className="h-4 w-4 text-amber-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-amber-400" />
                      )}
                      <span className="text-sm font-medium text-amber-300">
                        Available to Install
                      </span>
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">
                        {data.hubOnly.length}
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleAllInstall(); }}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      {selectedInstall.size === data.hubOnly.length ? "Deselect All" : "Select All"}
                    </button>
                  </button>

                  {expandInstall && (
                    <div className="px-4 pb-3 space-y-1.5">
                      {data.hubOnly.map((skill) => (
                        <label
                          key={skill.slug}
                          className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                            selectedInstall.has(skill.slug)
                              ? "border-indigo-500/40 bg-indigo-500/5"
                              : "border-white/[0.06] hover:border-white/[0.12]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedInstall.has(skill.slug)}
                            onChange={() => toggleInstall(skill.slug)}
                            className="rounded border-zinc-600 bg-transparent accent-indigo-600"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-white truncate">{skill.name}</span>
                              <AgentBadge agent={skill.agent} />
                            </div>
                            <p className="text-xs text-zinc-500 truncate">{skill.description}</p>
                          </div>
                        </label>
                      ))}

                      <div className="flex justify-end pt-2">
                        <button
                          onClick={handleInstall}
                          disabled={selectedInstall.size === 0}
                          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-2 text-sm font-medium text-white hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 transition-all duration-200"
                        >
                          <Download className="h-4 w-4" />
                          Install {selectedInstall.size > 0 ? `(${selectedInstall.size})` : ""}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Local Only - Delete section */}
              {data.localOnly.length > 0 && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/[0.03] overflow-hidden">
                  <button
                    onClick={() => setExpandDelete(!expandDelete)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandDelete ? (
                        <ChevronDown className="h-4 w-4 text-red-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-red-red-400" />
                      )}
                      <span className="text-sm font-medium text-red-300">
                        Local Only (Not in Hub)
                      </span>
                      <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">
                        {data.localOnly.length}
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleAllDelete(); }}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      {selectedDelete.size === data.localOnly.length ? "Deselect All" : "Select All"}
                    </button>
                  </button>

                  {expandDelete && (
                    <div className="px-4 pb-3 space-y-1.5">
                      {data.localOnly.map((skill) => (
                        <label
                          key={skill.slug}
                          className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                            selectedDelete.has(skill.slug)
                              ? "border-red-500/40 bg-red-500/5"
                              : "border-white/[0.06] hover:border-white/[0.12]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedDelete.has(skill.slug)}
                            onChange={() => toggleDelete(skill.slug)}
                            className="rounded border-zinc-600 bg-transparent accent-red-600"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-white truncate block">{skill.name}</span>
                            <p className="text-xs text-zinc-600 truncate">{skill.path}</p>
                          </div>
                        </label>
                      ))}

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                          <AlertTriangle className="h-3 w-3" />
                          Will delete local folders
                        </div>
                        <button
                          onClick={handleDelete}
                          disabled={selectedDelete.size === 0}
                          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-all duration-200"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete {selectedDelete.size > 0 ? `(${selectedDelete.size})` : ""}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Synced summary */}
              {data.synced.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/15 bg-green-500/[0.03] px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                  <span className="text-sm text-green-300">
                    {data.synced.length} skill(s) already synced
                  </span>
                </div>
              )}

              {/* Empty state */}
              {data.hubOnly.length === 0 && data.localOnly.length === 0 && data.synced.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-zinc-500">No skills found on either side</p>
                </div>
              )}

              {/* Re-compare button */}
              <div className="flex justify-end">
                <button
                  onClick={compare}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Re-compare
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AgentBadge({ agent }: { agent: AgentType }) {
  const cls =
    agent === "claude"
      ? "bg-purple-500/15 text-purple-400"
      : agent === "hermes"
        ? "bg-orange-500/15 text-orange-400"
        : "bg-indigo-500/15 text-indigo-400";

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cls}`}>
      {agent === "claude" ? "Claude" : agent === "hermes" ? "Hermes" : "Both"}
    </span>
  );
}
