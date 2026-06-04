"use client";

export function TriggerTags({ triggers }: { triggers?: string[] }) {
  if (!triggers?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {triggers.slice(0, 5).map((tag) => (
        <span
          key={tag}
          className="rounded bg-white/5 px-2 py-0.5 text-xs font-mono text-zinc-400 border border-white/5"
        >
          {tag}
        </span>
      ))}
      {triggers.length > 5 && (
        <span className="rounded bg-white/5 px-2 py-0.5 text-xs font-mono text-zinc-500">
          +{triggers.length - 5}
        </span>
      )}
    </div>
  );
}
