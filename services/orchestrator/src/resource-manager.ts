// ============================================
// Resource Manager
// Tracks active agents, resource usage, and enforces budget limits per company.
// ============================================

import { createLogger } from '@acbi/utils';

const logger = createLogger('orchestrator:resource-manager');

interface BudgetRecord {
  companyId: string;
  totalBudget: number;
  spent: number;
  allocations: BudgetAllocation[];
}

interface BudgetAllocation {
  swarmType: string;
  amount: number;
  allocatedAt: Date;
}

interface ActiveAgent {
  instanceId: string;
  agentType: string;
  companyId: string;
  startedAt: Date;
  resourceUsage: {
    tokensUsed: number;
    costUsd: number;
  };
}

export class ResourceManager {
  private budgets: Map<string, BudgetRecord> = new Map();
  private activeAgents: Map<string, ActiveAgent> = new Map();

  /**
   * Initialize a budget for a company with its total budget amount.
   */
  initializeBudget(companyId: string, totalBudget: number): void {
    if (this.budgets.has(companyId)) {
      logger.warn({ companyId }, 'Budget already initialized for company, skipping');
      return;
    }

    this.budgets.set(companyId, {
      companyId,
      totalBudget,
      spent: 0,
      allocations: [],
    });

    logger.info({ companyId, totalBudget }, 'Budget initialized for company');
  }

  /**
   * Allocate a portion of the company budget to a specific swarm.
   * Returns true if allocation succeeded, false if insufficient budget.
   */
  allocateBudget(companyId: string, amount: number, swarmType?: string): boolean {
    const budget = this.budgets.get(companyId);
    if (!budget) {
      logger.error({ companyId }, 'No budget record found for company');
      return false;
    }

    const remaining = budget.totalBudget - budget.spent;
    if (amount > remaining) {
      logger.warn(
        { companyId, requested: amount, remaining },
        'Insufficient budget for allocation',
      );
      return false;
    }

    budget.allocations.push({
      swarmType: swarmType ?? 'unspecified',
      amount,
      allocatedAt: new Date(),
    });

    logger.info(
      { companyId, amount, swarmType, remaining: remaining - amount },
      'Budget allocated',
    );

    return true;
  }

  /**
   * Track a cost incurred by a company (e.g., LLM call, API usage).
   * Returns true if the cost was within budget, false if budget exceeded.
   */
  trackCost(companyId: string, cost: number, description?: string): boolean {
    const budget = this.budgets.get(companyId);
    if (!budget) {
      logger.error({ companyId }, 'No budget record found for company');
      return false;
    }

    const newSpent = budget.spent + cost;
    if (newSpent > budget.totalBudget) {
      logger.error(
        { companyId, cost, spent: budget.spent, totalBudget: budget.totalBudget },
        'Cost would exceed budget limit',
      );
      return false;
    }

    budget.spent = newSpent;
    logger.debug({ companyId, cost, totalSpent: newSpent, description }, 'Cost tracked');

    return true;
  }

  /**
   * Get remaining budget for a company.
   */
  getRemainingBudget(companyId: string): number {
    const budget = this.budgets.get(companyId);
    if (!budget) {
      logger.warn({ companyId }, 'No budget record found, returning 0');
      return 0;
    }

    return budget.totalBudget - budget.spent;
  }

  /**
   * Get the full budget record for a company.
   */
  getBudgetRecord(companyId: string): BudgetRecord | undefined {
    return this.budgets.get(companyId);
  }

  /**
   * Get the total amount spent by a company.
   */
  getSpent(companyId: string): number {
    const budget = this.budgets.get(companyId);
    return budget?.spent ?? 0;
  }

  /**
   * Register an active agent.
   */
  registerAgent(agent: ActiveAgent): void {
    this.activeAgents.set(agent.instanceId, agent);
    logger.debug(
      { instanceId: agent.instanceId, agentType: agent.agentType, companyId: agent.companyId },
      'Agent registered',
    );
  }

  /**
   * Deregister an agent when it completes or fails.
   */
  deregisterAgent(instanceId: string): void {
    const agent = this.activeAgents.get(instanceId);
    if (agent) {
      this.activeAgents.delete(instanceId);
      logger.debug(
        { instanceId, agentType: agent.agentType, companyId: agent.companyId },
        'Agent deregistered',
      );
    }
  }

  /**
   * Get count of active agents for a company.
   */
  getActiveAgentCount(companyId: string): number {
    let count = 0;
    for (const agent of this.activeAgents.values()) {
      if (agent.companyId === companyId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get all active agents for a company.
   */
  getActiveAgents(companyId: string): ActiveAgent[] {
    const agents: ActiveAgent[] = [];
    for (const agent of this.activeAgents.values()) {
      if (agent.companyId === companyId) {
        agents.push(agent);
      }
    }
    return agents;
  }
}
