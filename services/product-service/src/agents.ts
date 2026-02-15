import { BaseAgent } from '@acbi/agent-framework';
import type { AgentTask, AgentResult, AgentConfig } from '@acbi/types';

/**
 * Product Architect Agent - designs system architecture for generated products.
 * Takes a business idea and produces: tech stack decision, database schema,
 * API design, and component hierarchy.
 */
export class ProductArchitectAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  protected async run(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    const { idea, techPreferences, features } = task.input as {
      idea: string;
      techPreferences?: Record<string, string>;
      features?: string[];
    };

    this.logger.info({ companyId: task.companyId }, 'Designing product architecture');

    // Call LLM to generate architecture
    const response = await this.callLLM([
      {
        role: 'user',
        content: `Design a product architecture for: "${idea}"
Tech preferences: ${JSON.stringify(techPreferences ?? { stack: 'nextjs', database: 'supabase' })}
Required features: ${(features ?? ['auth', 'payments', 'dashboard']).join(', ')}

Output a JSON object with:
- stack: { frontend, backend, database, hosting }
- schema: database table definitions
- pages: list of pages/routes
- apiEndpoints: list of API endpoints
- components: key React components needed`,
      },
    ]);

    this.addArtifact({
      type: 'document',
      name: 'architecture-design',
      content: response.content,
    });

    return {
      success: true,
      data: { architecture: response.content },
      tokensUsed: response.tokensUsed,
      costUsd: this.estimateCost(this.config.model, response.tokensUsed),
      durationMs: Date.now() - startTime,
      artifacts: this.getArtifacts(),
    };
  }
}

/**
 * Frontend Agent - generates React/Next.js code for product pages.
 */
export class FrontendAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  protected async run(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    const { architecture, companyName } = task.input as {
      architecture: string;
      companyName: string;
    };

    this.logger.info({ companyId: task.companyId }, 'Generating frontend code');

    const response = await this.callLLM([
      {
        role: 'user',
        content: `Generate Next.js 14 (App Router) code for "${companyName}" based on this architecture:
${architecture}

Generate complete, working code for each page. Use TypeScript, Tailwind CSS.
Include: layout.tsx, page.tsx (home), and key feature pages.
Output as JSON: { files: [{ path: string, content: string }] }`,
      },
    ]);

    this.addArtifact({ type: 'code', name: 'frontend-code', content: response.content });

    return {
      success: true,
      data: { code: response.content },
      tokensUsed: response.tokensUsed,
      costUsd: this.estimateCost(this.config.model, response.tokensUsed),
      durationMs: Date.now() - startTime,
      artifacts: this.getArtifacts(),
    };
  }
}

/**
 * DevOps Agent - deploys generated code to hosting platform.
 */
export class DevOpsAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  protected async run(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    const { repoUrl, hosting } = task.input as { repoUrl: string; hosting: string };

    this.logger.info({ companyId: task.companyId, hosting }, 'Deploying product');

    // Phase 1: Deploy to Vercel via API
    // For now, return placeholder
    return {
      success: true,
      data: {
        deployUrl: `https://${task.companyId}.vercel.app`,
        hosting,
        status: 'deployed',
      },
      tokensUsed: 0,
      costUsd: 0,
      durationMs: Date.now() - startTime,
    };
  }
}
