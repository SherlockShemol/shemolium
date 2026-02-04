/**
 * Get Markdown content for a specific post by slug
 *
 * Reads the .md file, strips frontmatter, and rewrites image paths
 * for serving from public/images/.
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const BLOG_DIR = path.join(process.cwd(), 'Blog Database')

interface FrontMatter {
    slug?: string
    [key: string]: unknown
}

/**
 * Build a slug-to-filename map for quick lookup
 */
function buildSlugMap(): Map<string, string> {
    const map = new Map<string, string>()

    if (!fs.existsSync(BLOG_DIR)) return map

    const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'))

    for (const file of files) {
        const filePath = path.join(BLOG_DIR, file)
        const raw = fs.readFileSync(filePath, 'utf-8')
        const { data: fm } = matter(raw) as { data: FrontMatter }

        const slug = fm.slug || file.replace(/\.md$/, '').toLowerCase().replace(/\s+/g, '-')
        map.set(slug, file)
    }

    return map
}

// Cache the slug map
let slugMap: Map<string, string> | null = null

function getSlugMap(): Map<string, string> {
    if (!slugMap) {
        slugMap = buildSlugMap()
    }
    return slugMap
}

/**
 * Rewrite image paths from Obsidian format to Cloudflare R2 URL
 * `../_assets/filename.png` → `https://pub-187e5a9ad2b040c7aa8e0208d1291b32.r2.dev/filename.png`
 */
const R2_BASE_URL = 'https://pub-187e5a9ad2b040c7aa8e0208d1291b32.r2.dev'

function rewriteImagePaths(content: string): string {
    return content.replace(
        /!\[([^\]]*)\]\(\.\.\/_assets\/([^)]+)\)/g,
        (_, alt, filename) => `![${alt}](${R2_BASE_URL}/${encodeURIComponent(filename).replace(/%20/g, '+')})`
    )
}

/**
 * Strip the first H1 heading from content (it duplicates the post title)
 */
function stripFirstHeading(content: string): string {
    return content.replace(/^\s*#\s+.+\n*/m, '')
}

/**
 * Get markdown content for a post by slug
 * Returns the body content after frontmatter, with image paths rewritten
 * and first heading stripped (to avoid duplicate title)
 */
export async function getPostContent(slug: string): Promise<string | null> {
    const map = getSlugMap()
    const filename = map.get(slug)

    if (!filename) {
        console.log(`[Markdown] No file found for slug: ${slug}`)
        return null
    }

    const filePath = path.join(BLOG_DIR, filename)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const { content } = matter(raw)

    return rewriteImagePaths(stripFirstHeading(content))
}

/**
 * Reset the slug map cache (useful for development)
 */
export function resetCache(): void {
    slugMap = null
}
