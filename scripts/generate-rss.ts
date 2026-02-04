#!/usr/bin/env tsx
/**
 * RSS Feed Generator
 * 
 * Generates a static RSS feed (Atom format) at build time.
 * Reads local Markdown files from Blog Database/ and converts to HTML.
 * 
 * Usage:
 *   pnpm tsx scripts/generate-rss.ts
 */

import fs from 'fs'
import path from 'path'
import { Feed } from 'feed'
import matter from 'gray-matter'
import BLOG from '../blog.config'

interface FrontMatter {
  title?: string
  slug?: string
  summary?: string
  date?: string
  type?: string | string[]
  status?: string | string[]
}

const BLOG_DIR = path.join(process.cwd(), 'Blog Database')
const OUTPUT_FILE = path.join(process.cwd(), 'public', 'feed.xml')

/**
 * Normalize a frontmatter value to string array
 */
function toStringArray(value: string | string[] | undefined): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  return [value]
}

/**
 * Simple Markdown to HTML conversion (for RSS content)
 */
function markdownToHtml(md: string): string {
  let html = md

  // Rewrite image paths to R2
  const R2_BASE_URL = 'https://pub-187e5a9ad2b040c7aa8e0208d1291b32.r2.dev'
  html = html.replace(
    /!\[([^\]]*)\]\(\.\.\/_assets\/([^)]+)\)/g,
    (_, alt, filename) => `<img src="${R2_BASE_URL}/${encodeURIComponent(filename).replace(/%20/g, '+')}" alt="${alt}" />`
  )

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  // Images (remaining)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr />')

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')

  // Paragraphs (lines that don't start with HTML tags)
  html = html.replace(/^(?!<[a-z/]|$)(.+)$/gm, '<p>$1</p>')

  // Clean up empty lines
  html = html.replace(/\n{2,}/g, '\n')

  return html.trim()
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('📰 Generating RSS feed...')

  if (!fs.existsSync(BLOG_DIR)) {
    console.error('❌ Error: Blog Database/ directory not found.')
    process.exit(1)
  }

  // Read all markdown files
  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'))
  console.log(`📄 Found ${files.length} markdown files`)

  interface PostEntry {
    title: string
    slug: string
    summary: string
    date: number
    content: string
  }

  const posts: PostEntry[] = []

  for (const file of files) {
    const filePath = path.join(BLOG_DIR, file)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const { data: fm, content } = matter(raw) as { data: FrontMatter; content: string }

    const type = toStringArray(fm.type)
    const status = toStringArray(fm.status)
    const slug = fm.slug || file.replace(/\.md$/, '').toLowerCase().replace(/\s+/g, '-')

    // Skip non-published or page type
    if (type[0] === 'Page') continue
    if (status[0] && status[0] !== 'Published') continue
    if (!slug) continue

    const date = fm.date ? new Date(fm.date).getTime() : 0

    posts.push({
      title: fm.title || file.replace(/\.md$/, ''),
      slug,
      summary: fm.summary || '',
      date,
      content
    })
  }

  // Sort by date (newest first) and take top 20
  posts.sort((a, b) => b.date - a.date)
  const feedPosts = posts.slice(0, 20)

  console.log(`📝 Including ${feedPosts.length} posts in feed`)

  // Create feed
  const year = new Date().getFullYear()
  const siteUrl = BLOG.link || 'https://example.com'
  const sitePath = BLOG.path || ''

  const feed = new Feed({
    title: BLOG.title || 'Blog',
    description: BLOG.description || '',
    id: `${siteUrl}/${sitePath}`,
    link: `${siteUrl}/${sitePath}`,
    language: BLOG.lang || 'en-US',
    favicon: `${siteUrl}/favicon.svg`,
    copyright: `All rights reserved ${year}, ${BLOG.author || 'Author'}`,
    author: {
      name: BLOG.author || 'Author',
      email: BLOG.email || '',
      link: siteUrl
    },
    feedLinks: {
      atom: `${siteUrl}/feed.xml`
    }
  })

  // Add posts to feed
  for (const post of feedPosts) {
    const htmlContent = markdownToHtml(post.content)

    feed.addItem({
      title: post.title,
      id: `${siteUrl}/${post.slug}`,
      link: `${siteUrl}/${post.slug}`,
      description: post.summary,
      content: htmlContent || `<p>${post.summary}</p>`,
      date: new Date(post.date || Date.now()),
      author: [{
        name: BLOG.author || 'Author',
        email: BLOG.email || '',
        link: siteUrl
      }]
    })
  }

  // Ensure public directory exists
  const publicDir = path.join(process.cwd(), 'public')
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true })
  }

  // Write feed
  const atomXml = feed.atom1()
  fs.writeFileSync(OUTPUT_FILE, atomXml)

  console.log(`✅ RSS feed generated: ${OUTPUT_FILE}`)
  console.log(`   - Format: Atom 1.0`)
  console.log(`   - Posts: ${feedPosts.length}`)
}

main().catch(error => {
  console.error('❌ RSS generation failed:', error)
  process.exit(1)
})
