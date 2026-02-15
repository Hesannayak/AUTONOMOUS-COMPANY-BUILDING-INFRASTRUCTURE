-- ============================================
-- ACBI Database Schema
-- Autonomous Company Building Infrastructure
-- ============================================

-- Companies table
CREATE TABLE companies (
  id VARCHAR(30) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  jurisdiction VARCHAR(10) NOT NULL,
  entity_type VARCHAR(20) NOT NULL DEFAULT 'C-Corp',
  idea TEXT NOT NULL,
  budget DECIMAL(12,2) NOT NULL,
  budget_spent DECIMAL(12,2) NOT NULL DEFAULT 0,
  founders JSONB NOT NULL DEFAULT '[]',
  legal_info JSONB,
  product_info JSONB,
  growth_info JSONB,
  tech_preferences JSONB,
  target_audience TEXT,
  features JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent Tasks table
CREATE TABLE agent_tasks (
  id VARCHAR(30) PRIMARY KEY,
  agent_type VARCHAR(50) NOT NULL,
  company_id VARCHAR(30) NOT NULL REFERENCES companies(id),
  input JSONB NOT NULL DEFAULT '{}',
  priority VARCHAR(10) NOT NULL DEFAULT 'medium',
  status VARCHAR(20) NOT NULL DEFAULT 'idle',
  result JSONB,
  parent_task_id VARCHAR(30) REFERENCES agent_tasks(id),
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  timeout_ms INT NOT NULL DEFAULT 300000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Swarms table
CREATE TABLE swarms (
  id VARCHAR(30) PRIMARY KEY,
  type VARCHAR(30) NOT NULL,
  company_id VARCHAR(30) NOT NULL REFERENCES companies(id),
  status VARCHAR(20) NOT NULL DEFAULT 'inactive',
  agents JSONB NOT NULL DEFAULT '[]',
  progress INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Workflows table
CREATE TABLE workflows (
  id VARCHAR(30) PRIMARY KEY,
  company_id VARCHAR(30) NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  current_step INT NOT NULL DEFAULT 0,
  steps JSONB NOT NULL DEFAULT '[]',
  context JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Domain Events table (event sourcing)
CREATE TABLE domain_events (
  id VARCHAR(30) PRIMARY KEY,
  type VARCHAR(100) NOT NULL,
  aggregate_id VARCHAR(30) NOT NULL,
  aggregate_type VARCHAR(30) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_agent_tasks_company ON agent_tasks(company_id);
CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_swarms_company ON swarms(company_id);
CREATE INDEX idx_swarms_status ON swarms(status);
CREATE INDEX idx_workflows_company ON workflows(company_id);
CREATE INDEX idx_domain_events_aggregate ON domain_events(aggregate_id, aggregate_type);
CREATE INDEX idx_domain_events_type ON domain_events(type);
CREATE INDEX idx_domain_events_timestamp ON domain_events(timestamp);

-- ============================================
-- Triggers
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER workflows_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at();
