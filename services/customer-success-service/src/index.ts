import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@acbi/utils';
import { SERVICE_PORTS } from '@acbi/config';

const app = express();
const logger = createLogger('customer-success-service');
const port = SERVICE_PORTS['customer-success-service'] ?? 3010;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'customer-success-service',
    timestamp: new Date().toISOString(),
  });
});

// Create support ticket
app.post('/api/support/tickets', async (req, res) => {
  const { companyId, customerId, subject, message } = req.body;
  logger.info({ companyId, customerId }, 'Creating support ticket');

  res.json({
    success: true,
    data: {
      ticketId: `tkt_${Date.now()}`,
      companyId,
      customerId,
      subject,
      status: 'open',
      createdAt: new Date().toISOString(),
    },
  });
});

// Get support metrics for a company
app.get('/api/support/:companyId/metrics', (req, res) => {
  res.json({
    success: true,
    data: {
      companyId: req.params['companyId'],
      openTickets: 0,
      avgResponseTimeMin: 0,
      csat: 0,
      nps: 0,
      churnRate: 0,
    },
  });
});

// Set up automated onboarding flow
app.post('/api/onboarding/setup', async (req, res) => {
  const { companyId, productUrl, features } = req.body;
  logger.info({ companyId }, 'Setting up onboarding flow');

  res.json({
    success: true,
    data: {
      companyId,
      onboardingSteps: [
        { step: 1, name: 'Welcome email', status: 'pending' },
        { step: 2, name: 'Product tour', status: 'pending' },
        { step: 3, name: 'First value moment', status: 'pending' },
        { step: 4, name: 'Follow-up check-in', status: 'pending' },
      ],
    },
  });
});

app.listen(port, () => {
  logger.info({ port }, `Customer success service running on port ${port}`);
});
