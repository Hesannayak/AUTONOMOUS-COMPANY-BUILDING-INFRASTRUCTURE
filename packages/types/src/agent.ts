// ============================================
// Agent Domain Types
// ============================================

export type AgentType =
  // Legal Swarm
  | 'legal-strategist'
  | 'filing-agent'
  | 'compliance-monitor'
  // Product Swarm
  | 'product-architect'
  | 'frontend-agent'
  | 'backend-agent'
  | 'devops-agent'
  | 'qa-agent'
  // Growth Swarm
  | 'seo-agent'
  | 'paid-ads-agent'
  | 'social-media-agent'
  // Sales Swarm
  | 'sdr-agent'
  | 'ae-agent'
  // Finance Swarm
  | 'treasurer-agent'
  | 'accountant-agent'
  // Customer Success
  | 'support-agent'
  | 'onboarding-agent';

export type AgentStatus = 'idle' | 'working' | 'waiting' | 'completed' | 'failed' | 'terminated';

export interface AgentTask {
  id: string;
  agentType: AgentType;
  companyId: string;
  input: Record<string, unknown>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: AgentStatus;
  result?: AgentResult;
  parentTaskId?: string;
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface AgentResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
  artifacts?: Artifact[];
}

export interface Artifact {
  type: 'code' | 'document' | 'config' | 'image' | 'url' | 'api-response';
  name: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface AgentConfig {
  type: AgentType;
  model: LLMModel;
  systemPrompt: string;
  tools: string[];
  maxConcurrent: number;
  timeoutMs: number;
  maxRetries: number;
  costLimitUsd: number;
}

export type LLMModel =
  | 'claude-sonnet-4-20250514'
  | 'claude-haiku-4-20250414'
  | 'gpt-4-turbo'
  | 'gpt-4o';

export interface AgentMemory {
  agentId: string;
  companyId: string;
  shortTerm: MemoryEntry[];  // Current task context
  longTerm: string[];         // Vector DB reference IDs
}

export interface MemoryEntry {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
}
