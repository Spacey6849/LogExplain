import { PatternRegistry, patternRegistry } from './pattern-registry';

// ──────────────────────────────────────────────────────────
// Pattern Registry — Unit Tests
// ──────────────────────────────────────────────────────────

describe('PatternRegistry', () => {
    let registry: PatternRegistry;

    beforeEach(() => {
        registry = new PatternRegistry();
    });

    // ─── Registration ─────────────────────────────────────

    describe('pattern loading', () => {
        it('should have loaded all pattern modules', () => {
            const count = registry.getPatternCount();
            expect(count).toBeGreaterThanOrEqual(28);
        });

        it('should return all patterns via getAllPatterns()', () => {
            const patterns = registry.getAllPatterns();
            expect(patterns.length).toBe(registry.getPatternCount());
        });

        it('should contain database patterns', () => {
            const patterns = registry.getAllPatterns();
            const dbPatterns = patterns.filter((p) => p.category === 'database');
            expect(dbPatterns.length).toBeGreaterThanOrEqual(5);
        });

        it('should contain network patterns', () => {
            const patterns = registry.getAllPatterns();
            const netPatterns = patterns.filter(
                (p) => p.category === 'network' || p.category === 'dns' || p.category === 'ssl_tls',
            );
            expect(netPatterns.length).toBeGreaterThanOrEqual(5);
        });

        it('should contain auth patterns', () => {
            const patterns = registry.getAllPatterns();
            const authPatterns = patterns.filter(
                (p) => p.category === 'authentication' || p.category === 'authorization' || p.category === 'security',
            );
            expect(authPatterns.length).toBeGreaterThanOrEqual(3);
        });

        it('should contain system patterns', () => {
            const patterns = registry.getAllPatterns();
            const sysPatterns = patterns.filter(
                (p) =>
                    p.category === 'memory' ||
                    p.category === 'disk' ||
                    p.category === 'cpu' ||
                    p.category === 'process' ||
                    p.category === 'filesystem',
            );
            expect(sysPatterns.length).toBeGreaterThanOrEqual(5);
        });

        it('should contain API patterns', () => {
            const patterns = registry.getAllPatterns();
            const apiPatterns = patterns.filter(
                (p) => p.category === 'api' || p.category === 'timeout',
            );
            expect(apiPatterns.length).toBeGreaterThanOrEqual(3);
        });

        it('should contain config patterns', () => {
            const patterns = registry.getAllPatterns();
            const configPatterns = patterns.filter(
                (p) => p.category === 'configuration',
            );
            expect(configPatterns.length).toBeGreaterThanOrEqual(2);
        });
    });

    // ─── Pattern By ID ────────────────────────────────────

    describe('getPatternById()', () => {
        it('should find DB_CONN_REFUSED by ID', () => {
            const pattern = registry.getPatternById('DB_CONN_REFUSED');
            expect(pattern).toBeDefined();
            expect(pattern!.id).toBe('DB_CONN_REFUSED');
            expect(pattern!.category).toBe('database');
        });

        it('should find SYS_OOM by ID', () => {
            const pattern = registry.getPatternById('SYS_OOM');
            expect(pattern).toBeDefined();
            expect(pattern!.category).toBe('memory');
        });

        it('should return undefined for non-existent ID', () => {
            const pattern = registry.getPatternById('DOES_NOT_EXIST');
            expect(pattern).toBeUndefined();
        });
    });

    // ─── Pattern Matching ─────────────────────────────────

    describe('findMatchingPatterns()', () => {
        it('should match ECONNREFUSED to DB_CONN_REFUSED', () => {
            const matches = registry.findMatchingPatterns(
                'ERROR: ECONNREFUSED 10.0.0.1:5432',
            );
            expect(matches.length).toBeGreaterThan(0);
            const topMatch = matches[0];
            expect(topMatch.pattern.id).toBe('DB_CONN_REFUSED');
            expect(topMatch.confidence).toBeGreaterThan(0.5);
        });

        it('should match password auth failure to DB_AUTH_FAILED', () => {
            const matches = registry.findMatchingPatterns(
                'FATAL: password authentication failed for user "admin"',
            );
            expect(matches.length).toBeGreaterThan(0);
            const ids = matches.map((m) => m.pattern.id);
            expect(ids).toContain('DB_AUTH_FAILED');
        });

        it('should match out of memory to SYS_OOM', () => {
            const matches = registry.findMatchingPatterns(
                'FATAL: out of memory, JavaScript heap out of memory',
            );
            expect(matches.length).toBeGreaterThan(0);
            const ids = matches.map((m) => m.pattern.id);
            expect(ids).toContain('SYS_OOM');
        });

        it('should match ENOSPC to SYS_DISK_FULL', () => {
            const matches = registry.findMatchingPatterns(
                'ERROR: ENOSPC: no space left on device',
            );
            expect(matches.length).toBeGreaterThan(0);
            const ids = matches.map((m) => m.pattern.id);
            expect(ids).toContain('SYS_DISK_FULL');
        });

        it('should match DNS failure to NET_DNS_FAILURE', () => {
            const matches = registry.findMatchingPatterns(
                'Error: getaddrinfo ENOTFOUND api.example.com',
            );
            expect(matches.length).toBeGreaterThan(0);
            const ids = matches.map((m) => m.pattern.id);
            expect(ids).toContain('NET_DNS_FAILURE');
        });

        it('should match connection reset to NET_CONN_RESET', () => {
            const matches = registry.findMatchingPatterns(
                'Error: read ECONNRESET',
            );
            expect(matches.length).toBeGreaterThan(0);
            const ids = matches.map((m) => m.pattern.id);
            expect(ids).toContain('NET_CONN_RESET');
        });

        it('should match SSL error to NET_SSL_ERROR', () => {
            const matches = registry.findMatchingPatterns(
                'Error: UNABLE_TO_VERIFY_LEAF_SIGNATURE',
            );
            expect(matches.length).toBeGreaterThan(0);
            const ids = matches.map((m) => m.pattern.id);
            expect(ids).toContain('NET_SSL_ERROR');
        });

        it('should match EADDRINUSE to NET_PORT_IN_USE', () => {
            const matches = registry.findMatchingPatterns(
                'Error: listen EADDRINUSE: address already in use :::3000',
            );
            expect(matches.length).toBeGreaterThan(0);
            const ids = matches.map((m) => m.pattern.id);
            expect(ids).toContain('NET_PORT_IN_USE');
        });

        it('should match segfault to SYS_PROCESS_CRASH', () => {
            const matches = registry.findMatchingPatterns(
                'segmentation fault (core dumped)',
            );
            expect(matches.length).toBeGreaterThan(0);
            const ids = matches.map((m) => m.pattern.id);
            expect(ids).toContain('SYS_PROCESS_CRASH');
        });

        it('should match ENOENT to SYS_FILE_NOT_FOUND', () => {
            const matches = registry.findMatchingPatterns(
                'Error: ENOENT: no such file or directory',
            );
            expect(matches.length).toBeGreaterThan(0);
            const ids = matches.map((m) => m.pattern.id);
            expect(ids).toContain('SYS_FILE_NOT_FOUND');
        });

        it('should return empty for completely unrecognized logs', () => {
            const matches = registry.findMatchingPatterns(
                'everything is fine and working perfectly',
            );
            expect(matches.length).toBe(0);
        });

        it('should sort matches by confidence descending', () => {
            const matches = registry.findMatchingPatterns(
                'ERROR: ECONNREFUSED 127.0.0.1:5432 could not connect to database',
            );
            for (let i = 1; i < matches.length; i++) {
                expect(matches[i - 1].confidence).toBeGreaterThanOrEqual(
                    matches[i].confidence,
                );
            }
        });

        it('should return confidence between 0 and 1', () => {
            const matches = registry.findMatchingPatterns(
                'ERROR: ECONNREFUSED 10.0.0.1:5432',
            );
            for (const match of matches) {
                expect(match.confidence).toBeGreaterThan(0);
                expect(match.confidence).toBeLessThanOrEqual(1);
            }
        });
    });

    // ─── Keyword Candidate Lookup ─────────────────────────

    describe('findCandidatesByKeyword()', () => {
        it('should find candidates for "connection refused"', () => {
            const candidates = registry.findCandidatesByKeyword(
                'connection refused to database',
            );
            expect(candidates.length).toBeGreaterThan(0);
            const ids = candidates.map((c) => c.id);
            expect(ids).toContain('DB_CONN_REFUSED');
        });

        it('should find candidates for "out of memory"', () => {
            const candidates = registry.findCandidatesByKeyword(
                'out of memory error in process',
            );
            expect(candidates.length).toBeGreaterThan(0);
            const ids = candidates.map((c) => c.id);
            expect(ids).toContain('SYS_OOM');
        });

        it('should return empty for unrelated keywords', () => {
            const candidates = registry.findCandidatesByKeyword(
                'everything is fine',
            );
            expect(candidates.length).toBe(0);
        });
    });

    // ─── Singleton Instance ───────────────────────────────

    describe('singleton instance', () => {
        it('should export a pre-built singleton instance', () => {
            expect(patternRegistry).toBeDefined();
            expect(patternRegistry).toBeInstanceOf(PatternRegistry);
            expect(patternRegistry.getPatternCount()).toBeGreaterThanOrEqual(28);
        });
    });

    // ─── Pattern Structure Validation ─────────────────────

    describe('pattern structure', () => {
        it('every pattern should have a unique ID', () => {
            const patterns = registry.getAllPatterns();
            const ids = patterns.map((p) => p.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });

        it('every pattern should have at least one regex', () => {
            const patterns = registry.getAllPatterns();
            for (const pattern of patterns) {
                expect(pattern.patterns.length).toBeGreaterThan(0);
            }
        });

        it('every pattern should have at least one keyword', () => {
            const patterns = registry.getAllPatterns();
            for (const pattern of patterns) {
                expect(pattern.keywords.length).toBeGreaterThan(0);
            }
        });

        it('every pattern should have an explanation with summary, rootCause, possibleCauses, and recommendedFixes', () => {
            const patterns = registry.getAllPatterns();
            for (const pattern of patterns) {
                expect(pattern.explanation.summary).toBeDefined();
                expect(pattern.explanation.summary.length).toBeGreaterThan(0);
                expect(pattern.explanation.rootCause).toBeDefined();
                expect(pattern.explanation.rootCause.length).toBeGreaterThan(0);
                expect(pattern.explanation.possibleCauses.length).toBeGreaterThan(0);
                expect(pattern.explanation.recommendedFixes.length).toBeGreaterThan(0);
            }
        });

        it('every pattern should have a valid severity', () => {
            const patterns = registry.getAllPatterns();
            const validLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
            for (const pattern of patterns) {
                expect(validLevels).toContain(pattern.severity);
            }
        });

        it('every pattern should have a valid category', () => {
            const patterns = registry.getAllPatterns();
            const validCategories = [
                'database', 'network', 'authentication', 'authorization',
                'memory', 'disk', 'cpu', 'api', 'timeout', 'configuration',
                'security', 'application', 'filesystem', 'dns', 'ssl_tls',
                'process', 'kernel', 'unknown',
            ];
            for (const pattern of patterns) {
                expect(validCategories).toContain(pattern.category);
            }
        });
    });
});
