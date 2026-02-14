import type Redis from "ioredis";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

interface CompletionResult {
  content: string;
  model: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
}

const DEFAULT_MODEL = "minimax/minimax-m2.5";
const FALLBACK_MODEL = "moonshotai/kimi-k2.5";
const BUDGET_KEY = "growth:daily_cost";
const BUDGET_TTL = 86400; // 24h

export class OpenRouterService {
  private apiKey: string;
  private dailyBudget: number;

  constructor(private redis: Redis) {
    this.apiKey = process.env.OPENROUTER_API_KEY || "";
    this.dailyBudget = Number(process.env.GROWTH_DAILY_BUDGET) || 0.5;
  }

  async complete(
    messages: Message[],
    opts: CompletionOptions = {}
  ): Promise<CompletionResult> {
    if (!this.apiKey) throw new Error("OPENROUTER_API_KEY not set");

    // Budget check
    const spent = Number((await this.redis.get(BUDGET_KEY)) || "0");
    if (spent >= this.dailyBudget) {
      throw new Error(
        `Daily budget exceeded: $${spent.toFixed(3)} / $${this.dailyBudget}`
      );
    }

    const model = opts.model || DEFAULT_MODEL;
    const result = await this.callApi(messages, { ...opts, model });

    // Track cost
    await this.redis
      .multi()
      .incrbyfloat(BUDGET_KEY, result.cost)
      .expire(BUDGET_KEY, BUDGET_TTL)
      .exec();

    return result;
  }

  private async callApi(
    messages: Message[],
    opts: CompletionOptions & { model: string },
    retries = 0
  ): Promise<CompletionResult> {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages,
      max_tokens: opts.maxTokens || 4096,
      temperature: opts.temperature ?? 0.7,
    };
    if (opts.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://wowguilds.com",
          "X-Title": "WoW Guilds",
        },
        body: JSON.stringify(body),
      }
    );

    if (res.status === 429 && retries < 2) {
      const delay = Math.pow(2, retries + 1) * 1000;
      await new Promise((r) => setTimeout(r, delay));
      return this.callApi(messages, opts, retries + 1);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // Try fallback model on primary model failure
      if (opts.model === DEFAULT_MODEL && retries === 0) {
        console.warn(
          `[OpenRouter] ${opts.model} failed (${res.status}), trying fallback`
        );
        return this.callApi(messages, { ...opts, model: FALLBACK_MODEL });
      }
      throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const choice = json.choices?.[0];
    if (!choice?.message?.content) {
      throw new Error("OpenRouter returned empty response");
    }

    const usage = json.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    // Rough cost estimate: $0.50/M input, $1.50/M output (conservative)
    const cost =
      (inputTokens * 0.5 + outputTokens * 1.5) / 1_000_000;

    return {
      content: choice.message.content,
      model: json.model || opts.model,
      cost,
      inputTokens,
      outputTokens,
    };
  }

  async getDailySpend(): Promise<number> {
    return Number((await this.redis.get(BUDGET_KEY)) || "0");
  }
}
