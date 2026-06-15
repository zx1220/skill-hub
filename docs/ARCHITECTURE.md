# Skill Hub 架构文档

> AI 技能注册中心 — 管理、发现、同步 Claude Code & Hermes 的技能

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [系统架构](#3-系统架构)
4. [数据流](#4-数据流)
5. [存储架构](#5-存储架构)
6. [API 接口](#6-api-接口)
7. [CLI 工具](#7-cli-工具)
8. [认证体系](#8-认证体系)
9. [AI 集成](#9-ai-集成)
10. [飞书集成](#10-飞书集成)
11. [部署方案](#11-部署方案)
12. [配置参考](#12-配置参考)
13. [目录结构](#13-目录结构)
14. [前端组件](#14-前端组件)
15. [开发指南](#15-开发指南)

---

## 1. 项目概述

Skill Hub 是一个 AI 技能管理平台，解决以下核心问题：

- **技能注册与发现**：将散落在各处的 AI Agent 技能统一注册，方便浏览和检索
- **多 Agent 支持**：同时支持 Claude Code 和 Hermes 两种 Agent，技能可标记为专属于某一 Agent 或通用
- **CLI 同步**：通过命令行工具在本地和服务器之间双向同步技能
- **知识库管理**：附带知识库笔记功能，支持 AI 分类、摘要，可同步到飞书
- **多设备协作**：通过 checksum 冲突检测和增量同步协议支持多设备协同工作

### 核心概念

| 概念 | 说明 |
|------|------|
| **Skill（技能）** | 一个 Markdown 文件集合，包含一个主文件 `SKILL.md`（含 YAML frontmatter）和可能的辅助文件 |
| **Agent（代理）** | 技能的目标运行时，分为 `claude`（Claude Code）、`hermes`（Hermes）、`both`（通用） |
| **Note（笔记）** | 知识库条目，状态流：`draft` → `classified` → `synced` |
| **Sync Protocol** | CLI 与服务器之间的同步协议，基于 checksum 的冲突检测 + 增量拉取 |

### 技能文件示例

```markdown
---
name: My Skill
description: 做什么的技能
read_when: 什么时候触发
version: "1.0.0"
agent: claude
triggers: ["关键词1", "关键词2"]
---

# My Skill

技能正文内容...
```

---

## 2. 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| **框架** | Next.js (App Router) | 16.2.7 |
| **语言** | TypeScript | 5.x |
| **UI** | React + Tailwind CSS v4 + shadcn/ui | React 19.2.4 |
| **数据库** | SQLite (better-sqlite3) | 12.10.0 |
| **AI** | Anthropic SDK | 0.104.1 |
| **飞书** | Lark SDK | 1.66.1 |
| **运行时** | Bun（首选）/ Node.js 20 | — |
| **部署** | Docker (多阶段构建, standalone 输出) | — |

---

## 3. 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                        客户端层                               │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │ Web Dashboard│  │ Login Page  │  │ CLI (skill-sync)     │ │
│  │ (React SPA)  │  │             │  │                      │ │
│  │  - 技能管理   │  │ API Key     │  │ push/pull/install   │ │
│  │  - 笔记管理   │  │ 认证        │  │ list/status/migrate  │ │
│  │  - AI 操作    │  │             │  │                      │ │
│  └──────┬───────┘  └──────┬──────┘  └──────────┬───────────┘ │
└─────────┼─────────────────┼────────────────────┼─────────────┘
          │ HTTP/REST       │ Cookie             │ HTTP/REST
          │                 │                    │ Bearer Token
          ▼                 ▼                    ▼
┌──────────────────────────────────────────────────────────────┐
│                      API 层 (Next.js Route Handlers)         │
│                                                              │
│  /api/auth/*        认证路由                                  │
│  /api/skills/*      技能 CRUD + 下载 + 上传                   │
│  /api/notes/*       笔记 CRUD + AI分类/摘要 + 飞书同步         │
│  /api/sync/*        CLI 同步协议 (push/pull/status)           │
│  /api/feishu/*      飞书空间查询 + 集成状态                     │
└──────────┬────────────────────┬──────────────┬───────────────┘
           │                    │              │
           ▼                    ▼              ▼
┌────────────────┐  ┌─────────────────┐  ┌────────────────┐
│  存储层         │  │  外部服务        │  │  外部服务        │
│                │  │                 │  │                │
│  ┌───────────┐ │  │  ┌───────────┐  │  │  ┌──────────┐  │
│  │  SQLite   │ │  │  │ GitHub    │  │  │  │ Anthropic│  │
│  │  (元数据)  │ │  │  │ API      │  │  │  │ API      │  │
│  └───────────┘ │  │  │ (技能/笔记)│  │  │  │ (分类/摘要│  │
│  ┌───────────┐ │  │  └───────────┘  │  │  │  )        │  │
│  │  文件系统  │ │  │                 │  │  └──────────┘  │
│  │  (技能文件)│ │  │                 │  │                │
│  └───────────┘ │  │                 │  │  ┌──────────┐  │
│  ┌───────────┐ │  │                 │  │  │ 飞书 API │  │
│  │ 同步日志  │ │  │                 │  │  │ (笔记同步)│  │
│  └───────────┘ │  │                 │  │  └──────────┘  │
└────────────────┘  └─────────────────┘  └────────────────┘
```

### 启动流程

```
instrumentation.ts (Next.js 启动钩子)
       │
       ▼
bootstrap.ts
       │
       ├── 初始化 SQLite 数据库 (建表、索引)
       │       └── data/skill-hub.db
       │
       └── 生成 Master API Key
               └── data/.master-key (48字节hex)
               └── 控制台打印 Key 前4后4位
```

---

## 4. 数据流

### 4.1 技能管理流程

```
                        创建/编辑技能
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
    Web Dashboard       CLI push            文件上传
         │                   │                   │
         ▼                   ▼                   ▼
    POST /api/skills    POST /api/sync/push   POST /api/skills/upload
         │                   │                   │
         ▼                   ▼                   ▼
    ┌─────────────────────────────────────────────────┐
    │              storage.ts (SQLite + FS)            │
    │                                                 │
    │   1. 解析 frontmatter → 提取元数据               │
    │   2. SQLite 事务 → 写入 skills 表                │
    │   3. SQLite 事务 → 写入 skill_files 表           │
    │   4. 文件系统 → 写入 data/skills/<slug>/         │
    │   5. 计算 SHA-256 checksum                       │
    │   6. 记录 sync_log                               │
    └─────────────────────────────────────────────────┘
                             │
                             ▼
                       读取技能
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
    Web Dashboard       CLI pull            下载技能
         │                   │                   │
         ▼                   ▼                   ▼
    GET /api/skills     GET /api/sync/pull   GET /api/skills/[slug]/download
         │                   │
         ▼                   ▼
    返回列表+元数据     返回文件内容+checksum
```

### 4.2 CLI 同步协议

```
┌──────────────────┐                          ┌──────────────────┐
│   CLI (本地)      │                          │   Server (远程)   │
│                  │                          │                  │
│  ~/.claude/skills│                          │  SQLite + FS     │
└────────┬─────────┘                          └────────┬─────────┘
         │                                             │
         │  ──── PUSH 流程 ────                         │
         │                                             │
         │  1. 读取本地文件                              │
         │  2. 计算 checksum                            │
         │  3. 读取上次同步的 base_checksum               │
         │                                             │
         │  POST /api/sync/push ──────────────────▶    │
         │  {slug, files, checksum, base_checksum}     │
         │                                             │
         │               4. 校验 base_checksum          │
         │                  ├─ 匹配 → 更新 ✓            │
         │                  └─ 不匹配 → 409 Conflict ✗  │
         │                                             │
         │  ◀──── 200 {checksum} 或 409 ────────────   │
         │                                             │
         │  5. 更新本地 .skills_store_lock.json          │
         │                                             │
         │  ──── PULL 流程 ────                         │
         │                                             │
         │  6. 读取上次同步时间戳 last_full_sync          │
         │                                             │
         │  GET /api/sync/pull?since=<timestamp> ──▶   │
         │                                             │
         │               7. 查询 sync_log 增量变更       │
         │                                             │
         │  ◀──── {changes, server_time} ────────────   │
         │                                             │
         │  8. 逐个应用变更:                             │
         │     - create/update → 写入文件               │
         │     - delete → 删除目录                      │
         │     - 清理本地多余文件                         │
         │  9. 更新 sync cursor                        │
         │                                             │
```

### 4.3 笔记 + AI + 飞书流程

```
创建笔记 (draft)
       │
       ▼
POST /api/notes ──▶ notes.ts (GitHub JSON) ──▶ notes/<id>.json
       │
       ▼
AI 分类 (classified)
       │
       ▼
POST /api/notes/[id]/classify ──▶ claude-ai.ts ──▶ Anthropic API
       │                                                │
       │  ◀─── {category, tags, suggestedTitle} ◀───────┘
       │
       ▼
AI 摘要
       │
       ▼
POST /api/notes/[id]/summarize ──▶ claude-ai.ts ──▶ Anthropic API
       │                                                │
       │  ◀─── {summary, keyPoints, wordCount} ◀────────┘
       │
       ▼
飞书同步 (synced)
       │
       ▼
POST /api/notes/[id]/sync ──▶ feishu.ts ──▶ 飞书 API
       │                                      │
       │     1. 创建飞书文档                     │
       │     2. 写入内容块                       │
       │     3. (可选) 添加到知识库空间            │
       │                                      │
       │  ◀─── {feishuDocId, feishuUrl} ◀──────┘
       │
       ▼
更新笔记状态为 synced
```

---

## 5. 存储架构

### 5.1 双存储策略

Skill Hub 采用**主存储 (SQLite+FS) + 远程存储 (GitHub)** 的双存储架构：

| 存储类型 | 数据位置 | 用途 | 模块 |
|----------|---------|------|------|
| **主存储** | SQLite + 本地文件系统 | 技能 CRUD、CLI 同步 | `storage.ts` |
| **远程存储** | GitHub 仓库 | 笔记存储、历史版本 | `github.ts` / `notes.ts` |
| **降级模式** | `public/demo-*.json` | 无配置时的只读演示 | `demo.ts` / `notes-demo.ts` |

### 5.2 SQLite Schema

数据库文件：`data/skill-hub.db`，WAL 模式，外键约束启用。

```sql
-- 技能元数据表
CREATE TABLE skills (
  slug        TEXT PRIMARY KEY,           -- 技能唯一标识 (URL-safe)
  name        TEXT NOT NULL,              -- 显示名称
  description TEXT DEFAULT '',            -- 描述
  version     TEXT DEFAULT '1.0.0',       -- 语义化版本
  agent       TEXT DEFAULT 'claude',      -- 目标 Agent: claude/hermes/both
  triggers    TEXT DEFAULT '[]',          -- JSON 数组，触发关键词
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now')),
  checksum    TEXT DEFAULT ''              -- SHA-256 前16位hex
);

-- 技能文件表
CREATE TABLE skill_files (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_slug  TEXT NOT NULL REFERENCES skills(slug) ON DELETE CASCADE,
  filename    TEXT NOT NULL,              -- 文件名 (如 SKILL.md)
  content     TEXT NOT NULL,              -- 文件内容
  updated_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(skill_slug, filename)
);

-- 同步日志表
CREATE TABLE sync_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_slug  TEXT NOT NULL,
  action      TEXT NOT NULL,              -- create/update/delete
  timestamp   TEXT DEFAULT (datetime('now')),
  device_id   TEXT                        -- 设备标识
);

-- 索引
CREATE INDEX idx_sync_log_timestamp ON sync_log(timestamp);
CREATE INDEX idx_skill_files_slug   ON skill_files(skill_slug);
```

### 5.3 文件系统布局

```
data/
├── skill-hub.db              # SQLite 数据库
├── .master-key               # Master API Key (48字节hex)
└── skills/
    ├── my-skill/
    │   ├── SKILL.md           # 主技能文件 (含 frontmatter)
    │   ├── helper.ts          # 辅助文件
    │   └── ...
    ├── another-skill/
    │   └── SKILL.md
    └── ...
```

### 5.4 Checksum 机制

用于冲突检测和增量同步：

```typescript
// 计算方式：对文件列表排序后拼接，取 SHA-256 前16位
function computeChecksum(files: SkillFile[]): string {
  const content = files
    .map(f => `${f.filename}:${f.content}`)
    .sort()
    .join('\n');
  return sha256(content).slice(0, 16);
}
```

### 5.5 GitHub 存储结构（笔记）

```
<repo>/
├── skills/                   # 技能目录 (可选，用于 GitHub 模式)
│   ├── skill-a/
│   │   └── SKILL.md
│   └── skill-b/
│       └── SKILL.md
├── registry.json             # 技能索引
├── notes/                    # 笔记目录
│   ├── abc12345.json         # 单条笔记
│   └── def67890.json
└── notes/notes-registry.json # 笔记索引
```

---

## 6. API 接口

### 6.1 认证路由

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `POST` | `/api/auth/login` | 无 | 验证 API Key，设置 HttpOnly Cookie（30天过期） |
| `GET` | `/api/auth/status` | 无 | 返回 `{ authenticated: boolean }` |

**登录请求示例：**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "your-api-key"}'
```

### 6.2 技能路由

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/api/skills` | 无 | 列出所有技能（DB 空则降级 demo） |
| `POST` | `/api/skills` | ✅ 需认证 | 创建技能 |
| `GET` | `/api/skills/[slug]` | 无 | 获取技能详情（含 SKILL.md 内容） |
| `PUT` | `/api/skills/[slug]` | ✅ 需认证 | 更新技能 |
| `DELETE` | `/api/skills/[slug]` | ✅ 需认证 | 删除技能（DB + 文件系统） |
| `GET` | `/api/skills/[slug]/download` | 无 | 下载所有文件（JSON 格式） |
| `POST` | `/api/skills/upload` | ✅ 需认证 | 拖拽上传（FormData，仅 .md，拒绝 .zip） |

**创建技能示例：**
```bash
curl -X POST http://localhost:3000/api/skills \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Skill",
    "slug": "my-skill",
    "description": "技能描述",
    "triggers": ["触发词1", "触发词2"],
    "agent": "claude",
    "content": "---\nname: My Skill\n---\n# Content"
  }'
```

### 6.3 同步路由（CLI 协议）

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `POST` | `/api/sync/push` | ✅ | 推送技能文件，冲突返回 409 |
| `GET` | `/api/sync/pull` | ✅ | 拉取变更，支持 `?since=<timestamp>` 增量 |
| `GET` | `/api/sync/status` | ✅ | 服务端同步状态 |

**Push 请求体：**
```json
{
  "slug": "my-skill",
  "files": [
    { "filename": "SKILL.md", "content": "..." }
  ],
  "checksum": "a1b2c3d4e5f6g7h8",
  "base_checksum": "previous-checksum",
  "device_id": "optional-device-id"
}
```

**Pull 响应体：**
```json
{
  "changes": [
    {
      "slug": "my-skill",
      "action": "update",
      "files": [{ "filename": "SKILL.md", "content": "..." }],
      "checksum": "a1b2c3d4e5f6g7h8",
      "timestamp": "2026-06-12T10:00:00Z"
    }
  ],
  "server_time": "2026-06-12T10:30:00Z"
}
```

### 6.4 笔记路由

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/api/notes` | 无 | 列出笔记（支持 `?category=`, `?status=`, `?q=` 筛选） |
| `POST` | `/api/notes` | ✅ GITHUB_TOKEN | 创建笔记 |
| `GET` | `/api/notes/[id]` | 无 | 获取笔记详情 |
| `PUT` | `/api/notes/[id]` | ✅ GITHUB_TOKEN | 更新笔记 |
| `DELETE` | `/api/notes/[id]` | ✅ GITHUB_TOKEN | 删除笔记 |
| `POST` | `/api/notes/[id]/classify` | ✅ ANTHROPIC_API_KEY | AI 分类 |
| `POST` | `/api/notes/[id]/summarize` | ✅ ANTHROPIC_API_KEY | AI 摘要 |
| `POST` | `/api/notes/[id]/sync` | — | 同步到飞书 |
| `DELETE` | `/api/notes/[id]/sync` | — | 清除飞书同步信息 |
| `POST` | `/api/notes/bulk-classify` | ✅ ANTHROPIC_API_KEY | 批量 AI 分类 |

### 6.5 飞书路由

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/api/feishu/spaces` | 飞书配置 | 列出可用的飞书知识空间 |
| `GET` | `/api/feishu/status` | — | 检查各集成状态（GitHub/飞书/AI） |

### 6.6 响应格式

**成功响应：**
```json
{
  "skills": [...],
  // 或
  "note": { ... }
}
```

**错误响应：**
```json
{
  "error": "描述信息（隐藏内部细节）"
}
```

---

## 7. CLI 工具

### 7.1 安装

```bash
# 方式1: 直接使用（推荐，无外部依赖）
node cli/skill-sync <command>

# 方式2: 全局链接
ln -s $(pwd)/cli/skill-sync /usr/local/bin/skill-sync
skill-sync <command>
```

### 7.2 命令参考

| 命令 | 说明 | 示例 |
|------|------|------|
| `auth <url> <key>` | 保存认证凭据 | `skill-sync auth http://localhost:3000 abc123...` |
| `push <name> [--force]` | 推送单个技能 | `skill-sync push my-skill --force` |
| `push --all [--force]` | 推送所有本地技能 | `skill-sync push --all` |
| `pull [name]` | 拉取技能（增量） | `skill-sync pull my-skill` |
| `list` | 列出服务端技能 | `skill-sync list` |
| `install <name>` | 拉取并安装到本地 | `skill-sync install my-skill` |
| `status` | 查看服务端状态 | `skill-sync status` |
| `migrate --from-github` | 从 GitHub 导入 | `skill-sync migrate --from-github --repo user/repo --token ghp_xxx` |

### 7.3 配置文件

CLI 配置存储在 `~/.skill-hub.json`：

```json
{
  "server_url": "http://localhost:3000",
  "api_key": "your-api-key"
}
```

### 7.4 同步锁文件

本地同步状态存储在 `~/.claude/skills/.skills_store_lock.json`：

```json
{
  "last_full_sync": "2026-06-12T10:00:00.000Z",
  "skills": {
    "my-skill": {
      "server_checksum": "a1b2c3d4e5f6g7h8",
      "last_sync": "2026-06-12T10:00:00.000Z"
    }
  }
}
```

### 7.5 技能安装路径

| Agent | 安装路径 |
|-------|---------|
| Claude Code | `~/.claude/skills/<name>/` |
| Hermes | `~/.hermes/skills/<name>/` |

---

## 8. 认证体系

```
┌─────────────────────────────────────────────────────┐
│                    认证流程                           │
│                                                     │
│  首次启动:                                           │
│    bootstrap.ts → generateApiKey()                  │
│    → 48字节随机hex → 保存到 data/.master-key         │
│    → 控制台打印 key (仅一次)                          │
│                                                     │
│  Web 认证:                                           │
│    POST /api/auth/login {apiKey}                    │
│    → validateApiKey(key) 比对 master key             │
│    → 设置 HttpOnly Cookie (30天过期)                  │
│    → 后续请求通过 Cookie 自动认证                      │
│                                                     │
│  CLI 认证:                                           │
│    Authorization: Bearer <api-key>                  │
│    → extractApiKey() 优先从 Header 提取              │
│    → 备选从 Cookie 提取                               │
│                                                     │
│  路由保护:                                           │
│    withAuth()        → 包装带 params 的路由处理器     │
│    withAuthSimple()  → 包装无 params 的路由处理器     │
│    未认证 → 401 { error: "Unauthorized..." }         │
└─────────────────────────────────────────────────────┘
```

### 获取 API Key

1. 启动服务器：`bun dev`
2. 查看控制台输出：
   ```
   🔑 Master API Key generated: abc123...xyz789
      Saved to: ./data/.master-key
   ```
3. 或直接读取文件：`cat data/.master-key`

---

## 9. AI 集成

### 9.1 分类功能

- **端点**：`POST /api/notes/[id]/classify`
- **模型**：Claude Haiku（快速、低成本）
- **输入**：笔记标题 + 内容
- **输出**：
  ```json
  {
    "category": "技术",       // 9个分类之一
    "tags": ["React", "前端"],
    "suggestedTitle": "..."
  }
  ```
- **分类列表**：技术、产品、设计、管理、学习、项目、灵感、会议、其他

### 9.2 摘要功能

- **端点**：`POST /api/notes/[id]/summarize`
- **模型**：Claude Sonnet（高质量）
- **输入**：笔记标题 + 内容
- **输出**：
  ```json
  {
    "summary": "...",
    "keyPoints": ["要点1", "要点2"],
    "wordCount": 500
  }
  ```

### 9.3 批量分类

- **端点**：`POST /api/notes/bulk-classify`
- **实现**：顺序调用 classifyNote()，非并行

### 9.4 模型配置

| 用途 | 环境变量 | 默认值 |
|------|---------|--------|
| 分类 | `ANTHROPIC_DEFAULT_HAIKU_MODEL` | `claude-haiku-4-5-20251001` |
| 摘要 | `ANTHROPIC_DEFAULT_SONNET_MODEL` | `claude-sonnet-4-6` |

---

## 10. 飞书集成

### 10.1 功能

1. **列出知识空间**：获取可用飞书 Wiki 空间列表
2. **创建文档**：将 Markdown 笔记转为飞书文档
3. **添加到知识库**：将文档挂载到指定 Wiki 空间节点

### 10.2 Markdown → 飞书块转换

`markdownToFeishuBlocks()` 支持以下 Markdown 元素：

| Markdown | 飞书块类型 |
|----------|-----------|
| `# ~ ###` | heading1 ~ heading3 |
| 段落文本 | text |
| `- item` | bullet |
| `> quote` | quote |
| `` `code` `` | code |
| ` ```lang ``` ` | code (带语言标注) |
| `**bold**` | bold |
| `*italic*` | italic |
| `[link](url)` | a (链接) |

### 10.3 配置

```env
FEISHU_APP_ID=cli_xxxx          # 飞书应用 ID
FEISHU_APP_SECRET=xxxx          # 飞书应用密钥
FEISHU_WIKI_SPACE_ID=xxxx       # 默认知识库空间 ID (可选)
```

---

## 11. 部署方案

### 11.1 Docker 部署（推荐）

```bash
# 构建并启动
docker compose up -d

# 查看日志获取 API Key
docker compose logs skill-hub | grep "Master API Key"

# 停止
docker compose down
```

**Dockerfile 要点：**
- 三阶段构建：deps → builder → runner
- 基于 `node:20-slim`
- Standalone 输出模式（最小化镜像体积）
- 创建 `nextjs` 专用用户（非 root）
- 数据卷挂载在 `/app/data`

**docker-compose.yml：**
```yaml
services:
  skill-hub:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - skill-hub-data:/app/data      # SQLite + 技能文件持久化
    environment:
      - NODE_ENV=production
    restart: unless-stopped

volumes:
  skill-hub-data:                      # 命名卷，数据不丢失
```

### 11.2 手动部署

```bash
# 安装依赖
bun install

# 构建
bun run build

# 生产启动
bun start
# 或
node .output/standalone/server.js
```

### 11.3 数据持久化

| 路径 | 内容 | 持久化方式 |
|------|------|-----------|
| `data/skill-hub.db` | SQLite 数据库 | Docker Volume / 备份 |
| `data/skills/` | 技能文件 | Docker Volume / 备份 |
| `data/.master-key` | API Key | Docker Volume / 备份 |

> ⚠️ 首次启动后务必保存 Master API Key，重启不会重新生成（文件已存在则跳过）。

---

## 12. 配置参考

### 环境变量

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `SKILL_REPO` | ✅ | — | GitHub 仓库 `owner/repo` |
| `GITHUB_TOKEN` | ❌ | — | GitHub PAT，无则降级 demo 模式 |
| `SKILL_BRANCH` | ❌ | `main` | Git 分支 |
| `FEISHU_APP_ID` | ❌ | — | 飞书应用 ID |
| `FEISHU_APP_SECRET` | ❌ | — | 飞书应用密钥 |
| `FEISHU_WIKI_SPACE_ID` | ❌ | — | 默认飞书知识库空间 |
| `ANTHROPIC_API_KEY` | ❌ | — | Anthropic API Key（AI 分类/摘要） |
| `ANTHROPIC_BASE_URL` | ❌ | — | 自定义 API 基础 URL |
| `SKILL_DB_PATH` | ❌ | `./data/skill-hub.db` | SQLite 数据库路径 |
| `SKILL_DATA_DIR` | ❌ | `./data/skills` | 技能文件目录 |
| `SKILL_MASTER_KEY_PATH` | ❌ | `./data/.master-key` | Master Key 存储路径 |

### 降级策略

```
有 GITHUB_TOKEN?
  ├─ Yes → 使用 GitHub API 读写技能/笔记
  └─ No  → 有数据库数据?
              ├─ Yes → 使用 SQLite 数据
              └─ No  → Demo 模式（只读，使用 public/demo-*.json）
```

---

## 13. 目录结构

```
skill-hub/
│
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # 根布局（暗色主题，Geist 字体）
│   │   ├── page.tsx                  # 首页仪表盘（技能 + 笔记双标签）
│   │   ├── error.tsx                 # 全局错误边界
│   │   ├── loading.tsx               # 全局加载动画
│   │   ├── globals.css               # Tailwind + oklch 主题色
│   │   │
│   │   ├── login/page.tsx            # API Key 登录页
│   │   │
│   │   ├── skills/[slug]/
│   │   │   ├── page.tsx              # 技能详情页
│   │   │   └── error.tsx             # 技能专用错误边界
│   │   │
│   │   ├── notes/
│   │   │   ├── page.tsx              # 笔记列表页
│   │   │   └── [id]/page.tsx         # 笔记详情页
│   │   │
│   │   └── api/
│   │       ├── auth/                 # 认证（login, status）
│   │       ├── skills/               # 技能 CRUD + 下载 + 上传
│   │       ├── notes/                # 笔记 CRUD + AI + 飞书
│   │       ├── sync/                 # CLI 同步协议
│   │       └── feishu/               # 飞书集成
│   │
│   ├── components/                   # React 组件
│   │   ├── ui/                       # shadcn/ui 原子组件
│   │   ├── nav-bar.tsx               # 顶部导航栏
│   │   ├── skill-card.tsx            # 技能卡片
│   │   ├── skill-form.tsx            # 技能表单（创建/编辑）
│   │   ├── note-card.tsx             # 笔记卡片
│   │   ├── note-form.tsx             # 笔记表单
│   │   ├── tab-switcher.tsx          # 技能/笔记标签切换
│   │   ├── markdown-editor.tsx       # Markdown 编辑器
│   │   ├── upload-dialog.tsx         # 文件上传对话框
│   │   ├── feishu-sync-dialog.tsx    # 飞书同步对话框
│   │   ├── agent-badge.tsx           # Agent 类型徽章
│   │   ├── code-block.tsx            # 代码块（带复制）
│   │   ├── delete-dialog.tsx         # 确认删除对话框
│   │   ├── tag-input.tsx             # 标签输入
│   │   ├── trigger-tags.tsx          # 触发词展示
│   │   ├── empty-state.tsx           # 空状态占位
│   │   ├── skill-skeleton.tsx        # 加载骨架屏
│   │   ├── note-classify-panel.tsx   # AI 分类面板
│   │   └── note-summary-panel.tsx    # AI 摘要面板
│   │
│   └── lib/                          # 业务逻辑层
│       ├── db.ts                     # SQLite 连接 + Schema
│       ├── storage.ts                # 技能 CRUD (SQLite + FS)
│       ├── sync.ts                   # CLI 同步协议处理
│       ├── auth.ts                   # 认证（Master Key + Cookie）
│       ├── bootstrap.ts              # 启动初始化
│       ├── github.ts                 # GitHub API 集成
│       ├── notes.ts                  # 笔记 CRUD (GitHub JSON)
│       ├── claude-ai.ts              # Anthropic SDK (分类/摘要)
│       ├── feishu.ts                 # 飞书 SDK (文档/知识库)
│       ├── demo.ts                   # Demo 技能数据
│       ├── notes-demo.ts             # Demo 笔记数据
│       ├── types.ts                  # TypeScript 类型定义
│       ├── constants.ts              # 全局常量 + 环境变量
│       ├── api-utils.ts              # safeError() 错误处理
│       └── utils.ts                  # cn() Tailwind 工具
│
├── cli/
│   └── skill-sync                    # CLI 同步工具（Node.js 脚本）
│
├── public/
│   ├── demo-registry.json            # Demo 技能数据 (8个)
│   ├── demo-notes.json               # Demo 笔记数据 (4条)
│   └── *.svg                         # 静态资源
│
├── data/                             # 运行时数据（gitignore）
│   ├── skill-hub.db                  # SQLite 数据库
│   ├── .master-key                   # API Key
│   └── skills/                       # 技能文件存储
│
├── Dockerfile                        # Docker 多阶段构建
├── docker-compose.yml                # Docker Compose
├── instrumentation.ts                # Next.js 启动钩子
├── next.config.ts                    # Next.js 配置
├── package.json
├── tsconfig.json
├── components.json                   # shadcn/ui 配置
├── CLAUDE.md                         # Claude Code 指引
└── AGENTS.md                         # Agent 规则
```

---

## 14. 前端组件

### 14.1 页面路由

| 路由 | 页面 | 功能 |
|------|------|------|
| `/` | Dashboard | 双标签（技能/笔记），搜索，Agent/分类筛选，网格布局 |
| `/login` | Login | API Key 输入 → Cookie 认证 |
| `/skills/[slug]` | Skill Detail | 元数据、安装命令、内容预览、文件列表、编辑/删除/下载 |
| `/notes/[id]` | Note Detail | 状态/分类/标签、AI 操作、内容预览、飞书同步 |

### 14.2 核心组件交互

```
Dashboard (page.tsx)
│
├── TabSwitcher ─────────── 技能 | 笔记 切换
│
├── [Skills Tab]
│   ├── NavBar ──────────── 搜索框 + Agent 筛选 (All/Claude/Hermes/Both)
│   ├── Stats Bar ───────── 各类型数量统计
│   ├── SkillCard[] ──────  Agent徽章 | 名称 | 描述 | 触发词 | 文件数
│   ├── SkillForm ───────── 创建/编辑技能（对话框）
│   ├── UploadDialog ────── 拖拽上传 .md 文件
│   └── SkillSkeleton ──── 加载骨架屏
│
├── [Notes Tab]
│   ├── NavBar ──────────── 搜索框 + 分类筛选 + 状态筛选
│   ├── NoteCard[] ──────── 状态徽章 | 标题 | 分类 | 标签 | 预览
│   └── NoteForm ────────── 创建/编辑笔记（含 Markdown 编辑器 + 标签输入）
│
├── Skill Detail (/skills/[slug])
│   ├── AgentBadge ──────── Agent 类型彩色徽章
│   ├── CodeBlock ───────── 安装命令（一键复制）
│   ├── TriggerTags ─────── 触发关键词标签
│   ├── Markdown预览 ────── SKILL.md 渲染
│   ├── SkillForm ───────── 编辑模式
│   └── DeleteDialog ────── 输入 slug 确认删除
│
└── Note Detail (/notes/[id])
    ├── Status Badge ────── draft | classified | synced
    ├── NoteClassifyPanel ─ AI 分类按钮 + 结果
    ├── NoteSummaryPanel ── AI 摘要按钮 + 结果
    ├── FeishuSyncDialog ── 飞书空间选择 + 同步
    ├── NoteForm ────────── 编辑模式
    └── DeleteDialog ────── 确认删除
```

### 14.3 主题配色

| Agent | 背景色 | 文字色 | 边框色 |
|-------|--------|--------|--------|
| Claude Code | `rgba(168,85,247,0.12)` | `#a855f7` (紫) | `rgba(168,85,247,0.25)` |
| Hermes | `rgba(249,115,22,0.12)` | `#f97316` (橙) | `rgba(249,115,22,0.25)` |
| Both | `rgba(99,102,241,0.12)` | `#6366f1` (靛) | `rgba(99,102,241,0.25)` |

使用 oklch 色彩空间（Tailwind CSS v4），全局暗色主题。

---

## 15. 开发指南

### 15.1 常用命令

```bash
bun install          # 安装依赖
bun dev              # 开发服务器 :3000
bun run build        # 生产构建
bun start            # 启动生产服务器
bun lint             # ESLint 检查
```

### 15.2 代码约定

| 约定 | 说明 |
|------|------|
| **App Router** | 所有页面和 API 路由在 `src/app/` |
| **客户端组件** | 标记 `"use client"`，使用 shadcn/ui + Tailwind CSS v4 |
| **Path alias** | `@/*` → `./src/*` |
| **数据库** | better-sqlite3，schema 在 `db.ts`，文件存 `data/skill-hub.db` |
| **Frontmatter** | `github.ts` 和 `storage.ts` 各有一份解析器，修改时需同步 |
| **错误处理** | `safeError()` 隐藏内部细节，日志记录完整错误 |
| **认证** | `withAuth()` / `withAuthSimple()` HOC 包装受保护路由 |

### 15.3 添加新 API 路由

1. 在 `src/app/api/` 下创建目录结构
2. 导出 `GET`/`POST`/`PUT`/`DELETE` 函数
3. 需要认证的路由用 `withAuth()` 包装
4. 错误处理使用 `safeError()`

```typescript
// src/app/api/example/route.ts
import { withAuthSimple } from '@/lib/auth';
import { safeError } from '@/lib/api-utils';

export const POST = withAuthSimple(async (request: Request) => {
  try {
    const body = await request.json();
    // ... 业务逻辑
    return Response.json({ success: true });
  } catch (e) {
    return safeError(e, '操作失败');
  }
});
```

### 15.4 添加新前端组件

1. 在 `src/components/` 创建文件
2. 客户端组件添加 `"use client"` 指令
3. 使用 shadcn/ui 组件作为基础
4. 样式使用 Tailwind CSS 类名

### 15.5 Frontmatter 格式

技能主文件 `SKILL.md` 必须包含 YAML frontmatter：

```yaml
---
name: 技能名称           # 必需
description: 描述        # 可选
read_when: 触发条件      # 可选
version: "1.0.0"        # 可选，默认 1.0.0
agent: claude            # 可选，默认 claude
triggers:                # 可选，触发关键词列表
  - 关键词1
  - 关键词2
---
```

> **注意**：`github.ts` 和 `storage.ts` 各有一份 frontmatter 解析器，修改解析逻辑时两处都要更新。

---

## 附录：类型定义速查

```typescript
// Agent 类型
type AgentType = "claude" | "hermes" | "both";

// 技能元数据
interface SkillMeta {
  name: string; slug: string; description: string;
  version: string; triggers: string[]; agent: AgentType;
  path: string; updatedAt: string; files: string[];
}

// 技能详情（含内容）
interface SkillDetail extends SkillMeta {
  content: string;    // SKILL.md 原始内容
  installCmd: string; // 安装命令
}

// 笔记元数据
interface NoteMeta {
  id: string; title: string; content: string;
  summary?: string; tags: string[]; category?: string;
  status: "draft" | "classified" | "synced";
  feishuDocId?: string; feishuUrl?: string;
  createdAt: string; updatedAt: string;
}

// 同步推送请求
interface SyncPushRequest {
  slug: string; files: SkillFile[];
  checksum: string; base_checksum?: string; device_id?: string;
}

// 同步拉取响应
interface SyncPullResponse {
  changes: SyncChange[]; server_time: string;
}

// 同步变更
interface SyncChange {
  slug: string; action: "create" | "update" | "delete";
  files: SkillFile[]; checksum: string; timestamp: string;
}
```
