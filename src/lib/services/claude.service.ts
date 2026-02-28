import { settingsService } from "./settings.service";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

// 利用可能なモデル
export const AVAILABLE_MODELS = {
  "haiku": "claude-haiku-4-5-20251001",      // 最も安価
  "sonnet": "claude-sonnet-4-20250514",      // バランス型
  "opus": "claude-3-opus-20240229",          // 最高性能
} as const;

export type ModelKey = keyof typeof AVAILABLE_MODELS;

// APIキーを動的に取得（DB優先 → 環境変数フォールバック）
async function getApiKey(): Promise<string> {
  const dbKey = await settingsService.get("ANTHROPIC_API_KEY").catch(() => null);
  return dbKey || process.env.ANTHROPIC_API_KEY || "";
}

// デフォルトモデルを動的に取得
async function getDefaultModel(): Promise<string> {
  const dbModel = await settingsService.get("CLAUDE_MODEL").catch(() => null);
  return dbModel || process.env.CLAUDE_MODEL || "haiku";
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class ClaudeService {
  private systemPromptCache: string | null = null;

  // システムプロンプトのキャッシュ設定
  setSystemPromptCache(prompt: string): void {
    this.systemPromptCache = prompt;
  }

  // モデルIDを取得
  private async getModelId(modelKey?: ModelKey | string): Promise<string> {
    const key = modelKey || await getDefaultModel();
    if (key in AVAILABLE_MODELS) {
      return AVAILABLE_MODELS[key as ModelKey];
    }
    // 直接モデルIDが指定された場合はそのまま使用
    return key;
  }

  // メッセージを送信
  async sendMessage(
    messages: Message[],
    options: {
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
      model?: ModelKey | string;
    } = {}
  ): Promise<ClaudeResponse> {
    const apiKey = await getApiKey();
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const { systemPrompt, maxTokens = 4096, temperature = 0.7, model } = options;
    const modelId = await this.getModelId(model);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: modelId,
            max_tokens: maxTokens,
            temperature,
            system: systemPrompt || this.systemPromptCache || undefined,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();

          // レート制限の場合はリトライ
          if (response.status === 429) {
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          throw new Error(`Claude API error: ${response.status} - ${errorBody}`);
        }

        const data = await response.json();

        return {
          content: data.content[0]?.text || "",
          usage: {
            inputTokens: data.usage?.input_tokens || 0,
            outputTokens: data.usage?.output_tokens || 0,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < MAX_RETRIES - 1) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("Claude API request failed");
  }

  // ストリーミングレスポンス
  async *streamMessage(
    messages: Message[],
    options: {
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
      model?: ModelKey | string;
    } = {}
  ): AsyncGenerator<string> {
    const apiKey = await getApiKey();
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const { systemPrompt, maxTokens = 4096, temperature = 0.7, model } = options;
    const modelId = await this.getModelId(model);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: maxTokens,
        temperature,
        stream: true,
        system: systemPrompt || this.systemPromptCache || undefined,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              yield parsed.delta.text;
            }
          } catch {
            // JSON parse error - skip
          }
        }
      }
    }
  }
}

export const claudeService = new ClaudeService();
