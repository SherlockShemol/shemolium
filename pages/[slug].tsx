import { clientConfig } from '@/lib/server/config'

import { useRouter } from 'next/router'
import { useMemo } from 'react'
import cn from 'classnames'
import { getAllPosts, getPostContent } from '@/lib/notion'
import { useLocale } from '@/lib/locale'
import { useConfig } from '@/lib/config'
import { createHash } from 'crypto'
import Container from '@/components/Container'
import Post from '@/components/Post'
import Comments from '@/components/Comments'
import type { GetStaticProps, GetStaticPaths, InferGetStaticPropsType } from 'next'
import type { Post as PostType } from '@/types'

/**
 * Select the appropriate post based on current language
 */
function useLocalizedPost(posts: PostType[], lang: string): PostType | null {
  return useMemo(() => {
    if (!posts || posts.length === 0) return null
    if (posts.length === 1) return posts[0]

    // Find post matching current language
    const localizedPost = posts.find(post => {
      const postLangs = post.lang
      if (!postLangs || postLangs.length === 0) return false
      return postLangs.includes(lang)
    })

    // Return localized post or fallback to first post
    return localizedPost || posts[0]
  }, [posts, lang])
}

interface BlogPostPageProps {
  posts: PostType[]
  contents: Record<string, string>
  emailHash: string
}

export default function BlogPostPage({ posts, contents, emailHash }: InferGetStaticPropsType<typeof getStaticProps>) {
  const router = useRouter()
  const BLOG = useConfig()
  const { locale, lang } = useLocale()

  // Select the appropriate post based on current language
  const post = useLocalizedPost(posts, lang)
  const content = post ? contents[post.id] : null

  // TODO: It would be better to render something
  if (router.isFallback || !post || !content) return null

  const fullWidth = post.fullWidth ?? false

  return (
    <Container
      layout="blog"
      title={post.title}
      description={post.summary}
      slug={post.slug}
      // date={new Date(post.publishedAt).toISOString()}
      type="article"
      fullWidth={fullWidth}
    >
      <Post
        post={post}
        content={content}
        emailHash={emailHash}
        fullWidth={fullWidth}
      />

      {/* Back and Top */}
      <div
        className={cn(
          'px-4 flex justify-between font-medium text-gray-500 dark:text-gray-400 my-5',
          fullWidth ? 'md:px-24' : 'mx-auto max-w-2xl'
        )}
      >
        <a>
          <button
            onClick={() => router.push(BLOG.path || '/')}
            className="mt-2 cursor-pointer hover:text-black dark:hover:text-gray-100"
          >
            ← {locale.POST.BACK}
          </button>
        </a>
        <a>
          <button
            onClick={() => window.scrollTo({
              top: 0,
              behavior: 'smooth'
            })}
            className="mt-2 cursor-pointer hover:text-black dark:hover:text-gray-100"
          >
            ↑ {locale.POST.TOP}
          </button>
        </a>
      </div>

      <Comments frontMatter={post} />
    </Container>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getAllPosts({ includePages: true })
  // Get unique slugs (there might be multiple posts with same slug for different languages)
  const uniqueSlugs = [...new Set((posts || []).map(row => row.slug))]
  return {
    paths: uniqueSlugs.map(slug => `${clientConfig.path}/${slug}`),
    fallback: true
  }
}

export const getStaticProps: GetStaticProps<BlogPostPageProps, { slug: string }> = async ({ params }) => {
  const slug = params?.slug
  if (!slug) return { notFound: true }

  const allPosts = await getAllPosts({ includePages: true })
  // Get all posts with this slug (could be multiple language versions)
  const posts = (allPosts || []).filter(t => t.slug === slug)

  if (!posts || posts.length === 0) return { notFound: true }

  // Fetch markdown content for all language versions
  const contents: Record<string, string> = {}
  for (const post of posts) {
    const content = await getPostContent(post.slug)
    if (content) {
      contents[post.id] = content
    }
  }

  const emailHash = createHash('md5')
    .update(clientConfig.email)
    .digest('hex')
    .trim()
    .toLowerCase()

  return {
    props: { posts, contents, emailHash },
    revalidate: 60
  }
}
