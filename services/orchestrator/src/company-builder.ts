// ============================================
// Company Builder
// Meta-coordinator that takes a "build company" request and orchestrates
// all swarms (legal, product, growth, sales, finance, customer-success).
// ============================================

import type {
  BuildCompanyRequest,
  Company,
  CompanyStatus,
  DomainEvent,
  SwarmOrchestrationPlan,
  SwarmPhase,
  SwarmPhaseTask,
  SwarmType,
  Jurisdiction,
  EntityType,
  EventMetadata,
} from '@acbi/types';
import { createLogger, generateId, generateCorrelationId } from '@acbi/utils';
import { ResourceManager } from './resource-manager.js';

const logger = createLogger('orchestrator:company-builder');

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
      estimatedDurationMs: 3_600_000, // 1 hour
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
        {
          id: generateId('task'),
          agentType: 'compliance-monitor',
          description: 'Set up compliance monitoring and regulatory tracking',
          input: { companyId },
          dependsOn: [],
        },
      ] satisfies SwarmPhaseTask[],
    },
    {
      order: 2,
      swarmType: 'product',
      dependsOn: ['legal'],
      estimatedDurationMs: 7_200_000, // 2 hours
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
          agentType: 'backend-agent',
          description: 'Build backend services and API',
          input: { companyId },
          dependsOn: [],
        },
        {
          id: generateId('task'),
          agentType: 'devops-agent',
          description: 'Set up CI/CD pipeline and infrastructure',
          input: { companyId },
          dependsOn: [],
        },
        {
          id: generateId('task'),
          agentType: 'qa-agent',
          description: 'Run automated testing and quality assurance',
          input: { companyId },
          dependsOn: [],
        },
      ] satisfies SwarmPhaseTask[],
    },
    {
      order: 3,
      swarmType: 'growth',
      dependsOn: ['product'],
      estimatedDurationMs: 3_600_000, // 1 hour
      tasks: [
        {
          id: generateId('task'),
          agentType: 'seo-agent',
          description: 'Optimize SEO and organic discovery',
          input: { companyId },
          dependsOn: [],
        },
        {
          id: generateId('task'),
          agentType: 'paid-ads-agent',
          description: 'Set up and manage paid advertising campaigns',
          input: { companyId },
          dependsOn: [],
        },
        {
          id: generateId('task'),
          agentType: 'social-media-agent',
          description: 'Create social media presence and content strategy',
          input: { companyId },
          dependsOn: [],
        },
      ] satisfies SwarmPhaseTask[],
    },
    {
      order: 4,
      swarmType: 'sales',
      dependsOn: ['growth'],
      estimatedDurationMs: 1_800_000, // 30 min
      tasks: [
        {
          id: generateId('task'),
          agentType: 'sdr-agent',
          description: 'Set up outbound sales development pipeline',
          input: { companyId },
          dependsOn: [],
        },
        {
          id: generateId('task'),
          agentType: 'ae-agent',
          description: 'Configure account executive workflows and CRM',
          input: { companyId },
          dependsOn: [],
        },
      ] satisfies SwarmPhaseTask[],
    },
    {
      order: 4,
      swarmType: 'finance',
      dependsOn: ['growth'],
      estimatedDurationMs: 1_800_000, // 30 min
      tasks: [
        {
          id: generateId('task'),
          agentType: 'treasurer-agent',
          description: 'Set up treasury management and banking',
          input: { companyId },
          dependsOn: [],
        },
        {
          id: generateId('task'),
          agentType: 'accountant-agent',
          description: 'Configure bookkeeping and financial reporting',
          input: { companyId },
          dependsOn: [],
        },
      ] satisfies SwarmPhaseTask[],
    },
    {
      order: 4,
      swarmType: 'customer-success',
      dependsOn: ['growth'],
      estimatedDurationMs: 1_800_000, // 30 min
      tasks: [
        {
          id: generateId('task'),
          agentType: 'support-agent',
          description: 'Set up customer support channels and knowledge base',
          input: { companyId },
          dependsOn: [],
        },
        {
          id: generateId('task'),
          agentType: 'onboarding-agent',
          description: 'Design customer onboarding flows',
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
  private resourceManager: ResourceManager;

  constructor(resourceManager: ResourceManager) {
    this.resourceManager = resourceManager;
  }

  /**
   * Start the company building process.
   * Creates the company record, orchestration plan, initializes budget,
   * and emits the initial creation events.
   */
  async startBuild(request: BuildCompanyRequest): Promise<Company> {
    const companyId = generateId('co');
    const correlationId = generateCorrelationId();
    const now = new Date();

    // Determine company name: use provided name or derive from the idea
    const companyName = request.name ?? `Company-${companyId.slice(0, 8)}`;

    // Create company record
    const company: Company = {
      id: companyId,
      name: companyName,
      status: 'building',
      jurisdiction: request.jurisdiction as Jurisdiction,
      entityType: (request.entityType as EntityType) ?? 'LLC',
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

    // Initialize resource manager budget tracking
    this.resourceManager.initializeBudget(companyId, request.budget);

    // Create orchestration plan
    const phases = createDefaultPhases(companyId);
    const plan: SwarmOrchestrationPlan = {
      companyId,
      phases,
    };
    this.plans.set(companyId, plan);

    // Emit creation events
    const createdEvent = this.createEvent(
      'company.created',
      companyId,
      'company',
      {
        name: companyName,
        idea: request.idea,
        budget: request.budget,
        jurisdiction: request.jurisdiction,
        entityType: company.entityType,
        founders: request.founders,
      },
      { correlationId, source: 'orchestrator' },
    );
    this.appendEvent(companyId, createdEvent);

    const buildStartedEvent = this.createEvent(
      'company.build_started',
      companyId,
      'company',
      {
        phases: phases.map((p) => ({
          order: p.order,
          swarmType: p.swarmType,
          dependsOn: p.dependsOn,
          taskCount: p.tasks.length,
          estimatedDurationMs: p.estimatedDurationMs,
        })),
      },
      { correlationId, source: 'orchestrator' },
    );
    this.appendEvent(companyId, buildStartedEvent);

    // Begin first phase (legal) asynchronously
    this.advancePhase(companyId, 'legal', correlationId);

    logger.info(
      { companyId, name: companyName, budget: request.budget, jurisdiction: request.jurisdiction },
      'Company build started',
    );

    return company;
  }

  /**
   * Get a company by its ID.
   */
  getCompany(id: string): Company | undefined {
    return this.companies.get(id);
  }

  /**
   * Get the event timeline for a company.
   */
  getCompanyEvents(id: string): DomainEvent[] {
    return this.events.get(id) ?? [];
  }

  /**
   * Get the orchestration plan for a company.
   */
  getOrchestrationPlan(id: string): SwarmOrchestrationPlan | undefined {
    return this.plans.get(id);
  }

  /**
   * Calculate overall progress (0-100) across all phases.
   */
  getCompanyProgress(id: string): number {
    const companyEvents = this.events.get(id) ?? [];
    const plan = this.plans.get(id);
    if (!plan) return 0;

    const totalPhases = plan.phases.length;
    if (totalPhases === 0) return 0;

    // Count completed phases based on events
    const completedPhases = new Set<string>();
    for (const event of companyEvents) {
      if (event.type === 'company.legal_completed') completedPhases.add('legal');
      if (event.type === 'company.product_deployed') completedPhases.add('product');
      if (event.type === 'company.growth_live') completedPhases.add('growth');
    }

    return Math.round((completedPhases.size / totalPhases) * 100);
  }

  // --------------------------------------------------
  // Internal helpers
  // --------------------------------------------------

  /**
   * Advance to the next phase of the orchestration plan.
   * In a real system this would dispatch work to swarm services;
   * for now it emits the phase-transition event and updates status.
   */
  private advancePhase(companyId: string, swarmType: SwarmType, correlationId: string): void {
    const company = this.companies.get(companyId);
    if (!company) return;

    const statusMap: Record<SwarmType, CompanyStatus> = {
      legal: 'legal_pending',
      product: 'product_building',
      growth: 'growth_active',
      sales: 'sales_active',
      finance: 'operational',
      'customer-success': 'operational',
    };

    const eventTypeMap: Record<SwarmType, string> = {
      legal: 'company.legal_started',
      product: 'company.product_started',
      growth: 'company.growth_started',
      sales: 'company.growth_live',
      finance: 'company.operational',
      'customer-success': 'company.operational',
    };

    const newStatus = statusMap[swarmType];
    if (newStatus) {
      company.status = newStatus;
      company.updatedAt = new Date();
    }

    const eventType = eventTypeMap[swarmType];
    if (eventType) {
      const event = this.createEvent(
        eventType,
        companyId,
        'company',
        { swarmType, phase: swarmType },
        { correlationId, source: 'orchestrator' },
      );
      this.appendEvent(companyId, event);
    }

    logger.info(
      { companyId, swarmType, newStatus },
      'Phase advanced',
    );
  }

  /**
   * Create a domain event.
   */
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

  /**
   * Append an event to the company's event store.
   */
  private appendEvent(companyId: string, event: DomainEvent): void {
    const existing = this.events.get(companyId) ?? [];
    existing.push(event);
    this.events.set(companyId, existing);

    logger.debug(
      { companyId, eventType: event.type, eventId: event.id },
      'Event appended',
    );
  }
}
