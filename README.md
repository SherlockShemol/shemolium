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
| `date` | ✅ | `string` | Publication date in `"YYYY-MM-DD"` format |
| `type` | ✅ | `string / string[]` | `"Post"` (blog post) or `"Page"` (standalone page like About) |
| `slug` | ✅ | `string` | URL path, e.g., `"my-post"` → `shemol.tech/my-post` |
| `status` | ✅ | `string / string[]` | `"Published"` (published) or `"Draft"` (draft, hidden) |
| `summary` | Recommended | `string` | Summary displayed in the post list on homepage |
| `tags` | Recommended | `string[]` | Tag list for categorization and tag pages |
| `lang` | Optional | `string[]` | Language, e.g., `[zh-CN]` or `[en-US]` |
| `fullWidth` | Optional | `boolean` | Whether to display in full width, default `false` |

### 3. Post vs Page

- **Post** (`type: "Post"`): Regular blog post, shown in homepage list with author, date, and tags
- **Page** (`type: "Page"`): Standalone page (e.g., About, Friends), not shown in homepage list, accessed directly via slug

### 4. Adding Images

Reference images using relative paths in Markdown:

```markdown
![Image description](../_assets/my-image_123456.png)
```

Image files should be placed in the `_assets/` directory. During build, image paths are automatically rewritten to Cloudflare R2 URLs.

### 5. Supported Markdown Features

- **Standard Markdown**: Headings, paragraphs, bold, italic, links, images
- **GFM (GitHub Flavored Markdown)**: Tables, task lists, strikethrough
- **Code blocks**: Syntax highlighting via rehype-highlight
- **Mermaid diagrams**: Use ` ```mermaid ` code blocks
- **Line breaks**: Single line breaks are rendered as `<br>` (consistent with Obsidian behavior)
- **HTML**: Inline HTML is supported

---

## Image Hosting (Cloudflare R2)

Blog images are hosted on [Cloudflare R2](https://developers.cloudflare.com/r2/), with free tier including:
- **Storage**: 10 GB/month
- **Reads**: 10 million requests/month
- **Egress**: Free (unlike AWS S3)

### Upload Images

After adding new images to `_assets/`, run:

```bash
pnpm upload-images
```

This script will:
1. Scan all Markdown files in `Blog Database/`
2. Find all referenced images
3. Upload corresponding images from `_assets/` to Cloudflare R2
4. Skip unreferenced images

### R2 Setup (First Time Only)

If you're setting up R2 for the first time:

1. Sign up for [Cloudflare](https://dash.cloudflare.com/)
2. Create an R2 bucket (e.g., `blog-images`)
3. Enable public access (Settings → Public access → R2.dev subdomain)
4. Install Wrangler CLI: `npm install -g wrangler`
5. Login: `wrangler login`

### R2 URL Configuration

R2 public URL is configured in the following files:

- `lib/markdown/getPostContent.ts` — `R2_BASE_URL` constant
- `scripts/generate-rss.ts` — Image URLs in RSS

If you change the R2 domain, update the URLs in both files.

---

## Development

```bash
# Install dependencies
pnpm install

# Start development server (automatically validates content)
pnpm dev

# Start development server (skip content validation, faster)
pnpm dev:skip-sync

# Upload new images to Cloudflare R2
pnpm upload-images

# Production build
pnpm build

# Start production server
pnpm start
```

---

## Deployment

### Vercel (Recommended)

1. Fork or push this repository to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Set build command to `pnpm build` (default is fine)
4. Deploy

Each `git push` will automatically trigger Vercel to rebuild and redeploy.

### Workflow: Publishing a New Post

```bash
# 1. Write Markdown post in Blog Database/
# 2. If there are new images, put them in _assets/ and upload to R2
pnpm upload-images

# 3. Commit and push
git add .
git commit -m "New post: Post Title"
git push

# 4. Vercel auto-deploys ✅
```

### Workflow: Deleting a Post

1. Delete the corresponding `.md` file in `Blog Database/`
2. `git commit && git push`
3. Images on R2 can be left (doesn't affect functionality, only takes storage)

---

## Configuration

### `blog.config.ts`

| Field | Description | Default |
|-------|-------------|---------|
| `title` | Blog title | — |
| `author` | Author name | — |
| `email` | Email for Gravatar avatar | — |
| `link` | Blog domain | — |
| `description` | Blog description (SEO) | — |
| `lang` | Default language | `'zh-CN'` |
| `postsPerPage` | Posts per page | `7` |
| `sortByDate` | Sort by date (newest first) | `true` |
| `showAbout` | Show About page | `true` |
| `showArchive` | Show archive | `true` |
| `comment.provider` | Comment system | — |

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
