// ============================================
// Company Domain Types
// ============================================

export type Jurisdiction =
  | 'US-DE'   // Delaware
  | 'US-WY'   // Wyoming
  | 'US-NV'   // Nevada
  | 'IN'      // India
  | 'SG'      // Singapore
  | 'UK'      // United Kingdom
  | 'CA-ON';  // Canada (Ontario)

export type EntityType = 'C-Corp' | 'LLC' | 'S-Corp' | 'PLC' | 'PVT-LTD';

export type CompanyStatus =
  | 'draft'
  | 'building'
  | 'legal_pending'
  | 'legal_complete'
  | 'product_building'
  | 'product_deployed'
  | 'growth_active'
  | 'sales_active'
  | 'operational'
  | 'failed'
  | 'paused';

export interface Founder {
  name: string;
  email: string;
  equityPercent: number;
  role: string;
}

export interface CompanyBuildRequest {
  idea: string;
  name?: string;
  budget: number;
  jurisdiction: Jurisdiction;
  entityType?: EntityType;
  founders: Founder[];
  techPreferences?: TechPreferences;
  targetAudience?: string;
  features?: string[];
}

export interface TechPreferences {
  stack?: 'nextjs' | 'react-vite' | 'remix';
  database?: 'supabase' | 'postgresql' | 'mongodb';
  hosting?: 'vercel' | 'aws' | 'railway';
  payments?: 'stripe' | 'paddle';
}

export interface Company {
  id: string;
  name: string;
  status: CompanyStatus;
  jurisdiction: Jurisdiction;
  entityType: EntityType;
  idea: string;
  budget: number;
  budgetSpent: number;
  founders: Founder[];
  legal: LegalInfo | null;
  product: ProductInfo | null;
  growth: GrowthInfo | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LegalInfo {
  ein?: string;
  entityId?: string;
  incorporationDate?: Date;
  registeredAgent?: string;
  bankAccountId?: string;
  stripeAccountId?: string;
  status: 'pending' | 'filing' | 'approved' | 'active' | 'failed';
}

export interface ProductInfo {
  repoUrl?: string;
  deployUrl?: string;
  stack: string;
  features: string[];
  status: 'designing' | 'coding' | 'testing' | 'deploying' | 'live' | 'failed';
}

export interface GrowthInfo {
  landingPageUrl?: string;
  seoScore?: number;
  adCampaigns: string[];
  socialAccounts: string[];
  status: 'setup' | 'content_creating' | 'live' | 'optimizing' | 'failed';
}
