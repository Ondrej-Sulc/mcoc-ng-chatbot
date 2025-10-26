import { PostHog } from 'posthog-node';
import { config } from '../config';

let posthogClient: PostHog | null = null;

if (config.POSTHOG_API_KEY && config.POSTHOG_HOST) {
    posthogClient = new PostHog(config.POSTHOG_API_KEY, {
        host: config.POSTHOG_HOST,
    });
}

export const posthogService = {
    capture(distinctId: string, event: string, properties: Record<string, any>) {
        if (posthogClient) {
            posthogClient.capture({
                distinctId,
                event,
                properties,
            });
            // Flush events immediately to ensure they are sent, especially in a serverless environment
            // or when debugging. For a long-running bot, events are otherwise sent in batches.
            posthogClient.flush();
        }
    },

    shutdown() {
        if (posthogClient) {
            posthogClient.shutdown();
        }
    },
};
