// components/PostHogProvider.tsx
'use client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

if (typeof window !== 'undefined') {
  const posthog_key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const posthog_host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (posthog_key && posthog_host) {
    posthog.init(posthog_key, {
      api_host: posthog_host,
      capture_pageview: false // we capture pageviews manually
    })
  }
}

export function PostHogPageview(): null {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname) {
      let url = window.origin + pathname
      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`
      }
      posthog.capture('$pageview', {
        '$current_url': url,
      })
    }
  }, [pathname, searchParams])

  return null
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}