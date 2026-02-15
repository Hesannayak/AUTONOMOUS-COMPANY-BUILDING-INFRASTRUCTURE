import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@acbi/utils';
import { SERVICE_PORTS } from '@acbi/config';

const app = express();
const logger = createLogger('finance-service');
const port = SERVICE_PORTS['finance-service'] ?? 3006;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'finance-service', timestamp: new Date().toISOString() });
});

// Set up financial accounts for a company
app.post('/api/finance/setup', async (req, res) => {
  const { companyId, companyName, ein } = req.body;
  logger.info({ companyId }, 'Setting up financial accounts');

  // Phase 1: Mercury bank account + Stripe account
  res.json({
    success: true,
    data: {
      companyId,
      bankAccount: { provider: 'mercury', status: 'pending' },
      paymentProcessor: { provider: 'stripe', status: 'pending' },
      bookkeeping: { provider: 'quickbooks', status: 'pending' },
    },
  });
});

// Track expense
app.post('/api/finance/expenses', async (req, res) => {
  const { companyId, amount, category, description } = req.body;
  logger.info({ companyId, amount, category }, 'Recording expense');

  res.json({
    success: true,
    data: {
      id: `exp_${Date.now()}`,
      companyId,
      amount,
      category,
      description,
      timestamp: new Date().toISOString(),
    },
  });
});

// Get financial summary
app.get('/api/finance/:companyId/summary', (req, res) => {
  res.json({
    success: true,
    data: {
      companyId: req.params['companyId'],
      revenue: 0,
      expenses: 0,
      netIncome: 0,
      cashOnHand: 0,
      burnRate: 0,
      runway: 'N/A',
      breakdown: {
        llmCosts: 0,
        apiCosts: 0,
        hosting: 0,
        legal: 0,
        marketing: 0,
      },
    },
  });
});

// Budget allocation
app.post('/api/finance/budget', async (req, res) => {
  const { companyId, totalBudget, allocation } = req.body;
  logger.info({ companyId, totalBudget }, 'Setting budget allocation');

  res.json({
    success: true,
    data: {
      companyId,
      totalBudget,
      allocation: allocation ?? {
        legal: 0.1,
        product: 0.4,
        growth: 0.25,
        sales: 0.15,
        operations: 0.1,
      },
    },
  });
});

app.listen(port, () => {
  logger.info({ port }, `Finance service running on port ${port}`);
});
