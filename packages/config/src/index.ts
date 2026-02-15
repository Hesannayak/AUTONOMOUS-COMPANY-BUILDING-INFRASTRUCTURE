import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().default('postgresql://acbi:acbi_dev_password@localhost:5432/acbi'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // LLM Providers
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // External APIs
  STRIPE_SECRET_KEY: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  VERCEL_TOKEN: z.string().optional(),

  // Auth
  JWT_SECRET: z.string().default('dev-secret-change-in-production'),
  JWT_EXPIRY: z.string().default('24h'),

  // App
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_GATEWAY_PORT: z.coerce.number().default(8000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let _config: EnvConfig | null = null;

export function loadConfig(): EnvConfig {
  if (_config) return _config;
  _config = envSchema.parse(process.env);
  return _config;
}

export function getConfig(): EnvConfig {
  if (!_config) return loadConfig();
  return _config;
}

// Service-specific port mapping
export const SERVICE_PORTS: Record<string, number> = {
  'api-gateway': 8000,
  orchestrator: 3001,
  'legal-service': 3002,
  'product-service': 3003,
  'growth-service': 3004,
  'sales-service': 3005,
  'finance-service': 3006,
  'ml-service': 3007,
  'code-execution-service': 3008,
  'blockchain-service': 3009,
  'customer-success-service': 3010,
  'workflow-engine': 3011,
};
