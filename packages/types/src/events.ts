// ============================================
// Event Sourcing Types
// ============================================

export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: 'company' | 'agent' | 'swarm' | 'workflow';
  payload: Record<string, unknown>;
  metadata: EventMetadata;
  timestamp: Date;
  version: number;
}

export interface EventMetadata {
  correlationId: string;   // Traces across swarms
  causationId?: string;    // What caused this event
  userId?: string;
  agentId?: string;
  source: string;          // Service that emitted the event
}

// Company Events
export type CompanyEventType =
  | 'company.created'
  | 'company.build_started'
  | 'company.legal_started'
  | 'company.legal_completed'
  | 'company.product_started'
  | 'company.product_deployed'
  | 'company.growth_started'
  | 'company.growth_live'
  | 'company.operational'
  | 'company.failed'
  | 'company.paused';

// Agent Events
export type AgentEventType =
  | 'agent.task_assigned'
  | 'agent.task_started'
  | 'agent.task_completed'
  | 'agent.task_failed'
  | 'agent.task_retrying'
  | 'agent.llm_called'
  | 'agent.tool_used'
  | 'agent.artifact_created';

// Swarm Events
export type SwarmEventType =
  | 'swarm.initialized'
  | 'swarm.started'
  | 'swarm.agent_added'
  | 'swarm.progress_updated'
  | 'swarm.completed'
  | 'swarm.failed';
