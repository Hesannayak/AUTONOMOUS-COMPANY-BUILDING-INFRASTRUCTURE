import { EventEmitter } from 'eventemitter3';
import type {
  SwarmType,
  SwarmStatus,
  Swarm,
  SwarmAgent,
  AgentTask,
  AgentResult,
} from '@acbi/types';
import { SWARM_AGENT_MAP } from '@acbi/types';
import { createLogger, generateId } from '@acbi/utils';
import { AgentRegistry } from './registry.js';
import { AgentRunner } from './runner.js';
import type { BaseAgent, LLMProvider } from './base-agent.js';

export interface SwarmEvents {
  'swarm:started': (swarm: Swarm) => void;
  'swarm:progress': (swarm: Swarm, progress: number) => void;
  'swarm:completed': (swarm: Swarm) => void;
  'swarm:failed': (swarm: Swarm, error: Error) => void;
  'agent:completed': (swarm: Swarm, agentType: string, result: AgentResult) => void;
}

/**
 * Coordinates a group of agents working together as a swarm.
 * Each swarm type (legal, product, growth, etc.) has a predefined
 * set of agents that collaborate to complete domain-specific tasks.
 */
export class SwarmCoordinator extends EventEmitter<SwarmEvents> {
  private logger = createLogger('swarm-coordinator');
  private registry = AgentRegistry.getInstance();
  private runner = new AgentRunner();
  private activeSwarms = new Map<string, Swarm>();
  private llmProvider: LLMProvider | null = null;

  setLLMProvider(provider: LLMProvider): void {
    this.llmProvider = provider;
  }

  async startSwarm(
    type: SwarmType,
    companyId: string,
    tasks: AgentTask[],
  ): Promise<Swarm> {
    const agentTypes = SWARM_AGENT_MAP[type];

    const swarm: Swarm = {
      id: generateId('swarm'),
      type,
      companyId,
      status: 'running',
      agents: agentTypes.map((agentType) => ({
        agentType,
        instanceId: generateId('inst'),
        status: 'idle',
      })),
      progress: 0,
      startedAt: new Date(),
    };

    this.activeSwarms.set(swarm.id, swarm);
    this.emit('swarm:started', swarm);
    this.logger.info({ swarmId: swarm.id, type }, `Starting ${type} swarm`);

    // Execute tasks (sequentially for now; parallel in Phase 2)
    try {
      let completedTasks = 0;
      for (const task of tasks) {
        const agent = this.registry.create(task.agentType);
        if (this.llmProvider) {
          agent.setLLMProvider(this.llmProvider);
        }

        // Update swarm agent status
        const swarmAgent = swarm.agents.find((a) => a.agentType === task.agentType);
        if (swarmAgent) {
          swarmAgent.status = 'working';
          swarmAgent.currentTask = task.id;
        }

        const result = await this.runner.run(agent, task);

        if (swarmAgent) {
          swarmAgent.status = result.success ? 'completed' : 'failed';
          swarmAgent.currentTask = undefined;
        }

        this.emit('agent:completed', swarm, task.agentType, result);

        completedTasks++;
        swarm.progress = Math.round((completedTasks / tasks.length) * 100);
        this.emit('swarm:progress', swarm, swarm.progress);

        if (!result.success) {
          throw new Error(`Agent ${task.agentType} failed: ${result.error}`);
        }
      }

      swarm.status = 'completed';
      swarm.completedAt = new Date();
      this.emit('swarm:completed', swarm);
      this.logger.info({ swarmId: swarm.id }, `Swarm completed: ${swarm.id}`);
    } catch (error) {
      swarm.status = 'failed';
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('swarm:failed', swarm, err);
      this.logger.error({ swarmId: swarm.id, error: err.message }, `Swarm failed: ${swarm.id}`);
    }

    return swarm;
  }

  getSwarm(id: string): Swarm | undefined {
    return this.activeSwarms.get(id);
  }

  getActiveSwarms(): Swarm[] {
    return Array.from(this.activeSwarms.values()).filter((s) => s.status === 'running');
  }
}
