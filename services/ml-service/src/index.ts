import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@acbi/utils';
import { SERVICE_PORTS } from '@acbi/config';
import { LLMRouter } from './llm-router.js';

const logger = createLogger('ml-service');
const app: Express = express();
const port = SERVICE_PORTS['ml-service'] ?? 3007;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize LLM Router
const llmRouter = new LLMRouter();

// Health check
app.get('/health', (_req, res) => {
  const stats = llmRouter.getUsageStats();
  res.json({
    status: 'healthy',
    service: 'ml-service',
    timestamp: new Date().toISOString(),
    stats: {
      requestCount: stats.requestCount,
      cacheHitRate: stats.cacheHitRate,
      cacheSize: stats.cacheSize,
      totalCost: stats.costBreakdown.total.cost,
    },
  });
});

// POST /api/llm/chat - Main chat endpoint
app.post('/api/llm/chat', async (req, res) => {
  try {
    const { companyId, messages, taskType, preferredModel, tools, maxTokens } = req.body as {
      companyId?: string;
      messages?: Array<{ role: string; content: string }>;
      taskType?: string;
      preferredModel?: string;
      tools?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
      maxTokens?: number;
    };

    if (!companyId || !messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'companyId and messages (non-empty array) are required',
      });
      return;
    }

    const response = await llmRouter.chat({
      companyId,
      messages: messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
      taskType: taskType as 'simple' | 'moderate' | 'complex' | 'creative' | 'code' | 'analysis' | undefined,
      preferredModel: preferredModel as 'claude-sonnet-4-20250514' | 'claude-haiku-4-20250414' | 'gpt-4-turbo' | 'gpt-4o' | undefined,
      tools,
      maxTokens,
    });

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: message }, 'Chat request failed');
    res.status(500).json({
      error: 'Internal Server Error',
      message,
    });
  }
});

// GET /api/llm/stats - Usage statistics
app.get('/api/llm/stats', (_req, res) => {
  const stats = llmRouter.getUsageStats();
  res.json({
    success: true,
    data: stats,
  });
});

// GET /api/llm/costs/:companyId - Cost breakdown for a company
app.get('/api/llm/costs/:companyId', (req, res) => {
  const { companyId } = req.params;
  const costTracker = llmRouter.getCostTracker();
  res.json({
    success: true,
    data: {
      companyId,
      totalCost: costTracker.getCompanyCost(companyId!),
      remainingBudget: costTracker.getRemainingBudget(companyId!),
      isOverLimit: costTracker.isOverLimit(companyId!),
    },
  });
});

// Start server
app.listen(port, () => {
  logger.info({ port }, 'ML Service started');
});

export { app };
