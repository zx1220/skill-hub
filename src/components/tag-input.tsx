"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({ tags, onChange, placeholder = "Type and press Enter..." }: TagInputProps) {
  const [input, setInput] = useState("");

  const addTag = (value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] p-2.5 min-h-[42px] focus-within:border-indigo-500/40 focus-within:ring-1 focus-within:ring-indigo-500/40 transition-colors">
      {tags.map((tag, i) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded bg-indigo-500/10 px-2 py-0.5 text-xs font-mono text-indigo-400 border border-indigo-500/20"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="text-indigo-500/60 hover:text-indigo-300 transition-colors"
            aria-label={`Remove tag ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
        aria-label="Add trigger word"
      />
    </div>
  );
}
