import { LogPattern } from '../types';

// ──────────────────────────────────────────────────────────
// API & Application-Level Log Patterns
// ──────────────────────────────────────────────────────────

export const apiPatterns: LogPattern[] = [
  {
    id: 'API_RATE_LIMITED',
    name: 'API Rate Limit Exceeded',
    category: 'api',
    patterns: [
      /rate\s*limit.*exceeded/i,
      /429\s+Too\s+Many\s+Requests/i,
      /HTTP\s+429/i,
      /throttl/i,
      /too\s+many\s+requests/i,
      /quota.*exceeded/i,
    ],
    keywords: ['rate limit', '429', 'too many requests', 'throttle', 'quota exceeded'],
    errorCodes: ['429'],
    severity: 'MEDIUM',
    severityModifiers: [
      {
        condition: /payment|billing|critical.*api/i,
        severity: 'HIGH',
        reason: 'Rate limiting on critical business APIs impacts revenue',
      },
    ],
    explanation: {
      summary:
        'The API rejected the request because the client has exceeded the maximum allowed number of requests within the rate limit window.',
      rootCause:
        'The client is sending requests faster than the API\'s rate limit policy allows.',
      possibleCauses: [
        'Client sending too many requests in a short period',
        'Missing or broken request throttling on the client side',
        'Retry logic without backoff flooding the API',
        'Rate limit tier too restrictive for the workload',
        'Multiple clients sharing the same API key',
        'Batch operation not using the bulk/batch endpoint',
      ],
      recommendedFixes: [
        'Implement exponential backoff with jitter on retries',
        'Respect the Retry-After header in 429 responses',
        'Use batch/bulk endpoints instead of individual requests',
        'Cache responses to reduce redundant API calls',
        'Request a higher rate limit tier from the API provider',
        'Distribute requests across multiple API keys if allowed',
      ],
    },
  },
  {
    id: 'API_TIMEOUT',
    name: 'API Request Timeout',
    category: 'timeout',
    patterns: [
      /request\s+timed?\s*out/i,
      /gateway\s+time[\s-]?out/i,
      /504\s+Gateway\s+Time[\s-]?out/i,
      /HTTP\s+504/i,
      /upstream\s+timed?\s*out/i,
      /proxy.*timeout/i,
    ],
    keywords: ['request timeout', 'gateway timeout', '504', 'upstream timeout'],
    errorCodes: ['504'],
    severity: 'HIGH',
    explanation: {
      summary:
        'An API request timed out before receiving a response. The upstream server or service was too slow to respond within the gateway\'s timeout window.',
      rootCause:
        'The upstream service processing the request exceeded the timeout threshold.',
      possibleCauses: [
        'Upstream service is overloaded or unresponsive',
        'Slow database queries backing the API endpoint',
        'Gateway/proxy timeout configured too low',
        'Network latency between proxy and upstream service',
        'Resource-intensive computation triggered by the request',
        'Deadlock or thread starvation in the upstream service',
      ],
      recommendedFixes: [
        'Check upstream service health and response times',
        'Increase gateway timeout if the operation is legitimately slow',
        'Optimize the slow upstream operation (query, computation)',
        'Implement async processing for long-running operations',
        'Add circuit breakers to prevent cascading timeouts',
        'Use request queuing and webhook callbacks for slow operations',
      ],
    },
  },
  {
    id: 'API_BAD_REQUEST',
    name: 'Bad Request / Validation Error',
    category: 'api',
    patterns: [
      /400\s+Bad\s+Request/i,
      /HTTP\s+400/i,
      /validation\s+(?:error|fail)/i,
      /invalid\s+(?:request|payload|input|parameter)/i,
      /malformed\s+(?:JSON|request|body)/i,
      /SyntaxError.*JSON/i,
    ],
    keywords: ['400', 'bad request', 'validation error', 'invalid request', 'malformed JSON'],
    errorCodes: ['400'],
    severity: 'LOW',
    explanation: {
      summary:
        'The API request was rejected because the request body, parameters, or headers are malformed or fail validation rules.',
      rootCause:
        'The client sent a request that does not conform to the expected API schema.',
      possibleCauses: [
        'Missing required fields in the request body',
        'Incorrect data types (string instead of number, etc.)',
        'Malformed JSON syntax in the request body',
        'Invalid enum value or out-of-range parameter',
        'API version mismatch — client using outdated request format',
        'Character encoding issues in the payload',
      ],
      recommendedFixes: [
        'Review the API documentation for the correct request schema',
        'Validate request payloads before sending (client-side validation)',
        'Check Content-Type header is set to application/json',
        'Use API client libraries or SDKs that enforce correct types',
        'Log and inspect the exact request being sent',
        'Verify you are targeting the correct API version',
      ],
    },
  },
  {
    id: 'API_INTERNAL_ERROR',
    name: 'Internal Server Error',
    category: 'application',
    patterns: [
      /500\s+Internal\s+Server\s+Error/i,
      /HTTP\s+500/i,
      /internal\s+server\s+error/i,
      /unhandled.*(?:error|exception)/i,
      /unexpected\s+error/i,
    ],
    keywords: ['500', 'internal server error', 'unhandled exception', 'unexpected error'],
    errorCodes: ['500'],
    severity: 'HIGH',
    severityModifiers: [
      {
        condition: /repeated|frequent|multiple/i,
        severity: 'CRITICAL',
        reason: 'Recurring 500 errors indicate a systemic bug or infrastructure failure',
      },
    ],
    explanation: {
      summary:
        'The server encountered an unexpected error while processing the request. This is a server-side issue, not a client error.',
      rootCause:
        'An unhandled exception or unexpected condition occurred in the server application code.',
      possibleCauses: [
        'Unhandled exception in application business logic',
        'Null reference or undefined variable access',
        'Database connection failure during request processing',
        'Dependency service (external API) returned unexpected data',
        'Application deployment or configuration error',
        'Corrupt application state or race condition',
      ],
      recommendedFixes: [
        'Check server application logs for the full stack trace',
        'Add comprehensive error handling and try-catch blocks',
        'Set up error tracking (Sentry, Bugsnag, Datadog)',
        'Review recent deployments that may have introduced the bug',
        'Test the failing request in a staging environment',
        'Implement circuit breakers for external dependency calls',
      ],
    },
  },
  {
    id: 'API_SERVICE_UNAVAILABLE',
    name: 'Service Unavailable',
    category: 'api',
    patterns: [
      /503\s+Service\s+Unavailable/i,
      /HTTP\s+503/i,
      /service\s+unavailable/i,
      /server\s+(?:is\s+)?(?:down|unavailable|overloaded)/i,
      /maintenance\s+mode/i,
    ],
    keywords: ['503', 'service unavailable', 'server down', 'maintenance'],
    errorCodes: ['503'],
    severity: 'CRITICAL',
    explanation: {
      summary:
        'The service is currently unavailable — it may be overloaded, under maintenance, or experiencing a failure. Requests cannot be processed.',
      rootCause:
        'The server is unable to handle requests due to overload, maintenance, or a crash.',
      possibleCauses: [
        'Server is overloaded and cannot accept new requests',
        'Planned maintenance window in effect',
        'Application crash with no healthy instances available',
        'Health checks failing, causing load balancer to remove all backends',
        'Auto-scaling has not yet provisioned enough instances',
        'Deployment in progress (rolling update)',
      ],
      recommendedFixes: [
        'Check the Retry-After header for expected recovery time',
        'Verify server health and instance counts',
        'Scale up or out to handle current load',
        'Check deployment status — rolling updates may cause brief 503s',
        'Review health check configuration for false negatives',
        'Implement graceful degradation and circuit breakers',
      ],
    },
  },
  {
    id: 'API_CORS_ERROR',
    name: 'CORS Policy Error',
    category: 'api',
    patterns: [
      /CORS.*(?:error|policy|block)/i,
      /Access-Control-Allow-Origin/i,
      /cross[\s-]?origin.*block/i,
      /No 'Access-Control-Allow-Origin' header/i,
      /preflight.*fail/i,
    ],
    keywords: ['CORS', 'cross-origin', 'Access-Control-Allow-Origin', 'preflight'],
    severity: 'MEDIUM',
    explanation: {
      summary:
        'The browser blocked a cross-origin request because the server\'s CORS policy does not allow it. This is a client-side security enforcement.',
      rootCause:
        'The server does not include the requesting origin in its Access-Control-Allow-Origin headers.',
      possibleCauses: [
        'Server CORS configuration does not include the client origin',
        'Missing or incorrect Access-Control-Allow-Origin header',
        'Preflight OPTIONS request failing or not handled',
        'Wildcard (*) CORS not allowed with credentials',
        'Proxy or CDN stripping CORS headers',
        'API gateway not configured to pass CORS headers through',
      ],
      recommendedFixes: [
        'Add the client origin to the server CORS allowed origins list',
        'Ensure OPTIONS preflight requests return correct CORS headers',
        'Set Access-Control-Allow-Methods and Access-Control-Allow-Headers',
        'If using credentials, specify exact origins (not wildcard *)',
        'Check reverse proxy (Nginx, API Gateway) CORS header configuration',
        'Use a CORS middleware in your framework (e.g., cors() in Express)',
      ],
    },
  },
];
