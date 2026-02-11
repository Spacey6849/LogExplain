// ──────────────────────────────────────────────────────────
// LogExplain – Log Parser
// Extracts structured metadata from raw log strings
// ──────────────────────────────────────────────────────────

export interface ParsedLogMetadata {
  /** ISO timestamp if found */
  timestamp?: string;
  /** Log level (INFO, ERROR, WARN, DEBUG, etc.) */
  logLevel?: string;
  /** Source service, process, or host */
  source?: string;
  /** Process ID */
  pid?: string;
  /** Error code if present */
  errorCode?: string;
  /** IP address if present */
  ipAddress?: string;
  /** Port number if present */
  port?: string;
  /** Username if present */
  username?: string;
  /** File path if present */
  filePath?: string;
  /** HTTP status code if present */
  httpStatus?: string;
  /** HTTP method if present */
  httpMethod?: string;
  /** URL or endpoint if present */
  url?: string;
  /** Raw message body (after metadata stripped) */
  messageBody: string;
}

// ─── Regex library for metadata extraction ──────────────

const TIMESTAMP_PATTERNS = [
  // ISO 8601: 2026-02-11T10:30:00.000Z
  /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/,
  // Syslog: Feb 11 10:30:00
  /([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/,
  // Common log: 11/Feb/2026:10:30:00 +0000
  /(\d{2}\/[A-Z][a-z]{2}\/\d{4}:\d{2}:\d{2}:\d{2}\s+[+-]\d{4})/,
  // Date-time: 2026-02-11 10:30:00
  /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)/,
  // Unix timestamp (10 or 13 digits)
  /\b(1\d{9}(?:\d{3})?)\b/,
];

const LOG_LEVEL_PATTERN =
  /\b(EMERG|EMERGENCY|ALERT|CRIT|CRITICAL|ERR|ERROR|WARN|WARNING|NOTICE|INFO|DEBUG|TRACE|FATAL|VERBOSE)\b/i;

const PID_PATTERN = /\bpid[=:\s]+(\d+)\b|\[(\d+)\]|\bPID\s+(\d+)\b/i;

const IP_PATTERN =
  /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/;

const PORT_PATTERN =
  /\bport[=:\s]+(\d{2,5})\b|:(\d{2,5})\b/i;

const ERROR_CODE_PATTERNS = [
  /\b(E[A-Z0-9_]{3,})\b/,                      // ECONNREFUSED, ENOENT, EAI_AGAIN, etc.
  /\berr(?:or)?[\s_-]*(?:code)?[=:\s]+([A-Z0-9_]+)\b/i,
  /\b(\d{3})\s+[A-Z][a-z]/,                     // HTTP-style: 404 Not Found
  /\bcode[=:\s]+['"]?([A-Z0-9_]+)['"]?\b/i,
];

const COMMON_ERROR_CODE_PATTERN =
  /\b(ECONNREFUSED|ECONNRESET|ETIMEDOUT|EPIPE|EADDRINUSE|EADDRNOTAVAIL|EAI_AGAIN|ENOTFOUND|ENOENT|ENOSPC|EACCES|EPERM|EHOSTUNREACH|ENETUNREACH|ECONNABORTED)\b/;

const DISALLOWED_ERROR_CODES = new Set([
  'ERROR',
  'ERR',
  'WARN',
  'WARNING',
  'INFO',
  'DEBUG',
  'TRACE',
  'FATAL',
  'CRIT',
  'CRITICAL',
  'ALERT',
  'NOTICE',
  'VERBOSE',
  'EMERG',
  'EMERGENCY',
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findPort(scanText: string, ipAddress?: string): string | undefined {
  if (ipAddress) {
    const ipPort = scanText.match(
      new RegExp(`\\b${escapeRegExp(ipAddress)}:(\\d{2,5})\\b`),
    );
    if (ipPort?.[1]) return ipPort[1];
  }

  const explicitPort = scanText.match(/\bport[=:\s]+(\d{2,5})\b/i);
  if (explicitPort?.[1]) return explicitPort[1];

  // Fallback: first ":<port>" that isn't part of a time token (e.g. 10:30:00)
  const matches = scanText.matchAll(/:(\d{2,5})\b/g);
  for (const match of matches) {
    const port = match[1];
    const idx = match.index ?? -1;
    const end = idx + match[0].length;

    // If immediately followed by another time separator (":dd"), treat as time.
    if (/^:\d{2}\b/.test(scanText.slice(end, end + 3))) continue;

    return port;
  }

  return undefined;
}

const HTTP_STATUS_PATTERN =
  /\bHTTP[\/\s]+\d\.\d['"]*\s+(\d{3})\b|\bstatus[=:\s]+(\d{3})\b|\b(\d{3})\s+(?:OK|Created|Accepted|Bad\s+Request|Unauthorized|Forbidden|Not\s+Found|Internal\s+Server|Service\s+Unavailable|Gateway\s+Time)/i;

const HTTP_METHOD_PATTERN =
  /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\b/;

const URL_PATTERN =
  /(?:https?:\/\/[^\s"']+)|(?:\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=-]+)/;

const USERNAME_PATTERN =
  /\buser(?:name)?[=:\s]+['"]?([a-zA-Z0-9._@-]+)['"]?\b/i;

const FILEPATH_PATTERN =
  /(?:\/(?:[a-zA-Z0-9._-]+\/)+[a-zA-Z0-9._-]+)|(?:[A-Z]:\\(?:[^\s\\]+\\)*[^\s\\]+)/;

// ─── Source extraction patterns ─────────────────────────

const SOURCE_PATTERNS = [
  // syslog style: hostname service[pid]:
  /^(?:\S+\s+\d+\s+\d+:\d+:\d+)\s+(\S+)\s+(\S+?)(?:\[\d+\])?:/,
  // systemd/journald: service.service
  /(\S+\.service)/,
  // Docker/K8s: container_name |
  /^(\S+)\s+\|/,
  // Generic: [SOURCE] or (SOURCE)
  /\[([a-zA-Z0-9._-]+)\]|\(([a-zA-Z0-9._-]+)\)/,
];

/**
 * Parse a raw log line and extract structured metadata.
 */
export function parseLogLine(rawLog: string): ParsedLogMetadata {
  const trimmed = rawLog.trim();
  let messageBody = trimmed;
  let scanText = trimmed;

  // Extract timestamp
  let timestamp: string | undefined;
  let timestampTokenToStrip: string | undefined;
  for (const pattern of TIMESTAMP_PATTERNS) {
    const match = scanText.match(pattern);
    if (match) {
      timestamp = match[1];
      timestampTokenToStrip = match[0];
      scanText = scanText.replace(match[0], ' ');
      break;
    }
  }

  // Extract log level
  const levelMatch = scanText.match(LOG_LEVEL_PATTERN);
  const logLevel = levelMatch ? levelMatch[1].toUpperCase() : undefined;

  // Extract PID
  const pidMatch = scanText.match(PID_PATTERN);
  const pid = pidMatch ? (pidMatch[1] || pidMatch[2] || pidMatch[3]) : undefined;

  // Extract IP address
  const ipMatch = scanText.match(IP_PATTERN);
  const ipAddress = ipMatch ? ipMatch[1] : undefined;

  // Extract port
  const port = findPort(scanText, ipAddress);

  // Extract error code
  let errorCode: string | undefined;
  const commonError = scanText.match(COMMON_ERROR_CODE_PATTERN);
  if (commonError?.[1]) {
    errorCode = commonError[1];
  } else {
    for (const pattern of ERROR_CODE_PATTERNS) {
      const match = scanText.match(pattern);
      if (match?.[1]) {
        const candidate = String(match[1]).toUpperCase();
        if (DISALLOWED_ERROR_CODES.has(candidate)) continue;
        errorCode = candidate;
        break;
      }
    }
  }

  // Extract HTTP status
  const httpStatusMatch = scanText.match(HTTP_STATUS_PATTERN);
  const httpStatus = httpStatusMatch
    ? (httpStatusMatch[1] || httpStatusMatch[2] || httpStatusMatch[3])
    : undefined;

  // Extract HTTP method
  const httpMethodMatch = scanText.match(HTTP_METHOD_PATTERN);
  const httpMethod = httpMethodMatch ? httpMethodMatch[1] : undefined;

  // Extract URL
  const urlMatch = scanText.match(URL_PATTERN);
  const url = urlMatch ? urlMatch[0] : undefined;

  // Extract username
  const usernameMatch = scanText.match(USERNAME_PATTERN);
  const username = usernameMatch ? usernameMatch[1] : undefined;

  // Extract file path
  const filePathMatch = scanText.match(FILEPATH_PATTERN);
  const filePath = filePathMatch ? filePathMatch[0] : undefined;

  // Extract source
  let source: string | undefined;
  for (const pattern of SOURCE_PATTERNS) {
    const match = scanText.match(pattern);
    if (match) {
      source = match[1] || match[2];
      break;
    }
  }

  // Strip known prefixes to get message body
  messageBody = trimmed;
  if (timestampTokenToStrip) messageBody = messageBody.replace(timestampTokenToStrip, '');
  messageBody = messageBody
    .replace(/^\s*[-:]\s*/, '')
    .trim();

  return {
    timestamp,
    logLevel,
    source,
    pid,
    errorCode,
    ipAddress,
    port,
    username,
    filePath,
    httpStatus,
    httpMethod,
    url,
    messageBody,
  };
}

/**
 * Detect the implicit severity from the log level string.
 */
export function severityFromLogLevel(
  logLevel?: string,
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null {
  if (!logLevel) return null;
  switch (logLevel.toUpperCase()) {
    case 'EMERG':
    case 'EMERGENCY':
    case 'FATAL':
    case 'CRIT':
    case 'CRITICAL':
      return 'CRITICAL';
    case 'ERR':
    case 'ERROR':
    case 'ALERT':
      return 'HIGH';
    case 'WARN':
    case 'WARNING':
    case 'NOTICE':
      return 'MEDIUM';
    case 'INFO':
    case 'DEBUG':
    case 'TRACE':
    case 'VERBOSE':
      return 'LOW';
    default:
      return null;
  }
}
