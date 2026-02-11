import { Injectable, Logger } from '@nestjs/common';
import { patternRegistry } from '../knowledge-base/pattern-registry';
import { LogExplanation, IncidentSummary } from '../knowledge-base/types';
import { parseLogLine } from '../engine/log-parser';
import { calculateSeverity } from '../engine/severity-scorer';
import {
  buildExplanation,
  buildIncidentSummary,
} from '../engine/explanation-generator';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  /**
   * Explain a single raw log entry.
   */
  explainLog(rawLog: string, source?: string): LogExplanation {
    const startTime = Date.now();

    // 1. Parse the log line to extract metadata
    const metadata = parseLogLine(rawLog);
    if (source) {
      metadata.source = source;
    }

    // 2. Find matching patterns from the knowledge base
    const matches = patternRegistry.findMatchingPatterns(rawLog);
    const topMatch = matches.length > 0 ? matches[0] : null;

    // 3. Calculate severity
    const severity = calculateSeverity(
      rawLog,
      topMatch ? topMatch.pattern : null,
      metadata.logLevel,
    );

    // 4. Generate explanation
    const explanation = buildExplanation(
      rawLog,
      topMatch ? topMatch.pattern : null,
      metadata,
      severity,
      topMatch ? topMatch.confidence : 0,
    );

    const elapsed = Date.now() - startTime;
    this.logger.debug(
      `Explained log in ${elapsed}ms | pattern=${explanation.patternId} severity=${explanation.severity} confidence=${explanation.confidence}`,
    );

    return explanation;
  }

  /**
   * Explain a batch of raw log entries.
   */
  explainBatch(rawLogs: string[], source?: string): LogExplanation[] {
    return rawLogs.map((log) => this.explainLog(log, source));
  }

  /**
   * Generate an incident summary from multiple related logs.
   */
  generateIncidentSummary(
    rawLogs: string[],
    incidentContext?: string,
  ): IncidentSummary {
    const explanations = rawLogs.map((log) => this.explainLog(log));
    const summary = buildIncidentSummary(explanations);

    // Append incident context to title if provided
    if (incidentContext) {
      summary.title = `${summary.title} — ${incidentContext}`;
    }

    this.logger.debug(
      `Incident summary: ${summary.totalLogsAnalyzed} logs, severity=${summary.severity}, score=${summary.severityScore}`,
    );

    return summary;
  }

  /**
   * Get the number of known patterns in the knowledge base.
   */
  getKnowledgeBaseStats(): {
    totalPatterns: number;
    categories: string[];
  } {
    const patterns = patternRegistry.getAllPatterns();
    const categories = [...new Set(patterns.map((p) => p.category))];
    return {
      totalPatterns: patterns.length,
      categories,
    };
  }
}
