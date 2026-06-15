"use client";

export function SkillCardSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111118] overflow-hidden">
      {/* Accent bar skeleton */}
      <div className="h-[2px] bg-white/[0.03]" />

      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 w-20 rounded-full bg-white/[0.04] animate-pulse" />
          <div className="h-3 w-8 rounded bg-white/[0.04] animate-pulse" />
        </div>
        <div className="h-[15px] w-2/3 rounded bg-white/[0.04] animate-pulse mb-2" />
        <div className="h-[13px] w-full rounded bg-white/[0.04] animate-pulse mb-1" />
        <div className="h-[13px] w-4/5 rounded bg-white/[0.04] animate-pulse mb-3.5" />
        <div className="flex gap-1.5 mb-3.5">
          <div className="h-5 w-12 rounded bg-white/[0.04] animate-pulse" />
          <div className="h-5 w-14 rounded bg-white/[0.04] animate-pulse" />
          <div className="h-5 w-10 rounded bg-white/[0.04] animate-pulse" />
        </div>
        <div className="pt-3 border-t border-white/[0.03] flex justify-between">
          <div className="h-3 w-16 rounded bg-white/[0.04] animate-pulse" />
          <div className="h-3 w-10 rounded bg-white/[0.04] animate-pulse" />
        </div>
      </div>
    </div>
  );
}
