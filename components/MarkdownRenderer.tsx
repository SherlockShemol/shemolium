'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import 'heti/umd/heti.min.css'
import { useConfig } from '@/lib/config'
import { FONTS_SANS, FONTS_SERIF } from '@/consts'
import type { Components } from 'react-markdown'

/**
 * Inline Mermaid diagram renderer
 */
function MermaidBlock({ code }: { code: string }) {
  const container = useRef<HTMLDivElement>(null)
  const [svg, setSVG] = useState('')

  useEffect(() => {
    let cancelled = false
    
    import('mermaid').then(({ default: mermaid }) => {
      if (cancelled) return
      mermaid.initialize({ theme: 'neutral', startOnLoad: false })
      const id = `mermaid-${Math.random().toString(36).slice(2)}`
      
      // Check if container still exists before rendering
      if (!container.current) return
      
      mermaid.render(id, code, container.current)
        .then(({ svg }) => { 
          if (!cancelled && container.current) {
            setSVG(svg) 
          }
        })
        .catch(() => { 
          if (!cancelled) {
            setSVG(`<pre>${code}</pre>`) 
          }
        })
    })
    
    return () => { 
      cancelled = true
      // Clear SVG when component unmounts to prevent DOM manipulation errors
      setSVG('')
    }
  }, [code])

  return (
    <div
      ref={container}
      className="w-full leading-normal flex justify-center"
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  )
}

interface MarkdownRendererProps {
  content: string
  darkMode?: boolean | null
}

/**
 * Markdown page renderer
 *
 * Replaces NotionRenderer — renders standard Markdown content
 * with GFM support, syntax highlighting, and image handling.
 */
export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const config = useConfig()
  const hetiRef = useRef<HTMLDivElement>(null)

  // Apply heti autoSpacing for CJK/Latin mixed text and punctuation compression
  useEffect(() => {
    let isMounted = true
    let timeoutId: NodeJS.Timeout | null = null
    
    if (hetiRef.current) {
      // Use a small delay to ensure DOM is fully rendered before applying heti
      timeoutId = setTimeout(() => {
        if (!isMounted || !hetiRef.current) return
        
        import('heti/umd/heti-addon.min.js').then((mod) => {
          if (!isMounted || !hetiRef.current) return
          
          try {
            const Heti = mod.default || mod
            const heti = new Heti('.heti')
            heti.autoSpacing()
          } catch (error) {
            // Silently ignore errors to prevent breaking the page
            console.warn('Heti autoSpacing error:', error)
          }
        }).catch(() => {
          // heti addon is optional, gracefully ignore
        })
      }, 100)
    }
    
    return () => {
      isMounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [content])
  const fontMap: Record<string, string[]> = {
    'sans-serif': FONTS_SANS,
    'serif': FONTS_SERIF
  }
  const font = fontMap[config.font]

  const components: Partial<Components> = {
    // Custom code block rendering with Mermaid support
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '')
      const lang = match ? match[1] : ''
      const codeString = String(children).replace(/\n$/, '')

      // Handle Mermaid diagrams
      if (lang.toLowerCase() === 'mermaid') {
        return <MermaidBlock code={codeString} />
      }

      // Inline code (no language class and no newlines)
      if (!className && !String(children).includes('\n')) {
        return <code className="notion-inline-code" {...props}>{children}</code>
      }

      // Block code — rehype-highlight handles syntax highlighting
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    },

    // Images
    img({ src, alt, ...props }) {
      if (!src) return null
      return (
        <figure className="notion-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt || ''}
            loading="lazy"
            style={{ maxWidth: '100%', height: 'auto' }}
            {...props}
          />
          {alt && <figcaption className="notion-image-caption">{alt}</figcaption>}
        </figure>
      )
    },

    // Links — open external links in new tab
    a({ href, children, ...props }) {
      const isExternal = href && (href.startsWith('http://') || href.startsWith('https://'))
      return (
        <a
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          {...props}
        >
          {children}
        </a>
      )
    },

    // Blockquotes
    blockquote({ children, ...props }) {
      return (
        <blockquote className="notion-quote" {...props}>
          {children}
        </blockquote>
      )
    },

    // Tables
    table({ children, ...props }) {
      return (
        <div className="notion-table-wrap">
          <table className="notion-table" {...props}>
            {children}
          </table>
        </div>
      )
    }
  }

  return (
    <>
      <style jsx global>
        {`
        .notion {
          --notion-font: ${font};
        }
        .markdown-body {
          font-family: var(--notion-font);
          line-height: 1.7;
          color: inherit;
        }
        .markdown-body h1, .markdown-body h2, .markdown-body h3,
        .markdown-body h4, .markdown-body h5, .markdown-body h6 {
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          font-weight: 600;
        }
        .markdown-body h1 { font-size: 1.875em; }
        .markdown-body h2 { font-size: 1.5em; }
        .markdown-body h3 { font-size: 1.25em; }
        .markdown-body p { margin: 0.5em 0; }
        .markdown-body ul, .markdown-body ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .markdown-body li { margin: 0.25em 0; }
        .markdown-body pre {
          background: var(--bg-color-1, #f7f6f3);
          border-radius: 4px;
          padding: 1em;
          overflow-x: auto;
          margin: 0.75em 0;
        }
        :is(.dark) .markdown-body pre {
          background: #2d2d2d;
        }
        .markdown-body code {
          font-size: 0.9em;
        }
        .notion-inline-code {
          background: rgba(135,131,120,0.15);
          border-radius: 3px;
          padding: 0.2em 0.4em;
          font-size: 85%;
          color: #eb5757;
        }
        :is(.dark) .notion-inline-code {
          background: rgba(135,131,120,0.3);
          color: #ff7a7a;
        }
        .markdown-body blockquote {
          border-left: 3px solid currentColor;
          padding: 0.2em 0.9em;
          margin: 0.5em 0;
          opacity: 0.8;
        }
        .markdown-body hr {
          border: none;
          border-top: 1px solid var(--fg-color-2, #e5e5e5);
          margin: 1.5em 0;
        }
        :is(.dark) .markdown-body hr {
          border-top-color: #333;
        }
        .notion-image {
          margin: 1em 0;
          text-align: center;
        }
        .notion-image img {
          border-radius: 4px;
        }
        .notion-image-caption {
          font-size: 0.875em;
          color: #999;
          margin-top: 0.5em;
        }
        .notion-table-wrap {
          overflow-x: auto;
          margin: 0.75em 0;
        }
        .notion-table {
          border-collapse: collapse;
          width: 100%;
        }
        .notion-table th, .notion-table td {
          border: 1px solid var(--fg-color-2, #e5e5e5);
          padding: 0.5em 0.75em;
          text-align: left;
        }
        :is(.dark) .notion-table th, :is(.dark) .notion-table td {
          border-color: #333;
        }
        .notion-table th {
          background: var(--bg-color-1, #f7f6f3);
          font-weight: 600;
        }
        :is(.dark) .notion-table th {
          background: #2d2d2d;
        }
        .markdown-body a {
          color: inherit;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .markdown-body a:hover {
          opacity: 0.8;
        }
        .markdown-body input[type="checkbox"] {
          margin-right: 0.5em;
        }
        `}
      </style>
      <div ref={hetiRef} className="markdown-body notion heti">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          rehypePlugins={[rehypeRaw, rehypeHighlight]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </div>
    </>
  )
}
