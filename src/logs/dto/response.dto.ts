import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SeverityLevel, LogCategory } from '../../knowledge-base/types';

// ──────────────────────────────────────────────────────────
// Response DTOs (used for Swagger documentation)
// ──────────────────────────────────────────────────────────

export class LogExplanationResponse {
  @ApiProperty({ example: 'ERROR: connection refused to 10.0.1.5:5432' })
  rawLog: string;

  @ApiProperty({ example: 'DB_CONN_REFUSED' })
  patternId: string;

  @ApiProperty({
    example:
      'The application failed to establish a connection to the database server.',
  })
  summary: string;

  @ApiProperty({ example: 'database', enum: ['database', 'network', 'authentication', 'authorization', 'memory', 'disk', 'cpu', 'api', 'timeout', 'configuration', 'security', 'application', 'filesystem', 'dns', 'ssl_tls', 'process', 'kernel', 'unknown'] })
  category: LogCategory;

  @ApiProperty({ example: 'HIGH', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  severity: SeverityLevel;

  @ApiProperty({ example: 75 })
  severityScore: number;

  @ApiProperty({
    example:
      'The database service is unreachable — it may be stopped, crashed, or blocked by a firewall.',
  })
  rootCause: string;

  @ApiProperty({
    example: [
      'Database service is not running or has crashed',
      'Firewall blocking the database port',
    ],
    type: [String],
  })
  possibleCauses: string[];

  @ApiProperty({
    example: [
      'Verify the database service is running',
      'Check firewall rules',
    ],
    type: [String],
  })
  recommendedFixes: string[];

  @ApiProperty({ example: { errorCode: 'ECONNREFUSED', port: '5432' } })
  metadata: Record<string, string>;

  @ApiPropertyOptional({ example: '2026-02-11T10:30:00Z' })
  timestamp?: string;

  @ApiPropertyOptional({ example: 'api-server-01' })
  source?: string;

  @ApiProperty({ example: 0.92 })
  confidence: number;

  @ApiProperty({ example: 'rule-based', enum: ['rule-based', 'llm-fallback'] })
  engine: string;
}

export class ExplainResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: LogExplanationResponse })
  data: LogExplanationResponse;

  @ApiProperty({ example: '2026-02-11T10:30:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: 12 })
  processingTimeMs: number;
}

export class BatchExplainResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [LogExplanationResponse] })
  data: LogExplanationResponse[];

  @ApiProperty({ example: 5 })
  totalLogs: number;

  @ApiProperty({ example: '2026-02-11T10:30:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: 45 })
  processingTimeMs: number;
}

export class TimelineEventResponse {
  @ApiPropertyOptional({ example: '2026-02-11T10:30:00Z' })
  timestamp?: string;

  @ApiProperty({ example: 'Database connection refused' })
  summary: string;

  @ApiProperty({ example: 'HIGH', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  severity: SeverityLevel;

  @ApiProperty({ example: 'database' })
  category: LogCategory;
}

export class IncidentSummaryResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    type: 'object',
    properties: {
      title: { type: 'string', example: 'CRITICAL Incident — Database connection failure causing API outage' },
      summary: { type: 'string', example: 'Analyzed 3 log entries. Overall severity: CRITICAL (score: 90/100).' },
      severity: { type: 'string', example: 'CRITICAL' },
      severityScore: { type: 'number', example: 90 },
      rootCauseChain: { type: 'array', items: { type: 'string' } },
      affectedSystems: { type: 'array', items: { type: 'string' } },
      timeline: { type: 'array', items: { type: 'object' } },
      recommendedActions: { type: 'array', items: { type: 'string' } },
      totalLogsAnalyzed: { type: 'number', example: 3 },
      categoryBreakdown: { type: 'object', additionalProperties: { type: 'number' } },
      correlations: { type: 'array', items: { type: 'string' } },
    },
  })
  data: any;

  @ApiProperty({ example: '2026-02-11T10:30:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: 80 })
  processingTimeMs: number;
}

export class ErrorResponse {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'Bad Request' })
  error: string;

  @ApiProperty({ example: ['Log entry must not be empty'] })
  message: string | string[];
}
