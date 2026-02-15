// ============================================
// API Request / Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiMeta {
  requestId: string;
  timestamp: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Build Company API
export interface BuildCompanyRequest {
  idea: string;
  name?: string;
  budget: number;
  jurisdiction: string;
  entityType?: string;
  founders: Array<{
    name: string;
    email: string;
    equityPercent: number;
    role: string;
  }>;
  techPreferences?: {
    stack?: string;
    database?: string;
    hosting?: string;
    payments?: string;
  };
  targetAudience?: string;
  features?: string[];
}

export interface BuildCompanyResponse {
  companyId: string;
  status: string;
  estimatedCompletionDays: number;
  dashboardUrl: string;
}

// Company Status API
export interface CompanyStatusResponse {
  id: string;
  name: string;
  status: string;
  progress: number;
  swarms: Array<{
    type: string;
    status: string;
    progress: number;
  }>;
  timeline: Array<{
    event: string;
    timestamp: string;
    details?: string;
  }>;
  costs: {
    budgetTotal: number;
    spent: number;
    remaining: number;
    breakdown: Record<string, number>;
  };
}
