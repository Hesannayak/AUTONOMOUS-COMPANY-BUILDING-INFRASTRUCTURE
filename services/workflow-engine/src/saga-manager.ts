import { createLogger, generateId } from '@acbi/utils';

const logger = createLogger('workflow-engine:saga-manager');

export interface SagaStep {
  id: string;
  name: string;
  execute: () => Promise<unknown>;
  compensate: () => Promise<void>;
}

export type SagaStatus = 'pending' | 'running' | 'completed' | 'compensating' | 'failed' | 'rolled_back';

interface SagaRecord {
  id: string;
  status: SagaStatus;
  steps: SagaStep[];
  completedSteps: SagaStep[];
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export class SagaManager {
  private sagas: Map<string, SagaRecord> = new Map();

  constructor() {
    logger.info('SagaManager initialized');
  }

  /**
   * Start a new saga — execute steps sequentially.
   * If any step fails, automatically compensate all completed steps in reverse order.
   */
  async startSaga(steps: SagaStep[]): Promise<{ sagaId: string; status: SagaStatus; error?: string }> {
    const sagaId = generateId('saga');
    const record: SagaRecord = {
      id: sagaId,
      status: 'running',
      steps,
      completedSteps: [],
      startedAt: new Date(),
    };

    this.sagas.set(sagaId, record);
    logger.info({ sagaId, stepCount: steps.length }, 'Saga started');

    try {
      for (const step of steps) {
        logger.info({ sagaId, stepId: step.id, stepName: step.name }, 'Executing saga step');
        await step.execute();
        record.completedSteps.push(step);
        logger.info({ sagaId, stepId: step.id, stepName: step.name }, 'Saga step completed');
      }

      record.status = 'completed';
      record.completedAt = new Date();
      logger.info({ sagaId }, 'Saga completed successfully');

      return { sagaId, status: 'completed' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      record.error = message;
      logger.error({ sagaId, error: message }, 'Saga step failed, starting compensation');

      // Compensate completed steps in reverse order
      record.status = 'compensating';
      await this.compensate(record.completedSteps);
      record.status = 'rolled_back';
      record.completedAt = new Date();

      logger.info({ sagaId, compensatedSteps: record.completedSteps.length }, 'Saga rolled back');

      return { sagaId, status: 'rolled_back', error: message };
    }
  }

  /**
   * Execute compensating actions for completed steps in reverse order.
   */
  async compensate(completedSteps: SagaStep[]): Promise<void> {
    const reversed = [...completedSteps].reverse();

    for (const step of reversed) {
      try {
        logger.info({ stepId: step.id, stepName: step.name }, 'Compensating step');
        await step.compensate();
        logger.info({ stepId: step.id, stepName: step.name }, 'Step compensated');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(
          { stepId: step.id, stepName: step.name, error: message },
          'Compensation failed for step — manual intervention may be needed',
        );
        // Continue compensating remaining steps even if one fails
      }
    }
  }

  /**
   * Get the record for a specific saga.
   */
  getSaga(sagaId: string): SagaRecord | undefined {
    return this.sagas.get(sagaId);
  }

  /**
   * Get all saga records.
   */
  getAllSagas(): SagaRecord[] {
    return Array.from(this.sagas.values());
  }
}
