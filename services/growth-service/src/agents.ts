import { BaseAgent } from '@acbi/agent-framework';
import type { AgentTask, AgentResult, AgentConfig } from '@acbi/types';

/**
 * SEO Agent - generates SEO-optimized content, meta tags, and content strategy.
 * For MVP: generates landing page copy and basic blog post outlines.
 */
export class SEOAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  protected async run(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    const { companyName, idea, targetAudience } = task.input as {
      companyName: string;
      idea: string;
      targetAudience?: string;
    };

    this.logger.info({ companyId: task.companyId }, 'Generating SEO content');

    const response = await this.callLLM([
      {
        role: 'user',
        content: `Generate SEO-optimized landing page content for "${companyName}".
Business idea: ${idea}
Target audience: ${targetAudience ?? 'small businesses and startups'}

Generate JSON with:
- metaTitle: SEO title (60 chars max)
- metaDescription: SEO description (160 chars max)
- heroHeadline: main headline
- heroSubheadline: sub-headline
- features: array of { title, description, icon } (4-6 features)
- pricing: array of { plan, price, features } (3 tiers)
- faq: array of { question, answer } (5 questions)
- keywords: target keywords array`,
      },
    ]);

    this.addArtifact({ type: 'document', name: 'seo-content', content: response.content });

    return {
      success: true,
      data: { content: response.content },
      tokensUsed: response.tokensUsed,
      costUsd: this.estimateCost(this.config.model, response.tokensUsed),
      durationMs: Date.now() - startTime,
      artifacts: this.getArtifacts(),
    };
  }
}

/**
 * Social Media Agent - sets up social media presence and generates initial posts.
 * Phase 2+: Will connect to actual social media APIs.
 */
export class SocialMediaAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  protected async run(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    const { companyName, idea } = task.input as { companyName: string; idea: string };

    this.logger.info({ companyId: task.companyId }, 'Setting up social media');

    const response = await this.callLLM([
      {
        role: 'user',
        content: `Create a social media launch strategy for "${companyName}" (${idea}).
Generate JSON with:
- twitterBio: Twitter/X bio (160 chars)
- linkedinSummary: LinkedIn company summary
- launchPosts: array of 5 launch announcement posts for Twitter
- contentCalendar: 2-week content plan with daily post ideas`,
      },
    ]);

    this.addArtifact({ type: 'document', name: 'social-media-plan', content: response.content });

    return {
      success: true,
      data: { socialPlan: response.content },
      tokensUsed: response.tokensUsed,
      costUsd: this.estimateCost(this.config.model, response.tokensUsed),
      durationMs: Date.now() - startTime,
      artifacts: this.getArtifacts(),
    };
  }
}
