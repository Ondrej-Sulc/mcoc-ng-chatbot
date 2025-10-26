import { PostHog } from 'posthog-node';
import { config } from '../config';

let posthogClient: PostHog | null = null;

if (config.POSTHOG_API_KEY && config.POSTHOG_HOST) {
    posthogClient = new PostHog(config.POSTHOG_API_KEY, {
        host: config.POSTHOG_HOST,
    });
}

export const posthogService = {
    capture(event: string, properties: Record<string, any>) {
        if (posthogClient) {
            posthogClient.capture({
                distinctId: properties.distinctId, // Expecting distinctId to be passed in properties
                event,
                properties,
            });
        }
    },

    shutdown() {
        if (posthogClient) {
            posthogClient.shutdown();
        }
    },
};
