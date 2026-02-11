// ──────────────────────────────────────────────────────────
// LogExplain – Knowledge Base: Common Interfaces
// ──────────────────────────────────────────────────────────

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type LogCategory =
  | 'database'
  | 'network'
  | 'authentication'
  | 'authorization'
  | 'memory'
  | 'disk'
  | 'cpu'
  | 'api'
  | 'timeout'
  | 'configuration'
  | 'security'
  | 'application'
  | 'filesystem'
  | 'dns'
  | 'ssl_tls'
  | 'process'
  | 'kernel'
  | 'kubernetes'
  | 'docker'
  | 'messaging'
  | 'cloud'
  | 'caching'
  | 'email'
  | 'logging'
  | 'unknown';

export interface LogPattern {
  /** Unique identifier for this pattern */
  id: string;

  /** Human-readable name */
  name: string;

  /** Category of the log */
  category: LogCategory;

  /** Regex patterns that match this log type */
  patterns: RegExp[];

  /** Keywords that help identify this log type */
  keywords: string[];

  /** Error codes associated with this pattern */
  errorCodes?: string[];

  /** Default severity for this pattern */
  severity: SeverityLevel;

  /** Severity can be adjusted by context modifiers */
  severityModifiers?: SeverityModifier[];

  /** Template-based explanation */
  explanation: ExplanationTemplate;
}

export interface SeverityModifier {
  /** Condition pattern that triggers severity change */
  condition: RegExp;
  /** New severity when condition is met */
  severity: SeverityLevel;
  /** Reason for the severity change */
  reason: string;
}

export interface ExplanationTemplate {
  /** Plain-English summary template (supports {{variable}} interpolation) */
  summary: string;

  /** Root cause explanation */
  rootCause: string;

  /** List of possible causes */
  possibleCauses: string[];

  /** Recommended fixes */
  recommendedFixes: string[];

  /** Additional context or documentation links */
  additionalContext?: string;
}

export interface LogExplanation {
  /** The original raw log line */
  rawLog: string;

  /** Matched pattern ID or 'unknown' */
  patternId: string;

  /** Plain-English summary */
  summary: string;

  /** Log category */
  category: LogCategory;

  /** Severity level */
  severity: SeverityLevel;

  /** Numeric severity score (0-100) */
  severityScore: number;

  /** Root cause analysis */
  rootCause: string;

  /** Possible causes */
  possibleCauses: string[];

  /** Recommended actions */
  recommendedFixes: string[];

  /** Extracted metadata from the log */
  metadata: Record<string, string>;

  /** Timestamp extracted from log, if present */
  timestamp?: string;

  /** Source/service extracted from log, if present */
  source?: string;

  /** Confidence of the match (0.0 – 1.0) */
  confidence: number;

  /** Whether the explanation came from rule engine or LLM fallback */
  engine: 'rule-based' | 'llm-fallback';
}

export interface IncidentSummary {
  /** Overall incident title */
  title: string;

  /** Plain-English incident summary */
  summary: string;

  /** Overall severity */
  severity: SeverityLevel;

  /** Numeric severity score (0-100) */
  severityScore: number;

  /** Identified root cause chain */
  rootCauseChain: string[];

  /** Affected systems/categories */
  affectedSystems: LogCategory[];

  /** Timeline of events */
  timeline: TimelineEvent[];

  /** Aggregated recommended actions */
  recommendedActions: string[];

  /** Total logs analyzed */
  totalLogsAnalyzed: number;

  /** Pattern distribution */
  categoryBreakdown: Record<string, number>;

  /** Correlation findings */
  correlations: string[];
}

export interface TimelineEvent {
  timestamp?: string;
  summary: string;
  severity: SeverityLevel;
  category: LogCategory;
}
