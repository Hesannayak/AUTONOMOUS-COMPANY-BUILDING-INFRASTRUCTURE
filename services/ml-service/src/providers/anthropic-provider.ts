import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '@acbi/utils';

const logger = createLogger('ml-service:anthropic-provider');

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatResponse {
  id: string;
  model: string;
  content: string;
  toolCalls?: Array<{ name: string; input: Record<string, unknown> }>;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  finishReason: string;
}

export class AnthropicProvider {
  private client: Anthropic | null = null;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;

  constructor() {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      logger.info('AnthropicProvider initialized with real API key');
    } else {
      logger.warn('ANTHROPIC_API_KEY not set — running in placeholder mode');
    }
  }

  async chat(
    model: string,
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    maxTokens?: number,
  ): Promise<ChatResponse> {
    const resolvedMaxTokens = maxTokens ?? 4096;

    logger.info(
      { model, messageCount: messages.length, tools: tools?.length ?? 0, maxTokens: resolvedMaxTokens },
      'Anthropic chat request',
    );

    // If no API key, return placeholder
    if (!this.client) {
      return this.placeholderResponse(model, messages, resolvedMaxTokens);
    }

    // Real Anthropic API call
    const systemMessage = messages.find((m) => m.role === 'system');
    const nonSystemMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Ensure conversation starts with user message
    if (nonSystemMessages.length === 0 || nonSystemMessages[0]?.role !== 'user') {
      nonSystemMessages.unshift({ role: 'user', content: 'Begin.' });
    }

    const requestParams: Anthropic.MessageCreateParams = {
      model,
      max_tokens: resolvedMaxTokens,
      messages: nonSystemMessages,
    };

    if (systemMessage) {
      requestParams.system = systemMessage.content;
    }

    if (tools && tools.length > 0) {
      requestParams.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Anthropic.Tool.InputSchema,
      }));
    }

    const apiResponse = await this.client.messages.create(requestParams);

    // Extract text content
    let content = '';
    const toolCalls: Array<{ name: string; input: Record<string, unknown> }> = [];

    for (const block of apiResponse.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    this.totalInputTokens += apiResponse.usage.input_tokens;
    this.totalOutputTokens += apiResponse.usage.output_tokens;

    const response: ChatResponse = {
      id: apiResponse.id,
      model: apiResponse.model,
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: apiResponse.usage.input_tokens,
        outputTokens: apiResponse.usage.output_tokens,
      },
      finishReason: apiResponse.stop_reason ?? 'end_turn',
    };

    logger.info(
      { id: response.id, inputTokens: response.usage.inputTokens, outputTokens: response.usage.outputTokens },
      'Anthropic chat response',
    );

    return response;
  }

  private placeholderResponse(
    model: string,
    messages: ChatMessage[],
    maxTokens: number,
  ): ChatResponse {
    const simulatedInputTokens = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    const simulatedOutputTokens = Math.ceil(maxTokens * 0.3);

    this.totalInputTokens += simulatedInputTokens;
    this.totalOutputTokens += simulatedOutputTokens;

    return {
      id: `msg_placeholder_${Date.now()}`,
      model,
      content: `[Placeholder] Anthropic ${model} response to: "${messages[messages.length - 1]?.content.slice(0, 100) ?? ''}"`,
      usage: {
        inputTokens: simulatedInputTokens,
        outputTokens: simulatedOutputTokens,
      },
      finishReason: 'end_turn',
    };
  }

  getTokenUsage(): { inputTokens: number; outputTokens: number } {
    return {
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
    };
  }
}
