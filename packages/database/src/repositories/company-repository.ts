import type { Pool, QueryResult } from 'pg';
import type { Company, CompanyStatus } from '@acbi/types';

export interface CompanyRow {
  id: string;
  name: string;
  status: string;
  jurisdiction: string;
  entity_type: string;
  idea: string;
  budget: string;
  budget_spent: string;
  founders: unknown;
  legal_info: unknown;
  product_info: unknown;
  growth_info: unknown;
  tech_preferences: unknown;
  target_audience: string | null;
  features: unknown;
  created_at: Date;
  updated_at: Date;
}

export interface PaginationOptions {
  limit: number;
  offset: number;
  status?: CompanyStatus;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

function rowToCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    status: row.status as Company['status'],
    jurisdiction: row.jurisdiction as Company['jurisdiction'],
    entityType: row.entity_type as Company['entityType'],
    idea: row.idea,
    budget: parseFloat(row.budget),
    budgetSpent: parseFloat(row.budget_spent),
    founders: row.founders as Company['founders'],
    legal: row.legal_info as Company['legal'],
    product: row.product_info as Company['product'],
    growth: row.growth_info as Company['growth'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CompanyRepository {
  constructor(private readonly pool: Pool) {}

  async create(company: Company): Promise<Company> {
    const query = `
      INSERT INTO companies (
        id, name, status, jurisdiction, entity_type, idea,
        budget, budget_spent, founders, legal_info, product_info,
        growth_info, tech_preferences, target_audience, features
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const values = [
      company.id,
      company.name,
      company.status,
      company.jurisdiction,
      company.entityType,
      company.idea,
      company.budget,
      company.budgetSpent,
      JSON.stringify(company.founders),
      company.legal ? JSON.stringify(company.legal) : null,
      company.product ? JSON.stringify(company.product) : null,
      company.growth ? JSON.stringify(company.growth) : null,
      null, // tech_preferences
      null, // target_audience
      JSON.stringify([]), // features
    ];

    const result: QueryResult<CompanyRow> = await this.pool.query(query, values);
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create company: no row returned');
    }
    return rowToCompany(row);
  }

  async findById(id: string): Promise<Company | null> {
    const query = 'SELECT * FROM companies WHERE id = $1';
    const result: QueryResult<CompanyRow> = await this.pool.query(query, [id]);
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToCompany(row);
  }

  async updateStatus(id: string, status: CompanyStatus): Promise<Company | null> {
    const query = `
      UPDATE companies SET status = $2
      WHERE id = $1
      RETURNING *
    `;
    const result: QueryResult<CompanyRow> = await this.pool.query(query, [id, status]);
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToCompany(row);
  }

  async updateBudgetSpent(id: string, amount: number): Promise<Company | null> {
    const query = `
      UPDATE companies SET budget_spent = $2
      WHERE id = $1
      RETURNING *
    `;
    const result: QueryResult<CompanyRow> = await this.pool.query(query, [id, amount]);
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToCompany(row);
  }

  async list(pagination: PaginationOptions): Promise<PaginatedResult<Company>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (pagination.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(pagination.status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const countQuery = `SELECT COUNT(*) as total FROM companies ${whereClause}`;
    const countResult = await this.pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0]?.total as string ?? '0', 10);

    const dataQuery = `
      SELECT * FROM companies ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const dataValues = [...values, pagination.limit, pagination.offset];
    const dataResult: QueryResult<CompanyRow> = await this.pool.query(dataQuery, dataValues);

    return {
      data: dataResult.rows.map(rowToCompany),
      total,
      limit: pagination.limit,
      offset: pagination.offset,
    };
  }
}
