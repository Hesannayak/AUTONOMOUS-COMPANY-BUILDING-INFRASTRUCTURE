import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@acbi/utils';
import { SERVICE_PORTS } from '@acbi/config';

const app = express();
const logger = createLogger('sales-service');
const port = SERVICE_PORTS['sales-service'] ?? 3005;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'sales-service', timestamp: new Date().toISOString() });
});

// Define Ideal Customer Profile
app.post('/api/sales/icp', async (req, res) => {
  const { companyId, idea, targetAudience } = req.body;
  logger.info({ companyId }, 'Defining ICP');

  res.json({
    success: true,
    data: {
      companyId,
      icp: {
        industry: [],
        companySize: '',
        decisionMakers: [],
        painPoints: [],
        budget: '',
      },
      status: 'draft',
    },
  });
});

// Generate outreach sequences
app.post('/api/sales/outreach', async (req, res) => {
  const { companyId, icp, channels } = req.body;
  logger.info({ companyId }, 'Generating outreach sequences');

  res.json({
    success: true,
    data: {
      companyId,
      sequences: [],
      status: 'generating',
    },
  });
});

// Get sales pipeline metrics
app.get('/api/sales/:companyId/pipeline', (req, res) => {
  res.json({
    success: true,
    data: {
      companyId: req.params['companyId'],
      leads: 0,
      contacted: 0,
      qualified: 0,
      demos: 0,
      closed: 0,
      revenue: 0,
    },
  });
});

app.listen(port, () => {
  logger.info({ port }, `Sales service running on port ${port}`);
});
