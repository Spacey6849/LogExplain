// ──────────────────────────────────────────────────────────
// LogExplain – Severity Scoring Engine
// Deterministic scoring from 0-100 based on multiple signals
// ──────────────────────────────────────────────────────────

import { SeverityLevel, LogPattern } from '../knowledge-base/types';

export interface SeverityResult {
  level: SeverityLevel;
  score: number; // 0 – 100
  reason: string;
}

/**
 * Base scores for each severity level.
 */
const BASE_SCORES: Record<SeverityLevel, number> = {
  LOW: 15,
  MEDIUM: 40,
  HIGH: 70,
  CRITICAL: 90,
};

/**
 * Score thresholds – score → level mapping.
 */
function scoreToLevel(score: number): SeverityLevel {
  if (score >= 80) return 'CRITICAL';
  if (score >= 55) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

/**
 * Calculate the severity score for a matched log.
 *
 * Scoring factors:
 * 1. Base score from the matched pattern's default severity
 * 2. Severity modifiers from context-aware rules
 * 3. Log-level keyword boost (ERROR/FATAL in the log itself)
 * 4. Repetition / frequency hints (if present)
 * 5. Production context boost
 */
export function calculateSeverity(
  rawLog: string,
  matchedPattern: LogPattern | null,
  extractedLogLevel?: string,
): SeverityResult {
  let score: number;
  let reason: string;

  if (!matchedPattern) {
    // Unknown log — assign based on extracted log level, default MEDIUM
    const levelFromLog = mapLogLevelToSeverity(extractedLogLevel);
    score = BASE_SCORES[levelFromLog];
    reason = `No known pattern matched. Severity derived from log level: ${extractedLogLevel || 'unknown'}`;
    return { level: scoreToLevel(score), score, reason };
  }

  // 1. Base score from pattern
  score = BASE_SCORES[matchedPattern.severity];
  reason = `Base severity: ${matchedPattern.severity} (pattern: ${matchedPattern.id})`;

  // 2. Apply severity modifiers
  if (matchedPattern.severityModifiers) {
    for (const modifier of matchedPattern.severityModifiers) {
      if (modifier.condition.test(rawLog)) {
        const modifiedBase = BASE_SCORES[modifier.severity];
        if (modifiedBase > score) {
          score = modifiedBase;
          reason = modifier.reason;
        }
      }
    }
  }

  // 3. Log-level keyword boost
  if (extractedLogLevel) {
    const logLevelSeverity = mapLogLevelToSeverity(extractedLogLevel);
    const logLevelScore = BASE_SCORES[logLevelSeverity];
    if (logLevelScore > score) {
      score = Math.round((score + logLevelScore) / 2); // blend, don't override
    }
  }

  // 4. Context keywords that increase severity
  const criticalContextKeywords = [
    /production|prod\b/i,
    /outage/i,
    /data\s*loss/i,
    /security\s+breach/i,
    /ransomware/i,
    /exploit/i,
  ];
  for (const keyword of criticalContextKeywords) {
    if (keyword.test(rawLog)) {
      score = Math.min(score + 10, 100);
      break;
    }
  }

  // 5. Repetition hints
  if (/repeated|recurring|frequent|multiple|consecutive/i.test(rawLog)) {
    score = Math.min(score + 5, 100);
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  return {
    level: scoreToLevel(score),
    score,
    reason,
  };
}

/**
 * Map a log level string to a severity level.
 */
function mapLogLevelToSeverity(logLevel?: string): SeverityLevel {
  if (!logLevel) return 'MEDIUM';
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
    default:
      return 'LOW';
  }
}

/**
 * Calculate an aggregate severity score from multiple individual scores.
 */
export function aggregateSeverity(
  scores: SeverityResult[],
): SeverityResult {
  if (scores.length === 0) {
    return { level: 'LOW', score: 0, reason: 'No logs to analyze' };
  }

  // Aggregate: take the max score, but boost if many high-severity logs
  const maxScore = Math.max(...scores.map((s) => s.score));
  const highCount = scores.filter((s) => s.score >= 55).length;
  const criticalCount = scores.filter((s) => s.score >= 80).length;

  let aggregateScore = maxScore;

  // Boost for multiple high-severity logs
  if (highCount >= 3) aggregateScore = Math.min(aggregateScore + 5, 100);
  if (highCount >= 5) aggregateScore = Math.min(aggregateScore + 5, 100);
  if (criticalCount >= 2) aggregateScore = Math.min(aggregateScore + 10, 100);

  return {
    level: scoreToLevel(aggregateScore),
    score: aggregateScore,
    reason: `Aggregate of ${scores.length} logs. Max score: ${maxScore}. High-severity count: ${highCount}. Critical count: ${criticalCount}.`,
  };
}
