// ============================================
// Filing Agent
// Responsible for preparing and submitting incorporation
// documents for company formation.
// ============================================

import { BaseAgent } from '@acbi/agent-framework';
import type { AgentTask, AgentResult, AgentConfig } from '@acbi/types';

export class FilingAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({
      ...config,
      type: 'filing-agent',
      systemPrompt: config.systemPrompt || `You are a filing agent responsible for preparing incorporation documents and managing the filing process. You generate accurate legal documents including Certificates of Incorporation, Bylaws, Board Consents, Stock Purchase Agreements, and IP Assignment Agreements. You ensure all documents comply with the relevant jurisdiction's requirements and are properly formatted for filing.`,
    });
  }

  /**
   * Generate incorporation documents for a company.
   *
   * Expected task.input:
   * - companyName: string
   * - jurisdiction: string
   * - entityType: string
   * - founders: Array<{ name, email, equityPercent, role }>
   * - registeredAgent?: string
   * - authorizedShares?: number
   * - parValue?: number
   */
  protected async run(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    const {
      companyName,
      jurisdiction,
      entityType,
      founders,
      authorizedShares,
      parValue,
    } = task.input as {
      companyName?: string;
      jurisdiction?: string;
      entityType?: string;
      founders?: Array<{ name: string; email: string; equityPercent: number; role: string }>;
      authorizedShares?: number;
      parValue?: number;
    };

    this.logger.info(
      { taskId: task.id, companyName, jurisdiction },
      'Generating incorporation documents',
    );

    // If LLM provider is available, use it for document generation
    if (this.llm) {
      try {
        const response = await this.callLLM([
          {
            role: 'user',
            content: `Generate the key incorporation documents for the following company:

Company Name: ${companyName ?? 'Not specified'}
Jurisdiction: ${jurisdiction ?? 'US-DE'}
Entity Type: ${entityType ?? 'C-Corp'}
Founders: ${JSON.stringify(founders ?? [])}
Authorized Shares: ${authorizedShares ?? 10_000_000}
Par Value: $${parValue ?? 0.0001}

Generate summaries of the following documents:
1. Certificate of Incorporation
2. Bylaws
3. Initial Board Consent
4. Stock Purchase Agreements (one per founder)
5. IP Assignment Agreement

For each document, provide a brief summary of key terms. Respond as JSON with a "documents" array where each item has "type", "name", and "summary" fields.`,
          },
        ]);

        const parsed = JSON.parse(response.content) as Record<string, unknown>;
        const durationMs = Date.now() - startTime;

        // Add documents as artifacts
        const documents = (parsed.documents ?? []) as Array<{
          type: string;
          name: string;
          summary: string;
        }>;
        for (const doc of documents) {
          this.addArtifact({
            type: 'document',
            name: doc.name,
            content: doc.summary,
            metadata: { documentType: doc.type },
          });
        }

        return {
          success: true,
          data: parsed,
          artifacts: this.getArtifacts(),
          tokensUsed: response.tokensUsed,
          costUsd: this.estimateCost(this.config.model, response.tokensUsed),
          durationMs,
        };
      } catch (error) {
        this.logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'LLM call failed, falling back to template-based documents',
        );
      }
    }

    // Template-based fallback when LLM is not available
    const documents = this.generateTemplateDocuments(
      companyName ?? 'Unnamed Corp',
      jurisdiction ?? 'US-DE',
      entityType ?? 'C-Corp',
      founders ?? [],
      authorizedShares ?? 10_000_000,
      parValue ?? 0.0001,
    );

    for (const doc of documents) {
      this.addArtifact({
        type: 'document',
        name: doc.name,
        content: doc.summary,
        metadata: { documentType: doc.type },
      });
    }

    const durationMs = Date.now() - startTime;

    return {
      success: true,
      data: { documents },
      artifacts: this.getArtifacts(),
      tokensUsed: 0,
      costUsd: 0,
      durationMs,
    };
  }

  /**
   * Generate template-based incorporation documents as fallback.
   */
  private generateTemplateDocuments(
    companyName: string,
    jurisdiction: string,
    entityType: string,
    founders: Array<{ name: string; email: string; equityPercent: number; role: string }>,
    authorizedShares: number,
    parValue: number,
  ): Array<{ type: string; name: string; summary: string }> {
    const founderNames = founders.map((f) => f.name).join(', ') || 'TBD';

    const documents = [
      {
        type: 'certificate_of_incorporation',
        name: `Certificate of Incorporation - ${companyName}`,
        summary: `Certificate of Incorporation for ${companyName}, a ${jurisdiction} ${entityType}. Authorized to issue ${authorizedShares.toLocaleString()} shares of Common Stock at $${parValue} par value per share. Registered agent to be designated upon filing.`,
      },
      {
        type: 'bylaws',
        name: `Bylaws - ${companyName}`,
        summary: `Corporate Bylaws for ${companyName}. Establishes board governance structure, officer roles, meeting procedures, stock issuance rules, and indemnification provisions. Board size: ${Math.max(1, founders.length)} directors.`,
      },
      {
        type: 'board_consent',
        name: `Initial Board Consent - ${companyName}`,
        summary: `Written consent of the initial Board of Directors of ${companyName}. Approves: adoption of bylaws, appointment of officers, issuance of founder shares, adoption of equity incentive plan, approval of IP assignment agreements, and authorization to open bank accounts.`,
      },
    ];

    // Stock purchase agreements for each founder
    for (const founder of founders) {
      const shares = Math.floor((founder.equityPercent / 100) * authorizedShares);
      documents.push({
        type: 'stock_purchase_agreement',
        name: `Stock Purchase Agreement - ${founder.name}`,
        summary: `Stock Purchase Agreement between ${companyName} and ${founder.name} (${founder.role}). ${shares.toLocaleString()} shares of Common Stock (${founder.equityPercent}% of authorized shares) at $${parValue} per share. Subject to 4-year vesting with 1-year cliff. Total purchase price: $${(shares * parValue).toFixed(2)}.`,
      });
    }

    documents.push({
      type: 'ip_assignment',
      name: `IP Assignment Agreement - ${companyName}`,
      summary: `Proprietary Information and Inventions Assignment Agreement for ${companyName}. Assigns all prior and future intellectual property developed by founders (${founderNames}) to the company. Includes non-disclosure, non-compete, and non-solicitation provisions.`,
    });

    return documents;
  }
}
