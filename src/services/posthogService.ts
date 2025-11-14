import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;
let isInitialized = false;

export async function getPosthogClient(): Promise<PostHog | null> {
    if (!isInitialized) {
        isInitialized = true; // Set immediately to prevent race conditions
        try {
            const { config } = await import('../config.js');
            if (config.POSTHOG_API_KEY && config.POSTHOG_HOST) {
                posthogClient = new PostHog(config.POSTHOG_API_KEY, {
                    host: config.POSTHOG_HOST,
                    flushAt: 1,
                    flushInterval: 0
                });
                console.log("✅ PostHog client initialized.");
            }
        } catch (e) {
            console.error("❌ Failed to initialize PostHog client:", e);
            posthogClient = null;
        }
    }
    return posthogClient;
}