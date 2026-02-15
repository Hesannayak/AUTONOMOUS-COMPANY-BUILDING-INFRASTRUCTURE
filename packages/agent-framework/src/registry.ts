import type { AgentType, AgentConfig } from '@acbi/types';
import type { BaseAgent } from './base-agent.js';
import { createLogger } from '@acbi/utils';

type AgentFactory = (config: AgentConfig) => BaseAgent;

/**
 * Central registry for all agent types.
 * Services register their agent implementations here;
 * the orchestrator looks them up when spawning swarms.
 */
export class AgentRegistry {
  private static instance: AgentRegistry;
  private factories = new Map<AgentType, AgentFactory>();
  private configs = new Map<AgentType, AgentConfig>();
  private logger = createLogger('agent-registry');

  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  register(type: AgentType, factory: AgentFactory, config: AgentConfig): void {
    this.factories.set(type, factory);
    this.configs.set(type, config);
    this.logger.info({ agentType: type }, `Registered agent: ${type}`);
  }

  create(type: AgentType, configOverrides?: Partial<AgentConfig>): BaseAgent {
    const factory = this.factories.get(type);
    const baseConfig = this.configs.get(type);

    if (!factory || !baseConfig) {
      throw new Error(`Agent type not registered: ${type}`);
    }

    const config = { ...baseConfig, ...configOverrides };
    return factory(config);
  }

  has(type: AgentType): boolean {
    return this.factories.has(type);
  }

  getRegisteredTypes(): AgentType[] {
    return Array.from(this.factories.keys());
  }

  getConfig(type: AgentType): AgentConfig | undefined {
    return this.configs.get(type);
  }
}
