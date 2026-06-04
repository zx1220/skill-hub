"use client";

export function SkillCardSkeleton() {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#111118] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 w-20 rounded-full bg-white/5 animate-pulse" />
        <div className="h-4 w-10 rounded bg-white/5 animate-pulse" />
      </div>
      <div className="h-5 w-2/3 rounded bg-white/5 animate-pulse mb-2" />
      <div className="h-4 w-full rounded bg-white/5 animate-pulse mb-1" />
      <div className="h-4 w-4/5 rounded bg-white/5 animate-pulse mb-3" />
      <div className="flex gap-1.5 mb-3">
        <div className="h-5 w-12 rounded bg-white/5 animate-pulse" />
        <div className="h-5 w-14 rounded bg-white/5 animate-pulse" />
        <div className="h-5 w-10 rounded bg-white/5 animate-pulse" />
      </div>
      <div className="pt-3 border-t border-white/[0.04] flex justify-between">
        <div className="h-3 w-16 rounded bg-white/5 animate-pulse" />
        <div className="h-3 w-10 rounded bg-white/5 animate-pulse" />
      </div>
    </div>
  );
}
