import { buildExplanation, buildIncidentSummary } from './explanation-generator';
import { ParsedLogMetadata } from './log-parser';
import { SeverityResult } from './severity-scorer';
import { LogPattern, LogExplanation } from '../knowledge-base/types';

// ──────────────────────────────────────────────────────────
// Explanation Generator — Unit Tests
// ──────────────────────────────────────────────────────────

/**
 * Create a minimal ParsedLogMetadata for testing.
 */
function makeMetadata(overrides: Partial<ParsedLogMetadata> = {}): ParsedLogMetadata {
    return {
        messageBody: 'test message',
        ...overrides,
    };
}

/**
 * Create a minimal LogPattern for testing.
 */
function makePattern(overrides: Partial<LogPattern> = {}): LogPattern {
    return {
        id: 'TEST_PATTERN',
        name: 'Test Pattern',
        category: 'database',
        patterns: [/test/i],
        keywords: ['test'],
        severity: 'HIGH',
        explanation: {
            summary: 'Test summary description',
            rootCause: 'Test root cause',
            possibleCauses: ['Cause A', 'Cause B'],
            recommendedFixes: ['Fix A', 'Fix B'],
        },
        ...overrides,
    };
}

/**
 * Create a minimal SeverityResult for testing.
 */
function makeSeverity(overrides: Partial<SeverityResult> = {}): SeverityResult {
    return {
        level: 'HIGH',
        score: 70,
        reason: 'Test severity',
        ...overrides,
    };
}

describe('ExplanationGenerator – buildExplanation()', () => {
    // ─── Matched Pattern ──────────────────────────────────

    describe('with a matched pattern', () => {
        it('should include the rawLog in the response', () => {
            const result = buildExplanation(
                'ERROR test log',
                makePattern(),
                makeMetadata(),
                makeSeverity(),
                0.9,
            );
            expect(result.rawLog).toBe('ERROR test log');
        });

        it('should include the patternId', () => {
            const result = buildExplanation(
                'test',
                makePattern({ id: 'DB_CONN_REFUSED' }),
                makeMetadata(),
                makeSeverity(),
                0.85,
            );
            expect(result.patternId).toBe('DB_CONN_REFUSED');
        });

        it('should include the summary from the pattern', () => {
            const result = buildExplanation(
                'test',
                makePattern(),
                makeMetadata(),
                makeSeverity(),
                0.85,
            );
            expect(result.summary).toBe('Test summary description');
        });

        it('should include the category from the pattern', () => {
            const result = buildExplanation(
                'test',
                makePattern({ category: 'network' }),
                makeMetadata(),
                makeSeverity(),
                0.85,
            );
            expect(result.category).toBe('network');
        });

        it('should include severity level and score', () => {
            const result = buildExplanation(
                'test',
                makePattern(),
                makeMetadata(),
                makeSeverity({ level: 'CRITICAL', score: 95 }),
                0.85,
            );
            expect(result.severity).toBe('CRITICAL');
            expect(result.severityScore).toBe(95);
        });

        it('should include rootCause from the pattern', () => {
            const result = buildExplanation(
                'test',
                makePattern(),
                makeMetadata(),
                makeSeverity(),
                0.85,
            );
            expect(result.rootCause).toBe('Test root cause');
        });

        it('should include possibleCauses from the pattern', () => {
            const result = buildExplanation(
                'test',
                makePattern(),
                makeMetadata(),
                makeSeverity(),
                0.85,
            );
            expect(result.possibleCauses).toEqual(['Cause A', 'Cause B']);
        });

        it('should include recommendedFixes from the pattern', () => {
            const result = buildExplanation(
                'test',
                makePattern(),
                makeMetadata(),
                makeSeverity(),
                0.85,
            );
            expect(result.recommendedFixes).toEqual(['Fix A', 'Fix B']);
        });

        it('should include the confidence score', () => {
            const result = buildExplanation(
                'test',
                makePattern(),
                makeMetadata(),
                makeSeverity(),
                0.92,
            );
            expect(result.confidence).toBe(0.92);
        });

        it('should set engine to "rule-based"', () => {
            const result = buildExplanation(
                'test',
                makePattern(),
                makeMetadata(),
                makeSeverity(),
                0.85,
            );
            expect(result.engine).toBe('rule-based');
        });

        it('should include parsed metadata fields', () => {
            const result = buildExplanation(
                'test',
                makePattern(),
                makeMetadata({
                    logLevel: 'ERROR',
                    ipAddress: '10.0.0.1',
                    port: '5432',
                    errorCode: 'ECONNREFUSED',
                    username: 'admin',
                }),
                makeSeverity(),
                0.85,
            );
            expect(result.metadata).toEqual(
                expect.objectContaining({
                    logLevel: 'ERROR',
                    ipAddress: '10.0.0.1',
                    port: '5432',
                    errorCode: 'ECONNREFUSED',
                    username: 'admin',
                }),
            );
        });

        it('should include timestamp and source from metadata', () => {
            const result = buildExplanation(
                'test',
                makePattern(),
                makeMetadata({
                    timestamp: '2026-02-11T10:30:00Z',
                    source: 'api-server-01',
                }),
                makeSeverity(),
                0.85,
            );
            expect(result.timestamp).toBe('2026-02-11T10:30:00Z');
            expect(result.source).toBe('api-server-01');
        });
    });

    // ─── Unknown/Unmatched Pattern ────────────────────────

    describe('with no matched pattern (unknown log)', () => {
        it('should set patternId to "unknown"', () => {
            const result = buildExplanation(
                'random text',
                null,
                makeMetadata(),
                makeSeverity({ level: 'MEDIUM', score: 40 }),
                0,
            );
            expect(result.patternId).toBe('unknown');
        });

        it('should set category to "unknown"', () => {
            const result = buildExplanation(
                'random text',
                null,
                makeMetadata(),
                makeSeverity({ level: 'MEDIUM', score: 40 }),
                0,
            );
            expect(result.category).toBe('unknown');
        });

        it('should set confidence to 0', () => {
            const result = buildExplanation(
                'random text',
                null,
                makeMetadata(),
                makeSeverity({ level: 'MEDIUM', score: 40 }),
                0,
            );
            expect(result.confidence).toBe(0);
        });

        it('should provide a meaningful summary for ERROR-level unknown logs', () => {
            const result = buildExplanation(
                'ERROR: some unrecognized error',
                null,
                makeMetadata({ logLevel: 'ERROR' }),
                makeSeverity(),
                0,
            );
            expect(result.summary).toContain('error-level');
        });

        it('should provide a meaningful summary for WARN-level unknown logs', () => {
            const result = buildExplanation(
                'WARN: something',
                null,
                makeMetadata({ logLevel: 'WARN' }),
                makeSeverity({ level: 'MEDIUM', score: 40 }),
                0,
            );
            expect(result.summary).toContain('warning-level');
        });

        it('should provide generic possibleCauses', () => {
            const result = buildExplanation(
                'random text',
                null,
                makeMetadata(),
                makeSeverity({ level: 'MEDIUM', score: 40 }),
                0,
            );
            expect(result.possibleCauses.length).toBeGreaterThan(0);
        });

        it('should provide generic recommendedFixes', () => {
            const result = buildExplanation(
                'random text',
                null,
                makeMetadata(),
                makeSeverity({ level: 'MEDIUM', score: 40 }),
                0,
            );
            expect(result.recommendedFixes.length).toBeGreaterThan(0);
        });
    });
});

// ──────────────────────────────────────────────────────────
// buildIncidentSummary() — Unit Tests
// ──────────────────────────────────────────────────────────

/**
 * Creates a mock LogExplanation.
 */
function makeExplanation(overrides: Partial<LogExplanation> = {}): LogExplanation {
    return {
        rawLog: 'test log',
        patternId: 'TEST_PATTERN',
        summary: 'Test summary for the incident timeline',
        category: 'database',
        severity: 'HIGH',
        severityScore: 70,
        rootCause: 'Test root cause',
        possibleCauses: ['Cause 1'],
        recommendedFixes: ['Fix 1'],
        metadata: {},
        confidence: 0.85,
        engine: 'rule-based',
        ...overrides,
    };
}

describe('ExplanationGenerator – buildIncidentSummary()', () => {
    it('should return empty summary for empty explanations', () => {
        const result = buildIncidentSummary([]);
        expect(result.title).toBe('No Logs Provided');
        expect(result.totalLogsAnalyzed).toBe(0);
        expect(result.severity).toBe('LOW');
        expect(result.severityScore).toBe(0);
        expect(result.rootCauseChain).toEqual([]);
        expect(result.affectedSystems).toEqual([]);
        expect(result.timeline).toEqual([]);
        expect(result.recommendedActions).toEqual([]);
        expect(result.correlations).toEqual([]);
    });

    it('should count total logs analyzed', () => {
        const exps = [makeExplanation(), makeExplanation(), makeExplanation()];
        const result = buildIncidentSummary(exps);
        expect(result.totalLogsAnalyzed).toBe(3);
    });

    it('should include affected systems', () => {
        const exps = [
            makeExplanation({ category: 'database' }),
            makeExplanation({ category: 'network' }),
        ];
        const result = buildIncidentSummary(exps);
        expect(result.affectedSystems).toContain('database');
        expect(result.affectedSystems).toContain('network');
    });

    it('should not include "unknown" in affected systems', () => {
        const exps = [
            makeExplanation({ category: 'unknown', patternId: 'unknown' }),
        ];
        const result = buildIncidentSummary(exps);
        expect(result.affectedSystems).not.toContain('unknown');
    });

    it('should build a category breakdown', () => {
        const exps = [
            makeExplanation({ category: 'database' }),
            makeExplanation({ category: 'database' }),
            makeExplanation({ category: 'network' }),
        ];
        const result = buildIncidentSummary(exps);
        expect(result.categoryBreakdown).toEqual({
            database: 2,
            network: 1,
        });
    });

    it('should build a timeline from explanations', () => {
        const exps = [
            makeExplanation({ timestamp: '2026-02-11T10:30:00Z', category: 'database' }),
            makeExplanation({ timestamp: '2026-02-11T10:31:00Z', category: 'network' }),
        ];
        const result = buildIncidentSummary(exps);
        expect(result.timeline).toHaveLength(2);
        expect(result.timeline[0].timestamp).toBe('2026-02-11T10:30:00Z');
        expect(result.timeline[1].timestamp).toBe('2026-02-11T10:31:00Z');
    });

    it('should sort timeline by timestamp', () => {
        const exps = [
            makeExplanation({ timestamp: '2026-02-11T10:32:00Z' }),
            makeExplanation({ timestamp: '2026-02-11T10:30:00Z' }),
            makeExplanation({ timestamp: '2026-02-11T10:31:00Z' }),
        ];
        const result = buildIncidentSummary(exps);
        expect(result.timeline[0].timestamp).toBe('2026-02-11T10:30:00Z');
        expect(result.timeline[1].timestamp).toBe('2026-02-11T10:31:00Z');
        expect(result.timeline[2].timestamp).toBe('2026-02-11T10:32:00Z');
    });

    it('should collect unique root causes (exclude unknown)', () => {
        const exps = [
            makeExplanation({ rootCause: 'Database down', patternId: 'DB_CONN' }),
            makeExplanation({ rootCause: 'Database down', patternId: 'DB_CONN' }),
            makeExplanation({ rootCause: 'Network issue', patternId: 'NET_ERR' }),
        ];
        const result = buildIncidentSummary(exps);
        expect(result.rootCauseChain).toContain('Database down');
        expect(result.rootCauseChain).toContain('Network issue');
        expect(result.rootCauseChain).toHaveLength(2); // deduplicated
    });

    it('should collect unique recommended actions (capped at 10)', () => {
        const exps = [
            makeExplanation({ recommendedFixes: ['Fix A', 'Fix B'] }),
            makeExplanation({ recommendedFixes: ['Fix A', 'Fix C'] }),
        ];
        const result = buildIncidentSummary(exps);
        // Should have Fix A, Fix B, Fix C (deduplicated)
        expect(result.recommendedActions).toContain('Fix A');
        expect(result.recommendedActions).toContain('Fix B');
        expect(result.recommendedActions).toContain('Fix C');
    });

    it('should generate a title with severity level', () => {
        const exps = [makeExplanation({ severity: 'CRITICAL', severityScore: 90 })];
        const result = buildIncidentSummary(exps);
        expect(result.title).toContain('CRITICAL');
    });

    it('should generate a summary mentioning log count and severity', () => {
        const exps = [
            makeExplanation({ severity: 'HIGH', severityScore: 70 }),
            makeExplanation({ severity: 'HIGH', severityScore: 75 }),
        ];
        const result = buildIncidentSummary(exps);
        expect(result.summary).toContain('2 log entries');
    });

    // ─── Correlations ─────────────────────────────────────

    describe('correlation detection', () => {
        it('should detect database + timeout correlation', () => {
            const exps = [
                makeExplanation({ category: 'database' }),
                makeExplanation({ category: 'timeout' }),
            ];
            const result = buildIncidentSummary(exps);
            expect(result.correlations).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('Database issues detected alongside API timeouts'),
                ]),
            );
        });

        it('should detect memory + process crash correlation', () => {
            const exps = [
                makeExplanation({ category: 'memory' }),
                makeExplanation({ category: 'process' }),
            ];
            const result = buildIncidentSummary(exps);
            expect(result.correlations).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('Memory issues detected alongside process crashes'),
                ]),
            );
        });

        it('should detect DNS + network correlation', () => {
            const exps = [
                makeExplanation({ category: 'dns' }),
                makeExplanation({ category: 'network' }),
            ];
            const result = buildIncidentSummary(exps);
            expect(result.correlations).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('DNS resolution failures'),
                ]),
            );
        });

        it('should detect disk + database correlation', () => {
            const exps = [
                makeExplanation({ category: 'disk' }),
                makeExplanation({ category: 'database' }),
            ];
            const result = buildIncidentSummary(exps);
            expect(result.correlations).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('Disk space issues alongside database errors'),
                ]),
            );
        });

        it('should return empty correlations when no related patterns found', () => {
            const exps = [
                makeExplanation({ category: 'database' }),
                makeExplanation({ category: 'database' }),
            ];
            const result = buildIncidentSummary(exps);
            expect(result.correlations).toEqual([]);
        });
    });
});
