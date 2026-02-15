import type { Pool, QueryResult } from 'pg';
import type { DomainEvent } from '@acbi/types';

export interface EventRow {
  id: string;
  type: string;
  aggregate_id: string;
  aggregate_type: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  timestamp: Date;
  version: number;
}

function rowToEvent(row: EventRow): DomainEvent {
  return {
    id: row.id,
    type: row.type,
    aggregateId: row.aggregate_id,
    aggregateType: row.aggregate_type as DomainEvent['aggregateType'],
    payload: row.payload,
    metadata: row.metadata as DomainEvent['metadata'],
    timestamp: row.timestamp,
    version: row.version,
  };
}

export class EventRepository {
  constructor(private readonly pool: Pool) {}

  async save(event: DomainEvent): Promise<DomainEvent> {
    const query = `
      INSERT INTO domain_events (
        id, type, aggregate_id, aggregate_type, payload, metadata, timestamp, version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      event.id,
      event.type,
      event.aggregateId,
      event.aggregateType,
      JSON.stringify(event.payload),
      JSON.stringify(event.metadata),
      event.timestamp,
      event.version,
    ];

    const result: QueryResult<EventRow> = await this.pool.query(query, values);
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to save event: no row returned');
    }
    return rowToEvent(row);
  }

  async findByAggregate(aggregateId: string, aggregateType: string): Promise<DomainEvent[]> {
    const query = `
      SELECT * FROM domain_events
      WHERE aggregate_id = $1 AND aggregate_type = $2
      ORDER BY version ASC, timestamp ASC
    `;
    const result: QueryResult<EventRow> = await this.pool.query(query, [aggregateId, aggregateType]);
    return result.rows.map(rowToEvent);
  }

  async findByType(type: string, limit: number = 100): Promise<DomainEvent[]> {
    const query = `
      SELECT * FROM domain_events
      WHERE type = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;
    const result: QueryResult<EventRow> = await this.pool.query(query, [type, limit]);
    return result.rows.map(rowToEvent);
  }
}
