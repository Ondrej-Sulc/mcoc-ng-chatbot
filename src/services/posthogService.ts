import { PostHog } from 'posthog-node';
import { config } from '../config';

let posthogClient: PostHog | null = null;

if (config.POSTHOG_API_KEY && config.POSTHOG_HOST) {
    try {
        posthogClient = new PostHog(config.POSTHOG_API_KEY, {
            host: config.POSTHOG_HOST,
            flushAt: 1,
            flushInterval: 0
        });
        console.log("✅ PostHog client initialized.");
    } catch (e) {
        console.error("❌ Failed to initialize PostHog client:", e);
    }
}

export default posthogClient;