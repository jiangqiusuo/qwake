export interface OpenAICompatibleClientOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutSeconds?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResult {
  text: string;
  rawModel?: string;
  usage?: unknown;
  latencyMs: number;
}

export async function requestChatCompletion(
  options: OpenAICompatibleClientOptions,
  prompt: string
): Promise<ChatCompletionResult> {
  const controller = new AbortController();
  const timeoutMs = Math.max(1, options.timeoutSeconds ?? 30) * 1000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${options.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "authorization": `Bearer ${options.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: options.model,
        temperature: options.temperature ?? 1,
        max_tokens: options.maxTokens ?? 16,
        stream: false,
        reasoning_effort: "none",
        messages: [
          {
            role: "system",
            content: "Answer with exactly one word, one letter, one number, or one coin side. Do not explain."
          },
          { role: "user", content: prompt }
        ]
      })
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
    }
    const parsed = JSON.parse(text) as {
      model?: string;
      usage?: unknown;
      choices?: Array<{ message?: { content?: string }; text?: string }>;
    };
    const content = parsed.choices?.[0]?.message?.content ?? parsed.choices?.[0]?.text ?? "";
    return {
      text: content,
      rawModel: parsed.model,
      usage: parsed.usage,
      latencyMs: Date.now() - startedAt
    };
  } finally {
    clearTimeout(timeout);
  }
}
