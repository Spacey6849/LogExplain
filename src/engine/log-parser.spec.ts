import { parseLogLine, severityFromLogLevel } from './log-parser';

// ──────────────────────────────────────────────────────────
// Log Parser — Unit Tests
// ──────────────────────────────────────────────────────────

describe('LogParser – parseLogLine()', () => {
    // ─── Timestamp Extraction ──────────────────────────────

    describe('timestamp extraction', () => {
        it('should extract ISO 8601 timestamps', () => {
            const result = parseLogLine(
                '2026-02-11T10:30:00Z ERROR something failed',
            );
            expect(result.timestamp).toBe('2026-02-11T10:30:00Z');
        });

        it('should extract ISO 8601 timestamps with milliseconds', () => {
            const result = parseLogLine(
                '2026-02-11T10:30:00.123Z ERROR something failed',
            );
            expect(result.timestamp).toBe('2026-02-11T10:30:00.123Z');
        });

        it('should extract ISO 8601 timestamps with timezone offset', () => {
            const result = parseLogLine(
                '2026-02-11T10:30:00+05:30 ERROR something failed',
            );
            expect(result.timestamp).toBe('2026-02-11T10:30:00+05:30');
        });

        it('should extract syslog-style timestamps', () => {
            const result = parseLogLine(
                'Feb 11 10:30:00 myhost ERROR something failed',
            );
            expect(result.timestamp).toBe('Feb 11 10:30:00');
        });

        it('should extract date-time style timestamps', () => {
            const result = parseLogLine(
                '2026-02-11 10:30:00 ERROR something failed',
            );
            expect(result.timestamp).toBe('2026-02-11 10:30:00');
        });

        it('should handle logs without timestamps', () => {
            const result = parseLogLine('ERROR: connection refused');
            expect(result.timestamp).toBeUndefined();
        });
    });

    // ─── Log Level Extraction ─────────────────────────────

    describe('log level extraction', () => {
        it.each([
            ['ERROR', 'ERROR: something failed'],
            ['WARN', 'WARN: disk space low'],
            ['INFO', 'INFO: server started'],
            ['DEBUG', 'DEBUG: query executed in 5ms'],
            ['FATAL', 'FATAL: out of memory'],
            ['CRITICAL', 'CRITICAL: system failure'],
            ['TRACE', 'TRACE: entering function'],
            ['NOTICE', 'NOTICE: scheduled maintenance'],
            ['ALERT', 'ALERT: security breach detected'],
            ['EMERGENCY', 'EMERGENCY: system is unusable'],
        ])('should extract log level %s', (expectedLevel, logLine) => {
            const result = parseLogLine(logLine);
            expect(result.logLevel).toBe(expectedLevel);
        });

        it('should be case-insensitive for log levels', () => {
            const result = parseLogLine('error: something failed');
            expect(result.logLevel).toBe('ERROR');
        });

        it('should handle logs without a log level', () => {
            const result = parseLogLine('Connection to server lost');
            expect(result.logLevel).toBeUndefined();
        });
    });

    // ─── IP Address Extraction ────────────────────────────

    describe('IP address extraction', () => {
        it('should extract IPv4 addresses', () => {
            const result = parseLogLine(
                'ERROR: ECONNREFUSED 192.168.1.100:5432',
            );
            expect(result.ipAddress).toBe('192.168.1.100');
        });

        it('should extract IP with port', () => {
            const result = parseLogLine(
                'ERROR: ECONNREFUSED 10.0.1.5:5432',
            );
            expect(result.ipAddress).toBe('10.0.1.5');
            expect(result.port).toBe('5432');
        });

        it('should handle logs without IP addresses', () => {
            const result = parseLogLine('ERROR: disk full');
            expect(result.ipAddress).toBeUndefined();
        });
    });

    // ─── Port Extraction ──────────────────────────────────

    describe('port extraction', () => {
        it('should extract port from IP:port format', () => {
            const result = parseLogLine(
                'Connection refused to 10.0.0.1:3306',
            );
            expect(result.port).toBe('3306');
        });

        it('should extract port from explicit port= format', () => {
            const result = parseLogLine(
                'ERROR: bind failed port=8080',
            );
            expect(result.port).toBe('8080');
        });
    });

    // ─── Error Code Extraction ────────────────────────────

    describe('error code extraction', () => {
        it('should extract common POSIX error codes', () => {
            const result = parseLogLine(
                'Error: ECONNREFUSED 127.0.0.1:5432',
            );
            expect(result.errorCode).toBe('ECONNREFUSED');
        });

        it('should extract ENOSPC error code', () => {
            const result = parseLogLine('ENOSPC: no space left on device');
            expect(result.errorCode).toBe('ENOSPC');
        });

        it('should extract ENOENT error code', () => {
            const result = parseLogLine(
                'Error: ENOENT: no such file or directory',
            );
            expect(result.errorCode).toBe('ENOENT');
        });

        it('should extract ETIMEDOUT error code', () => {
            const result = parseLogLine(
                'connect ETIMEDOUT 10.0.0.1:443',
            );
            expect(result.errorCode).toBe('ETIMEDOUT');
        });

        it('should not confuse log levels with error codes', () => {
            const result = parseLogLine(
                'ERROR: simple failure message',
            );
            // ERROR should be the logLevel, not errorCode
            expect(result.logLevel).toBe('ERROR');
            // errorCode should not be 'ERROR'
            if (result.errorCode) {
                expect(result.errorCode).not.toBe('ERROR');
            }
        });
    });

    // ─── HTTP Metadata ────────────────────────────────────

    describe('HTTP metadata extraction', () => {
        it('should extract HTTP methods', () => {
            const result = parseLogLine(
                'GET /api/v1/users 200 OK',
            );
            expect(result.httpMethod).toBe('GET');
        });

        it('should extract HTTP status codes', () => {
            const result = parseLogLine(
                '503 Service Unavailable - upstream server not responding',
            );
            expect(result.httpStatus).toBe('503');
        });

        it('should extract URLs', () => {
            const result = parseLogLine(
                'ERROR: Request timeout on /api/v1/users after 30000ms',
            );
            expect(result.url).toContain('/api/v1/users');
        });
    });

    // ─── Username Extraction ──────────────────────────────

    describe('username extraction', () => {
        it('should extract username from user= format', () => {
            const result = parseLogLine(
                'FATAL: password authentication failed for user "admin"',
            );
            expect(result.username).toBe('admin');
        });
    });

    // ─── Source Extraction ────────────────────────────────

    describe('source extraction', () => {
        it('should extract source from [source] bracket format', () => {
            const result = parseLogLine(
                '2026-02-11T10:30:00Z ERROR [database] FATAL: connection refused',
            );
            expect(result.source).toBe('database');
        });

        it('should extract source from syslog format', () => {
            const result = parseLogLine(
                'Feb 11 10:30:00 myhost nginx[12345]: error occurred',
            );
            expect(result.source).toBeDefined();
        });
    });

    // ─── Message Body Extraction ──────────────────────────

    describe('message body', () => {
        it('should always have a messageBody', () => {
            const result = parseLogLine('ERROR: something went wrong');
            expect(result.messageBody).toBeDefined();
            expect(result.messageBody.length).toBeGreaterThan(0);
        });

        it('should strip timestamp from message body', () => {
            const result = parseLogLine(
                '2026-02-11T10:30:00Z ERROR: something went wrong',
            );
            expect(result.messageBody).not.toContain('2026-02-11T10:30:00Z');
        });
    });

    // ─── Complex Real-World Logs ──────────────────────────

    describe('complex real-world log parsing', () => {
        it('should parse a database auth failure log', () => {
            const result = parseLogLine(
                '2026-02-11T10:30:00Z ERROR [database] FATAL: password authentication failed for user "admin"',
            );
            expect(result.timestamp).toBe('2026-02-11T10:30:00Z');
            expect(result.logLevel).toBe('ERROR');
            expect(result.source).toBe('database');
            expect(result.username).toBe('admin');
        });

        it('should parse a network connection refused log', () => {
            const result = parseLogLine(
                'ERROR ECONNREFUSED 127.0.0.1:5432',
            );
            expect(result.logLevel).toBe('ERROR');
            expect(result.errorCode).toBe('ECONNREFUSED');
            expect(result.ipAddress).toBe('127.0.0.1');
            expect(result.port).toBe('5432');
        });

        it('should parse an OOM error log', () => {
            const result = parseLogLine(
                'FATAL: out of memory, JavaScript heap out of memory',
            );
            expect(result.logLevel).toBe('FATAL');
        });

        it('should parse a 503 service unavailable log', () => {
            const result = parseLogLine(
                '2026-02-11T10:30:03Z CRITICAL 503 Service Unavailable - upstream server not responding',
            );
            expect(result.timestamp).toBe('2026-02-11T10:30:03Z');
            expect(result.logLevel).toBe('CRITICAL');
            expect(result.httpStatus).toBe('503');
        });
    });
});

// ──────────────────────────────────────────────────────────
// severityFromLogLevel() — Unit Tests
// ──────────────────────────────────────────────────────────

describe('LogParser – severityFromLogLevel()', () => {
    it('should return CRITICAL for FATAL', () => {
        expect(severityFromLogLevel('FATAL')).toBe('CRITICAL');
    });

    it('should return CRITICAL for EMERGENCY', () => {
        expect(severityFromLogLevel('EMERGENCY')).toBe('CRITICAL');
    });

    it('should return CRITICAL for CRIT', () => {
        expect(severityFromLogLevel('CRIT')).toBe('CRITICAL');
    });

    it('should return HIGH for ERROR', () => {
        expect(severityFromLogLevel('ERROR')).toBe('HIGH');
    });

    it('should return HIGH for ERR', () => {
        expect(severityFromLogLevel('ERR')).toBe('HIGH');
    });

    it('should return HIGH for ALERT', () => {
        expect(severityFromLogLevel('ALERT')).toBe('HIGH');
    });

    it('should return MEDIUM for WARN', () => {
        expect(severityFromLogLevel('WARN')).toBe('MEDIUM');
    });

    it('should return MEDIUM for WARNING', () => {
        expect(severityFromLogLevel('WARNING')).toBe('MEDIUM');
    });

    it('should return MEDIUM for NOTICE', () => {
        expect(severityFromLogLevel('NOTICE')).toBe('MEDIUM');
    });

    it('should return LOW for INFO', () => {
        expect(severityFromLogLevel('INFO')).toBe('LOW');
    });

    it('should return LOW for DEBUG', () => {
        expect(severityFromLogLevel('DEBUG')).toBe('LOW');
    });

    it('should return LOW for TRACE', () => {
        expect(severityFromLogLevel('TRACE')).toBe('LOW');
    });

    it('should return null when logLevel is undefined', () => {
        expect(severityFromLogLevel(undefined)).toBeNull();
    });

    it('should be case-insensitive', () => {
        expect(severityFromLogLevel('error')).toBe('HIGH');
        expect(severityFromLogLevel('Fatal')).toBe('CRITICAL');
    });
});
