import type { Post } from '@/types'

interface FilterOptions {
    posts: Post[]
    includePages?: boolean
}

export default function filterPublishedPosts({ posts, includePages }: FilterOptions): Post[] {
    if (!posts || !posts.length) return []
    return posts
        .filter(post =>
            includePages
                ? post?.type?.[0] === 'Post' || post?.type?.[0] === 'Page'
                : post?.type?.[0] === 'Post'
        )
        .filter(post =>
            post.title &&
            post.slug &&
            post?.status?.[0] === 'Published' &&
            post.date <= Date.now()
        )
}
