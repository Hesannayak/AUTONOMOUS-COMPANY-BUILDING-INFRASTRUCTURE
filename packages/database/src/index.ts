import pg from 'pg';
import { getConfig } from '@acbi/config';
import { CompanyRepository } from './repositories/company-repository.js';
import { EventRepository } from './repositories/event-repository.js';

const { Pool } = pg;

export type { PaginationOptions, PaginatedResult } from './repositories/company-repository.js';
export { CompanyRepository } from './repositories/company-repository.js';
export { EventRepository } from './repositories/event-repository.js';

let _pool: pg.Pool | null = null;

/**
 * Creates and returns a PostgreSQL connection pool.
 * Reuses the existing pool if one has already been created.
 */
export function createPool(connectionString?: string): pg.Pool {
  if (_pool) return _pool;

  const config = getConfig();
  _pool = new Pool({
    connectionString: connectionString ?? config.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  _pool.on('error', (err: Error) => {
    console.error('Unexpected database pool error:', err);
  });

  return _pool;
}

/**
 * Executes a parameterized SQL query against the connection pool.
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  const pool = createPool();
  return pool.query<T>(text, params);
}

/**
 * Gracefully shuts down the connection pool.
 */
export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

/**
 * Creates repository instances bound to the current connection pool.
 */
export function createRepositories(pool?: pg.Pool): {
  companies: CompanyRepository;
  events: EventRepository;
} {
  const p = pool ?? createPool();
  return {
    companies: new CompanyRepository(p),
    events: new EventRepository(p),
  };
}
