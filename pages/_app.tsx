import 'katex/dist/katex.min.css'
import { useEffect, useState } from 'react'
import '@/styles/globals.css'
import '@/styles/notion.css'
import dynamic from 'next/dynamic'
import loadLocale from '@/assets/i18n'
import { ConfigProvider } from '@/lib/config'
import { LocaleProvider, getClientLang } from '@/lib/locale'
import { prepareDayjs } from '@/lib/dayjs'
import { ThemeProvider } from '@/lib/theme'
import Scripts from '@/components/Scripts'
import blogConfig from '@/blog.config'
import { oppoSans } from '@/lib/fonts'
import type { AppProps } from 'next/app'
import type { Locale, BlogConfig } from '@/types'

// Static imports for default locales to avoid hydration mismatch
import enUS from '@/assets/i18n/basic/en-US.json'
import zhCN from '@/assets/i18n/basic/zh-CN.json'

const Ackee = dynamic(() => import('@/components/Ackee'), { ssr: false })
const Gtag = dynamic(() => import('@/components/Gtag'), { ssr: false })

// Load config at module level (build time) - this is static and doesn't change at runtime
const staticConfig = blogConfig as BlogConfig

// Default locale map for SSR/initial render
const defaultLocales: Record<string, Locale> = {
  'en-US': enUS as Locale,
  'zh-CN': zhCN as Locale
}

export default function MyApp({ Component, pageProps }: AppProps) {
  const [config] = useState(staticConfig)

  // Use config's default language for initial render (consistent between server and client)
  const defaultLang = staticConfig.lang
  const defaultLocale = defaultLocales[defaultLang] || (enUS as Locale)

  const [currentLang, setCurrentLang] = useState<string>(defaultLang)
  const [currentLocale, setCurrentLocale] = useState<Locale>(defaultLocale)

  // Client-side initialization: detect user preference and switch language if needed
  useEffect(() => {
    // Prepare dayjs with timezone
    prepareDayjs(staticConfig.timezone)

    // Get client-side language preference (from localStorage or browser)
    const clientLang = getClientLang(staticConfig.lang)

    // Only switch if different from default
    if (clientLang !== defaultLang) {
      const newLocale = defaultLocales[clientLang]
      if (newLocale) {
        setCurrentLang(clientLang)
        setCurrentLocale(newLocale)
      } else {
        // Fallback to async load for other locales
        loadLocale('basic', clientLang).then(locale => {
          setCurrentLang(clientLang)
          setCurrentLocale(locale)
        })
      }
    }
  }, [defaultLang])

  return (
    <div className={oppoSans.variable}>
      <ConfigProvider value={config}>
        <Scripts />
        <LocaleProvider initialLang={currentLang} initialLocale={currentLocale}>
          <ThemeProvider>
            <>
              {process.env.VERCEL_ENV === 'production' && config?.analytics?.provider === 'ackee' && (
                <Ackee
                  ackeeServerUrl={config.analytics.ackeeConfig.dataAckeeServer}
                  ackeeDomainId={config.analytics.ackeeConfig.domainId}
                />
              )}
              {process.env.VERCEL_ENV === 'production' && config?.analytics?.provider === 'ga' && <Gtag />}
              <Component {...pageProps} />
            </>
          </ThemeProvider>
        </LocaleProvider>
      </ConfigProvider>
    </div>
  )
}
