// ============================================
// Swarm Domain Types
// ============================================

import type { AgentType } from './agent.js';

export type SwarmType = 'legal' | 'product' | 'growth' | 'sales' | 'finance' | 'customer-success';

export type SwarmStatus =
  | 'inactive'
  | 'initializing'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed';

export interface Swarm {
  id: string;
  type: SwarmType;
  companyId: string;
  status: SwarmStatus;
  agents: SwarmAgent[];
  progress: number; // 0-100
  startedAt?: Date;
  completedAt?: Date;
}

export interface SwarmAgent {
  agentType: AgentType;
  instanceId: string;
  status: 'idle' | 'working' | 'completed' | 'failed';
  currentTask?: string;
}

export const SWARM_AGENT_MAP: Record<SwarmType, AgentType[]> = {
  legal: ['legal-strategist', 'filing-agent', 'compliance-monitor'],
  product: ['product-architect', 'frontend-agent', 'backend-agent', 'devops-agent', 'qa-agent'],
  growth: ['seo-agent', 'paid-ads-agent', 'social-media-agent'],
  sales: ['sdr-agent', 'ae-agent'],
  finance: ['treasurer-agent', 'accountant-agent'],
  'customer-success': ['support-agent', 'onboarding-agent'],
};

export interface SwarmOrchestrationPlan {
  companyId: string;
  phases: SwarmPhase[];
}

export interface SwarmPhase {
  order: number;
  swarmType: SwarmType;
  dependsOn: SwarmType[];
  tasks: SwarmPhaseTask[];
  estimatedDurationMs: number;
}

export interface SwarmPhaseTask {
  id: string;
  agentType: AgentType;
  description: string;
  input: Record<string, unknown>;
  dependsOn: string[]; // task IDs
}
