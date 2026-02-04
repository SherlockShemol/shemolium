export interface PostDate {
  start_date?: string
}

export interface PostAuthor {
  id: string
  first_name?: string
  last_name?: string
  profile_photo?: string
}

export interface Post {
  id: string
  title: string
  slug: string
  summary?: string
  date: number // Unix timestamp in milliseconds
  type: string[]
  status?: string[]
  tags?: string[]
  lang?: string[]
  fullWidth?: boolean
  author?: PostAuthor[]
}

export interface PostWithContent extends Post {
  content: string
}
