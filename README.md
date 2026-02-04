<div align="center">
  <img src="./public/favicon.png" width="50" height="50" alt="Shemolium Logo">
  <h1>Shemolium</h1>
</div>

A static blog built with local Markdown files and Next.js, deployed on [Vercel](https://vercel.com). Images hosted on [Cloudflare R2](https://developers.cloudflare.com/r2/).

Demo: [https://shemol.tech](https://shemol.tech)

## Features

- **Fast and responsive** — Static generation with optimized page rendering
- **Deploy instantly** — Push to GitHub, Vercel auto-deploys in minutes
- **Markdown-based** — Write posts in Obsidian or any Markdown editor
- **Cloudflare R2 images** — Free image hosting (10 GB storage, unlimited egress)
- **Fully functional** — Comments, quick search, tag filtering, RSS feed, and more
- **Easy customization** — Built with Tailwind CSS, supports English & Chinese
- **SEO friendly** — Pretty URLs, sitemap, meta tags, and RSS

---

## Architecture

```
📁 Project Root
├── Blog Database/           ← Markdown files (committed to Git)
│   ├── About.md
│   ├── 2026-1-31.md
│   └── ...
├── _assets/                 ← Images (gitignored, uploaded to R2)
│   ├── image_123456.png
│   └── ...
├── lib/markdown/            ← Markdown data layer
│   ├── getAllPosts.ts        ← Reads .md files → Post[]
│   ├── getPostContent.ts    ← Returns markdown body, rewrites image URLs
│   ├── getAllTagsFromPosts.ts
│   ├── filterPublishedPosts.ts
│   └── index.ts
├── components/
│   ├── MarkdownRenderer.tsx ← react-markdown renderer with GFM + syntax highlighting
│   └── Post.tsx             ← Post page layout
├── scripts/
│   ├── sync-content.ts      ← Build-time content verification
│   ├── generate-rss.ts      ← RSS feed generator (reads from Markdown)
│   └── upload-images.ts     ← Upload images to Cloudflare R2
└── blog.config.ts           ← Blog configuration
```

### Data Flow

```
Obsidian / Markdown Editor
    ↓ write .md files
Blog Database/ (Git)
    ↓ pnpm build
Next.js Static Generation → Vercel

_assets/ (local)
    ↓ pnpm upload-images
Cloudflare R2 → CDN → Browser
```

---

## Writing Posts

### 1. Create a Markdown File

Create a new `.md` file in `Blog Database/` with YAML frontmatter:

```yaml
---
lang: [zh-CN]
date: "2026-02-17"
type: "Post"
slug: "my-new-post"
tags: [技术, 前端]
summary: "这是文章摘要，会显示在首页的文章列表中"
status: "Published"
---

# 我的新文章

正文内容...
```

### 2. Frontmatter Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `date` | ✅ | `string` | 发布日期，格式 `"YYYY-MM-DD"` |
| `type` | ✅ | `string / string[]` | `"Post"`（博文）或 `"Page"`（独立页面如 About） |
| `slug` | ✅ | `string` | URL 路径，如 `"my-post"` → `shemol.tech/my-post` |
| `status` | ✅ | `string / string[]` | `"Published"`（发布）或 `"Draft"`（草稿，不显示） |
| `summary` | 推荐 | `string` | 摘要，显示在首页文章列表 |
| `tags` | 推荐 | `string[]` | 标签列表，用于分类和标签页 |
| `lang` | 可选 | `string[]` | 语言，如 `[zh-CN]` 或 `[en-US]` |
| `fullWidth` | 可选 | `boolean` | 是否全宽显示，默认 `false` |

### 3. Post vs Page

- **Post** (`type: "Post"`)：普通博文，显示在首页列表中，有作者、日期、标签
- **Page** (`type: "Page"`)：独立页面（如 About、Friends），不在首页列表显示，通过 slug 直接访问

### 4. Adding Images

在 Markdown 中使用相对路径引用图片：

```markdown
![图片描述](../_assets/my-image_123456.png)
```

图片文件需要放在 `_assets/` 目录中。构建时，图片路径会自动被改写为 Cloudflare R2 URL。

### 5. Supported Markdown Features

- **标准 Markdown**：标题、段落、粗体、斜体、链接、图片
- **GFM（GitHub Flavored Markdown）**：表格、任务列表、删除线
- **代码块**：支持语法高亮（通过 rehype-highlight）
- **Mermaid 图表**：使用 ` ```mermaid ` 代码块
- **换行**：单换行会被渲染为 `<br>`（与 Obsidian 行为一致）
- **HTML**：支持内联 HTML

---

## Image Hosting (Cloudflare R2)

博客图片托管在 [Cloudflare R2](https://developers.cloudflare.com/r2/)，免费额度包括：
- **存储**：10 GB/月
- **读取**：1000 万次/月
- **出站流量**：免费（不像 AWS S3）

### Upload Images

当你添加了新图片到 `_assets/` 后，运行：

```bash
pnpm upload-images
```

这个脚本会：
1. 扫描 `Blog Database/` 中的所有 Markdown 文件
2. 找出所有被引用的图片
3. 将对应图片从 `_assets/` 上传到 Cloudflare R2
4. 跳过未被引用的图片

### R2 Setup (First Time Only)

如果你是第一次设置 R2：

1. 注册 [Cloudflare](https://dash.cloudflare.com/)
2. 创建 R2 存储桶（如 `blog-images`）
3. 开启公开访问（Settings → Public access → R2.dev subdomain）
4. 安装 Wrangler CLI：`npm install -g wrangler`
5. 登录：`wrangler login`

### R2 URL Configuration

R2 公开 URL 配置在以下文件中：

- `lib/markdown/getPostContent.ts` — `R2_BASE_URL` 常量
- `scripts/generate-rss.ts` — RSS 中的图片 URL

如果更换了 R2 域名，需同时修改这两个文件中的 URL。

---

## Development

```bash
# 安装依赖
pnpm install

# 启动开发服务器（会自动验证内容）
pnpm dev

# 启动开发服务器（跳过内容验证，更快）
pnpm dev:skip-sync

# 上传新图片到 Cloudflare R2
pnpm upload-images

# 生产构建
pnpm build

# 启动生产服务器
pnpm start
```

---

## Deployment

### Vercel (Recommended)

1. Fork 或 push 此仓库到 GitHub
2. 在 [Vercel](https://vercel.com) 中导入项目
3. 设置构建命令为 `pnpm build`（默认即可）
4. 部署

之后每次 `git push` 都会自动触发 Vercel 重新构建和部署。

### Workflow: 发布新文章

```bash
# 1. 在 Blog Database/ 中写好 Markdown 文章
# 2. 如果有新图片，放入 _assets/ 并上传到 R2
pnpm upload-images

# 3. 提交并推送
git add .
git commit -m "New post: 文章标题"
git push

# 4. Vercel 自动部署 ✅
```

### Workflow: 删除文章

1. 删除 `Blog Database/` 中对应的 `.md` 文件
2. `git commit && git push`
3. R2 上的图片可以不删（不影响功能，只占存储）

---

## Configuration

### `blog.config.ts`

| Field | Description | Default |
|-------|-------------|---------|
| `title` | 博客标题 | — |
| `author` | 作者名 | — |
| `email` | 用于 Gravatar 头像 | — |
| `link` | 博客域名 | — |
| `description` | 博客描述（SEO） | — |
| `lang` | 默认语言 | `'zh-CN'` |
| `postsPerPage` | 每页文章数 | `7` |
| `sortByDate` | 按日期排序（新的在前） | `true` |
| `showAbout` | 显示 About 页面 | `true` |
| `showArchive` | 显示归档 | `true` |
| `comment.provider` | 评论系统 | — |

---

## Technical Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 14 (Static Generation) |
| **Content** | Local Markdown + gray-matter |
| **Rendering** | react-markdown + remark-gfm + rehype-highlight |
| **Images** | Cloudflare R2 |
| **Styling** | Tailwind CSS |
| **Deployment** | Vercel |
| **Comments** | Gitalk / Cusdis / Utterances |
| **RSS** | Custom generator (Atom 1.0) |

---

## Acknowledgments

This project is based on [Nobelium](https://github.com/craigary/nobelium) by [Craig Hart](https://github.com/craigary). Special thanks to Craig and all the contributors of the original project.

## License

The MIT License.

Copyright (c) 2021-present, Craig Hart  
Copyright (c) 2024-present, Shemol
