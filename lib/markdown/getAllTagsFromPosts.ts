import type { Post } from '@/types'

export function getAllTagsFromPosts(posts: Post[]): Record<string, number> {
    const taggedPosts = posts.filter(post => post?.tags)
    const tags: Record<string, number> = {}

    taggedPosts.forEach(post => {
        post?.tags?.forEach(tag => {
            if (tag in tags) {
                tags[tag] += 1
            } else {
                tags[tag] = 1
            }
        })
    })

    return tags
}
