import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger, generateId } from '@acbi/utils';
import { SERVICE_PORTS } from '@acbi/config';
import { WorkflowExecutor } from './workflow-executor.js';
import type { WorkflowDefinition, WorkflowStep, StepType } from './workflow-executor.js';

const logger = createLogger('workflow-engine');
const app: Express = express();
const port = SERVICE_PORTS['workflow-engine'] ?? 3011;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize Workflow Executor
const executor = new WorkflowExecutor();

// Health check
app.get('/health', (_req, res) => {
  const workflows = executor.listWorkflows();
  res.json({
    status: 'healthy',
    service: 'workflow-engine',
    timestamp: new Date().toISOString(),
    stats: {
      totalWorkflows: workflows.length,
      running: workflows.filter((w) => w.status === 'running').length,
      completed: workflows.filter((w) => w.status === 'completed').length,
      failed: workflows.filter((w) => w.status === 'failed').length,
      paused: workflows.filter((w) => w.status === 'paused').length,
    },
  });
});

// POST /api/workflows - Create a new workflow
app.post('/api/workflows', (req, res) => {
  try {
    const { name, description, steps, metadata } = req.body as {
      name?: string;
      description?: string;
      steps?: Array<{
        id?: string;
        name: string;
        type: StepType;
        waitDuration?: number;
      }>;
      metadata?: Record<string, unknown>;
    };

    if (!name || !steps || !Array.isArray(steps) || steps.length === 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'name and steps (non-empty array) are required',
      });
      return;
    }

    // Convert incoming step definitions to WorkflowStep objects.
    // In a real implementation, step.execute and step.compensate would be
    // resolved from a registry of task handlers. For now, we use placeholders.
    const workflowSteps: WorkflowStep[] = steps.map((s) => ({
      id: s.id ?? generateId('step'),
      name: s.name,
      type: s.type,
      waitDuration: s.waitDuration,
      execute: async () => {
        logger.info({ stepName: s.name }, 'Executing placeholder step');
        return { status: 'completed', stepName: s.name };
      },
      compensate: async () => {
        logger.info({ stepName: s.name }, 'Compensating placeholder step');
      },
    }));

    const definition: WorkflowDefinition = {
      name,
      description,
      steps: workflowSteps,
      metadata,
    };

    const workflowId = executor.createWorkflow(definition);

    res.status(201).json({
      success: true,
      data: {
        id: workflowId,
        name,
        description,
        stepCount: steps.length,
        status: 'pending',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: message }, 'Failed to create workflow');
    res.status(500).json({ error: 'Internal Server Error', message });
  }
});

// GET /api/workflows/:id - Get workflow status
app.get('/api/workflows/:id', (req, res) => {
  const { id } = req.params;
  const workflow = executor.getStatus(id!);

  if (!workflow) {
    res.status(404).json({ error: 'Not Found', message: `Workflow ${id} not found` });
    return;
  }

  res.json({
    success: true,
    data: {
      id: workflow.id,
      name: workflow.definition.name,
      description: workflow.definition.description,
      status: workflow.status,
      currentStepIndex: workflow.currentStepIndex,
      totalSteps: workflow.definition.steps.length,
      completedSteps: workflow.completedSteps.length,
      error: workflow.error,
      createdAt: workflow.createdAt.toISOString(),
      startedAt: workflow.startedAt?.toISOString(),
      completedAt: workflow.completedAt?.toISOString(),
      pausedAt: workflow.pausedAt?.toISOString(),
    },
  });
});

// POST /api/workflows/:id/execute - Execute a workflow
app.post('/api/workflows/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;
    const workflow = executor.getStatus(id!);

    if (!workflow) {
      res.status(404).json({ error: 'Not Found', message: `Workflow ${id} not found` });
      return;
    }

    // Execute asynchronously — respond immediately with accepted status
    const result = await executor.execute(id!);

    res.json({
      success: true,
      data: {
        id: result.id,
        status: result.status,
        completedSteps: result.completedSteps.length,
        totalSteps: result.definition.steps.length,
        error: result.error,
        completedAt: result.completedAt?.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: message }, 'Failed to execute workflow');
    res.status(500).json({ error: 'Internal Server Error', message });
  }
});

// POST /api/workflows/:id/pause - Pause a running workflow
app.post('/api/workflows/:id/pause', (req, res) => {
  try {
    const { id } = req.params;
    executor.pauseWorkflow(id!);
    res.json({ success: true, message: `Pause signal sent to workflow ${id}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: 'Bad Request', message });
  }
});

// POST /api/workflows/:id/resume - Resume a paused workflow
app.post('/api/workflows/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await executor.resumeWorkflow(id!);
    res.json({
      success: true,
      data: {
        id: result.id,
        status: result.status,
        completedSteps: result.completedSteps.length,
        totalSteps: result.definition.steps.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: 'Bad Request', message });
  }
});

// GET /api/workflows - List all workflows
app.get('/api/workflows', (_req, res) => {
  const workflows = executor.listWorkflows();
  res.json({
    success: true,
    data: workflows.map((w) => ({
      id: w.id,
      name: w.definition.name,
      status: w.status,
      completedSteps: w.completedSteps.length,
      totalSteps: w.definition.steps.length,
      createdAt: w.createdAt.toISOString(),
    })),
  });
});

// Start server
app.listen(port, () => {
  logger.info({ port }, 'Workflow Engine started');
});

export { app };
