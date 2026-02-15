import type { Request, Response } from 'express';
import { createLogger } from '@acbi/utils';

const logger = createLogger('api-gateway:proxy');

interface ProxyTarget {
  host: string;
  port: number;
}

/**
 * Simple HTTP proxy that forwards requests to internal services using native fetch.
 */
export async function proxyRequest(
  req: Request,
  res: Response,
  target: ProxyTarget,
  stripPrefix?: string,
): Promise<void> {
  // Build the target URL, stripping the gateway prefix
  let targetPath = req.originalUrl;
  if (stripPrefix && targetPath.startsWith(stripPrefix)) {
    targetPath = targetPath.slice(stripPrefix.length) || '/';
  }

  const targetUrl = `http://${target.host}:${target.port}${targetPath}`;

  logger.debug(
    { method: req.method, originalUrl: req.originalUrl, targetUrl },
    'Proxying request',
  );

  try {
    // Build headers, forwarding relevant ones from the original request
    const headers: Record<string, string> = {
      'content-type': req.headers['content-type'] ?? 'application/json',
    };

    // Forward authorization header if present
    if (req.headers.authorization) {
      headers['authorization'] = req.headers.authorization;
    }

    // Forward correlation ID if present
    const correlationId = req.headers['x-correlation-id'];
    if (correlationId && typeof correlationId === 'string') {
      headers['x-correlation-id'] = correlationId;
    }

    // Forward user ID if set by auth middleware
    const userId = (req as unknown as Record<string, unknown>)['userId'];
    if (typeof userId === 'string') {
      headers['x-user-id'] = userId;
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    // Include body for methods that support it
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const proxyResponse = await fetch(targetUrl, fetchOptions);

    // Forward status code
    res.status(proxyResponse.status);

    // Forward relevant response headers
    const contentType = proxyResponse.headers.get('content-type');
    if (contentType) {
      res.set('content-type', contentType);
    }

    // Read and forward the response body
    const body = await proxyResponse.text();

    // Try to parse as JSON, otherwise send as text
    try {
      const jsonBody = JSON.parse(body) as unknown;
      res.json(jsonBody);
    } catch {
      res.send(body);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ targetUrl, error: message }, 'Proxy request failed');
    res.status(502).json({
      error: 'Bad Gateway',
      message: `Failed to reach upstream service: ${message}`,
    });
  }
}

/**
 * Create a proxy middleware for a specific service target.
 */
export function createProxyMiddleware(target: ProxyTarget, stripPrefix?: string) {
  return (req: Request, res: Response) => {
    proxyRequest(req, res, target, stripPrefix).catch((error) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: message }, 'Unhandled proxy error');
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal Server Error', message });
      }
    });
  };
}
