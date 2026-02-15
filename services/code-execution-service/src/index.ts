// ============================================
// Code Execution Service - Entry Point
// Sandboxed code execution environment used by the Product Swarm
// to run generated code safely.
// Phase 3: Real sandboxing via Docker/Firecracker.
// ============================================

import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@acbi/utils';
import { SERVICE_PORTS } from '@acbi/config';
import { CodeSandbox } from './sandbox.js';
import { ProjectTemplateManager } from './templates.js';
import type { SupportedLanguage } from './sandbox.js';

const logger = createLogger('code-execution-service');
const app: Express = express();
const port = SERVICE_PORTS['code-execution-service'] ?? 3008;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Initialize core services
const sandbox = new CodeSandbox();
const templateManager = new ProjectTemplateManager();

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'code-execution-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    supportedLanguages: sandbox.getSupportedLanguages(),
    templateCount: templateManager.listTemplates().length,
  });
});

// POST /api/execute - Execute code in sandbox
app.post('/api/execute', async (req, res) => {
  try {
    const { code, language, timeout } = req.body as {
      code?: string;
      language?: string;
      timeout?: number;
    };

    if (!code || !language) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'code and language are required',
      });
      return;
    }

    const result = await sandbox.execute(
      code,
      language as SupportedLanguage,
      timeout,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: message }, 'Code execution failed');
    res.status(500).json({ error: 'Internal Server Error', message });
  }
});

// POST /api/validate - Validate code without executing
app.post('/api/validate', async (req, res) => {
  try {
    const { code, language } = req.body as {
      code?: string;
      language?: string;
    };

    if (!code || !language) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'code and language are required',
      });
      return;
    }

    const result = await sandbox.validate(code, language as SupportedLanguage);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: message }, 'Code validation failed');
    res.status(500).json({ error: 'Internal Server Error', message });
  }
});

// GET /api/templates - List available project templates
app.get('/api/templates', (_req, res) => {
  const templates = templateManager.listTemplates();
  res.json({
    success: true,
    data: templates,
  });
});

// GET /api/templates/:name - Get a specific template
app.get('/api/templates/:name', (req, res) => {
  const { name } = req.params;
  const template = templateManager.getTemplate(name!);

  if (!template) {
    res.status(404).json({
      error: 'Not Found',
      message: `Template '${name}' not found`,
    });
    return;
  }

  res.json({
    success: true,
    data: template,
  });
});

// POST /api/templates/:name/scaffold - Scaffold a project from a template
app.post('/api/templates/:name/scaffold', (req, res) => {
  try {
    const { name } = req.params;
    const { companyName, projectName, description } = req.body as {
      companyName?: string;
      projectName?: string;
      description?: string;
    };

    if (!companyName) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'companyName is required',
      });
      return;
    }

    const result = templateManager.scaffoldProject(name!, {
      companyName,
      projectName,
      description,
    });

    if (!result) {
      res.status(404).json({
        error: 'Not Found',
        message: `Template '${name}' not found`,
      });
      return;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: message }, 'Project scaffolding failed');
    res.status(500).json({ error: 'Internal Server Error', message });
  }
});

// Start server
app.listen(port, () => {
  logger.info({ port }, 'Code Execution Service started');
  logger.info(
    {
      supportedLanguages: sandbox.getSupportedLanguages(),
      templates: templateManager.listTemplates().map((t) => t.name),
    },
    'Service capabilities',
  );
});

export { app };
