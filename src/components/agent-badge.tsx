"use client";

import { AGENT_COLORS } from "@/lib/constants";
import type { AgentType } from "@/lib/types";

export function AgentBadge({ agent }: { agent: AgentType }) {
  const colors = AGENT_COLORS[agent];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium font-mono"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: colors.text }}
      />
      {colors.label}
    </span>
  );
}
