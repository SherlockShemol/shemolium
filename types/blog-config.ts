export interface SEOConfig {
  keywords?: string[]
  googleSiteVerification?: string
}

export interface AckeeConfig {
  tracker: string
  dataAckeeServer: string
  domainId: string
}

export interface GAConfig {
  measurementId: string
}

export interface AnalyticsConfig {
  provider: '' | 'ga' | 'ackee'
  ackeeConfig: AckeeConfig
  gaConfig: GAConfig
}

export interface GitalkConfig {
  repo: string
  owner: string
  admin: string[]
  clientID: string
  clientSecret: string
  distractionFreeMode: boolean
}

export interface UtterancesConfig {
  repo: string
}

export interface CusdisConfig {
  appId: string
  host: string
  scriptSrc: string
}

export interface CommentConfig {
  provider: '' | 'gitalk' | 'utterances' | 'cusdis'
  gitalkConfig: GitalkConfig
  utterancesConfig: UtterancesConfig
  cusdisConfig: CusdisConfig
}

export type SupportedLang = 'en-US' | 'zh-CN' | 'zh-HK' | 'zh-TW' | 'ja-JP' | 'es-ES'
export type Appearance = 'light' | 'dark' | 'auto'
export type FontStyle = 'sans-serif' | 'serif'

export interface BlogConfig {
  title: string
  author: string
  email: string
  link: string
  description: string
  lang: SupportedLang
  timezone: string
  appearance: Appearance
  font: FontStyle
  lightBackground: string
  darkBackground: string
  path: string
  since: number
  postsPerPage: number
  sortByDate: boolean
  showAbout: boolean
  showArchive: boolean
  autoCollapsedNavBar: boolean
  ogImageGenerateURL: string
  socialLink: string
  seo: SEOConfig
  notionPageId?: string | undefined
  notionAccessToken?: string | undefined
  analytics: AnalyticsConfig
  comment: CommentConfig
  isProd: boolean
}
