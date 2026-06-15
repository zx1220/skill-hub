# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
bun install          # Install dependencies
bun dev              # Dev server on :3000
bun run build        # Production build (standalone output)
bun start            # Start production server
bun lint             # ESLint
```

No test framework is configured. Verify by running `bun dev` and checking the browser.

## Architecture

**Skill Hub** — AI 技能注册中心，管理 Claude Code & Hermes 的技能。双存储：GitHub 仓库（远程）+ SQLite + 文件系统（本地）。

```
Web Dashboard ──▶ Next.js API ──▶ GitHub Repo (skills/ 目录)
                       │                    ▲
                  SQLite + FS              │
                       │              CLI (skill-sync)
                  AI/飞书集成
```

### 数据流

- **技能** 以 Markdown 文件存储，YAML frontmatter 定义元数据（name, description, read_when, version）
- `src/lib/github.ts` — GitHub API 集成，60s 内存缓存，`registry.json` 作为技能索引
- `src/lib/storage.ts` — SQLite + 文件系统 CRUD，SHA-256 checksum 用于同步冲突检测
- `src/lib/auth.ts` — API Key 认证（自动生成 master key），`withAuth()` HOC 包装受保护路由
- 无 `GITHUB_TOKEN` 时自动降级为 demo 模式（只读，使用 `src/lib/demo.ts` 数据）

### API 路由

| 路径 | 认证 | 说明 |
|------|------|------|
| `/api/skills` | 读公开/写需认证 | 技能 CRUD |
| `/api/skills/[slug]/download` | 公开 | 下载技能文件 |
| `/api/skills/upload` | 需认证 | 批量上传 |
| `/api/auth/*` | — | 登录/验证 |
| `/api/notes` | 需认证 | 知识库笔记 |
| `/api/feishu/*` | 需认证 | 飞书同步 |
| `/api/sync/*` | 需认证 | CLI 同步协议 |

### 关键类型（`src/lib/types.ts`）

- `SkillMeta` / `SkillDetail` — 技能元数据与详情
- `AgentType` = `"claude" | "hermes" | "both"`
- `NoteMeta` — 知识库笔记，状态流：`draft → classified → synced`
- `SyncPushRequest` / `SyncChange` — CLI 同步协议

### 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `SKILL_REPO` | ✅ | GitHub 仓库 `owner/repo` |
| `GITHUB_TOKEN` | ❌ | 无则 demo 模式 |
| `SKILL_BRANCH` | ❌ | 默认 `main` |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | ❌ | 飞书集成 |
| `ANTHROPIC_API_KEY` | ❌ | AI 分类/摘要 |

### 代码约定

- **Next.js 16 App Router** — 所有页面和 API 路由在 `src/app/`
- **客户端组件** — 组件标记 `"use client"`，shadcn/ui + Tailwind CSS v4
- **Path alias** — `@/*` → `./src/*`
- **Frontmatter 解析** — `github.ts` 和 `storage.ts` 各有一份，修改时需同步
- **数据库** — better-sqlite3，schema 在 `src/lib/db.ts`，文件存 `data/skill-hub.db`
- **CLI** — `cli/skill-sync` 是独立 shell 脚本，配置存 `~/.skill-hub.json`
- **Docker** — 多阶段构建，standalone 输出，`data/` 卷持久化

### 技能安装路径

| Agent | 本地路径 |
|-------|----------|
| Claude Code | `~/.claude/skills/<name>/` |
| Hermes | `~/.hermes/skills/<name>/` |
