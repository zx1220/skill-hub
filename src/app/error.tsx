"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4 animate-fade-in-up">
      <div className="relative mb-2">
        <div className="absolute inset-0 rounded-3xl bg-red-500/[0.06] blur-xl scale-150" />
        <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/10 flex items-center justify-center">
          <span className="text-2xl font-bold text-red-400/60">!</span>
        </div>
      </div>
      <h1 className="text-xl text-white font-semibold">Something went wrong</h1>
      <p className="text-sm text-zinc-500 max-w-md text-center leading-relaxed">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-2 text-sm font-medium text-white hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-500/20 transition-all duration-200"
      >
        Try again
      </button>
      <Link href="/" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
        ← Back to Skills
      </Link>
    </div>
  );
}
