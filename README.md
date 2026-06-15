# Skill Hub

AI Skill Registry — 管理、发现和安装 Claude Code & Hermes 的技能。

## 架构概览

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Web Dashboard │───▶│  Next.js API  │───▶│  GitHub Repo    │
│  (React/Next)   │◀───│  (/api/skills) │◀───│  skills/ 目录   │
└─────────────┘     └──────────────┘     └─────────────────┘
       ▲                                         ▲
       │                                         │
┌─────────────┐                           ┌──────────────┐
│  CLI (skill-sync)  │─────────────────────────▶│  GitHub Repo  │
└─────────────┘                           └──────────────┘
```

**数据存储**：技能以 Markdown 文件形式存储在 GitHub 仓库的 `skills/` 目录下。

## 快速开始

### 前置条件

- Node.js ≥ 18
- [bun](https://bun.sh/)（推荐）或 npm/yarn/pnpm
- GitHub Personal Access Token（可选，无 token 时使用 demo 模式）

### 安装

```bash
git clone https://github.com/zx1220/skill-hub.git
cd skill-hub
bun install
```

### 环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

| 变量 | 必需 | 说明 |
|------|------|------|
| `SKILL_REPO` | ✅ | GitHub 仓库地址，格式 `owner/repo` |
| `SKILL_BRANCH` | ❌ | Git 分支，默认 `main` |
| `GITHUB_TOKEN` | ❌ | GitHub PAT，无此值时进入 demo 模式（只读） |

> 生成 Token：[GitHub Settings → Tokens](https://github.com/settings/tokens)
> - 公开仓库：勾选 `public_repo`
> - 私有仓库：勾选 `repo`

### 启动开发服务器

```bash
bun dev
```

访问 [http://localhost:3000](http://localhost:3000)。

### 生产构建

```bash
bun run build
bun start
```

## Web Dashboard 功能

### 浏览技能
- 首页展示所有技能卡片（网格布局）
- 支持 **搜索**（名称、描述、触发词）
- 支持 **Agent 筛选**（Claude / Hermes / Both）

### 创建技能
1. 点击右上角 **"+ Add Skill"**
2. 填写表单：
   - **Name**：技能名称
   - **Slug**：URL 标识（自动从名称生成）
   - **Description**：简短描述
   - **Trigger Words**：触发词标签
   - **Agent**：Claude Code / Hermes / Both
   - **Content**：SKILL.md 正文（Markdown）
3. 提交后自动推送到 GitHub 仓库

### 查看/编辑/删除
- 点击技能卡片进入详情页
- 详情页展示完整 SKILL.md 内容 + 安装命令
- 支持编辑（修改后自动更新 GitHub 文件）
- 支持删除（需输入 slug 确认）

## CLI 工具 (`skill-sync`)

CLI 用于在本地和 GitHub 仓库之间同步技能文件。

### 安装 CLI 到 PATH

```bash
# 方式一：创建符号链接（推荐）
sudo ln -s "$(pwd)/cli/skill-sync" /usr/local/bin/skill-sync

# 方式二：直接用绝对路径调用
./cli/skill-sync --help
```

### 首次配置

```bash
# 保存 GitHub Token
skill-sync auth <your-github-token>

# 设置仓库地址
skill-sync config repo zx1220/skill-hub
```

配置保存在 `~/.skill-hub.json`。

### 命令一览

| 命令 | 说明 |
|------|------|
| `skill-sync auth <token>` | 保存 GitHub Token |
| `skill-sync config repo <owner/repo>` | 设置仓库地址 |
| `skill-sync push <name> [--agent claude\|hermes]` | 上传本地技能到仓库 |
| `skill-sync pull [name] [--agent claude\|hermes]` | 从仓库下载技能（省略 name 则下载全部） |
| `skill-sync list` | 列出仓库中所有技能 |
| `skill-sync install <name> --agent <agent>` | 安装技能到本地 Agent 目录 |

### 使用示例

```bash
# 从本地上传一个 Claude 技能
skill-sync push my-skill --agent claude

# 从仓库安装一个技能到 Hermes
skill-sync install my-skill --agent hermes

# 拉取所有技能到本地
skill-sync pull --agent claude

# 查看仓库中的技能列表
skill-sync list
```

### 技能安装路径

| Agent | 本地路径 |
|-------|----------|
| Claude Code | `~/.claude/skills/<skill-name>/` |
| Hermes | `~/.hermes/skills/<skill-name>/` |

## 技能文件格式

每个技能是一个目录，包含 `SKILL.md` 文件：

```
skills/
  └── my-skill/
      ├── SKILL.md        # 必需，技能定义
      └── _meta.json      # 可选，Agent 扩展信息
```

### SKILL.md 格式

```markdown
---
name: My Skill
description: "技能描述"
read_when:
  - 触发词1
  - 触发词2
version: "1.0.0"
---

# My Skill

这里是技能的正文内容（Markdown），
包含具体的指令和规则。
```

**Frontmatter 字段**：

| 字段 | 必需 | 说明 |
|------|------|------|
| `name` | ✅ | 技能名称 |
| `description` | ✅ | 简短描述 |
| `read_when` | ❌ | 触发词列表 |
| `version` | ❌ | 版本号 |

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/skills` | 列出所有技能 |
| `POST` | `/api/skills` | 创建新技能 |
| `GET` | `/api/skills/[slug]` | 获取技能详情 |
| `PUT` | `/api/skills/[slug]` | 更新技能 |
| `DELETE` | `/api/skills/[slug]` | 删除技能 |

### 请求/响应示例

```bash
# 列出技能
curl http://localhost:3000/api/skills

# 创建技能
curl -X POST http://localhost:3000/api/skills \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Skill",
    "slug": "my-skill",
    "description": "A test skill",
    "triggers": ["test"],
    "agent": "claude",
    "content": "# My Skill\n\nInstructions here."
  }'
```

## 技术栈

- **框架**：Next.js 16 (App Router)
- **语言**：TypeScript
- **UI**：shadcn/ui + Tailwind CSS v4
- **包管理**：bun
- **数据存储**：GitHub 仓库（文件即数据）

## 项目结构

```
src/
  app/
    page.tsx              # 首页 Dashboard
    error.tsx             # 全局错误页
    skills/[slug]/
      page.tsx            # 技能详情页
      error.tsx           # 详情页错误处理
    api/skills/
      route.ts            # GET/POST
      [slug]/route.ts     # GET/PUT/DELETE
  components/
    skill-card.tsx        # 技能卡片
    skill-form.tsx        # 创建/编辑表单
    nav-bar.tsx           # 导航栏（搜索+筛选）
    agent-badge.tsx       # Agent 类型标签
    code-block.tsx        # 安装命令代码块
    delete-dialog.tsx     # 删除确认弹窗
    tag-input.tsx         # 触发词标签输入
    trigger-tags.tsx      # 触发词展示
    empty-state.tsx       # 空状态
    skill-skeleton.tsx    # 加载骨架屏
  lib/
    github.ts             # GitHub API 集成（含缓存）
    demo.ts               # Demo 模式数据
    types.ts              # TypeScript 类型定义
    constants.ts          # 配置常量
    api-utils.ts          # API 工具函数
cli/
  skill-sync              # CLI 工具
```

## 部署

### Vercel（推荐）

```bash
npx vercel
```

在 Vercel Dashboard 中设置环境变量 `SKILL_REPO`、`SKILL_BRANCH`、`GITHUB_TOKEN`。

### Docker

```dockerfile
# 示例 Dockerfile（基于 standalone 输出）
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN npm install -g bun && bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

### 手动部署

```bash
bun run build
NODE_ENV=production node .next/standalone/server.js
```
