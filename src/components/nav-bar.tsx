"use client";

import { Search } from "lucide-react";
import Link from "next/link";

interface NavBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  agentFilter: string;
  onAgentFilterChange: (agent: string) => void;
  skillCount: number;
}

const AGENT_TABS = [
  { value: "all", label: "All" },
  { value: "claude", label: "Claude" },
  { value: "hermes", label: "Hermes" },
  { value: "both", label: "Both" },
];

export function NavBar({
  searchQuery,
  onSearchChange,
  agentFilter,
  onAgentFilterChange,
  skillCount,
}: NavBarProps) {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-16 items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">S</span>
            </div>
            <span className="text-lg font-semibold text-white hidden sm:inline">
              Skill Hub
            </span>
          </Link>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search skills..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 pl-10 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-colors"
              aria-label="Search skills"
            />
          </div>

          {/* Agent filter tabs */}
          <div className="hidden md:flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
            {AGENT_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => onAgentFilterChange(tab.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  agentFilter === tab.value
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Count + Add */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-zinc-500 font-mono">{skillCount} skills</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
