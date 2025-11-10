// components/PostHogProvider.tsx
'use client'
import { usePathname, useSearchParams } from 'next/navigation'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useEffect } from 'react'

if (typeof window !== 'undefined') {
  const posthog_key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const posthog_host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (posthog_key && posthog_host) {
    import('posthog-js').then((posthog) => {
      posthog.init(posthog_key, {
        api_host: posthog_host,
        // Enable debug mode in development
        loaded: (posthog) => {
          if (process.env.NODE_ENV === 'development') posthog.debug()
        }
      })
    })
  }
}

function PostHogPageview(): null {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const posthog = usePostHog()

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname
      if (searchParams && searchParams.toString()) {
        url = url + `?${searchParams.toString()}`
      }
      posthog.capture('$pageview', {
        '$current_url': url,
      })
    }
  }, [pathname, searchParams, posthog])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider>
      <PostHogPageview />
      {children}
    </PHProvider>
  )
}