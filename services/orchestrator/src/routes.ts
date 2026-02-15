// ============================================
// Express Routes for the Orchestrator Service
// ============================================

import { Router } from 'express';
import type { Request, Response } from 'express';
import type {
  BuildCompanyRequest,
  BuildCompanyResponse,
  CompanyStatusResponse,
  ApiResponse,
  DomainEvent,
} from '@acbi/types';
import { createLogger, generateId } from '@acbi/utils';
import { CompanyBuilder } from './company-builder.js';

const logger = createLogger('orchestrator:routes');

export function createRouter(companyBuilder: CompanyBuilder): Router {
  const router = Router();

  // -----------------------------------------------
  // POST /api/companies/build
  // Accept a BuildCompanyRequest, create a company, and return its ID.
  // -----------------------------------------------
  router.post('/api/companies/build', async (req: Request, res: Response) => {
    const requestId = generateId('req');

    try {
      const body = req.body as BuildCompanyRequest;

      // Basic validation
      if (!body.idea || typeof body.idea !== 'string') {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Field "idea" is required and must be a string' },
          meta: { requestId, timestamp: new Date().toISOString() },
        };
        res.status(400).json(response);
        return;
      }

      if (!body.budget || typeof body.budget !== 'number' || body.budget <= 0) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Field "budget" is required and must be a positive number' },
          meta: { requestId, timestamp: new Date().toISOString() },
        };
        res.status(400).json(response);
        return;
      }

      if (!body.jurisdiction || typeof body.jurisdiction !== 'string') {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Field "jurisdiction" is required' },
          meta: { requestId, timestamp: new Date().toISOString() },
        };
        res.status(400).json(response);
        return;
      }

      if (!Array.isArray(body.founders) || body.founders.length === 0) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'At least one founder is required' },
          meta: { requestId, timestamp: new Date().toISOString() },
        };
        res.status(400).json(response);
        return;
      }

      logger.info({ requestId, idea: body.idea, budget: body.budget }, 'Build company request received');

      const company = await companyBuilder.startBuild(body);

      // Estimate completion based on phases (~4 hours total in dev, days in prod)
      const estimatedCompletionDays = 3;

      const data: BuildCompanyResponse = {
        companyId: company.id,
        status: company.status,
        estimatedCompletionDays,
        dashboardUrl: `/dashboard/companies/${company.id}`,
      };

      const response: ApiResponse<BuildCompanyResponse> = {
        success: true,
        data,
        meta: { requestId, timestamp: new Date().toISOString() },
      };

      logger.info({ requestId, companyId: company.id }, 'Company build initiated');
      res.status(201).json(response);
    } catch (error) {
      logger.error({ requestId, error }, 'Failed to start company build');

      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while starting the company build',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      };
      res.status(500).json(response);
    }
  });

  // -----------------------------------------------
  // GET /api/companies/:id
  // Return the current status of a company.
  // -----------------------------------------------
  router.get('/api/companies/:id', (req: Request, res: Response) => {
    const requestId = generateId('req');
    const { id } = req.params;

    try {
      const company = companyBuilder.getCompany(id!);
      if (!company) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'NOT_FOUND', message: `Company ${id} not found` },
          meta: { requestId, timestamp: new Date().toISOString() },
        };
        res.status(404).json(response);
        return;
      }

      const events = companyBuilder.getCompanyEvents(id!);
      const progress = companyBuilder.getCompanyProgress(id!);

      const timeline = events.map((evt) => ({
        event: evt.type,
        timestamp: evt.timestamp.toISOString(),
        details: JSON.stringify(evt.payload),
      }));

      const data: CompanyStatusResponse = {
        id: company.id,
        name: company.name,
        status: company.status,
        progress,
        swarms: [], // Populated once swarm services report back
        timeline,
        costs: {
          budgetTotal: company.budget,
          spent: company.budgetSpent,
          remaining: company.budget - company.budgetSpent,
          breakdown: {},
        },
      };

      const response: ApiResponse<CompanyStatusResponse> = {
        success: true,
        data,
        meta: { requestId, timestamp: new Date().toISOString() },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error({ requestId, companyId: id, error }, 'Failed to get company status');

      const response: ApiResponse = {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve company status' },
        meta: { requestId, timestamp: new Date().toISOString() },
      };
      res.status(500).json(response);
    }
  });

  // -----------------------------------------------
  // GET /api/companies/:id/events
  // Return the full event timeline for a company.
  // -----------------------------------------------
  router.get('/api/companies/:id/events', (req: Request, res: Response) => {
    const requestId = generateId('req');
    const { id } = req.params;

    try {
      const company = companyBuilder.getCompany(id!);
      if (!company) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'NOT_FOUND', message: `Company ${id} not found` },
          meta: { requestId, timestamp: new Date().toISOString() },
        };
        res.status(404).json(response);
        return;
      }

      const events = companyBuilder.getCompanyEvents(id!);

      const response: ApiResponse<DomainEvent[]> = {
        success: true,
        data: events,
        meta: { requestId, timestamp: new Date().toISOString() },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error({ requestId, companyId: id, error }, 'Failed to get company events');

      const response: ApiResponse = {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve company events' },
        meta: { requestId, timestamp: new Date().toISOString() },
      };
      res.status(500).json(response);
    }
  });

  return router;
}
