import { createLogger } from '@acbi/utils';

const logger = createLogger('ml-service:cost-tracker');

interface UsageRecord {
  companyId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: Date;
}

interface CostBreakdown {
  byModel: Record<string, { tokens: number; cost: number }>;
  byCompany: Record<string, { tokens: number; cost: number }>;
  total: { tokens: number; cost: number };
}

// Cost per 1K tokens (input/output) for each model
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  'claude-haiku-4-20250414': { input: 0.00025, output: 0.00125 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4o': { input: 0.005, output: 0.015 },
};

const DEFAULT_COST_LIMIT_PER_COMPANY = 100; // $100 default limit

export class CostTracker {
  private usageRecords: UsageRecord[] = [];
  private companyLimits: Map<string, number> = new Map();

  constructor() {
    logger.info('CostTracker initialized');
  }

  /**
   * Calculate cost based on model pricing and token counts.
   */
  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
      logger.warn({ model }, 'Unknown model for pricing, using default');
      return ((inputTokens + outputTokens) / 1000) * 0.01;
    }
    return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
  }

  /**
   * Track token usage and cost for a company.
   */
  trackUsage(
    companyId: string,
    model: string,
    tokens: { input: number; output: number },
    cost?: number,
  ): void {
    const actualCost = cost ?? this.calculateCost(model, tokens.input, tokens.output);

    const record: UsageRecord = {
      companyId,
      model,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      cost: actualCost,
      timestamp: new Date(),
    };

    this.usageRecords.push(record);

    logger.info(
      { companyId, model, inputTokens: tokens.input, outputTokens: tokens.output, cost: actualCost },
      'Usage tracked',
    );
  }

  /**
   * Get total cost for a specific company.
   */
  getCompanyCost(companyId: string): number {
    return this.usageRecords
      .filter((r) => r.companyId === companyId)
      .reduce((sum, r) => sum + r.cost, 0);
  }

  /**
   * Get total cost across all companies.
   */
  getTotalCost(): number {
    return this.usageRecords.reduce((sum, r) => sum + r.cost, 0);
  }

  /**
   * Get a full breakdown of costs by model and by company.
   */
  getCostBreakdown(): CostBreakdown {
    const byModel: Record<string, { tokens: number; cost: number }> = {};
    const byCompany: Record<string, { tokens: number; cost: number }> = {};
    let totalTokens = 0;
    let totalCost = 0;

    for (const record of this.usageRecords) {
      const tokens = record.inputTokens + record.outputTokens;

      // Aggregate by model
      if (!byModel[record.model]) {
        byModel[record.model] = { tokens: 0, cost: 0 };
      }
      byModel[record.model]!.tokens += tokens;
      byModel[record.model]!.cost += record.cost;

      // Aggregate by company
      if (!byCompany[record.companyId]) {
        byCompany[record.companyId] = { tokens: 0, cost: 0 };
      }
      byCompany[record.companyId]!.tokens += tokens;
      byCompany[record.companyId]!.cost += record.cost;

      totalTokens += tokens;
      totalCost += record.cost;
    }

    return {
      byModel,
      byCompany,
      total: { tokens: totalTokens, cost: totalCost },
    };
  }

  /**
   * Set a cost limit for a company.
   */
  setCompanyLimit(companyId: string, limit: number): void {
    this.companyLimits.set(companyId, limit);
    logger.info({ companyId, limit }, 'Company cost limit set');
  }

  /**
   * Check whether a company has exceeded its cost limit.
   */
  isOverLimit(companyId: string): boolean {
    const limit = this.companyLimits.get(companyId) ?? DEFAULT_COST_LIMIT_PER_COMPANY;
    const currentCost = this.getCompanyCost(companyId);
    return currentCost >= limit;
  }

  /**
   * Get remaining budget for a company.
   */
  getRemainingBudget(companyId: string): number {
    const limit = this.companyLimits.get(companyId) ?? DEFAULT_COST_LIMIT_PER_COMPANY;
    const currentCost = this.getCompanyCost(companyId);
    return Math.max(0, limit - currentCost);
  }
}
