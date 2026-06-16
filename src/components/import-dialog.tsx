"use client";

import { useState, useRef, useCallback } from "react";
import {
  X,
  Upload,
  GitBranch,
  FileText,
  FolderOpen,
  Loader2,
  Check,
  ChevronRight,
} from "lucide-react";
// ─── Types ───

type TabId = "upload" | "github";

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

// ─── Tab definitions ───

const TABS: { id: TabId; label: string; icon: typeof Upload }[] = [
  { id: "upload", label: "本地上传", icon: Upload },
  { id: "github", label: "GitHub 上传", icon: GitBranch },
];

// ─── Component ───

export function ImportDialog({ open, onClose, onImported }: ImportDialogProps) {
  const [tab, setTab] = useState<TabId>("upload");
  const [error, setError] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm pt-8 pb-8 animate-fade-in">
      <div className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#111118] shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Import Skills</h2>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-white/[0.06] px-6 py-2 bg-white/[0.01]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(""); }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.id
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6 min-h-[320px]">
          {tab === "upload" && (
            <UploadTab
              onError={setError}
              onSuccess={() => { onImported(); onClose(); }}
            />
          )}
          {tab === "github" && (
            <GitHubTab
              error={error}
              onError={setError}
              onSuccess={onImported}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Upload Tab (single file + folder) ───

// Common binary file extensions — skipped to honor text-only uploads
const BINARY_EXTS = new Set([
  "png", "jpg", "jpeg", "gif", "ico", "bmp", "webp", "tiff", "heic",
  "mp3", "mp4", "wav", "avi", "mov", "mkv", "flv", "webm", "ogg",
  "zip", "tar", "gz", "rar", "7z", "bz2",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "exe", "dll", "so", "dylib", "bin", "class", "jar", "wasm",
  "ttf", "otf", "woff", "woff2", "eot",
  "db", "sqlite", "sqlite3",
]);

function isLikelyBinary(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return BINARY_EXTS.has(ext);
}

function UploadTab({
  onError,
  onSuccess,
}: {
  onError: (e: string) => void;
  onSuccess: () => void;
}) {
  const [files, setFiles] = useState<{ name: string; size: number; path: string }[]>([]);
  const [folderName, setFolderName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [storedFiles, setStoredFiles] = useState<{ file: File; relativePath: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const processEntries = useCallback((entries: { file: File; relativePath: string }[]) => {
    const display: { name: string; size: number; path: string }[] = [];
    const kept: { file: File; relativePath: string }[] = [];
    let topFolder = "";

    for (const { file: f, relativePath } of entries) {
      const parts = relativePath.split("/");

      if (parts.length > 1 && !topFolder) {
        topFolder = parts[0];
      }

      // Skip hidden files and binary files (text-only uploads)
      if (parts.some((p) => p.startsWith("."))) continue;
      if (isLikelyBinary(relativePath)) continue;

      display.push({ name: f.name, size: f.size, path: relativePath });
      kept.push({ file: f, relativePath });
    }

    setFolderName(topFolder);
    setFiles(display);
    setStoredFiles(kept);
    onError("");
  }, [onError]);

  const handleInputChange = useCallback((fileList: File[]) => {
    const entries: { file: File; relativePath: string }[] = [];

    for (const f of fileList) {
      const relPath = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      entries.push({ file: f, relativePath: relPath });
    }

    processEntries(entries);
  }, [processEntries]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const items = e.dataTransfer.items;
    const collected: { file: File; relativePath: string }[] = [];
    const promises: Promise<void>[] = [];

    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) {
        promises.push(readEntryWithPath(entry, "", collected));
      } else {
        const f = items[i].getAsFile();
        if (f) collected.push({ file: f, relativePath: f.name });
      }
    }

    Promise.all(promises).then(() => {
      if (collected.length > 0) {
        processEntries(collected);
      } else {
        onError("No valid files found");
      }
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setLoading(true);
    onError("");

    try {
      const formData = new FormData();
      const paths: string[] = [];

      for (const { file: f, relativePath } of storedFiles) {
        const parts = relativePath.split("/");
        if (parts.some((p) => p.startsWith("."))) continue;

        const localPath = parts.length > 1 ? parts.slice(1).join("/") : f.name;
        formData.append("files", f, localPath);
        paths.push(localPath);
      }

      if (paths.length === 0) {
        onError("没有可上传的文本文件");
        return;
      }
      // Explicit relative paths, aligned with `files` by index, so the server
      // can preserve subdirectory structure without relying on multipart filename parsing.
      formData.append("paths", JSON.stringify(paths));

      if (folderName) {
        const slug = folderName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        formData.append("slug", slug);
      }

      const res = await fetch("/api/skills/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      // Auto-classify after upload (best effort, silently fail if no AI key)
      try {
        await fetch("/api/skills/classify", { method: "POST" });
      } catch { /* ignore */ }

      setFiles([]);
      setFolderName("");
      setStoredFiles([]);
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragOver
            ? "border-indigo-500/60 bg-indigo-500/5"
            : "border-white/[0.08] hover:border-white/[0.15]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleInputChange(Array.from(e.target.files));
            }
          }}
          className="hidden"
        />
        {files.length > 0 ? (
          <div className="space-y-2">
            {folderName && (
              <div className="flex items-center justify-center gap-2 text-sm text-indigo-400 mb-2">
                <FolderOpen className="h-4 w-4" />
                {folderName}/
              </div>
            )}
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-center gap-2 text-xs text-zinc-400">
                  <FileText className="h-3 w-3" />
                  <span>{f.path}</span>
                  <span className="text-zinc-600">({(f.size / 1024).toFixed(1)} KB)</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-2">{files.length} file(s) selected</p>
          </div>
        ) : (
          <div>
            <Upload className="h-8 w-8 text-zinc-500 mx-auto mb-3" />
            <p className="text-sm text-zinc-400">
              点击选择 <span className="text-indigo-400">技能文件夹</span>,或拖拽文件/文件夹到此处
            </p>
            <p className="text-xs text-zinc-600 mt-1">自动保留子目录结构,仅上传文本文件</p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={() => { setFiles([]); setFolderName(""); setStoredFiles([]); }} className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">
          Clear
        </button>
        <button
          onClick={handleUpload}
          disabled={files.length === 0 || loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {loading ? "上传中..." : "本地上传"}
        </button>
      </div>
    </div>
  );
}

// ─── GitHub Tab ───

function GitHubTab({
  error,
  onError,
  onSuccess,
  onClose,
}: {
  error: string;
  onError: (e: string) => void;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [branch, setBranch] = useState("main");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; skills: { slug: string; name?: string }[] } | null>(null);

  const handleImport = async () => {
    if (!repo.trim()) { onError("Please enter a repository"); return; }
    setLoading(true);
    onError("");
    setResult(null);

    try {
      const res = await fetch("/api/skills/import/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: repo.trim(),
          token: token.trim() || undefined,
          branch: branch.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      setResult(data);
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
          <div className="flex items-center gap-2 text-green-400 text-sm font-medium mb-2">
            <Check className="h-4 w-4" />
            Imported {result.imported} skill(s)
          </div>
          <div className="space-y-1">
            {result.skills.map((s) => (
              <div key={s.slug} className="text-xs text-zinc-400">
                <ChevronRight className="h-3 w-3 inline mr-1" />
                {s.name || s.slug}
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Repository <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          placeholder="owner/repo"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          GitHub Token <span className="text-zinc-600">(optional, falls back to server config)</span>
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ghp_xxxxxxxxxxxx"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
        />
        <p className="mt-1.5 text-xs text-zinc-600">
          Without a token, GitHub API limits to 60 requests/hour
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">Branch</label>
        <input
          type="text"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          placeholder="main"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleImport}
          disabled={!repo.trim() || loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
          {loading ? "Importing..." : "Import from GitHub"}
        </button>
      </div>
    </div>
  );
}

// ─── Helper: Recursively read DataTransfer entries with path tracking ───

function readEntryWithPath(
  entry: FileSystemEntry,
  basePath: string,
  collected: { file: File; relativePath: string }[]
): Promise<void> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file((file) => {
        collected.push({ file, relativePath: basePath ? `${basePath}/${file.name}` : file.name });
        resolve();
      }, () => resolve());
    } else if (entry.isDirectory) {
      const dirName = entry.name;
      const dirPath = basePath ? `${basePath}/${dirName}` : dirName;
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const readBatch = () => {
        reader.readEntries((entries) => {
          if (entries.length === 0) {
            resolve();
            return;
          }
          Promise.all(entries.map((e) => readEntryWithPath(e, dirPath, collected))).then(readBatch);
        }, () => resolve());
      };
      readBatch();
    } else {
      resolve();
    }
  });
}
