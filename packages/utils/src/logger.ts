import pino from 'pino';

export function createLogger(service: string) {
  return pino({
    name: service,
    level: process.env['LOG_LEVEL'] ?? 'info',
    transport:
      process.env['NODE_ENV'] === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    base: {
      service,
      env: process.env['NODE_ENV'] ?? 'development',
    },
  });
}
