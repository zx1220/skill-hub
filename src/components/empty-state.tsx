"use client";

import { PackageOpen } from "lucide-react";

export function EmptyState({ query }: { query?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="h-16 w-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-6">
        <PackageOpen className="h-8 w-8 text-zinc-600" />
      </div>
      {query ? (
        <>
          <h3 className="text-lg font-medium text-zinc-300 mb-2">No skills found</h3>
          <p className="text-sm text-zinc-500 max-w-sm">
            No skills match &ldquo;{query}&rdquo;. Try a different search term.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-medium text-zinc-300 mb-2">No skills yet</h3>
          <p className="text-sm text-zinc-500 max-w-sm">
            Add your first skill to the registry to get started.
          </p>
        </>
      )}
    </div>
  );
}
