# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
bun install             # Install dependencies
bun dev                 # Dev server on :3000
bun run build           # Production build (standalone output)
bun start               # Start production server
bun lint                # ESLint
bun run migrate:turso   # 一次性脚本：迁移数据到 Turso 远程库 (scripts/migrate-to-turso.ts)
bunx tsx verify-libsql.ts  # (临时) 数据层端到端自检，跑完即可删
```

No test framework is configured. Verify by running `bun dev` and checking the browser.

## Architecture

**Skill Hub** — AI 技能注册中心，管理 Claude Code & Hermes 的技能。**主数据源是 libSQL**（本地 file / 远程 Turso），GitHub 仓库仅作为导入来源之一。

```
Web Dashboard ──▶ Next.js API ──▶ libSQL (本地 data/local.db / 远程 Turso)
                       │
            ┌──────────┼──────────────┐
     skill-sync CLI   导入源        本地 agent 同步
     push/pull/install  GitHub/URL    ~/.claude|hermes/skills
```

### 数据存储（核心）

- **libSQL**（`@libsql/client`，纯 JS、serverless 友好）—— 不是 better-sqlite3，GitHub 仓库也不再是主存储。
  - 生产：`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`（远程 Turso）；`SKILL_DB_URL` 是 `TURSO_DATABASE_URL` 的别名。
  - 本地开发回退：`file:./data/local.db`。
  - schema 在 `src/lib/db.ts`（表：`skills` / `skill_files` / `sync_log` / `categories`）。`getClient()` 单例，首次连接幂等建表并播种默认分类。
- `src/lib/storage.ts` — 基于 libSQL 的技能/分类 CRUD；`computeChecksum` 对文件内容做 SHA-256（取前 16 位）用于同步冲突检测。
- `src/lib/sync.ts` — CLI 同步协议（`handlePush` / `handlePull` / `getSyncStatus`），增量靠 `sync_log`。
- `src/lib/demo.ts` — demo 数据（读 `public/demo-registry.json`）。
- **`src/lib/github.ts` 是半遗留代码**：保留了 registry/CRUD 与 60s 内存缓存逻辑，但当前**无路由调用其读写函数**，仅 `buildInstallCmd`（安装命令拼接）被 `storage.ts` / `demo.ts` 复用。仓库导入走独立实现 `src/lib/github-import.ts`（Git Trees API 一次枚举 + Contents raw 下载，支持子路径单技能导入）。

### Demo 模式

- `GET /api/skills` 与 `GET /api/skills/[slug]` 在**数据库为空**时降级返回 demo 数据。触发条件是「空库」，**不是**「无 `GITHUB_TOKEN`」。

### 认证（`src/lib/auth.ts`）

- API Key 认证，timing-safe 比对。
- master key 来源：`SKILL_MASTER_KEY` 环境变量（serverless 必需）→ 本地文件 `data/.master-key`（本地首次启动自动生成并打印到控制台）。
- 取 key 顺序：`Authorization: Bearer`（CLI）→ cookie `skill-hub-key`（Web UI）。
- HOC：`withAuth()`（带 params 的动态路由）/ `withAuthSimple()`（无 params 路由）。

### 分类（`src/lib/classify.ts`）

- **关键词规则匹配**（`DEFAULT_RULES`，按数组顺序先匹配先得，未命中归「工具类」），**不是 AI**。
- `POST /api/skills/classify`（`?force=true` 全量；默认只分类未分类的技能）。
- `ANTHROPIC_API_KEY` / `@anthropic-ai/sdk` 是**预留依赖**，当前分类路径未使用。

### 导入 & 本地同步

- `src/lib/github-import.ts` — 从任意 GitHub 仓库导入技能。
- `src/lib/local-scanner.ts` — 扫描本地 agent 技能目录（`~/.claude/skills`、`~/.hermes/skills`）。
- `/api/skills/import/{github,url,local}` — 三种导入入口（均需认证）。
- `/api/skills/sync/local/{compare,install,delete}` — 服务器技能与本地 agent 目录的对比/安装/删除（均需认证）。

### API 路由

| 路径 | 认证 | 说明 |
|------|------|------|
| `/api/skills` | 读公开 / 写需认证 | 技能列表（空库降级 demo）/ 新建 |
| `/api/skills/[slug]` | 读公开 / 改删需认证 | 详情 / PUT 更新 / PATCH 改分类 / DELETE |
| `/api/skills/[slug]/download` | 公开 | 下载技能（archiver 打 zip，`maxDuration=60`）|
| `/api/skills/upload` | 需认证 | 批量上传 |
| `/api/skills/classify` | 需认证 | 关键词分类（`?force=true`）|
| `/api/skills/import/{github,url,local}` | 需认证 | 三种导入源 |
| `/api/skills/sync/local/{compare,install,delete}` | 需认证 | 本地 agent 目录同步 |
| `/api/categories` `/api/categories/[name]` | 全部需认证（含 GET）| 分类 CRUD |
| `/api/auth/{login,status}` | — | 登录 / 状态 |
| `/api/sync/{pull,push,status}` | 需认证 | CLI 同步协议 |

> 历史曾有 `/api/notes`（知识库笔记）与 `/api/feishu/*`（飞书同步），**已移除**（types 中无 `NoteMeta`，源码无任何引用；`@larksuiteoapi/node-sdk` 仅残留在 package.json 未使用）。`.env.example` 里的飞书项也已过时。

### 关键类型（`src/lib/types.ts`）

- 技能：`SkillMeta` / `SkillDetail` / `CreateSkillInput` / `SkillRegistry` / `AgentType`（`"claude" | "hermes" | "both"`）。
- 同步协议：`SkillFile` / `SyncPushRequest` / `SyncChange` / `SyncPullResponse` / `SyncStatusResponse`。
- 导入 & 本地同步：`ImportResult` / `ImportUrlRequest` / `ImportGitHubRequest` / `ImportLocalRequest` / `LocalSkillScan` / `LocalSyncAgent` / `LocalSyncCompareResponse` / `LocalSyncDeleteResponse` / `LocalSyncInstallResponse`。

### 环境变量

| 变量 | 状态 | 说明 |
|------|------|------|
| `TURSO_DATABASE_URL` (`SKILL_DB_URL`) | 生产推荐 | 远程 Turso 库地址；不设则用本地 `file:./data/local.db` |
| `TURSO_AUTH_TOKEN` | 生产推荐 | Turso 访问令牌 |
| `SKILL_MASTER_KEY` | 生产推荐 | master API key；不设则本地生成 `data/.master-key` |
| `SKILL_REPO` / `GITHUB_TOKEN` / `SKILL_BRANCH` | 遗留 | 仅 `constants.ts` 的 `GITHUB_CONFIG` 读取，`github.ts` 读写函数当前无路由调用 |
| `ANTHROPIC_API_KEY` | 预留 | `AI_CONFIG`，当前分类未使用 |
| `SKILL_MASTER_KEY_PATH` | 高级 | 覆盖 master key 文件位置（`constants.ts` 的 `DB_CONFIG`；DB 路径由 `db.ts` 管理，不可配置）|
| `SRC_DB` | 迁移专用 | `migrate-to-turso.ts` 的旧 better-sqlite3 源库，默认 `data/skill-hub.db` |

### 代码约定

- **Next.js 16 App Router**（16.2.7）/ **React 19** — 所有页面和 API 路由在 `src/app/`。
- **客户端组件**标记 `"use client"`，shadcn/ui + Tailwind CSS v4 + `@base-ui/react`。
- **Path alias** — `@/*` → `./src/*`。
- **配置常量集中**在 `src/lib/constants.ts`（`AGENT_COLORS` / `AGENT_INSTALL_PATHS` / `DB_CONFIG` / `GITHUB_CONFIG` / `AI_CONFIG` / `SITE_CONFIG`）；`src/lib/api-utils.ts` 提供 `safeError()` 统一错误响应。
- **Frontmatter 解析有多份副本**（`github.ts` / `storage.ts` 的 `buildSkillMd` / `sync.ts` 的 `parseFrontmatterContent` / `github-import.ts` / `local-scanner.ts`），**修改 frontmatter 格式时需全部同步**。
- **数据库** — libSQL，schema 在 `src/lib/db.ts`；本地文件 `data/local.db`，惰性初始化（首次 `getClient()` 触发）。`src/lib/bootstrap.ts` 的 `initializeApp()` 当前**无调用点**。
- **CLI** — `cli/skill-sync` 是独立 **Node.js** 脚本（`#!/usr/bin/env node`，非 shell），配置存 `~/.skill-hub.json`。命令：`auth` / `push` / `pull` / `list` / `install` / `status` / `migrate --from-github`。
- **Docker** — 多阶段构建（`node:20-slim`），standalone 输出，`/app/data` 卷持久化。

### 技能安装路径

| Agent | 本地路径 |
|-------|----------|
| Claude Code | `~/.claude/skills/<name>/` |
| Hermes | `~/.hermes/skills/<name>/` |
