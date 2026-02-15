import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@acbi/utils';
import { SERVICE_PORTS } from '@acbi/config';
import { GovernanceManager } from './governance.js';

const app = express();
const logger = createLogger('blockchain-service');
const port = SERVICE_PORTS['blockchain-service'] ?? 3009;
const governance = new GovernanceManager();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'blockchain-service',
    phase: 'scaffold-only',
    timestamp: new Date().toISOString(),
  });
});

// Create governance proposal
app.post('/api/governance/proposal', async (req, res) => {
  const result = governance.createProposal(req.body);
  res.json({ success: true, data: result });
});

// List proposals
app.get('/api/governance/proposals', (_req, res) => {
  res.json({ success: true, data: governance.listProposals() });
});

// Vote on proposal
app.post('/api/governance/vote', async (req, res) => {
  const { proposalId, vote, voterId } = req.body;
  const result = governance.vote(proposalId, vote, voterId);
  res.json({ success: true, data: result });
});

// Get agent reputation score
app.get('/api/reputation/:agentId', (req, res) => {
  const result = governance.getAgentReputation(req.params['agentId'] ?? '');
  res.json({ success: true, data: result });
});

app.listen(port, () => {
  logger.info({ port }, `Blockchain service running on port ${port} (Phase 3 scaffold)`);
});
