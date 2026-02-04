/**
 * Local Markdown Post Provider
 *
 * Reads all .md files from Blog Database/, parses YAML frontmatter,
 * and returns Post[] compatible with the existing blog system.
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import dayjs from '@/lib/dayjs'
import { config as BLOG } from '@/lib/server/config'
import filterPublishedPosts from '@/lib/markdown/filterPublishedPosts'
import type { Post } from '@/types'

const BLOG_DIR = path.join(process.cwd(), 'Blog Database')

interface FrontMatter {
    title?: string
    slug?: string
    summary?: string
    date?: string
    type?: string | string[]
    status?: string | string[]
    tags?: string | string[]
    lang?: string | string[]
    fullWidth?: boolean
}

/**
 * Normalize a frontmatter value to string[]
 */
function toStringArray(value: string | string[] | undefined): string[] | undefined {
    if (!value) return undefined
    if (Array.isArray(value)) return value
    return [value]
}

/**
 * Generate a stable ID from filename
 */
function generateId(filename: string): string {
    // Use a simple hash of the filename
    let hash = 0
    for (let i = 0; i < filename.length; i++) {
        const char = filename.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32-bit integer
    }
    // Format as UUID-like string
    const hex = Math.abs(hash).toString(16).padStart(8, '0')
    return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-${hex.slice(0, 4)}-${hex.slice(0, 4)}-${hex.padStart(12, '0')}`
}

interface GetAllPostsOptions {
    includePages?: boolean
}

/**
 * Get all posts from local Markdown files
 */
export async function getAllPosts({ includePages = false }: GetAllPostsOptions = {}): Promise<Post[] | null> {
    if (!fs.existsSync(BLOG_DIR)) {
        console.log('[Markdown] Blog Database directory not found:', BLOG_DIR)
        return []
    }

    const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'))
    console.log(`[Markdown] Found ${files.length} markdown files`)

    const data: Post[] = []

    for (const file of files) {
        const filePath = path.join(BLOG_DIR, file)
        const raw = fs.readFileSync(filePath, 'utf-8')
        const { data: fm } = matter(raw) as { data: FrontMatter }

        // Skip files without frontmatter
        if (!fm.slug && !fm.title) continue

        // Use filename (without .md) as title fallback
        const title = fm.title || file.replace(/\.md$/, '')
        const slug = fm.slug || file.replace(/\.md$/, '').toLowerCase().replace(/\s+/g, '-')

        // Parse date
        const date = fm.date
            ? dayjs.tz(fm.date).valueOf()
            : fs.statSync(filePath).mtimeMs

        const post: Post = {
            id: generateId(file),
            title,
            slug,
            summary: fm.summary,
            date,
            type: toStringArray(fm.type) || ['Post'],
            status: toStringArray(fm.status),
            tags: toStringArray(fm.tags),
            lang: toStringArray(fm.lang),
            fullWidth: fm.fullWidth ?? false
        }

        data.push(post)
    }

    // Filter published posts
    const posts = filterPublishedPosts({ posts: data, includePages })

    // Sort by date
    if (BLOG.sortByDate) {
        posts.sort((a, b) => b.date - a.date)
    }

    return posts
}
