// ============================================
// Plan Generator — Version A: Fast & Magical
// Takes an idea + answers to smart questions and produces
// a one-page company build plan in ~90 seconds.
// ============================================

import { createLogger, generateId } from '@acbi/utils';
import { SERVICE_PORTS } from '@acbi/config';

const logger = createLogger('orchestrator:plan-generator');

export interface SmartQuestion {
  id: string;
  question: string;
  placeholder: string;
  type: 'text' | 'select';
  options?: Array<{ value: string; label: string }>;
  required: boolean;
}

export interface CompanyPlan {
  id: string;
  companyName: string;
  tagline: string;
  entityType: string;
  jurisdiction: string;
  timeline: string;
  budget: { total: number; legal: number; product: number; marketing: number; operations: number };
  legal: { steps: string[]; estimatedDays: number };
  product: { stack: string; features: string[]; estimatedDays: number };
  marketing: { channels: string[]; contentPieces: number; estimatedDays: number };
  revenueProjection: { month3: string; month6: string; month12: string };
  risks: string[];
  generatedAt: string;
}

/**
 * Generate 5 smart context-gathering questions based on the idea.
 * These are returned instantly (no LLM needed — rule-based for speed).
 */
export function generateSmartQuestions(_idea: string): SmartQuestion[] {
  return [
    {
      id: 'target_customer',
      question: 'Who is your target customer?',
      placeholder: 'e.g., "Small dental practices with 1-5 dentists"',
      type: 'text',
      required: true,
    },
    {
      id: 'key_feature',
      question: 'What is the #1 feature your product must have?',
      placeholder: 'e.g., "Appointment scheduling with SMS reminders"',
      type: 'text',
      required: true,
    },
    {
      id: 'budget_tier',
      question: 'What is your budget?',
      placeholder: '',
      type: 'select',
      options: [
        { value: '500', label: 'Starter — $500 (MVP only)' },
        { value: '1500', label: 'Growth — $1,500 (MVP + Marketing)' },
        { value: '5000', label: 'Scale — $5,000 (Full build)' },
      ],
      required: true,
    },
    {
      id: 'entity_type',
      question: 'Preferred legal entity?',
      placeholder: '',
      type: 'select',
      options: [
        { value: 'auto', label: 'Let AI decide (recommended)' },
        { value: 'C-Corp', label: 'C-Corp (for fundraising)' },
        { value: 'LLC', label: 'LLC (simpler, pass-through tax)' },
      ],
      required: true,
    },
    {
      id: 'timeline',
      question: 'How fast do you want to launch?',
      placeholder: '',
      type: 'select',
      options: [
        { value: 'fast', label: 'Fast — 14 days (lean MVP)' },
        { value: 'normal', label: 'Normal — 30 days (recommended)' },
        { value: 'thorough', label: 'Thorough — 60 days (full build)' },
      ],
      required: true,
    },
  ];
}

/**
 * Generate a company plan from the idea and question answers.
 * Calls the LLM gateway for intelligent plan creation, with
 * a fast fallback if the LLM is unavailable.
 */
export async function generatePlan(
  idea: string,
  answers: Record<string, string>,
  _founderName: string,
  _founderEmail: string,
): Promise<CompanyPlan> {
  const budget = parseInt(answers['budget_tier'] ?? '1500', 10);
  const entityChoice = answers['entity_type'] ?? 'auto';
  const timeline = answers['timeline'] ?? 'normal';
  const targetCustomer = answers['target_customer'] ?? '';
  const keyFeature = answers['key_feature'] ?? '';

  const entityType = entityChoice === 'auto'
    ? (budget >= 5000 ? 'C-Corp' : 'LLC')
    : entityChoice;

  const timelineDays = timeline === 'fast' ? 14 : timeline === 'thorough' ? 60 : 30;

  // Try to get an LLM-generated company name and tagline
  let companyName = `${idea.split(' ').slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}AI`;
  let tagline = `${keyFeature} for ${targetCustomer}`;

  try {
    const llmPort = SERVICE_PORTS['ml-service'];
    if (llmPort) {
      const resp = await fetch(`http://localhost:${llmPort}/api/llm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'plan-gen',
          taskType: 'creative',
          messages: [
            {
              role: 'user',
              content: `Generate a company name and tagline for this business:
Idea: ${idea}
Target customer: ${targetCustomer}
Key feature: ${keyFeature}

Respond with ONLY a JSON object (no markdown, no code fences): {"name": "CompanyName", "tagline": "A short catchy tagline"}`,
            },
          ],
        }),
      });

      if (resp.ok) {
        const result = await resp.json() as { data?: { content?: string } };
        const content = result.data?.content ?? '';
        try {
          const parsed = JSON.parse(content) as { name?: string; tagline?: string };
          if (parsed.name) companyName = parsed.name;
          if (parsed.tagline) tagline = parsed.tagline;
        } catch {
          // LLM returned non-JSON — use defaults
          logger.debug('LLM returned non-JSON for name generation, using defaults');
        }
      }
    }
  } catch {
    logger.debug('LLM service unreachable for plan generation, using defaults');
  }

  // Budget allocation
  const budgetAllocation = {
    total: budget,
    legal: Math.round(budget * 0.15),
    product: Math.round(budget * 0.45),
    marketing: Math.round(budget * 0.25),
    operations: Math.round(budget * 0.15),
  };

  // Features based on budget tier
  const baseFeatures = [keyFeature || 'Core functionality', 'User authentication', 'Dashboard'];
  const growthFeatures = [...baseFeatures, 'Payment processing', 'Analytics', 'Email notifications'];
  const scaleFeatures = [...growthFeatures, 'Admin panel', 'API access', 'Custom integrations', 'Mobile-responsive'];

  const features = budget >= 5000 ? scaleFeatures : budget >= 1500 ? growthFeatures : baseFeatures;

  const plan: CompanyPlan = {
    id: generateId('plan'),
    companyName,
    tagline,
    entityType,
    jurisdiction: 'US-DE',
    timeline: `${timelineDays} days`,
    budget: budgetAllocation,
    legal: {
      steps: [
        `Incorporate ${entityType} in Delaware`,
        'Obtain EIN from IRS',
        'Open Mercury business bank account',
        'Set up Stripe payment processing',
      ],
      estimatedDays: 7,
    },
    product: {
      stack: 'Next.js + Supabase + Vercel',
      features,
      estimatedDays: timeline === 'fast' ? 7 : timeline === 'thorough' ? 40 : 16,
    },
    marketing: {
      channels: budget >= 1500
        ? ['SEO-optimized landing page', 'Google Ads', 'Social media profiles', 'Content marketing']
        : ['SEO-optimized landing page', 'Social media profiles'],
      contentPieces: budget >= 5000 ? 20 : budget >= 1500 ? 10 : 3,
      estimatedDays: timeline === 'fast' ? 3 : timeline === 'thorough' ? 15 : 7,
    },
    revenueProjection: {
      month3: budget >= 5000 ? '$2,000/mo' : budget >= 1500 ? '$500/mo' : '$0',
      month6: budget >= 5000 ? '$8,000/mo' : budget >= 1500 ? '$2,000/mo' : '$500/mo',
      month12: budget >= 5000 ? '$25,000/mo' : budget >= 1500 ? '$8,000/mo' : '$2,000/mo',
    },
    risks: [
      'Market validation — early customer feedback critical',
      'Regulatory compliance for target industry',
      budget < 1500 ? 'Limited marketing budget may slow growth' : 'Paid ads require ongoing optimization',
    ],
    generatedAt: new Date().toISOString(),
  };

  logger.info({ planId: plan.id, companyName, budget, timeline }, 'Plan generated');
  return plan;
}
