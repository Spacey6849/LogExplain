import { LogPattern } from './types';
import { databasePatterns } from './patterns/database.patterns';
import { networkPatterns } from './patterns/network.patterns';
import { authPatterns } from './patterns/auth.patterns';
import { systemPatterns } from './patterns/system.patterns';
import { apiPatterns } from './patterns/api.patterns';
import { configPatterns } from './patterns/config.patterns';
import { kubernetesPatterns } from './patterns/kubernetes.patterns';
import { dockerPatterns } from './patterns/docker.patterns';
import { cloudPatterns } from './patterns/cloud.patterns';
import { messagingPatterns } from './patterns/messaging.patterns';
import { infrastructurePatterns } from './patterns/infrastructure.patterns';

// ──────────────────────────────────────────────────────────
// Pattern Registry
// Aggregates all pattern modules into a single searchable index
// ──────────────────────────────────────────────────────────

export class PatternRegistry {
  private patterns: LogPattern[];
  private keywordIndex: Map<string, LogPattern[]>;

  constructor() {
    this.patterns = [
      ...databasePatterns,
      ...networkPatterns,
      ...authPatterns,
      ...systemPatterns,
      ...apiPatterns,
      ...configPatterns,
      ...kubernetesPatterns,
      ...dockerPatterns,
      ...cloudPatterns,
      ...messagingPatterns,
      ...infrastructurePatterns,
    ];

    // Build keyword index for fast lookup
    this.keywordIndex = new Map();
    for (const pattern of this.patterns) {
      for (const keyword of pattern.keywords) {
        const lower = keyword.toLowerCase();
        if (!this.keywordIndex.has(lower)) {
          this.keywordIndex.set(lower, []);
        }
        this.keywordIndex.get(lower)!.push(pattern);
      }
    }
  }

  /**
   * Get all registered patterns.
   */
  getAllPatterns(): LogPattern[] {
    return this.patterns;
  }

  /**
   * Get the total number of patterns.
   */
  getPatternCount(): number {
    return this.patterns.length;
  }

  /**
   * Find patterns whose regex matches the provided log line.
   * Returns matches sorted by specificity (number of regex groups matched).
   */
  findMatchingPatterns(logLine: string): Array<{ pattern: LogPattern; confidence: number }> {
    const matches: Array<{ pattern: LogPattern; confidence: number }> = [];

    for (const pattern of this.patterns) {
      let maxConfidence = 0;

      // 1. Check regex patterns
      for (const regex of pattern.patterns) {
        const match = logLine.match(regex);
        if (match) {
          // More specific matches (longer regex match) get higher confidence
          const matchRatio = match[0].length / logLine.length;
          const confidence = Math.min(0.6 + matchRatio * 0.3, 0.95);
          maxConfidence = Math.max(maxConfidence, confidence);
        }
      }

      // 2. Boost confidence with keyword matches
      if (maxConfidence > 0) {
        let keywordHits = 0;
        for (const keyword of pattern.keywords) {
          if (logLine.toLowerCase().includes(keyword.toLowerCase())) {
            keywordHits++;
          }
        }
        const keywordBoost = Math.min(keywordHits * 0.05, 0.15);
        maxConfidence = Math.min(maxConfidence + keywordBoost, 0.99);
      }

      // 3. Check error codes for additional boost
      if (maxConfidence > 0 && pattern.errorCodes) {
        for (const code of pattern.errorCodes) {
          if (logLine.includes(code)) {
            maxConfidence = Math.min(maxConfidence + 0.1, 0.99);
            break;
          }
        }
      }

      if (maxConfidence > 0) {
        matches.push({ pattern, confidence: Math.round(maxConfidence * 100) / 100 });
      }
    }

    // Sort by confidence descending
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Quick keyword-based candidate lookup (for pre-filtering).
   */
  findCandidatesByKeyword(logLine: string): LogPattern[] {
    const candidates = new Set<LogPattern>();
    const lowerLog = logLine.toLowerCase();

    for (const [keyword, patterns] of this.keywordIndex.entries()) {
      if (lowerLog.includes(keyword)) {
        for (const pattern of patterns) {
          candidates.add(pattern);
        }
      }
    }

    return Array.from(candidates);
  }

  /**
   * Get a pattern by its ID.
   */
  getPatternById(id: string): LogPattern | undefined {
    return this.patterns.find((p) => p.id === id);
  }
}

// Singleton instance
export const patternRegistry = new PatternRegistry();
