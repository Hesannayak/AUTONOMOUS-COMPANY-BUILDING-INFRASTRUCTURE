import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@acbi/utils';
import { SERVICE_PORTS } from '@acbi/config';
import { authMiddleware } from './middleware/auth.js';
import { standardRateLimit } from './middleware/rate-limit.js';
import { createProxyMiddleware } from './proxy.js';

const logger = createLogger('api-gateway');
const app = express();
const port = SERVICE_PORTS['api-gateway'] ?? 8000;

// Global middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(standardRateLimit);

// Auth middleware (toggled via AUTH_ENABLED env var)
app.use(authMiddleware);

// --- Service proxy targets ---

const orchestratorTarget = { host: 'localhost', port: SERVICE_PORTS['orchestrator'] ?? 3001 };
const mlServiceTarget = { host: 'localhost', port: SERVICE_PORTS['ml-service'] ?? 3007 };
const workflowEngineTarget = { host: 'localhost', port: SERVICE_PORTS['workflow-engine'] ?? 3011 };

// --- Proxy routes to internal services ---

// /api/companies/* → orchestrator (port 3001)
app.all('/api/companies/*', createProxyMiddleware(orchestratorTarget));

// /api/llm/* → ml-service (port 3007)
app.all('/api/llm/*', createProxyMiddleware(mlServiceTarget));

// /api/workflows/* → workflow-engine (port 3011)
app.all('/api/workflows/*', createProxyMiddleware(workflowEngineTarget));

// --- Gateway health check (aggregates all service health) ---

app.get('/health', async (_req, res) => {
  const services = [
    { name: 'orchestrator', ...orchestratorTarget },
    { name: 'ml-service', ...mlServiceTarget },
    { name: 'workflow-engine', ...workflowEngineTarget },
  ];

  const serviceHealth: Record<string, { status: string; responseTime?: number }> = {};
  let allHealthy = true;

  await Promise.all(
    services.map(async (service) => {
      const start = Date.now();
      try {
        const response = await fetch(`http://${service.host}:${service.port}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        const responseTime = Date.now() - start;

        if (response.ok) {
          serviceHealth[service.name] = { status: 'healthy', responseTime };
        } else {
          serviceHealth[service.name] = { status: 'unhealthy', responseTime };
          allHealthy = false;
        }
      } catch {
        serviceHealth[service.name] = { status: 'unreachable' };
        allHealthy = false;
      }
    }),
  );

  const statusCode = allHealthy ? 200 : 503;
  res.status(statusCode).json({
    status: allHealthy ? 'healthy' : 'degraded',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    services: serviceHealth,
  });
});

// --- 404 handler ---

app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

// Start server
app.listen(port, () => {
  logger.info({ port }, 'API Gateway started');
  logger.info(
    {
      routes: {
        '/api/companies/*': `orchestrator (port ${orchestratorTarget.port})`,
        '/api/llm/*': `ml-service (port ${mlServiceTarget.port})`,
        '/api/workflows/*': `workflow-engine (port ${workflowEngineTarget.port})`,
      },
    },
    'Proxy routes configured',
  );
});

export { app };
