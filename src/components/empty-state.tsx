"use client";

import { PackageOpen, Search } from "lucide-react";

export function EmptyState({ query }: { query?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in-up">
      <div className="relative mb-6">
        {/* Glow background */}
        <div className="absolute inset-0 rounded-3xl bg-indigo-500/[0.06] blur-xl scale-150" />
        <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] flex items-center justify-center">
          {query ? (
            <Search className="h-7 w-7 text-zinc-500" />
          ) : (
            <PackageOpen className="h-7 w-7 text-zinc-500" />
          )}
        </div>
      </div>
      {query ? (
        <>
          <h3 className="text-lg font-medium text-zinc-300 mb-2">No results found</h3>
          <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">
            Nothing matches &ldquo;<span className="text-indigo-400 font-medium">{query}</span>&rdquo;. Try a different search term.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-medium text-zinc-300 mb-2">Nothing here yet</h3>
          <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">
            Get started by adding your first skill to the registry.
          </p>
        </>
      )}
    </div>
  );
}
