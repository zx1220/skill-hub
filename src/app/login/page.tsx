"use client";

import { useState } from "react";
import { KeyRound, Sparkles } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });

      if (res.ok) {
        window.location.href = "/";
      } else {
        const data = await res.json();
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] p-4">
      <div className="w-full max-w-sm animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition-shadow">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white mt-4 tracking-tight">
            Skill<span className="text-gradient-indigo">Hub</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Enter your API key to continue</p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#111118] p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-zinc-300 mb-1.5">
                API Key
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                <input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/50 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/[0.08] px-4 py-2 text-sm text-red-400 animate-scale-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !apiKey}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 py-2.5 text-sm font-medium text-white hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 disabled:opacity-50 disabled:shadow-none transition-all duration-200"
            >
              {loading ? "Verifying..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
