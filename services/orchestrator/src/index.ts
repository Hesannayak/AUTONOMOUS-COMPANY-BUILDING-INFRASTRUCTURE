// ============================================
// Orchestrator Service - Entry Point
// Meta-coordinator that takes "build company" requests and orchestrates
// all swarms (legal, product, growth, sales, finance, customer-success).
// ============================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@acbi/utils';
import { SERVICE_PORTS } from '@acbi/config';
import { CompanyBuilder } from './company-builder.js';
import { ResourceManager } from './resource-manager.js';
import { createRouter } from './routes.js';

const logger = createLogger('orchestrator');

const PORT = SERVICE_PORTS['orchestrator'] ?? 3001;

// Initialize core services
const resourceManager = new ResourceManager();
const companyBuilder = new CompanyBuilder(resourceManager);

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'orchestrator',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use(createRouter(companyBuilder));

// Start server
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Orchestrator service started');
});

export { app };
