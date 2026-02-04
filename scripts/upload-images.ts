#!/usr/bin/env tsx
/**
 * Upload new/updated images to Cloudflare R2
 *
 * Compares local _assets/ with what's referenced in Blog Database/,
 * then uploads any missing images to R2.
 *
 * Usage:
 *   pnpm upload-images
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const BUCKET = 'blog-images'
const ASSETS_DIR = path.join(process.cwd(), '_assets')
const BLOG_DIR = path.join(process.cwd(), 'Blog Database')

function getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase()
    const map: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
    }
    return map[ext] || 'application/octet-stream'
}

function getReferencedImages(): Set<string> {
    const refs = new Set<string>()
    if (!fs.existsSync(BLOG_DIR)) return refs

    const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'))
    for (const file of files) {
        const content = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8')
        const matches = content.matchAll(/\.\.\/_assets\/([^)]+)/g)
        for (const match of matches) {
            refs.add(match[1])
        }
    }
    return refs
}

async function main(): Promise<void> {
    console.log('🖼️  Checking for images to upload to Cloudflare R2...')

    if (!fs.existsSync(ASSETS_DIR)) {
        console.log('⚠️  No _assets/ directory found. Nothing to upload.')
        return
    }

    // Get all referenced images
    const referenced = getReferencedImages()
    console.log(`📝 Found ${referenced.size} image references in blog posts`)

    // Get local image files
    const localFiles = fs.readdirSync(ASSETS_DIR)
    console.log(`📂 Found ${localFiles.length} files in _assets/`)

    // Upload each referenced image
    let uploaded = 0
    let failed = 0
    let skipped = 0

    for (const filename of localFiles) {
        if (!referenced.has(filename)) {
            skipped++
            continue
        }

        const filePath = path.join(ASSETS_DIR, filename)
        const contentType = getContentType(filename)

        try {
            execSync(
                `wrangler r2 object put "${BUCKET}/${filename}" --file "${filePath}" --content-type "${contentType}" --remote`,
                { stdio: 'pipe', timeout: 30000 }
            )
            uploaded++
            if (uploaded % 50 === 0) {
                console.log(`  ✅ Uploaded ${uploaded}...`)
            }
        } catch {
            failed++
            console.log(`  ❌ Failed: ${filename}`)
        }
    }

    console.log('')
    console.log(`🎉 Upload complete!`)
    console.log(`   ✅ Uploaded: ${uploaded}`)
    if (skipped > 0) console.log(`   ⏭️  Skipped (unreferenced): ${skipped}`)
    if (failed > 0) console.log(`   ❌ Failed: ${failed}`)
}

main().catch(error => {
    console.error('❌ Upload failed:', error)
    process.exit(1)
})
