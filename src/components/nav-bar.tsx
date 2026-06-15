"use client";

import { Search, Sparkles } from "lucide-react";
import Link from "next/link";

interface NavBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  itemCount: number;
}

export function NavBar({
  searchQuery,
  onSearchChange,
  itemCount,
}: NavBarProps) {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-16 items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow">
              <Sparkles className="h-4 w-4 text-white" />
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" style={{ mixBlendMode: "overlay" }} />
            </div>
            <span className="text-lg font-semibold text-white hidden sm:inline tracking-tight">
              Skill<span className="text-gradient-indigo">Hub</span>
            </span>
          </Link>

          {/* Search */}
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 transition-colors group-focus-within:text-indigo-400" />
            <input
              type="text"
              placeholder="Search skills..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 pl-10 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/50 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
              aria-label="Search skills"
            />
          </div>

          {/* Count */}
          <span className="text-xs text-zinc-500 font-mono tabular-nums shrink-0">
            {itemCount} skills
          </span>
        </div>
      </div>
    </nav>
  );
}
