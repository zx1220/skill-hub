"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#0a0a0f] overflow-hidden">
      {label && (
        <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-2">
          <span className="text-xs font-medium text-zinc-500">{label}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Copy command"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-green-400" />
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
      )}
      <pre className="p-4 overflow-x-auto">
        <code className="text-sm font-mono text-zinc-300 leading-relaxed">{code}</code>
      </pre>
    </div>
  );
}
