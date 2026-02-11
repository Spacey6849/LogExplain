import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiSecurity,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { LogsService } from './logs.service';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { ExplainLogDto, BatchExplainDto, IncidentSummaryDto } from './dto/request.dto';
import {
  ExplainResponse,
  BatchExplainResponse,
  IncidentSummaryResponse,
  ErrorResponse,
} from './dto/response.dto';

@ApiTags('logs')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  // ─── POST /v1/logs/explain ────────────────────────────
  @Post('explain')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Explain a single log entry',
    description:
      'Accepts a raw log string and returns a structured explanation including ' +
      'plain-English summary, root cause analysis, severity classification, ' +
      'and recommended actions.',
  })
  @ApiOkResponse({ type: ExplainResponse, description: 'Log explanation returned successfully' })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'Invalid request payload' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  explainLog(@Body() dto: ExplainLogDto): ExplainResponse {
    const startTime = Date.now();
    const explanation = this.logsService.explainLog(dto.log, dto.source);

    return {
      success: true,
      data: explanation,
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    };
  }

  // ─── POST /v1/logs/batch-explain ──────────────────────
  @Post('batch-explain')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Explain multiple log entries (batch)',
    description:
      'Accepts an array of raw log strings (max 50) and returns structured ' +
      'explanations for each. Useful for processing multiple log lines at once.',
  })
  @ApiOkResponse({ type: BatchExplainResponse, description: 'Batch explanations returned successfully' })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'Invalid request payload' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  batchExplain(@Body() dto: BatchExplainDto): BatchExplainResponse {
    const startTime = Date.now();
    const explanations = this.logsService.explainBatch(dto.logs, dto.source);

    return {
      success: true,
      data: explanations,
      totalLogs: explanations.length,
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    };
  }

  // ─── POST /v1/logs/incident-summary ───────────────────
  @Post('incident-summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate an incident summary from related logs',
    description:
      'Accepts an array of related log strings (max 100) and returns a holistic ' +
      'incident summary including correlated root-cause chain, timeline, affected ' +
      'systems, severity assessment, and recommended actions.',
  })
  @ApiOkResponse({ type: IncidentSummaryResponse, description: 'Incident summary returned successfully' })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'Invalid request payload' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  incidentSummary(
    @Body() dto: IncidentSummaryDto,
  ): IncidentSummaryResponse {
    const startTime = Date.now();
    const summary = this.logsService.generateIncidentSummary(
      dto.logs,
      dto.incidentContext,
    );

    return {
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    };
  }
}
