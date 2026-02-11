import { LogsService } from './logs.service';

// ──────────────────────────────────────────────────────────
// Logs Service — Unit Tests
// Full integration test of the interpretation pipeline:
//   parseLogLine → findMatchingPatterns → calculateSeverity → buildExplanation
// ──────────────────────────────────────────────────────────

describe('LogsService', () => {
    let service: LogsService;

    beforeEach(() => {
        service = new LogsService();
    });

    // ─── explainLog() ─────────────────────────────────────

    describe('explainLog()', () => {
        it('should return a valid LogExplanation structure', () => {
            const result = service.explainLog('ERROR: ECONNREFUSED 127.0.0.1:5432');
            expect(result).toBeDefined();
            expect(result.rawLog).toBe('ERROR: ECONNREFUSED 127.0.0.1:5432');
            expect(result.patternId).toBeDefined();
            expect(result.summary).toBeDefined();
            expect(typeof result.summary).toBe('string');
            expect(result.category).toBeDefined();
            expect(result.severity).toBeDefined();
            expect(typeof result.severityScore).toBe('number');
            expect(result.rootCause).toBeDefined();
            expect(Array.isArray(result.possibleCauses)).toBe(true);
            expect(Array.isArray(result.recommendedFixes)).toBe(true);
            expect(typeof result.metadata).toBe('object');
            expect(typeof result.confidence).toBe('number');
            expect(result.engine).toBe('rule-based');
        });

        it('should identify database connection refused errors', () => {
            const result = service.explainLog(
                '2026-02-11T10:30:00Z ERROR ECONNREFUSED 127.0.0.1:5432',
            );
            expect(result.patternId).toBe('DB_CONN_REFUSED');
            expect(result.category).toBe('database');
            expect(result.severity).toBe('HIGH');
            expect(result.confidence).toBeGreaterThan(0.5);
        });

        it('should identify database authentication failures', () => {
            const result = service.explainLog(
                '2026-02-11T10:30:00Z ERROR [database] FATAL: password authentication failed for user "admin"',
            );
            expect(result.patternId).toBe('DB_AUTH_FAILED');
            expect(result.category).toBe('database');
        });

        it('should identify out of memory errors', () => {
            const result = service.explainLog(
                'FATAL: out of memory, JavaScript heap out of memory',
            );
            expect(result.patternId).toBe('SYS_OOM');
            expect(result.category).toBe('memory');
            expect(result.severity).toBe('CRITICAL');
        });

        it('should identify disk full errors', () => {
            const result = service.explainLog(
                'ERROR: ENOSPC: no space left on device, write',
            );
            expect(result.patternId).toBe('SYS_DISK_FULL');
            expect(result.category).toBe('disk');
        });

        it('should identify DNS failures', () => {
            const result = service.explainLog(
                'Error: getaddrinfo ENOTFOUND api.example.com',
            );
            expect(result.patternId).toBe('NET_DNS_FAILURE');
            expect(result.category).toBe('dns');
        });

        it('should handle unknown/unrecognized logs gracefully', () => {
            const result = service.explainLog(
                'Something completely random and unknown happened',
            );
            expect(result.patternId).toBe('unknown');
            expect(result.category).toBe('unknown');
            expect(result.confidence).toBe(0);
            expect(result.possibleCauses.length).toBeGreaterThan(0);
            expect(result.recommendedFixes.length).toBeGreaterThan(0);
        });

        it('should override source when provided', () => {
            const result = service.explainLog(
                'ERROR: ECONNREFUSED 127.0.0.1:5432',
                'production-api-server-01',
            );
            expect(result.source).toBe('production-api-server-01');
        });

        it('should extract timestamp from the log', () => {
            const result = service.explainLog(
                '2026-02-11T10:30:00Z ERROR: connection refused',
            );
            expect(result.timestamp).toBe('2026-02-11T10:30:00Z');
        });

        it('should include extracted metadata', () => {
            const result = service.explainLog(
                'ERROR: ECONNREFUSED 10.0.0.1:5432',
            );
            expect(result.metadata).toBeDefined();
            expect(result.metadata['errorCode']).toBe('ECONNREFUSED');
        });

        it('should return results quickly (< 100ms per log)', () => {
            const start = Date.now();
            service.explainLog('ERROR: ECONNREFUSED 10.0.0.1:5432');
            const elapsed = Date.now() - start;
            expect(elapsed).toBeLessThan(100);
        });
    });

    // ─── explainBatch() ───────────────────────────────────

    describe('explainBatch()', () => {
        it('should return an array of explanations', () => {
            const results = service.explainBatch([
                'ERROR: ECONNREFUSED 127.0.0.1:5432',
                'ERROR: ENOSPC: no space left on device',
            ]);
            expect(results).toHaveLength(2);
        });

        it('should handle a single log in batch', () => {
            const results = service.explainBatch([
                'ERROR: ECONNREFUSED 127.0.0.1:5432',
            ]);
            expect(results).toHaveLength(1);
            expect(results[0].patternId).toBe('DB_CONN_REFUSED');
        });

        it('should apply source to all batch results', () => {
            const results = service.explainBatch(
                ['ERROR: something', 'WARN: something'],
                'batch-server-01',
            );
            for (const r of results) {
                expect(r.source).toBe('batch-server-01');
            }
        });

        it('should process mixed known and unknown logs', () => {
            const results = service.explainBatch([
                'ERROR: ECONNREFUSED 127.0.0.1:5432',
                'Something entirely unknown',
                'FATAL: out of memory, JavaScript heap out of memory',
            ]);
            expect(results).toHaveLength(3);
            expect(results[0].patternId).toBe('DB_CONN_REFUSED');
            expect(results[1].patternId).toBe('unknown');
            expect(results[2].patternId).toBe('SYS_OOM');
        });
    });

    // ─── generateIncidentSummary() ────────────────────────

    describe('generateIncidentSummary()', () => {
        it('should generate an incident summary from related logs', () => {
            const result = service.generateIncidentSummary([
                '2026-02-11T10:30:00Z ERROR Connection refused to database at 10.0.1.5:5432',
                '2026-02-11T10:30:02Z ERROR Request timeout on /api/v1/users after 30000ms',
                '2026-02-11T10:30:03Z CRITICAL 503 Service Unavailable - upstream server not responding',
            ]);
            expect(result).toBeDefined();
            expect(result.title).toBeDefined();
            expect(result.summary).toBeDefined();
            expect(result.severity).toBeDefined();
            expect(typeof result.severityScore).toBe('number');
            expect(result.totalLogsAnalyzed).toBe(3);
            expect(result.affectedSystems.length).toBeGreaterThan(0);
            expect(result.timeline.length).toBe(3);
            expect(result.recommendedActions.length).toBeGreaterThan(0);
        });

        it('should append incident context to the title', () => {
            const result = service.generateIncidentSummary(
                ['ERROR: ECONNREFUSED 10.0.0.1:5432'],
                'API outage reported at 10:30 UTC',
            );
            expect(result.title).toContain('API outage reported at 10:30 UTC');
        });

        it('should calculate aggregate severity', () => {
            const result = service.generateIncidentSummary([
                'FATAL: out of memory',
                'ERROR: ECONNREFUSED 10.0.0.1:5432',
            ]);
            expect(result.severityScore).toBeGreaterThanOrEqual(70);
        });

        it('should detect correlations between database and timeout categories', () => {
            const result = service.generateIncidentSummary([
                'ERROR: Connection refused to database at 10.0.1.5:5432',
                'ERROR: Request timeout on /api/v1/users after 30000ms',
            ]);
            // Database + timeout should trigger the correlation
            const hasDbTimeoutCorrelation = result.correlations.some(
                (c) => c.toLowerCase().includes('database') && c.toLowerCase().includes('timeout'),
            );
            expect(hasDbTimeoutCorrelation).toBe(true);
        });

        it('should build category breakdown', () => {
            const result = service.generateIncidentSummary([
                'ERROR: ECONNREFUSED 10.0.0.1:5432',
                'ERROR: ECONNREFUSED 10.0.0.2:3306',
            ]);
            expect(result.categoryBreakdown['database']).toBe(2);
        });

        it('should sort timeline by timestamp', () => {
            const result = service.generateIncidentSummary([
                '2026-02-11T10:32:00Z ERROR: third event',
                '2026-02-11T10:30:00Z ERROR: ECONNREFUSED 10.0.0.1:5432',
                '2026-02-11T10:31:00Z ERROR: ENOSPC: no space left on device',
            ]);
            const timestamps = result.timeline
                .filter((t) => t.timestamp)
                .map((t) => t.timestamp!);
            for (let i = 1; i < timestamps.length; i++) {
                expect(timestamps[i] >= timestamps[i - 1]).toBe(true);
            }
        });
    });

    // ─── getKnowledgeBaseStats() ──────────────────────────

    describe('getKnowledgeBaseStats()', () => {
        it('should return total pattern count', () => {
            const stats = service.getKnowledgeBaseStats();
            expect(stats.totalPatterns).toBeGreaterThanOrEqual(28);
        });

        it('should return list of categories', () => {
            const stats = service.getKnowledgeBaseStats();
            expect(stats.categories.length).toBeGreaterThan(0);
            expect(stats.categories).toContain('database');
            expect(stats.categories).toContain('network');
            expect(stats.categories).toContain('memory');
        });
    });

    // ─── Determinism ──────────────────────────────────────

    describe('determinism (same input → same output)', () => {
        it('should produce identical results for the same log', () => {
            const log = '2026-02-11T10:30:00Z ERROR ECONNREFUSED 127.0.0.1:5432';
            const result1 = service.explainLog(log);
            const result2 = service.explainLog(log);
            expect(result1.patternId).toBe(result2.patternId);
            expect(result1.summary).toBe(result2.summary);
            expect(result1.category).toBe(result2.category);
            expect(result1.severity).toBe(result2.severity);
            expect(result1.severityScore).toBe(result2.severityScore);
            expect(result1.rootCause).toBe(result2.rootCause);
            expect(result1.confidence).toBe(result2.confidence);
        });
    });
});
