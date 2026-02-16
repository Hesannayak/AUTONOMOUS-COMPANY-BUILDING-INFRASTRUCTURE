// ============================================
// Company Builder
// Meta-coordinator that takes a "build company" request and orchestrates
// all swarms (legal, product, growth, sales, finance, customer-success).
// Includes safety rail checkpoints for human-in-the-loop actions.
// ============================================

import type {
  BuildCompanyRequest,
  Company,
  DomainEvent,
  SwarmOrchestrationPlan,
  SwarmPhase,
  SwarmPhaseTask,
  Jurisdiction,
  EntityType,
  EventMetadata,
} from '@acbi/types';
import { createLogger, generateId, generateCorrelationId } from '@acbi/utils';
import { SERVICE_PORTS } from '@acbi/config';
import { ResourceManager } from './resource-manager.js';

const logger = createLogger('orchestrator:company-builder');

// ============================================
// Safety Rails — Human-in-the-loop checkpoints
// These are ACTION checkpoints, not blocking approvals.
// The build pauses at certain critical points, and the
// user confirms before the system proceeds.
// ============================================

export type CheckpointType =
  | 'legal_sign_docs'       // After legal swarm forms entity → sign incorporation docs
  | 'product_review_demo'   // After product swarm builds MVP → review the demo
  | 'growth_confirm_ad_spend'; // Before charging ads budget → confirm spend

export type CheckpointStatus = 'pending' | 'approved' | 'rejected';

export interface SafetyCheckpoint {
  id: string;
  companyId: string;
  type: CheckpointType;
  status: CheckpointStatus;
  title: string;
  description: string;
  details: Record<string, unknown>;
  createdAt: Date;
  resolvedAt: Date | null;
}

/**
 * Default swarm phases with sequential dependencies:
 * legal -> product -> growth (each depends on the previous).
 * Sales, finance, and customer-success run in parallel after growth.
 */
function createDefaultPhases(companyId: string): SwarmPhase[] {
  return [
    {
      order: 1,
      swarmType: 'legal',
      dependsOn: [],
      estimatedDurationMs: 3_600_000,
      tasks: [
        {
          id: generateId('task'),
          agentType: 'legal-strategist',
          description: 'Determine optimal entity structure and jurisdiction strategy',
          input: { companyId },
          dependsOn: [],
        },
        {
          id: generateId('task'),
          agentType: 'filing-agent',
          description: 'File incorporation documents and obtain EIN',
          input: { companyId },
          dependsOn: [],
        },
      ] satisfies SwarmPhaseTask[],
    },
    {
      order: 2,
      swarmType: 'product',
      dependsOn: ['legal'],
      estimatedDurationMs: 7_200_000,
      tasks: [
        {
          id: generateId('task'),
          agentType: 'product-architect',
          description: 'Design product architecture and technical spec',
          input: { companyId },
          dependsOn: [],
        },
        {
          id: generateId('task'),
          agentType: 'frontend-agent',
          description: 'Build frontend application',
          input: { companyId },
          dependsOn: [],
        },
        {
          id: generateId('task'),
          agentType: 'devops-agent',
          description: 'Deploy product to production',
          input: { companyId },
          dependsOn: [],
        },
      ] satisfies SwarmPhaseTask[],
    },
    {
      order: 3,
      swarmType: 'growth',
      dependsOn: ['product'],
      estimatedDurationMs: 3_600_000,
      tasks: [
        {
          id: generateId('task'),
          agentType: 'seo-agent',
          description: 'Generate landing page and SEO content',
          input: { companyId },
          dependsOn: [],
        },
        {
          id: generateId('task'),
          agentType: 'social-media-agent',
          description: 'Create social media presence',
          input: { companyId },
          dependsOn: [],
        },
      ] satisfies SwarmPhaseTask[],
    },
    {
      order: 4,
      swarmType: 'finance',
      dependsOn: ['legal'],
      estimatedDurationMs: 1_800_000,
      tasks: [
        {
          id: generateId('task'),
          agentType: 'treasurer-agent',
          description: 'Set up treasury management and banking',
          input: { companyId },
          dependsOn: [],
        },
      ] satisfies SwarmPhaseTask[],
    },
  ];
}

export class CompanyBuilder {
  private companies: Map<string, Company> = new Map();
  private events: Map<string, DomainEvent[]> = new Map();
  private plans: Map<string, SwarmOrchestrationPlan> = new Map();
  private checkpoints: Map<string, SafetyCheckpoint[]> = new Map();
  private pipelineResolvers: Map<string, () => void> = new Map();
  private resourceManager: ResourceManager;

  constructor(resourceManager: ResourceManager) {
    this.resourceManager = resourceManager;
  }

  /**
   * Start the company building process.
   * Creates the company record, orchestration plan, initializes budget,
   * emits events, and kicks off the build pipeline.
   */
  async startBuild(request: BuildCompanyRequest): Promise<Company> {
    const companyId = generateId('co');
    const correlationId = generateCorrelationId();
    const now = new Date();

    const companyName = request.name ?? `Company-${companyId.slice(0, 8)}`;

    const company: Company = {
      id: companyId,
      name: companyName,
      status: 'building',
      jurisdiction: request.jurisdiction as Jurisdiction,
      entityType: (request.entityType as EntityType) ?? 'C-Corp',
      idea: request.idea,
      budget: request.budget,
      budgetSpent: 0,
      founders: request.founders,
      legal: null,
      product: null,
      growth: null,
      createdAt: now,
      updatedAt: now,
    };

    this.companies.set(companyId, company);
    this.resourceManager.initializeBudget(companyId, request.budget);

    // Create orchestration plan
    const phases = createDefaultPhases(companyId);
    const plan: SwarmOrchestrationPlan = { companyId, phases };
    this.plans.set(companyId, plan);

    // Emit creation events
    this.appendEvent(companyId, this.createEvent(
      'company.created', companyId, 'company',
      { name: companyName, idea: request.idea, budget: request.budget, jurisdiction: request.jurisdiction },
      { correlationId, source: 'orchestrator' },
    ));

    this.appendEvent(companyId, this.createEvent(
      'company.build_started', companyId, 'company',
      { phases: phases.map((p) => ({ order: p.order, swarmType: p.swarmType, taskCount: p.tasks.length })) },
      { correlationId, source: 'orchestrator' },
    ));

    logger.info(
      { companyId, name: companyName, budget: request.budget, jurisdiction: request.jurisdiction },
      'Company build started',
    );

    // Execute the build pipeline asynchronously (fire-and-forget for the API response)
    this.executePipeline(companyId, company, request, correlationId).catch((err) => {
      logger.error({ companyId, error: (err as Error).message }, 'Pipeline execution failed');
      company.status = 'failed';
      company.updatedAt = new Date();
      this.appendEvent(companyId, this.createEvent(
        'company.failed', companyId, 'company',
        { error: (err as Error).message },
        { correlationId, source: 'orchestrator' },
      ));
    });

    return company;
  }

  /**
   * Execute the full build pipeline: Legal -> Product -> Growth -> Finance
   * Each phase calls the corresponding downstream microservice.
   */
  private async executePipeline(
    companyId: string,
    company: Company,
    request: BuildCompanyRequest,
    correlationId: string,
  ): Promise<void> {
    // === Phase 1: Legal ===
    logger.info({ companyId }, 'Phase 1: Starting legal incorporation');
    company.status = 'legal_pending';
    company.updatedAt = new Date();
    this.appendEvent(companyId, this.createEvent(
      'company.legal_started', companyId, 'company',
      { swarmType: 'legal' },
      { correlationId, source: 'orchestrator' },
    ));

    try {
      const legalResult = await this.callService(
        'legal-service',
        '/api/legal/incorporate',
        'POST',
        {
          companyName: company.name,
          jurisdiction: company.jurisdiction,
          entityType: company.entityType,
          founders: company.founders,
        },
      );

      company.legal = {
        status: 'filing',
        entityId: legalResult?.companyId as string | undefined,
      };
      company.status = 'legal_complete';
      company.updatedAt = new Date();
      this.appendEvent(companyId, this.createEvent(
        'company.legal_completed', companyId, 'company',
        { legalResult },
        { correlationId, source: 'orchestrator' },
      ));
      logger.info({ companyId }, 'Phase 1: Legal incorporation initiated');

      // SAFETY RAIL: Ask user to sign incorporation docs before proceeding
      await this.createAndWaitForCheckpoint(companyId, 'legal_sign_docs', {
        title: 'Sign incorporation documents',
        description: 'Your legal entity has been formed. Review and confirm the incorporation documents before we proceed to building your product.',
        details: {
          entityType: company.entityType,
          jurisdiction: company.jurisdiction,
          legalResult,
        },
      }, correlationId);

    } catch (err) {
      logger.error({ companyId, error: (err as Error).message }, 'Phase 1: Legal failed');
      // Continue with other phases even if legal has issues
      company.legal = { status: 'failed' };
    }

    // === Phase 2: Product ===
    logger.info({ companyId }, 'Phase 2: Starting product build');
    company.status = 'product_building';
    company.updatedAt = new Date();
    this.appendEvent(companyId, this.createEvent(
      'company.product_started', companyId, 'company',
      { swarmType: 'product' },
      { correlationId, source: 'orchestrator' },
    ));

    try {
      const productResult = await this.callService(
        'product-service',
        '/api/products/build',
        'POST',
        {
          companyId,
          idea: request.idea,
          techPreferences: request.techPreferences ?? { stack: 'nextjs', database: 'supabase', hosting: 'vercel' },
          features: request.features ?? ['auth', 'payments', 'dashboard'],
        },
      );

      company.product = {
        stack: request.techPreferences?.stack ?? 'nextjs',
        features: request.features ?? ['auth', 'payments', 'dashboard'],
        status: 'deploying',
      };
      company.status = 'product_deployed';
      company.updatedAt = new Date();
      this.appendEvent(companyId, this.createEvent(
        'company.product_deployed', companyId, 'company',
        { productResult },
        { correlationId, source: 'orchestrator' },
      ));
      logger.info({ companyId }, 'Phase 2: Product build initiated');

      // SAFETY RAIL: Ask user to review the product demo before going live
      await this.createAndWaitForCheckpoint(companyId, 'product_review_demo', {
        title: 'Review your product demo',
        description: 'Your MVP has been built. Review the demo and confirm before we start marketing.',
        details: {
          stack: company.product.stack,
          features: company.product.features,
          productResult,
        },
      }, correlationId);

    } catch (err) {
      logger.error({ companyId, error: (err as Error).message }, 'Phase 2: Product failed');
      company.product = { stack: 'nextjs', features: [], status: 'failed' };
    }

    // === Phase 3: Growth ===
    logger.info({ companyId }, 'Phase 3: Starting growth setup');

    // SAFETY RAIL: Confirm ad spend before charging marketing budget
    const marketingBudget = this.resourceManager.getRemainingBudget(companyId);
    await this.createAndWaitForCheckpoint(companyId, 'growth_confirm_ad_spend', {
      title: 'Confirm marketing spend',
      description: `Ready to launch marketing campaigns. Estimated spend: up to $${Math.round(marketingBudget * 0.25)} on ads and content. Confirm to proceed.`,
      details: {
        estimatedAdSpend: Math.round(marketingBudget * 0.25),
        channels: ['SEO', 'Landing page', 'Social media', 'Content marketing'],
      },
    }, correlationId);

    company.status = 'growth_active';
    company.updatedAt = new Date();
    this.appendEvent(companyId, this.createEvent(
      'company.growth_started', companyId, 'company',
      { swarmType: 'growth' },
      { correlationId, source: 'orchestrator' },
    ));

    try {
      const growthResult = await this.callService(
        'growth-service',
        '/api/growth/landing-page',
        'POST',
        {
          companyId,
          companyName: company.name,
          idea: request.idea,
          targetAudience: request.targetAudience ?? 'small businesses and startups',
        },
      );

      company.growth = {
        status: 'live',
        adCampaigns: [],
        socialAccounts: [],
      };
      company.updatedAt = new Date();
      this.appendEvent(companyId, this.createEvent(
        'company.growth_live', companyId, 'company',
        { growthResult },
        { correlationId, source: 'orchestrator' },
      ));
      logger.info({ companyId }, 'Phase 3: Growth setup initiated');
    } catch (err) {
      logger.error({ companyId, error: (err as Error).message }, 'Phase 3: Growth failed');
      company.growth = { status: 'failed', adCampaigns: [], socialAccounts: [] };
    }

    // === Phase 4: Finance (parallel with growth) ===
    try {
      await this.callService(
        'finance-service',
        '/api/finance/setup',
        'POST',
        { companyId, companyName: company.name },
      );
      logger.info({ companyId }, 'Phase 4: Finance setup initiated');
    } catch (err) {
      logger.error({ companyId, error: (err as Error).message }, 'Phase 4: Finance failed');
    }

    // === Mark operational ===
    company.status = 'operational';
    company.updatedAt = new Date();
    this.appendEvent(companyId, this.createEvent(
      'company.operational', companyId, 'company',
      { message: 'All swarms completed. Company is operational.' },
      { correlationId, source: 'orchestrator' },
    ));

    logger.info({ companyId, name: company.name }, 'Company build pipeline completed — OPERATIONAL');
  }

  /**
   * Call a downstream microservice via HTTP.
   */
  private async callService(
    serviceName: string,
    path: string,
    method: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const port = SERVICE_PORTS[serviceName];
    if (!port) {
      logger.warn({ serviceName }, `Unknown service: ${serviceName}, skipping`);
      return null;
    }

    const url = `http://localhost:${port}${path}`;

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const text = await response.text();
        logger.warn({ serviceName, path, status: response.status, body: text }, 'Service returned error');
        return null;
      }

      return await response.json() as Record<string, unknown>;
    } catch (error) {
      // Service might not be running — log and continue
      logger.warn(
        { serviceName, path, error: (error as Error).message },
        `Service ${serviceName} unreachable (may not be running)`,
      );
      return null;
    }
  }

  // --------------------------------------------------
  // Safety checkpoint methods
  // --------------------------------------------------

  /**
   * Create a checkpoint and pause the pipeline until the user approves it.
   * If AUTO_APPROVE_CHECKPOINTS is set, checkpoints are auto-approved (for dev/testing).
   */
  private async createAndWaitForCheckpoint(
    companyId: string,
    type: CheckpointType,
    config: { title: string; description: string; details: Record<string, unknown> },
    correlationId: string,
  ): Promise<void> {
    const checkpoint: SafetyCheckpoint = {
      id: generateId('chk'),
      companyId,
      type,
      status: 'pending',
      title: config.title,
      description: config.description,
      details: config.details,
      createdAt: new Date(),
      resolvedAt: null,
    };

    const existing = this.checkpoints.get(companyId) ?? [];
    existing.push(checkpoint);
    this.checkpoints.set(companyId, existing);

    this.appendEvent(companyId, this.createEvent(
      'company.checkpoint_created', companyId, 'company',
      { checkpointId: checkpoint.id, type, title: config.title },
      { correlationId, source: 'orchestrator' },
    ));

    logger.info({ companyId, checkpointId: checkpoint.id, type }, 'Safety checkpoint created — waiting for approval');

    // In dev mode, auto-approve after a short delay so the pipeline doesn't block forever
    if (process.env['AUTO_APPROVE_CHECKPOINTS'] === 'true') {
      logger.info({ companyId, checkpointId: checkpoint.id }, 'Auto-approving checkpoint (dev mode)');
      await new Promise(resolve => setTimeout(resolve, 500));
      checkpoint.status = 'approved';
      checkpoint.resolvedAt = new Date();
      return;
    }

    // Wait for user to approve via the API
    return new Promise<void>((resolve) => {
      const resolverKey = `${companyId}:${checkpoint.id}`;
      this.pipelineResolvers.set(resolverKey, resolve);
    });
  }

  /**
   * Approve or reject a pending checkpoint.
   * Returns the updated checkpoint, or null if not found.
   */
  resolveCheckpoint(companyId: string, checkpointId: string, action: 'approve' | 'reject'): SafetyCheckpoint | null {
    const checkpoints = this.checkpoints.get(companyId);
    if (!checkpoints) return null;

    const checkpoint = checkpoints.find(c => c.id === checkpointId);
    if (!checkpoint || checkpoint.status !== 'pending') return null;

    checkpoint.status = action === 'approve' ? 'approved' : 'rejected';
    checkpoint.resolvedAt = new Date();

    logger.info({ companyId, checkpointId, action }, `Checkpoint ${action}d`);

    this.appendEvent(companyId, this.createEvent(
      `company.checkpoint_${action}d`, companyId, 'company',
      { checkpointId, type: checkpoint.type },
      { correlationId: generateCorrelationId(), source: 'user' },
    ));

    // Resume the pipeline if approved
    if (action === 'approve') {
      const resolverKey = `${companyId}:${checkpointId}`;
      const resolver = this.pipelineResolvers.get(resolverKey);
      if (resolver) {
        resolver();
        this.pipelineResolvers.delete(resolverKey);
      }
    }

    return checkpoint;
  }

  /**
   * Get all checkpoints for a company.
   */
  getCheckpoints(companyId: string): SafetyCheckpoint[] {
    return this.checkpoints.get(companyId) ?? [];
  }

  /**
   * Get pending checkpoints for a company (the ones needing user action).
   */
  getPendingCheckpoints(companyId: string): SafetyCheckpoint[] {
    return (this.checkpoints.get(companyId) ?? []).filter(c => c.status === 'pending');
  }

  getCompany(id: string): Company | undefined {
    return this.companies.get(id);
  }

  getCompanyEvents(id: string): DomainEvent[] {
    return this.events.get(id) ?? [];
  }

  getOrchestrationPlan(id: string): SwarmOrchestrationPlan | undefined {
    return this.plans.get(id);
  }

  getCompanyProgress(id: string): number {
    const companyEvents = this.events.get(id) ?? [];
    const plan = this.plans.get(id);
    if (!plan) return 0;

    const totalPhases = plan.phases.length;
    if (totalPhases === 0) return 0;

    const completedPhases = new Set<string>();
    for (const event of companyEvents) {
      if (event.type === 'company.legal_completed') completedPhases.add('legal');
      if (event.type === 'company.product_deployed') completedPhases.add('product');
      if (event.type === 'company.growth_live') completedPhases.add('growth');
      if (event.type === 'company.operational') completedPhases.add('finance');
    }

    return Math.round((completedPhases.size / totalPhases) * 100);
  }

  getAllCompanies(): Company[] {
    return Array.from(this.companies.values());
  }

  // --------------------------------------------------
  // Internal helpers
  // --------------------------------------------------

  private createEvent(
    type: string,
    aggregateId: string,
    aggregateType: DomainEvent['aggregateType'],
    payload: Record<string, unknown>,
    metadata: Pick<EventMetadata, 'correlationId' | 'source'> & Partial<EventMetadata>,
  ): DomainEvent {
    const existingEvents = this.events.get(aggregateId) ?? [];

    return {
      id: generateId('evt'),
      type,
      aggregateId,
      aggregateType,
      payload,
      metadata: {
        correlationId: metadata.correlationId,
        source: metadata.source,
        causationId: metadata.causationId,
        userId: metadata.userId,
        agentId: metadata.agentId,
      },
      timestamp: new Date(),
      version: existingEvents.length + 1,
    };
  }

  private appendEvent(companyId: string, event: DomainEvent): void {
    const existing = this.events.get(companyId) ?? [];
    existing.push(event);
    this.events.set(companyId, existing);
    logger.debug({ companyId, eventType: event.type, eventId: event.id }, 'Event appended');
  }
}
