import { calculateSeverity, aggregateSeverity, SeverityResult } from './severity-scorer';
import { LogPattern, SeverityLevel } from '../knowledge-base/types';

// ──────────────────────────────────────────────────────────
// Severity Scorer — Unit Tests
// ──────────────────────────────────────────────────────────

/**
 * Helper factory: build a minimal LogPattern for testing.
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
            summary: 'Test summary',
            rootCause: 'Test root cause',
            possibleCauses: ['Cause 1'],
            recommendedFixes: ['Fix 1'],
        },
        ...overrides,
    };
}

describe('SeverityScorer – calculateSeverity()', () => {
    // ─── Base Score Calculation ────────────────────────────

    describe('base score from pattern severity', () => {
        it.each<[SeverityLevel, number]>([
            ['LOW', 15],
            ['MEDIUM', 40],
            ['HIGH', 70],
            ['CRITICAL', 90],
        ])(
            'should assign base score %d for pattern severity %s',
            (severity, expectedBaseScore) => {
                const pattern = makePattern({ severity });
                const result = calculateSeverity('test log', pattern, undefined);
                // Score should start at the base score (may be modified by other factors)
                expect(result.score).toBeGreaterThanOrEqual(expectedBaseScore - 5);
                expect(result.score).toBeLessThanOrEqual(100);
            },
        );
    });

    // ─── Unknown Log (no pattern match) ───────────────────

    describe('unknown log handling', () => {
        it('should assign MEDIUM severity when no pattern and no log level', () => {
            const result = calculateSeverity('random log', null, undefined);
            expect(result.score).toBe(40); // MEDIUM base
        });

        it('should use log level for severity when no pattern match', () => {
            const result = calculateSeverity('FATAL: crash', null, 'FATAL');
            expect(result.score).toBe(90); // CRITICAL base
            expect(result.level).toBe('CRITICAL');
        });

        it('should return LOW severity for INFO-level unknown logs', () => {
            const result = calculateSeverity('INFO: healthy', null, 'INFO');
            expect(result.score).toBe(15); // LOW base
            expect(result.level).toBe('LOW');
        });

        it('should include a reason mentioning no pattern matched', () => {
            const result = calculateSeverity('random log', null, undefined);
            expect(result.reason).toContain('No known pattern matched');
        });
    });

    // ─── Severity Modifiers ───────────────────────────────

    describe('severity modifiers', () => {
        it('should apply severity modifier when condition matches', () => {
            const pattern = makePattern({
                severity: 'HIGH',
                severityModifiers: [
                    {
                        condition: /production/i,
                        severity: 'CRITICAL',
                        reason: 'Production environment',
                    },
                ],
            });
            const result = calculateSeverity(
                'ERROR in production database',
                pattern,
                'ERROR',
            );
            // Should be boosted towards CRITICAL (90)
            expect(result.score).toBeGreaterThanOrEqual(80);
        });

        it('should NOT apply severity modifier when condition does not match', () => {
            const pattern = makePattern({
                severity: 'MEDIUM',
                severityModifiers: [
                    {
                        condition: /production/i,
                        severity: 'CRITICAL',
                        reason: 'Production environment',
                    },
                ],
            });
            const result = calculateSeverity(
                'WARNING in staging',
                pattern,
                'WARN',
            );
            expect(result.score).toBeLessThan(80);
        });
    });

    // ─── Log-Level Keyword Boost ──────────────────────────

    describe('log-level keyword boost', () => {
        it('should boost score when log level indicates higher severity', () => {
            const pattern = makePattern({ severity: 'LOW' });
            const resultWithError = calculateSeverity('test log', pattern, 'ERROR');
            const resultWithInfo = calculateSeverity('test log', pattern, 'INFO');
            // ERROR level should give a higher score than INFO
            expect(resultWithError.score).toBeGreaterThan(resultWithInfo.score);
        });
    });

    // ─── Context Keywords ─────────────────────────────────

    describe('critical context keyword boost', () => {
        it('should boost score for "production" keyword', () => {
            const pattern = makePattern({ severity: 'HIGH' });
            const baseResult = calculateSeverity('test log in staging', pattern);
            const boosted = calculateSeverity('test log in production', pattern);
            expect(boosted.score).toBeGreaterThan(baseResult.score);
        });

        it('should boost score for "outage" keyword', () => {
            const pattern = makePattern({ severity: 'HIGH' });
            const baseResult = calculateSeverity('test log normal', pattern);
            const boosted = calculateSeverity('test log outage detected', pattern);
            expect(boosted.score).toBeGreaterThan(baseResult.score);
        });

        it('should boost score for "data loss" keyword', () => {
            const pattern = makePattern({ severity: 'HIGH' });
            const baseResult = calculateSeverity('test log normal', pattern);
            const boosted = calculateSeverity('test log data loss detected', pattern);
            expect(boosted.score).toBeGreaterThan(baseResult.score);
        });
    });

    // ─── Repetition Hints ─────────────────────────────────

    describe('repetition hint boost', () => {
        it('should boost score for "repeated" keyword', () => {
            const pattern = makePattern({ severity: 'HIGH' });
            const baseResult = calculateSeverity('test error', pattern);
            const boosted = calculateSeverity('test error repeated 10 times', pattern);
            expect(boosted.score).toBeGreaterThan(baseResult.score);
        });
    });

    // ─── Score Clamping ───────────────────────────────────

    describe('score clamping', () => {
        it('should never exceed 100', () => {
            const pattern = makePattern({
                severity: 'CRITICAL',
                severityModifiers: [
                    {
                        condition: /production/i,
                        severity: 'CRITICAL',
                        reason: 'Production',
                    },
                ],
            });
            const result = calculateSeverity(
                'production outage data loss repeated security breach',
                pattern,
                'FATAL',
            );
            expect(result.score).toBeLessThanOrEqual(100);
        });

        it('should never go below 0', () => {
            const result = calculateSeverity('', null, undefined);
            expect(result.score).toBeGreaterThanOrEqual(0);
        });
    });

    // ─── Level from Score ─────────────────────────────────

    describe('score-to-level mapping', () => {
        it('should return CRITICAL for scores >= 80', () => {
            const pattern = makePattern({ severity: 'CRITICAL' });
            const result = calculateSeverity('test', pattern);
            expect(result.level).toBe('CRITICAL');
        });

        it('should return HIGH for scores >= 55', () => {
            const pattern = makePattern({ severity: 'HIGH' });
            const result = calculateSeverity('test', pattern);
            expect(result.level).toBe('HIGH');
        });

        it('should return MEDIUM for scores >= 30', () => {
            const pattern = makePattern({ severity: 'MEDIUM' });
            const result = calculateSeverity('test', pattern);
            expect(result.level).toBe('MEDIUM');
        });

        it('should return LOW for scores < 30', () => {
            const pattern = makePattern({ severity: 'LOW' });
            const result = calculateSeverity('test', pattern);
            expect(result.level).toBe('LOW');
        });
    });
});

// ──────────────────────────────────────────────────────────
// aggregateSeverity() — Unit Tests
// ──────────────────────────────────────────────────────────

describe('SeverityScorer – aggregateSeverity()', () => {
    it('should return LOW/0 for empty array', () => {
        const result = aggregateSeverity([]);
        expect(result.level).toBe('LOW');
        expect(result.score).toBe(0);
    });

    it('should return the max score from input scores', () => {
        const scores: SeverityResult[] = [
            { level: 'LOW', score: 15, reason: '' },
            { level: 'HIGH', score: 70, reason: '' },
            { level: 'MEDIUM', score: 40, reason: '' },
        ];
        const result = aggregateSeverity(scores);
        expect(result.score).toBeGreaterThanOrEqual(70);
    });

    it('should boost aggregate for 3+ high-severity logs', () => {
        const scores: SeverityResult[] = [
            { level: 'HIGH', score: 60, reason: '' },
            { level: 'HIGH', score: 65, reason: '' },
            { level: 'HIGH', score: 70, reason: '' },
        ];
        const result = aggregateSeverity(scores);
        // Max is 70, with 3 high-severity logs it should get +5 boost
        expect(result.score).toBe(75);
    });

    it('should boost aggregate for 2+ critical-severity logs', () => {
        const scores: SeverityResult[] = [
            { level: 'CRITICAL', score: 85, reason: '' },
            { level: 'CRITICAL', score: 90, reason: '' },
        ];
        const result = aggregateSeverity(scores);
        // Max is 90, with 2 critical logs it should get +10 boost
        expect(result.score).toBe(100);
    });

    it('should include log count and breakdown in reason', () => {
        const scores: SeverityResult[] = [
            { level: 'HIGH', score: 70, reason: '' },
        ];
        const result = aggregateSeverity(scores);
        expect(result.reason).toContain('1 logs');
    });

    it('should cap aggregate score at 100', () => {
        const scores: SeverityResult[] = Array(10).fill({
            level: 'CRITICAL',
            score: 95,
            reason: '',
        });
        const result = aggregateSeverity(scores);
        expect(result.score).toBeLessThanOrEqual(100);
    });
});
