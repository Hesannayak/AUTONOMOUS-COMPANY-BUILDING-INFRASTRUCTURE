import { createLogger } from '@acbi/utils';
import { AnthropicProvider } from './providers/anthropic-provider.js';
import { OpenAIProvider } from './providers/openai-provider.js';
import { CostTracker } from './cost-tracker.js';
import type { ChatMessage, ToolDefinition, ChatResponse } from './providers/anthropic-provider.js';

const logger = createLogger('ml-service:llm-router');

type TaskType = 'simple' | 'moderate' | 'complex' | 'creative' | 'code' | 'analysis';

type SupportedModel = 'claude-sonnet-4-20250514' | 'claude-haiku-4-20250414' | 'gpt-4-turbo' | 'gpt-4o';

interface ChatParams {
  companyId: string;
  messages: ChatMessage[];
  taskType?: TaskType;
  preferredModel?: SupportedModel;
  tools?: ToolDefinition[];
  maxTokens?: number;
}

interface CacheEntry {
  response: ChatResponse;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Model routing based on task complexity
const TASK_MODEL_MAP: Record<TaskType, SupportedModel> = {
  simple: 'claude-haiku-4-20250414',
  moderate: 'gpt-4o',
  complex: 'claude-sonnet-4-20250514',
  creative: 'claude-sonnet-4-20250514',
  code: 'claude-sonnet-4-20250514',
  analysis: 'gpt-4-turbo',
};

export class LLMRouter {
  private anthropicProvider: AnthropicProvider;
  private openaiProvider: OpenAIProvider;
  private costTracker: CostTracker;
  private cache: Map<string, CacheEntry> = new Map();
  private requestCount = 0;
  private cacheHits = 0;

  constructor() {
    this.anthropicProvider = new AnthropicProvider();
    this.openaiProvider = new OpenAIProvider();
    this.costTracker = new CostTracker();

    // Periodically clean expired cache entries
    setInterval(() => this.cleanExpiredCache(), 60_000);

    logger.info('LLMRouter initialized');
  }

  /**
   * Route a chat request to the appropriate model and provider.
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    this.requestCount++;

    // Check cost limits before proceeding
    if (this.costTracker.isOverLimit(params.companyId)) {
      throw new Error(
        `Company ${params.companyId} has exceeded its cost limit. Remaining budget: $${this.costTracker.getRemainingBudget(params.companyId).toFixed(2)}`,
      );
    }

    // Select model
    const model = params.preferredModel ?? this.selectModel(params.taskType ?? 'moderate');

    // Check cache for identical prompts
    const cacheKey = this.buildCacheKey(model, params.messages);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.cacheHits++;
      logger.info({ model, cacheHit: true }, 'Returning cached response');
      return cached.response;
    }

    // Route to appropriate provider
    const response = await this.routeToProvider(model, params.messages, params.tools, params.maxTokens);

    // Track costs
    const cost = this.costTracker.calculateCost(model, response.usage.inputTokens, response.usage.outputTokens);
    this.costTracker.trackUsage(params.companyId, model, {
      input: response.usage.inputTokens,
      output: response.usage.outputTokens,
    }, cost);

    // Cache the response
    this.cache.set(cacheKey, {
      response,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return response;
  }

  /**
   * Select the best model based on task type.
   */
  selectModel(taskType: TaskType): SupportedModel {
    const model = TASK_MODEL_MAP[taskType];
    logger.debug({ taskType, selectedModel: model }, 'Model selected for task type');
    return model;
  }

  /**
   * Get usage statistics for the router.
   */
  getUsageStats(): {
    requestCount: number;
    cacheHits: number;
    cacheHitRate: number;
    cacheSize: number;
    costBreakdown: ReturnType<CostTracker['getCostBreakdown']>;
    anthropicTokens: ReturnType<AnthropicProvider['getTokenUsage']>;
    openaiTokens: ReturnType<OpenAIProvider['getTokenUsage']>;
  } {
    return {
      requestCount: this.requestCount,
      cacheHits: this.cacheHits,
      cacheHitRate: this.requestCount > 0 ? this.cacheHits / this.requestCount : 0,
      cacheSize: this.cache.size,
      costBreakdown: this.costTracker.getCostBreakdown(),
      anthropicTokens: this.anthropicProvider.getTokenUsage(),
      openaiTokens: this.openaiProvider.getTokenUsage(),
    };
  }

  /**
   * Get the cost tracker instance for external use.
   */
  getCostTracker(): CostTracker {
    return this.costTracker;
  }

  /**
   * Route request to the correct provider based on model name.
   */
  private async routeToProvider(
    model: SupportedModel,
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    maxTokens?: number,
  ): Promise<ChatResponse> {
    if (model.startsWith('claude-')) {
      logger.info({ model }, 'Routing to Anthropic provider');
      return this.anthropicProvider.chat(model, messages, tools, maxTokens);
    }

    if (model.startsWith('gpt-')) {
      logger.info({ model }, 'Routing to OpenAI provider');
      return this.openaiProvider.chat(model, messages, tools, maxTokens);
    }

    // Fallback to Anthropic
    logger.warn({ model }, 'Unknown model prefix, falling back to Anthropic provider');
    return this.anthropicProvider.chat(model, messages, tools, maxTokens);
  }

  /**
   * Build a cache key from model and messages.
   */
  private buildCacheKey(model: string, messages: ChatMessage[]): string {
    const messageHash = messages.map((m) => `${m.role}:${m.content}`).join('|');
    return `${model}::${messageHash}`;
  }

  /**
   * Remove expired entries from the cache.
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.debug({ cleaned, remaining: this.cache.size }, 'Expired cache entries cleaned');
    }
  }
}
