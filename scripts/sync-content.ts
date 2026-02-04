#!/usr/bin/env tsx
/**
 * Content Sync Script
 *
 * Currently a no-op since:
 * - Blog Database/ markdown files are read directly from the project root
 * - Images are served from Cloudflare R2 (no local copy needed)
 *
 * Kept as a convenience script for future use.
 *
 * Usage:
 *   pnpm sync-content
 */

import fs from 'fs'
import path from 'path'

async function main(): Promise<void> {
    console.log('📦 Syncing blog content...')

    // Verify Blog Database exists
    const blogDir = path.join(process.cwd(), 'Blog Database')
    if (fs.existsSync(blogDir)) {
        const mdFiles = fs.readdirSync(blogDir).filter(f => f.endsWith('.md'))
        console.log(`📝 Blog Database: ${mdFiles.length} markdown files`)
    } else {
        console.log('⚠️  No Blog Database/ directory found')
    }

    console.log('🖼️  Images served from Cloudflare R2 (no local copy needed)')
    console.log('🎉 Content sync complete!')
}

main().catch(error => {
    console.error('❌ Content sync failed:', error)
    process.exit(1)
})
