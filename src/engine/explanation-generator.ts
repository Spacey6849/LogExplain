// ──────────────────────────────────────────────────────────
// LogExplain – Explanation Generator
// Generates structured, deterministic explanations from
// matched patterns and parsed metadata
// ──────────────────────────────────────────────────────────

import {
  LogExplanation,
  LogPattern,
  IncidentSummary,
  LogCategory,
  TimelineEvent,
} from '../knowledge-base/types';
import { ParsedLogMetadata } from './log-parser';
import { SeverityResult, aggregateSeverity } from './severity-scorer';

/**
 * Build a single log explanation from a matched pattern.
 */
export function buildExplanation(
  rawLog: string,
  matchedPattern: LogPattern | null,
  metadata: ParsedLogMetadata,
  severity: SeverityResult,
  confidence: number,
): LogExplanation {
  if (!matchedPattern) {
    return buildUnknownExplanation(rawLog, metadata, severity);
  }

  // Build metadata map from parsed data
  const metadataMap: Record<string, string> = {};
  if (metadata.logLevel) metadataMap['logLevel'] = metadata.logLevel;
  if (metadata.pid) metadataMap['pid'] = metadata.pid;
  if (metadata.ipAddress) metadataMap['ipAddress'] = metadata.ipAddress;
  if (metadata.port) metadataMap['port'] = metadata.port;
  if (metadata.errorCode) metadataMap['errorCode'] = metadata.errorCode;
  if (metadata.username) metadataMap['username'] = metadata.username;
  if (metadata.filePath) metadataMap['filePath'] = metadata.filePath;
  if (metadata.httpStatus) metadataMap['httpStatus'] = metadata.httpStatus;
  if (metadata.httpMethod) metadataMap['httpMethod'] = metadata.httpMethod;
  if (metadata.url) metadataMap['url'] = metadata.url;

  return {
    rawLog,
    patternId: matchedPattern.id,
    summary: matchedPattern.explanation.summary,
    category: matchedPattern.category,
    severity: severity.level,
    severityScore: severity.score,
    rootCause: matchedPattern.explanation.rootCause,
    possibleCauses: matchedPattern.explanation.possibleCauses,
    recommendedFixes: matchedPattern.explanation.recommendedFixes,
    metadata: metadataMap,
    timestamp: metadata.timestamp,
    source: metadata.source,
    confidence,
    engine: 'rule-based',
  };
}

/**
 * Build an explanation for an unknown/unmatched log.
 */
function buildUnknownExplanation(
  rawLog: string,
  metadata: ParsedLogMetadata,
  severity: SeverityResult,
): LogExplanation {
  const metadataMap: Record<string, string> = {};
  if (metadata.logLevel) metadataMap['logLevel'] = metadata.logLevel;
  if (metadata.errorCode) metadataMap['errorCode'] = metadata.errorCode;
  if (metadata.ipAddress) metadataMap['ipAddress'] = metadata.ipAddress;
  if (metadata.httpStatus) metadataMap['httpStatus'] = metadata.httpStatus;

  // Attempt to generate a basic summary from the log level
  let summary = 'This log entry could not be matched to a known pattern in the knowledge base.';
  if (metadata.logLevel) {
    const levelLabel = metadata.logLevel.toUpperCase();
    if (['ERROR', 'ERR', 'FATAL', 'CRIT', 'CRITICAL', 'EMERG'].includes(levelLabel)) {
      summary = `An error-level log entry was detected but does not match any known pattern. Manual review is recommended.`;
    } else if (['WARN', 'WARNING'].includes(levelLabel)) {
      summary = `A warning-level log entry was detected but does not match any known pattern. It may indicate a non-critical issue.`;
    } else {
      summary = `An informational log entry was detected with log level "${levelLabel}". No specific issue pattern was matched.`;
    }
  }

  return {
    rawLog,
    patternId: 'unknown',
    summary,
    category: 'unknown',
    severity: severity.level,
    severityScore: severity.score,
    rootCause: 'Unable to determine root cause — this log does not match any known pattern.',
    possibleCauses: [
      'New or uncommon error not yet in the knowledge base',
      'Custom application-specific log format',
      'Informational log with no actionable issue',
    ],
    recommendedFixes: [
      'Review the log message manually for context',
      'Check application documentation for this specific message',
      'If this is a recurring issue, consider adding a custom pattern to the knowledge base',
    ],
    metadata: metadataMap,
    timestamp: metadata.timestamp,
    source: metadata.source,
    confidence: 0,
    engine: 'rule-based',
  };
}

/**
 * Build an incident summary from multiple log explanations.
 */
export function buildIncidentSummary(
  explanations: LogExplanation[],
): IncidentSummary {
  if (explanations.length === 0) {
    return {
      title: 'No Logs Provided',
      summary: 'No log entries were provided for incident analysis.',
      severity: 'LOW',
      severityScore: 0,
      rootCauseChain: [],
      affectedSystems: [],
      timeline: [],
      recommendedActions: [],
      totalLogsAnalyzed: 0,
      categoryBreakdown: {},
      correlations: [],
    };
  }

  // Aggregate severity
  const severityResults: SeverityResult[] = explanations.map((e) => ({
    level: e.severity,
    score: e.severityScore,
    reason: '',
  }));
  const aggregatedSeverity = aggregateSeverity(severityResults);

  // Category breakdown
  const categoryBreakdown: Record<string, number> = {};
  const affectedSystems = new Set<LogCategory>();
  for (const exp of explanations) {
    categoryBreakdown[exp.category] = (categoryBreakdown[exp.category] || 0) + 1;
    if (exp.category !== 'unknown') {
      affectedSystems.add(exp.category);
    }
  }

  // Build timeline (sorted by timestamp if available)
  const timeline: TimelineEvent[] = explanations.map((exp) => ({
    timestamp: exp.timestamp,
    summary: exp.summary.substring(0, 150),
    severity: exp.severity,
    category: exp.category,
  }));

  // Sort timeline by timestamp
  timeline.sort((a, b) => {
    if (!a.timestamp && !b.timestamp) return 0;
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return a.timestamp.localeCompare(b.timestamp);
  });

  // Collect unique root causes
  const rootCauseChain = [
    ...new Set(
      explanations
        .filter((e) => e.patternId !== 'unknown')
        .map((e) => e.rootCause),
    ),
  ];

  // Collect unique recommended actions (deduplicated, top 10)
  const allFixes = explanations.flatMap((e) => e.recommendedFixes);
  const uniqueFixes = [...new Set(allFixes)].slice(0, 10);

  // Correlations — detect related patterns
  const correlations = detectCorrelations(explanations);

  // Generate title
  const topCategory = Object.entries(categoryBreakdown).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const title = generateIncidentTitle(
    explanations,
    topCategory ? topCategory[0] : 'unknown',
    aggregatedSeverity.level,
  );

  // Generate summary
  const summary = generateIncidentSummaryText(
    explanations,
    aggregatedSeverity,
    Array.from(affectedSystems),
    correlations,
  );

  return {
    title,
    summary,
    severity: aggregatedSeverity.level,
    severityScore: aggregatedSeverity.score,
    rootCauseChain,
    affectedSystems: Array.from(affectedSystems),
    timeline,
    recommendedActions: uniqueFixes,
    totalLogsAnalyzed: explanations.length,
    categoryBreakdown,
    correlations,
  };
}

// ─── Internal helpers ───────────────────────────────────

function generateIncidentTitle(
  explanations: LogExplanation[],
  topCategory: string,
  severity: string,
): string {
  const knownPatterns = explanations.filter((e) => e.patternId !== 'unknown');
  if (knownPatterns.length === 0) {
    return `${severity} Incident — Unrecognized Errors Detected`;
  }

  const categoryLabel = topCategory.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const patternCount = new Set(knownPatterns.map((e) => e.patternId)).size;

  if (patternCount === 1) {
    return `${severity} Incident — ${knownPatterns[0].summary.substring(0, 80)}`;
  }

  return `${severity} Incident — ${patternCount} issue types detected across ${categoryLabel}`;
}

function generateIncidentSummaryText(
  explanations: LogExplanation[],
  severity: SeverityResult,
  affectedSystems: LogCategory[],
  correlations: string[],
): string {
  const lines: string[] = [];

  lines.push(
    `Analyzed ${explanations.length} log entries. ` +
    `Overall severity: ${severity.level} (score: ${severity.score}/100).`,
  );

  if (affectedSystems.length > 0) {
    const systemList = affectedSystems.map((s) => s.replace(/_/g, ' ')).join(', ');
    lines.push(`Affected systems: ${systemList}.`);
  }

  const criticalCount = explanations.filter((e) => e.severity === 'CRITICAL').length;
  const highCount = explanations.filter((e) => e.severity === 'HIGH').length;

  if (criticalCount > 0) {
    lines.push(`${criticalCount} critical-severity log(s) require immediate attention.`);
  }
  if (highCount > 0) {
    lines.push(`${highCount} high-severity log(s) detected.`);
  }

  if (correlations.length > 0) {
    lines.push(`Correlations found: ${correlations.join('; ')}.`);
  }

  return lines.join(' ');
}

function detectCorrelations(explanations: LogExplanation[]): string[] {
  const correlations: string[] = [];
  const categories = explanations.map((e) => e.category);
  const patternIds = explanations.map((e) => e.patternId);

  // Database + timeout → likely database is root cause of API timeouts
  if (
    categories.includes('database') &&
    (categories.includes('timeout') || patternIds.includes('API_TIMEOUT'))
  ) {
    correlations.push(
      'Database issues detected alongside API timeouts — the database may be the root cause of slow API responses',
    );
  }

  // Memory + process crash → OOM caused the crash
  if (categories.includes('memory') && categories.includes('process')) {
    correlations.push(
      'Memory issues detected alongside process crashes — out-of-memory condition likely caused the crash',
    );
  }

  // Auth failures + security → potential attack
  if (
    categories.includes('authentication') &&
    categories.includes('security')
  ) {
    correlations.push(
      'Authentication failures alongside security alerts — potential coordinated attack',
    );
  }

  // DNS + network → DNS is root cause
  if (categories.includes('dns') && categories.includes('network')) {
    correlations.push(
      'DNS resolution failures detected alongside network errors — DNS may be the initial failure point',
    );
  }

  // Disk full + database → disk usage may have caused DB failure
  if (
    categories.includes('disk') &&
    categories.includes('database')
  ) {
    correlations.push(
      'Disk space issues alongside database errors — disk full condition may have caused database failure',
    );
  }

  // Config + application → misconfiguration as root cause
  if (
    categories.includes('configuration') &&
    categories.includes('application')
  ) {
    correlations.push(
      'Configuration errors alongside application failures — misconfiguration is a likely root cause',
    );
  }

  return correlations;
}
