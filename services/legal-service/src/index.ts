// ============================================
// Legal Service - Entry Point
// Handles company incorporation, EIN requests, and bank account setup.
// MVP: Delaware C-Corp via Stripe Atlas.
// ============================================

import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@acbi/utils';
import { SERVICE_PORTS } from '@acbi/config';
import { AgentRegistry } from '@acbi/agent-framework';
import { LegalSwarm } from './legal-swarm.js';
import { LegalStrategistAgent } from './agents/legal-strategist.js';
import { FilingAgent } from './agents/filing-agent.js';

const logger = createLogger('legal-service');

const PORT = SERVICE_PORTS['legal-service'] ?? 3002;

// Initialize swarm
const legalSwarm = new LegalSwarm();

// Register agents
const registry = AgentRegistry.getInstance();

registry.register(
  'legal-strategist',
  (config) => new LegalStrategistAgent(config),
  {
    type: 'legal-strategist',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: 'You are a legal strategist specializing in business incorporation and corporate law.',
    tools: [],
    maxConcurrent: 2,
    timeoutMs: 60_000,
    maxRetries: 2,
    costLimitUsd: 1.0,
  },
);

registry.register(
  'filing-agent',
  (config) => new FilingAgent(config),
  {
    type: 'filing-agent',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: 'You are a filing agent responsible for preparing incorporation documents.',
    tools: [],
    maxConcurrent: 2,
    timeoutMs: 60_000,
    maxRetries: 2,
    costLimitUsd: 1.0,
  },
);

// Create Express app
const app: Express = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'legal-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Start incorporation process
app.post('/api/legal/incorporate', async (req, res) => {
  try {
    const { companyName, jurisdiction, entityType, founders, registeredAgent } = req.body;

    if (!companyName || !founders) {
      res.status(400).json({ error: 'companyName and founders are required' });
      return;
    }

    const result = await legalSwarm.incorporateCompany({
      companyName,
      jurisdiction: jurisdiction ?? 'US-DE',
      entityType: entityType ?? 'C-Corp',
      founders,
      registeredAgent,
    });

    logger.info({ companyId: result.companyId }, 'Incorporation process started');
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: message }, 'Failed to start incorporation');
    res.status(500).json({ error: message });
  }
});

// Get legal status
app.get('/api/legal/status/:companyId', (req, res) => {
  const { companyId } = req.params;
  const status = legalSwarm.getStatus(companyId);

  if (!status) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }

  res.json(status);
});

// Request EIN
app.post('/api/legal/ein', async (req, res) => {
  try {
    const { companyId } = req.body;

    if (!companyId) {
      res.status(400).json({ error: 'companyId is required' });
      return;
    }

    const result = await legalSwarm.requestEIN(companyId);
    logger.info({ companyId }, 'EIN request initiated');
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: message }, 'Failed to request EIN');
    res.status(500).json({ error: message });
  }
});

// Open bank account
app.post('/api/legal/bank-account', async (req, res) => {
  try {
    const { companyId } = req.body;

    if (!companyId) {
      res.status(400).json({ error: 'companyId is required' });
      return;
    }

    const result = await legalSwarm.openBankAccount(companyId);
    logger.info({ companyId }, 'Bank account opening initiated');
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: message }, 'Failed to open bank account');
    res.status(500).json({ error: message });
  }
});

// Start server
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Legal service started');
});

export { app };
