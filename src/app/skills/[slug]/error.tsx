"use client";

export default function SkillError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4">
      <h1 className="text-xl text-white">Failed to load skill</h1>
      <p className="text-sm text-zinc-500 max-w-md text-center">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
      >
        Try again
      </button>
      <a href="/" className="text-sm text-indigo-400 hover:text-indigo-300">
        ← Back to Skills
      </a>
    </div>
  );
}
