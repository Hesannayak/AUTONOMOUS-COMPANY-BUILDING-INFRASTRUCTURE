// ============================================
// Legal Strategist Agent
// Analyzes incorporation requirements and recommends
// entity type, jurisdiction, and legal strategy.
// ============================================

import { BaseAgent } from '@acbi/agent-framework';
import type { AgentTask, AgentResult, AgentConfig } from '@acbi/types';

export class LegalStrategistAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({
      ...config,
      type: 'legal-strategist',
      systemPrompt: config.systemPrompt || `You are a legal strategist specializing in business incorporation and corporate law. You analyze company requirements including funding goals, founder locations, IP needs, and business model to recommend the optimal entity type and jurisdiction. You are well-versed in Delaware C-Corp advantages for venture-backed startups, Wyoming LLC benefits for small businesses, and international incorporation options. You provide clear, actionable recommendations with cost estimates and timelines.`,
    });
  }

  /**
   * Analyze incorporation requirements and provide recommendations.
   *
   * Expected task.input:
   * - companyName: string
   * - idea: string
   * - founders: Array<{ name, email, equityPercent, role }>
   * - targetFunding?: string (e.g., "venture", "bootstrap", "angel")
   * - budget?: number
   * - targetMarket?: string
   */
  protected async run(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    const { companyName, idea, founders, targetFunding, budget } = task.input as {
      companyName?: string;
      idea?: string;
      founders?: Array<{ name: string; email: string; equityPercent: number; role: string }>;
      targetFunding?: string;
      budget?: number;
    };

    this.logger.info(
      { taskId: task.id, companyName },
      'Analyzing incorporation requirements',
    );

    // If LLM provider is available, use it for analysis
    if (this.llm) {
      try {
        const response = await this.callLLM([
          {
            role: 'user',
            content: `Analyze the following company and recommend the best entity type and jurisdiction for incorporation:

Company Name: ${companyName ?? 'Not specified'}
Business Idea: ${idea ?? 'Not specified'}
Number of Founders: ${founders?.length ?? 'Unknown'}
Target Funding: ${targetFunding ?? 'Not specified'}
Budget: ${budget ? `$${budget}` : 'Not specified'}

Provide your recommendation as a JSON object with these fields:
- recommendedEntityType: string (e.g., "C-Corp", "LLC")
- recommendedJurisdiction: string (e.g., "US-DE", "US-WY")
- reasoning: string (brief explanation)
- estimatedCost: number (in USD)
- estimatedTimeDays: number

Respond with ONLY the JSON object, no other text.`,
          },
        ]);

        const data = JSON.parse(response.content) as Record<string, unknown>;
        const durationMs = Date.now() - startTime;

        return {
          success: true,
          data,
          tokensUsed: response.tokensUsed,
          costUsd: this.estimateCost(this.config.model, response.tokensUsed),
          durationMs,
        };
      } catch (error) {
        this.logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'LLM call failed, falling back to rule-based recommendation',
        );
      }
    }

    // Rule-based fallback when LLM is not available
    const recommendation = this.generateRuleBasedRecommendation(
      targetFunding,
      founders?.length ?? 1,
      budget,
    );

    const durationMs = Date.now() - startTime;

    return {
      success: true,
      data: recommendation,
      tokensUsed: 0,
      costUsd: 0,
      durationMs,
    };
  }

  /**
   * Rule-based recommendation engine as fallback.
   */
  private generateRuleBasedRecommendation(
    targetFunding?: string,
    founderCount: number = 1,
    _budget?: number,
  ): Record<string, unknown> {
    // Default: Delaware C-Corp for venture-backed startups
    if (targetFunding === 'venture' || targetFunding === 'angel' || founderCount > 1) {
      return {
        recommendedEntityType: 'C-Corp',
        recommendedJurisdiction: 'US-DE',
        reasoning:
          'Delaware C-Corp is the standard for venture-backed startups. It provides well-established corporate law, no state corporate income tax for out-of-state revenue, and is expected by most institutional investors.',
        estimatedCost: 500,
        estimatedTimeDays: 3,
      };
    }

    // Single founder, bootstrap: Wyoming LLC
    return {
      recommendedEntityType: 'LLC',
      recommendedJurisdiction: 'US-WY',
      reasoning:
        'Wyoming LLC offers pass-through taxation, minimal filing fees, strong asset protection, and no state income tax. Ideal for bootstrapped single-founder businesses.',
      estimatedCost: 200,
      estimatedTimeDays: 2,
    };
  }
}
