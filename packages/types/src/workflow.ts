// ============================================
// Workflow / State Machine Types
// ============================================

export type WorkflowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface Workflow {
  id: string;
  companyId: string;
  name: string;
  status: WorkflowStatus;
  currentStep: number;
  steps: WorkflowStep[];
  context: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'task' | 'decision' | 'parallel' | 'wait' | 'human-review';
  status: WorkflowStatus;
  agentType?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  retries: number;
  maxRetries: number;
  timeoutMs: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface WorkflowDefinition {
  name: string;
  version: string;
  steps: WorkflowStepDefinition[];
}

export interface WorkflowStepDefinition {
  id: string;
  name: string;
  type: WorkflowStep['type'];
  agentType?: string;
  inputMapping?: Record<string, string>;  // Maps context keys to step input
  outputMapping?: Record<string, string>; // Maps step output to context keys
  condition?: string;                      // For decision steps
  parallel?: WorkflowStepDefinition[];     // For parallel steps
  maxRetries?: number;
  timeoutMs?: number;
}

// Saga pattern for distributed transactions
export interface SagaStep {
  name: string;
  execute: string;    // Action to run
  compensate: string; // Rollback action if later steps fail
}
