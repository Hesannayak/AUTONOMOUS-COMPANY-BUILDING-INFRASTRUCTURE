import { EventEmitter } from 'eventemitter3';
import type {
  AgentType,
  AgentStatus,
  AgentTask,
  AgentResult,
  AgentConfig,
  LLMModel,
  Artifact,
} from '@acbi/types';
import { createLogger, generateId } from '@acbi/utils';

export interface AgentEvents {
  'task:started': (task: AgentTask) => void;
  'task:completed': (task: AgentTask, result: AgentResult) => void;
  'task:failed': (task: AgentTask, error: Error) => void;
  'tool:called': (toolName: string, input: unknown) => void;
  'llm:called': (model: LLMModel, tokensUsed: number) => void;
}

export interface LLMProvider {
  chat(params: {
    model: LLMModel;
    messages: Array<{ role: string; content: string }>;
    tools?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
    maxTokens?: number;
  }): Promise<{
    content: string;
    toolCalls?: Array<{ name: string; input: Record<string, unknown> }>;
    tokensUsed: number;
  }>;
}

export abstract class BaseAgent extends EventEmitter<AgentEvents> {
  readonly id: string;
  readonly type: AgentType;
  protected status: AgentStatus = 'idle';
  protected config: AgentConfig;
  protected logger: ReturnType<typeof createLogger>;
  protected llm: LLMProvider | null = null;
  protected artifacts: Artifact[] = [];

  constructor(config: AgentConfig) {
    super();
    this.id = generateId('agent');
    this.type = config.type;
    this.config = config;
    this.logger = createLogger(`agent:${config.type}`);
  }

  setLLMProvider(provider: LLMProvider): void {
    this.llm = provider;
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  async execute(task: AgentTask): Promise<AgentResult> {
    this.status = 'working';
    const startTime = Date.now();
    this.emit('task:started', task);
    this.logger.info({ taskId: task.id }, `Starting task: ${task.id}`);

    try {
      const result = await this.run(task);
      this.status = 'completed';
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;
      this.emit('task:completed', task, result);
      this.logger.info(
        { taskId: task.id, durationMs: result.durationMs },
        `Task completed: ${task.id}`,
      );
      return result;
    } catch (error) {
      this.status = 'failed';
      task.status = 'failed';
      const err = error instanceof Error ? error : new Error(String(error));
      const result: AgentResult = {
        success: false,
        error: err.message,
        tokensUsed: 0,
        costUsd: 0,
        durationMs: Date.now() - startTime,
      };
      task.result = result;
      this.emit('task:failed', task, err);
      this.logger.error({ taskId: task.id, error: err.message }, `Task failed: ${task.id}`);
      return result;
    }
  }

  /**
   * Core execution logic — implemented by each specific agent type.
   * This is where the agent's domain expertise lives.
   */
  protected abstract run(task: AgentTask): Promise<AgentResult>;

  /**
   * Call the LLM with the agent's system prompt + task context.
   */
  protected async callLLM(
    messages: Array<{ role: string; content: string }>,
    tools?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>,
  ) {
    if (!this.llm) {
      throw new Error('LLM provider not set. Call setLLMProvider() first.');
    }

    const fullMessages = [
      { role: 'system', content: this.config.systemPrompt },
      ...messages,
    ];

    const response = await this.llm.chat({
      model: this.config.model,
      messages: fullMessages,
      tools,
      maxTokens: 4096,
    });

    this.emit('llm:called', this.config.model, response.tokensUsed);
    return response;
  }

  protected addArtifact(artifact: Artifact): void {
    this.artifacts.push(artifact);
  }

  protected getArtifacts(): Artifact[] {
    return [...this.artifacts];
  }

  /**
   * Calculate estimated USD cost based on model and token usage.
   */
  protected estimateCost(model: LLMModel, tokensUsed: number): number {
    const rates: Record<LLMModel, number> = {
      'claude-sonnet-4-20250514': 0.015 / 1000,      // $15/M tokens (blended)
      'claude-haiku-4-20250414': 0.001 / 1000,        // $1/M tokens (blended)
      'gpt-4-turbo': 0.02 / 1000,
      'gpt-4o': 0.01 / 1000,
    };
    return tokensUsed * (rates[model] ?? 0.01 / 1000);
  }
}
