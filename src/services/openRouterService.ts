import { config } from "../config";

const OPEN_ROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export type OpenRouterMessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: OpenRouterMessageContent;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: "json_object" };
}

export interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
}

/**
 * Service for interacting with the OpenRouter API.
 */
export class OpenRouterService {
  private apiKey: string;

  /**
   * Creates an instance of OpenRouterService.
   * @param apiKey - The OpenRouter API key.
   */
  constructor(apiKey: string) {
    if (!apiKey)
      throw new Error("OPEN_ROUTER_API_KEY is not set in environment.");
    this.apiKey = apiKey;
  }

  async chat(request: OpenRouterRequest): Promise<OpenRouterResponse> {
    /**
     * Sends a chat request to the OpenRouter API.
     * @param request - The chat request parameters.
     * @returns A promise that resolves to an OpenRouterResponse.
     */
    const res = await fetch(OPEN_ROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenRouter API error: ${res.status} ${errorText}`);
    }
    return res.json();
  }
}

export const openRouterService = new OpenRouterService(
  config.OPEN_ROUTER_API_KEY!
);

export async function getLLMSummary(
  messageHistory: { role: string; content: string }[],
  summaryPrompt: string
): Promise<string> {
  try {
    const messages: OpenRouterMessage[] = [
      { role: "system", content: summaryPrompt },
      ...messageHistory.map((msg) => ({
        role: msg.role as "user" | "assistant", // Cast to valid roles
        content: msg.content,
      })),
    ];

    const request: OpenRouterRequest = {
      model: config.OPENROUTER_DEFAULT_MODEL, // Or another suitable model
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000, // Adjust as needed for summary length
    };

    const response = await openRouterService.chat(request);

    if (response.choices && response.choices.length > 0) {
      return response.choices[0].message.content;
    } else {
      return "Error: No summary returned from LLM.";
    }
  } catch (error: any) {
    if (error.message.includes("401")) {
      return "Error: LLM API key not configured or invalid.";
    } else if (error.message.includes("Failed to fetch")) {
      return "Error: Could not connect to LLM API. Check network or API endpoint.";
    } else {
      return `Error: LLM API returned an error: ${error.message}`;
    }
  }
}
