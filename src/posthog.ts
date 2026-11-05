const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST

if (__DEV__ && !apiKey) {
  throw new Error(
    'EXPO_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once EXPO_PUBLIC_POSTHOG_KEY is configured',
  )
}

if (__DEV__ && !host) {
  throw new Error(
    'EXPO_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once EXPO_PUBLIC_POSTHOG_HOST is configured',
  )
}

export const posthogApiKey = apiKey
export const posthogOptions = host
  ? {
      host,
      captureAppLifecycleEvents: true,
      debug: __DEV__,
      preloadFeatureFlags: true,
      logs: {
        serviceName: 'tetris-app',
        environment: __DEV__ ? 'development' : 'production',
      },
      errorTracking: {
        autocapture: {
          uncaughtExceptions: true,
          unhandledRejections: true,
          console: [],
        },
      },
    }
  : undefined
