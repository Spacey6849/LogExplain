import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ──────────────────────────────────────────────────────────
// Request DTOs
// ──────────────────────────────────────────────────────────

export class ExplainLogDto {
  @ApiProperty({
    description: 'Raw log string to interpret',
    example:
      '2026-02-11T10:30:00Z ERROR [database] FATAL: password authentication failed for user "admin"',
  })
  @IsString()
  @IsNotEmpty({ message: 'Log entry must not be empty' })
  log: string;

  @ApiPropertyOptional({
    description: 'Optional context about the source system',
    example: 'production-api-server-01',
  })
  @IsOptional()
  @IsString()
  source?: string;
}

export class BatchExplainDto {
  @ApiProperty({
    description: 'Array of raw log strings to interpret (max 50)',
    example: [
      '2026-02-11T10:30:00Z ERROR ECONNREFUSED 127.0.0.1:5432',
      '2026-02-11T10:30:05Z WARN disk usage at 95%',
    ],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one log entry is required' })
  @ArrayMaxSize(50, { message: 'Maximum 50 log entries per batch request' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'Each log entry must not be empty' })
  logs: string[];

  @ApiPropertyOptional({
    description: 'Optional context about the source system',
    example: 'production-api-server-01',
  })
  @IsOptional()
  @IsString()
  source?: string;
}

export class IncidentSummaryDto {
  @ApiProperty({
    description:
      'Array of related log strings for incident analysis (max 100)',
    example: [
      '2026-02-11T10:30:00Z ERROR Connection refused to database at 10.0.1.5:5432',
      '2026-02-11T10:30:02Z ERROR Request timeout on /api/v1/users after 30000ms',
      '2026-02-11T10:30:03Z CRITICAL 503 Service Unavailable - upstream server not responding',
    ],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one log entry is required' })
  @ArrayMaxSize(100, {
    message: 'Maximum 100 log entries per incident analysis',
  })
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'Each log entry must not be empty' })
  logs: string[];

  @ApiPropertyOptional({
    description: 'Optional incident title or context',
    example: 'API outage reported at 10:30 UTC',
  })
  @IsOptional()
  @IsString()
  incidentContext?: string;
}
