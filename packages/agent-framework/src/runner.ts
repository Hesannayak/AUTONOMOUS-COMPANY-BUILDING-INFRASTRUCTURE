import type { AgentTask, AgentResult } from '@acbi/types';
import type { BaseAgent } from './base-agent.js';
import { createLogger, generateId } from '@acbi/utils';

/**
 * Manages agent execution lifecycle: timeouts, retries, concurrency.
 */
export class AgentRunner {
  private logger = createLogger('agent-runner');
  private running = new Map<string, { agent: BaseAgent; abortController: AbortController }>();

  async run(agent: BaseAgent, task: AgentTask): Promise<AgentResult> {
    const runId = generateId('run');
    const abortController = new AbortController();
    this.running.set(runId, { agent, abortController });

    try {
      const result = await this.executeWithTimeout(agent, task);

      if (!result.success && task.retryCount < task.maxRetries) {
        this.logger.warn(
          { taskId: task.id, retry: task.retryCount + 1 },
          `Retrying task: ${task.id}`,
        );
        task.retryCount++;
        return this.run(agent, task);
      }

      return result;
    } finally {
      this.running.delete(runId);
    }
  }

  private async executeWithTimeout(agent: BaseAgent, task: AgentTask): Promise<AgentResult> {
    return new Promise<AgentResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Agent task timed out after ${task.timeoutMs}ms`));
      }, task.timeoutMs);

      agent
        .execute(task)
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  getRunningCount(): number {
    return this.running.size;
  }

  cancelAll(): void {
    for (const [runId, { abortController }] of this.running) {
      abortController.abort();
      this.logger.info({ runId }, `Cancelled run: ${runId}`);
    }
    this.running.clear();
  }
}
