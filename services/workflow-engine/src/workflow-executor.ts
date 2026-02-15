import { createLogger, generateId } from '@acbi/utils';
import { SagaManager } from './saga-manager.js';
import type { SagaStep } from './saga-manager.js';

const logger = createLogger('workflow-engine:executor');

export type StepType = 'task' | 'decision' | 'parallel' | 'wait' | 'human-review';

export type WorkflowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'rolled_back';

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  /** The action to execute for this step. */
  execute: () => Promise<unknown>;
  /** The compensating action to run if a later step fails (Saga pattern). */
  compensate?: () => Promise<void>;
  /** For decision steps: returns the next step ID based on the result. */
  decide?: (result: unknown) => string | null;
  /** For parallel steps: sub-steps to run concurrently. */
  parallelSteps?: WorkflowStep[];
  /** For wait steps: duration in milliseconds. */
  waitDuration?: number;
  /** Result of execution, populated after the step runs. */
  result?: unknown;
  /** Status of individual step. */
  status?: WorkflowStatus;
}

export interface WorkflowDefinition {
  id?: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  metadata?: Record<string, unknown>;
}

interface WorkflowRecord {
  id: string;
  definition: WorkflowDefinition;
  status: WorkflowStatus;
  currentStepIndex: number;
  completedSteps: WorkflowStep[];
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  pausedAt?: Date;
}

export class WorkflowExecutor {
  private workflows: Map<string, WorkflowRecord> = new Map();
  private sagaManager: SagaManager;
  private pauseSignals: Map<string, boolean> = new Map();

  constructor() {
    this.sagaManager = new SagaManager();
    logger.info('WorkflowExecutor initialized');
  }

  /**
   * Register a workflow definition without executing it.
   */
  createWorkflow(definition: WorkflowDefinition): string {
    const id = definition.id ?? generateId('wf');
    const record: WorkflowRecord = {
      id,
      definition: { ...definition, id },
      status: 'pending',
      currentStepIndex: 0,
      completedSteps: [],
      createdAt: new Date(),
    };

    this.workflows.set(id, record);
    logger.info({ workflowId: id, name: definition.name, stepCount: definition.steps.length }, 'Workflow created');

    return id;
  }

  /**
   * Execute a workflow by running its steps sequentially.
   * Uses the Saga pattern: if a step fails, compensating actions are run
   * for all previously completed steps in reverse order.
   */
  async execute(workflowId: string): Promise<WorkflowRecord> {
    const record = this.workflows.get(workflowId);
    if (!record) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (record.status === 'running') {
      throw new Error(`Workflow ${workflowId} is already running`);
    }

    record.status = 'running';
    record.startedAt = new Date();
    this.pauseSignals.set(workflowId, false);

    logger.info({ workflowId, name: record.definition.name }, 'Workflow execution started');

    // Build saga steps from workflow steps
    const sagaSteps: SagaStep[] = [];

    try {
      for (let i = record.currentStepIndex; i < record.definition.steps.length; i++) {
        // Check for pause signal
        if (this.pauseSignals.get(workflowId)) {
          record.status = 'paused';
          record.currentStepIndex = i;
          record.pausedAt = new Date();
          logger.info({ workflowId, pausedAtStep: i }, 'Workflow paused');
          return record;
        }

        const step = record.definition.steps[i]!;
        record.currentStepIndex = i;

        logger.info({ workflowId, stepId: step.id, stepName: step.name, stepType: step.type }, 'Executing step');

        await this.executeStep(step);

        step.status = 'completed';
        record.completedSteps.push(step);

        // Track for saga compensation
        sagaSteps.push({
          id: step.id,
          name: step.name,
          execute: step.execute,
          compensate: step.compensate ?? (async () => {
            logger.warn({ stepId: step.id }, 'No compensate action defined for step');
          }),
        });

        logger.info({ workflowId, stepId: step.id }, 'Step completed');
      }

      record.status = 'completed';
      record.completedAt = new Date();
      logger.info({ workflowId }, 'Workflow completed successfully');

      return record;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      record.error = message;
      logger.error({ workflowId, error: message }, 'Workflow step failed, running compensations');

      // Run saga compensation for completed steps
      if (sagaSteps.length > 0) {
        await this.sagaManager.compensate(sagaSteps);
        record.status = 'rolled_back';
      } else {
        record.status = 'failed';
      }

      record.completedAt = new Date();
      return record;
    }
  }

  /**
   * Pause a running workflow. It will pause before the next step begins.
   */
  pauseWorkflow(id: string): void {
    const record = this.workflows.get(id);
    if (!record) {
      throw new Error(`Workflow ${id} not found`);
    }
    if (record.status !== 'running') {
      throw new Error(`Workflow ${id} is not running (status: ${record.status})`);
    }
    this.pauseSignals.set(id, true);
    logger.info({ workflowId: id }, 'Pause signal sent to workflow');
  }

  /**
   * Resume a paused workflow from where it left off.
   */
  async resumeWorkflow(id: string): Promise<WorkflowRecord> {
    const record = this.workflows.get(id);
    if (!record) {
      throw new Error(`Workflow ${id} not found`);
    }
    if (record.status !== 'paused') {
      throw new Error(`Workflow ${id} is not paused (status: ${record.status})`);
    }

    logger.info({ workflowId: id, resumeFromStep: record.currentStepIndex }, 'Resuming workflow');
    return this.execute(id);
  }

  /**
   * Get the current status of a workflow.
   */
  getStatus(id: string): WorkflowRecord | undefined {
    return this.workflows.get(id);
  }

  /**
   * List all workflows.
   */
  listWorkflows(): WorkflowRecord[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Execute a single step based on its type.
   */
  private async executeStep(step: WorkflowStep): Promise<void> {
    switch (step.type) {
      case 'task': {
        step.result = await step.execute();
        break;
      }

      case 'decision': {
        const result = await step.execute();
        step.result = result;
        // Decision result can be used by the caller to determine next steps
        if (step.decide) {
          const nextStepId = step.decide(result);
          step.result = { decision: result, nextStepId };
        }
        break;
      }

      case 'parallel': {
        if (step.parallelSteps && step.parallelSteps.length > 0) {
          const results = await Promise.all(
            step.parallelSteps.map(async (subStep) => {
              subStep.result = await subStep.execute();
              subStep.status = 'completed';
              return subStep.result;
            }),
          );
          step.result = results;
        } else {
          step.result = await step.execute();
        }
        break;
      }

      case 'wait': {
        const duration = step.waitDuration ?? 0;
        logger.info({ stepId: step.id, duration }, 'Waiting');
        await new Promise<void>((resolve) => setTimeout(resolve, duration));
        step.result = { waited: duration };
        break;
      }

      case 'human-review': {
        // In a real implementation, this would pause and wait for human input.
        // For now, auto-approve after executing the step.
        logger.info({ stepId: step.id }, 'Human review step — auto-approving in development mode');
        step.result = await step.execute();
        break;
      }

      default: {
        throw new Error(`Unknown step type: ${step.type}`);
      }
    }
  }
}
