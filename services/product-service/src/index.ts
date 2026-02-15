import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@acbi/utils';
import { SERVICE_PORTS } from '@acbi/config';

const app = express();
const logger = createLogger('product-service');
const port = SERVICE_PORTS['product-service'] ?? 3003;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'product-service', timestamp: new Date().toISOString() });
});

// Build product for a company
app.post('/api/products/build', async (req, res) => {
  const { companyId, idea, techPreferences, features } = req.body;
  logger.info({ companyId }, 'Starting product build');

  // Phase 1: Scaffold Next.js + Supabase project, deploy to Vercel
  const buildId = `build_${Date.now()}`;
  res.json({
    success: true,
    data: {
      buildId,
      companyId,
      status: 'designing',
      steps: [
        { name: 'Architecture Design', status: 'pending' },
        { name: 'Code Generation', status: 'pending' },
        { name: 'Testing', status: 'pending' },
        { name: 'Deployment', status: 'pending' },
      ],
    },
  });
});

// Get build status
app.get('/api/products/:buildId/status', (req, res) => {
  res.json({
    success: true,
    data: { buildId: req.params['buildId'], status: 'in_progress', progress: 0 },
  });
});

// List generated code artifacts
app.get('/api/products/:companyId/artifacts', (req, res) => {
  res.json({ success: true, data: { companyId: req.params['companyId'], artifacts: [] } });
});

app.listen(port, () => {
  logger.info({ port }, `Product service running on port ${port}`);
});
