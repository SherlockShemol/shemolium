#!/usr/bin/env tsx
/**
 * Notion Sync Script
 * 
 * Syncs all posts and their content blocks from Notion to local cache.
 * This enables local development without hitting the Notion API on every request.
 * 
 * Usage:
 *   pnpm sync          - Full sync
 *   pnpm sync:force    - Force re-sync all blocks
 */

import fs from 'fs'
import path from 'path'
import { NotionAPI } from 'notion-client'
import { idToUuid } from 'notion-utils'

interface PostProperties {
  id: string
  title?: string
  slug?: string
  summary?: string
  date?: number | { start_date?: string }
  type?: string[]
  status?: string[]
  tags?: string[]
  fullWidth?: boolean
  last_edited_time?: number
  [key: string]: unknown
}

interface BlockValue {
  type?: string
  format?: {
    page_full_width?: boolean
    [key: string]: unknown
  }
  created_time?: number
  last_edited_time?: number
  properties?: Record<string, unknown>
  [key: string]: unknown
}

interface Block {
  value?: BlockValue
}

interface CollectionValue {
  schema?: NotionSchema
  [key: string]: unknown
}

interface Collection {
  value?: CollectionValue
}

interface View {
  blockIds?: string[]
  collection_group_results?: {
    blockIds?: string[]
  }
}

interface CollectionQuery {
  [collectionId: string]: {
    [viewId: string]: View
  }
}

interface NotionSchema {
  [key: string]: {
    name: string
    type: string
  }
}

// Load environment variables from .env.local (only if not already set)
function loadEnv(): void {
  const envPath = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        const value = valueParts.join('=').replace(/^["']|["']$/g, '')
        // Only set if not already defined (prefer system env vars)
        if (key && value && !process.env[key]) {
          process.env[key] = value
        }
      }
    })
  }
}

loadEnv()

const CACHE_DIR = path.join(process.cwd(), '.cache')
const POSTS_CACHE_FILE = path.join(CACHE_DIR, 'posts.json')
const BLOCKS_DIR = path.join(CACHE_DIR, 'blocks')

// Helper: Get all page IDs from collection query
function getAllPageIds(collectionQuery: CollectionQuery): string[] {
  const ids: string[] = []
  if (!collectionQuery) return ids
  
  for (const collectionId of Object.keys(collectionQuery)) {
    const views = collectionQuery[collectionId]
    for (const viewId of Object.keys(views)) {
      const view = views[viewId]
      if (view?.blockIds) {
        ids.push(...view.blockIds)
      }
      // Also check collection_group_results
      if (view?.collection_group_results?.blockIds) {
        ids.push(...view.collection_group_results.blockIds)
      }
    }
  }
  
  // Remove duplicates
  return [...new Set(ids)]
}

// Helper: Get page properties
function getPageProperties(
  id: string, 
  block: Record<string, Block>, 
  schema: NotionSchema
): PostProperties | null {
  const rawProperties = block[id]?.value?.properties as Record<string, unknown[][]> | undefined
  if (!rawProperties) return null
  
  const properties: PostProperties = { id }
  
  for (const key of Object.keys(schema)) {
    const property = schema[key]
    const value = rawProperties[key] as unknown[][] | undefined
    
    if (!value) continue
    
    switch (property.type) {
      case 'title':
      case 'text':
      case 'url':
      case 'email':
      case 'phone_number':
        properties[property.name] = (value[0]?.[0] as string) || ''
        break
      case 'number':
        properties[property.name] = value[0]?.[0] ? Number(value[0][0]) : null
        break
      case 'select':
      case 'status':
        properties[property.name] = value[0]?.[0] ? [value[0][0] as string] : []
        break
      case 'multi_select':
        properties[property.name] = (value[0]?.[0] as string)?.split(',') || []
        break
      case 'date':
        if ((value[0]?.[1] as unknown[])?.[0]?.[1 as unknown as keyof unknown]) {
          const dateArray = value[0][1] as unknown[]
          const dateObj = dateArray[0] as Record<string, unknown>
          properties[property.name] = dateObj[1]
        }
        break
      case 'checkbox':
        properties[property.name] = value[0]?.[0] === 'Yes'
        break
      case 'person':
        // Person properties need additional API call, skip for now
        properties[property.name] = []
        break
      default:
        // For other types, try to extract the value
        if (value[0]?.[0]) {
          properties[property.name] = value[0][0]
        }
    }
  }
  
  return properties
}

async function main(): Promise<void> {
  const forceSync = process.argv.includes('--force')
  
  console.log('🔄 Starting Notion sync...')
  
  // Check for required environment variables
  if (!process.env.NOTION_PAGE_ID) {
    console.error('❌ Error: NOTION_PAGE_ID is not set in .env.local')
    console.error('   Please add NOTION_PAGE_ID=your-page-id to .env.local')
    process.exit(1)
  }
  
  // Ensure cache directories exist
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }
  if (!fs.existsSync(BLOCKS_DIR)) {
    fs.mkdirSync(BLOCKS_DIR, { recursive: true })
  }
  
  const api = new NotionAPI({ authToken: process.env.NOTION_ACCESS_TOKEN })
  
  console.log('📥 Fetching posts from Notion...')
  
  const pageId = idToUuid(process.env.NOTION_PAGE_ID)
  const response = await api.getPage(pageId)
  
  const collectionValues = Object.values(response.collection) as unknown as Collection[]
  const collection = collectionValues[0]?.value
  const collectionQuery = response.collection_query as unknown as CollectionQuery
  const block = response.block as unknown as Record<string, Block>
  const schema = collection?.schema as NotionSchema
  
  const rawMetadata = block[pageId]?.value
  
  if (
    rawMetadata?.type !== 'collection_view_page' &&
    rawMetadata?.type !== 'collection_view'
  ) {
    console.error(`❌ Error: pageId "${pageId}" is not a database`)
    process.exit(1)
  }
  
  // Get all page IDs from collection query
  const pageIds = getAllPageIds(collectionQuery)
  console.log(`📄 Found ${pageIds.length} pages in database`)
  
  // Get properties for each page
  const posts: PostProperties[] = []
  for (let i = 0; i < pageIds.length; i++) {
    const id = pageIds[i]
    const properties = getPageProperties(id, block, schema)
    
    if (properties) {
      // Add fullwidth
      properties.fullWidth = block[id]?.value?.format?.page_full_width ?? false
      
      // Add last_edited_time for cache invalidation
      properties.last_edited_time = block[id]?.value?.last_edited_time || 0
      
      // Convert date to timestamp
      const createdTime = block[id]?.value?.created_time
      const dateValue = properties.date as { start_date?: string } | undefined
      if (dateValue?.start_date) {
        properties.date = new Date(dateValue.start_date).getTime()
      } else if (createdTime) {
        properties.date = createdTime
      } else {
        properties.date = Date.now()
      }
      
      posts.push(properties)
    }
  }
  
  // Load existing posts cache to check for changes
  let existingPosts: Record<string, PostProperties> = {}
  if (fs.existsSync(POSTS_CACHE_FILE)) {
    try {
      const existingData = JSON.parse(fs.readFileSync(POSTS_CACHE_FILE, 'utf-8')) as PostProperties[]
      existingPosts = Object.fromEntries(existingData.map(p => [p.id, p]))
    } catch {
      // Ignore parse errors
    }
  }
  
  // Save all posts metadata
  fs.writeFileSync(POSTS_CACHE_FILE, JSON.stringify(posts, null, 2))
  console.log(`✅ Saved ${posts.length} posts metadata to ${POSTS_CACHE_FILE}`)
  
  // Sync blocks for each post
  console.log('📦 Syncing post blocks...')
  let syncedCount = 0
  let skippedCount = 0
  let updatedCount = 0
  
  for (const post of posts) {
    if (!post.id) continue
    
    const blockFile = path.join(BLOCKS_DIR, `${post.id}.json`)
    const existingPost = existingPosts[post.id]
    
    // Check if we need to sync this post
    let needsSync = forceSync
    let syncReason = 'forced'
    
    if (!needsSync && !fs.existsSync(blockFile)) {
      needsSync = true
      syncReason = 'new'
    }
    
    if (!needsSync && existingPost) {
      // Compare last_edited_time to detect updates
      const cachedEditTime = existingPost.last_edited_time || 0
      const currentEditTime = post.last_edited_time || 0
      if (currentEditTime > cachedEditTime) {
        needsSync = true
        syncReason = 'updated'
        updatedCount++
      }
    }
    
    if (!needsSync) {
      skippedCount++
      continue
    }
    
    try {
      const label = syncReason === 'updated' ? '🔄' : (syncReason === 'new' ? '✨' : '📥')
      process.stdout.write(`   ${label} ${post.title || post.id}...`)
      const blockMap = await api.getPage(post.id)
      fs.writeFileSync(blockFile, JSON.stringify(blockMap, null, 2))
      console.log(' ✓')
      syncedCount++
    } catch (error) {
      const err = error as Error
      console.log(` ❌ Error: ${err.message}`)
    }
  }
  
  console.log('')
  console.log('🎉 Sync complete!')
  console.log(`   - Posts: ${posts.length}`)
  console.log(`   - New/Updated synced: ${syncedCount}`)
  if (updatedCount > 0) {
    console.log(`   - Updated posts: ${updatedCount}`)
  }
  console.log(`   - Unchanged (cached): ${skippedCount}`)
  console.log('')
  console.log('You can now run `pnpm dev:skip-sync` to start the dev server.')
}

main().catch(error => {
  console.error('❌ Sync failed:', error)
  process.exit(1)
})
