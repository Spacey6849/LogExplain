import { LogPattern } from '../types';

// ──────────────────────────────────────────────────────────
// Caching, Email, and Logging Infrastructure Patterns
// ──────────────────────────────────────────────────────────

export const infrastructurePatterns: LogPattern[] = [
    // ── Caching ──
    {
        id: 'CACHE_REDIS_ERROR',
        name: 'Redis Connection/Command Error',
        category: 'caching',
        patterns: [
            /redis.*(?:connection\s+refused|ECONNREFUSED)/i,
            /Redis.*(?:error|fail|timeout|NOAUTH|WRONGPASS)/i,
            /NOAUTH\s+Authentication\s+required/i,
            /ERR\s+max\s+number\s+of\s+clients\s+reached/i,
            /redis.*LOADING/i,
        ],
        keywords: ['Redis', 'ECONNREFUSED', 'NOAUTH', 'cache error', 'redis timeout'],
        errorCodes: ['NOAUTH', 'WRONGPASS'],
        severity: 'HIGH',
        explanation: {
            summary:
                'A Redis operation failed — the cache layer is unavailable or returned an error. This may degrade performance or cause failures if caching is critical.',
            rootCause:
                'Redis is unreachable, requires authentication, or has reached its resource limits.',
            possibleCauses: [
                'Redis server is not running or crashed',
                'Redis requires a password (requirepass) but none was provided',
                'Redis max client connections reached',
                'Redis is still loading dataset into memory after restart',
                'Network connectivity issue to the Redis host/port',
                'Redis memory is full and eviction policy is set to noeviction',
            ],
            recommendedFixes: [
                'Check Redis status: redis-cli ping',
                'Verify Redis password in connection configuration',
                'Check Redis memory usage: redis-cli INFO memory',
                'Increase maxclients if the limit is too low',
                'Implement Redis Sentinel or Cluster for high availability',
                'Set appropriate maxmemory-policy (allkeys-lru for cache use cases)',
            ],
        },
    },
    {
        id: 'CACHE_MISS_SPIKE',
        name: 'Cache Miss Rate Spike',
        category: 'caching',
        patterns: [
            /cache\s+miss.*(?:rate|spike|high|increased)/i,
            /cache\s+hit\s+ratio.*(?:low|dropped|declining)/i,
            /cache.*(?:cold|warming|invalidated|flushed)/i,
            /cache\s+stampede/i,
        ],
        keywords: ['cache miss', 'cache hit ratio', 'cache cold', 'stampede'],
        severity: 'MEDIUM',
        explanation: {
            summary:
                'The cache miss rate has spiked significantly, causing more requests to hit the backend database or API directly.',
            rootCause:
                'Cached data is missing, expired, or was invalidated, forcing direct backend lookups.',
            possibleCauses: [
                'Cache was recently flushed or the cache server restarted',
                'TTL (time-to-live) is too short for the cached data',
                'Cache stampede: many requests simultaneously filling the same key',
                'Cache eviction due to memory pressure',
                'New deployment with different cache key scheme',
            ],
            recommendedFixes: [
                'Implement cache warming on startup for critical data',
                'Use probabilistic early expiration (cache stampede prevention)',
                'Set appropriate TTL values based on data change frequency',
                'Monitor cache hit/miss ratios with alerting',
                'Implement circuit breaker to protect backend during cache failures',
            ],
        },
    },

    // ── Email ──
    {
        id: 'EMAIL_SMTP_ERROR',
        name: 'SMTP Email Delivery Error',
        category: 'email',
        patterns: [
            /SMTP.*(?:error|fail|refused|timeout)/i,
            /(?:mail|email).*(?:delivery|send).*(?:fail|error|bounce)/i,
            /(?:550|552|554).*(?:rejected|denied|spam|relay)/i,
            /EHLO.*fail/i,
            /authentication.*fail.*(?:smtp|mail)/i,
        ],
        keywords: ['SMTP', 'email', 'delivery failed', 'bounce', 'rejected', 'mail server'],
        errorCodes: ['550', '552', '554', '450', '451'],
        severity: 'MEDIUM',
        severityModifiers: [
            {
                condition: /password\s+reset|verification|critical\s+notification/i,
                severity: 'HIGH',
                reason: 'Failed delivery of critical transactional emails impacts user experience',
            },
        ],
        explanation: {
            summary:
                'An email delivery attempt failed. The SMTP server rejected the message or the connection could not be established.',
            rootCause:
                'The SMTP server refused the email or the connection failed due to configuration, authentication, or content issues.',
            possibleCauses: [
                'SMTP authentication credentials are incorrect',
                'Sender domain lacks proper SPF/DKIM/DMARC records',
                'Recipient email address does not exist (hard bounce)',
                'Email content flagged as spam by the receiving server',
                'SMTP relay not allowed from this IP address',
                'Mail server rate limit exceeded',
            ],
            recommendedFixes: [
                'Verify SMTP credentials and connection settings (host, port, TLS)',
                'Set up SPF, DKIM, and DMARC records for the sending domain',
                'Implement bounce handling and remove invalid addresses',
                'Use a managed email service (SendGrid, SES, Postmark)',
                'Monitor email deliverability rates and bounce rates',
                'Implement email queuing with retry logic',
            ],
        },
    },

    // ── Logging Infrastructure ──
    {
        id: 'LOG_ROTATION_FAIL',
        name: 'Log Rotation Failure',
        category: 'logging',
        patterns: [
            /log\s*rotation.*(?:fail|error)/i,
            /logrotate.*(?:error|fail)/i,
            /unable\s+to\s+(?:rotate|truncate).*log/i,
            /log\s+file.*(?:too\s+large|exceeded|growing)/i,
        ],
        keywords: ['logrotate', 'log rotation', 'log file size', 'log truncate'],
        severity: 'MEDIUM',
        explanation: {
            summary:
                'Log file rotation failed, causing log files to grow without bound. This can eventually fill up the disk.',
            rootCause:
                'The log rotation mechanism (logrotate, built-in rotation) failed to compress, archive, or truncate old log files.',
            possibleCauses: [
                'Logrotate configuration file has syntax errors',
                'Insufficient permissions to rotate the log file',
                'Application holds an open file handle preventing rotation',
                'Disk space too low to create compressed archive',
                'Logrotate cron job is not running',
            ],
            recommendedFixes: [
                'Test logrotate config: logrotate -d /etc/logrotate.d/<app>',
                'Fix file permissions on the log directory',
                'Use copytruncate directive if the app cannot reopen log files',
                'Verify cron service is running: systemctl status crond',
                'Implement structured logging to a log aggregation service instead',
            ],
        },
    },

    // ── Nginx / Reverse Proxy ──
    {
        id: 'NGINX_BAD_GATEWAY',
        name: 'Nginx Bad Gateway (502)',
        category: 'api',
        patterns: [
            /502\s+Bad\s+Gateway/i,
            /HTTP\s+502/i,
            /upstream\s+prematurely\s+closed\s+connection/i,
            /no\s+live\s+upstreams/i,
            /connect\(\)\s+failed.*upstream/i,
        ],
        keywords: ['502', 'bad gateway', 'upstream', 'nginx', 'proxy'],
        errorCodes: ['502'],
        severity: 'HIGH',
        explanation: {
            summary:
                'Nginx returned a 502 Bad Gateway error — the upstream application server is not responding or crashed.',
            rootCause:
                'Nginx could not get a valid response from the upstream server that the request was proxied to.',
            possibleCauses: [
                'Upstream application server is crashed or not running',
                'Upstream server is overloaded and dropping connections',
                'PHP-FPM, Gunicorn, or Node.js process pool is exhausted',
                'Upstream connection timeout is too short',
                'Application is listening on the wrong port or socket',
                'Firewall blocking traffic between Nginx and the upstream',
            ],
            recommendedFixes: [
                'Check if the upstream application is running',
                'Review upstream application logs for crashes or errors',
                'Increase proxy_read_timeout and proxy_connect_timeout in nginx.conf',
                'Scale up application server processes/workers',
                'Verify the upstream address and port in the Nginx config',
                'Use health checks to automatically remove unhealthy upstreams',
            ],
        },
    },

    // ── Database-adjacent ──
    {
        id: 'DB_DEADLOCK',
        name: 'Database Deadlock Detected',
        category: 'database',
        patterns: [
            /deadlock\s+detected/i,
            /Deadlock\s+found/i,
            /deadlock.*victim/i,
            /transaction.*deadlock/i,
            /Error\s+1213/i,
        ],
        keywords: ['deadlock', 'deadlock detected', 'deadlock victim', 'transaction conflict'],
        errorCodes: ['1213', '40P01'],
        severity: 'HIGH',
        explanation: {
            summary:
                'A database deadlock was detected — two or more transactions are waiting for each other to release locks, creating a circular dependency.',
            rootCause:
                'Concurrent transactions acquired locks in conflicting orders, creating a cycle that the database had to break by killing one transaction.',
            possibleCauses: [
                'Transactions updating the same rows in different orders',
                'Long-running transactions holding locks for extended periods',
                'Missing or incorrect indexes causing full table locks',
                'Application not using consistent lock ordering',
                'High concurrency on frequently updated rows',
            ],
            recommendedFixes: [
                'Implement consistent lock ordering across all transactions',
                'Keep transactions short and focused',
                'Add proper indexes to reduce lock scope (row-level vs table-level)',
                'Implement retry logic for deadlock victims (the rolled-back transaction)',
                'Use SELECT ... FOR UPDATE NOWAIT to fail fast instead of waiting',
                'Review deadlock graphs: SHOW ENGINE INNODB STATUS (MySQL)',
            ],
        },
    },

    // ── Application Runtime ──
    {
        id: 'APP_STACK_OVERFLOW',
        name: 'Stack Overflow / Recursion Limit',
        category: 'application',
        patterns: [
            /stack\s*overflow/i,
            /Maximum\s+call\s+stack\s+size\s+exceeded/i,
            /RecursionError/i,
            /StackOverflowError/i,
            /maximum\s+recursion\s+depth\s+exceeded/i,
        ],
        keywords: ['stack overflow', 'recursion', 'call stack', 'RecursionError'],
        severity: 'HIGH',
        explanation: {
            summary:
                'The application hit a stack overflow due to excessive recursion or deeply nested function calls.',
            rootCause:
                'An infinite or excessively deep recursive function call exhausted the call stack.',
            possibleCauses: [
                'Infinite recursion due to missing or incorrect base case',
                'Circular dependency between modules or functions',
                'Deeply nested data structure being processed recursively',
                'Event handler triggering itself in an infinite loop',
                'Misconfigured middleware creating a request loop',
            ],
            recommendedFixes: [
                'Review recursive functions for proper base cases / termination conditions',
                'Convert deep recursion to iterative approach with an explicit stack',
                'Implement recursion depth limits as safety guards',
                'Check for circular references in data structures',
                'Use tail-call optimization where supported',
                'Increase stack size if the deep recursion is intentional: --stack-size flag',
            ],
        },
    },
    {
        id: 'APP_UNHANDLED_PROMISE',
        name: 'Unhandled Promise Rejection',
        category: 'application',
        patterns: [
            /UnhandledPromiseRejection/i,
            /unhandled\s+promise\s+rejection/i,
            /PromiseRejectionHandledWarning/i,
            /Unhandled\s+Rejection/i,
            /unhandled.*(?:error|rejection).*(?:promise|async)/i,
        ],
        keywords: ['unhandled promise', 'rejection', 'promise rejection', 'async error'],
        severity: 'HIGH',
        severityModifiers: [
            {
                condition: /process.*exit|crash|terminate/i,
                severity: 'CRITICAL',
                reason: 'Unhandled promise rejections can cause Node.js process to exit in newer versions',
            },
        ],
        explanation: {
            summary:
                'An async operation (Promise) was rejected but no error handler was attached. In Node.js 15+, this terminates the process.',
            rootCause:
                'A rejected Promise does not have a .catch() handler or is not inside a try/catch within an async function.',
            possibleCauses: [
                'Missing .catch() or try/catch around async/await calls',
                'Forgotten await on an async function that throws',
                'Error in a callback passed to a Promise',
                'Race condition causing rejection after the handler is removed',
                'Third-party library rejecting a promise unexpectedly',
            ],
            recommendedFixes: [
                'Add .catch() to all Promises or use try/catch with async/await',
                'Set up a global handler: process.on("unhandledRejection", handler)',
                'Use a linting rule (no-floating-promises) to catch missing await/catch',
                'Review async code for missing error handling paths',
                'Implement centralized error handling middleware (Express/Koa)',
            ],
        },
    },
    {
        id: 'APP_TYPE_ERROR',
        name: 'TypeError / Null Reference',
        category: 'application',
        patterns: [
            /TypeError.*(?:undefined|null|not\s+a\s+function|not\s+iterable)/i,
            /Cannot\s+read\s+propert.*of\s+(?:undefined|null)/i,
            /NullPointerException/i,
            /NullReferenceException/i,
            /AttributeError.*NoneType/i,
            /is\s+not\s+a\s+function/i,
        ],
        keywords: ['TypeError', 'undefined', 'null', 'NullPointerException', 'NullReferenceException'],
        severity: 'MEDIUM',
        severityModifiers: [
            {
                condition: /production|prod|live/i,
                severity: 'HIGH',
                reason: 'TypeErrors in production indicate untested code paths',
            },
        ],
        explanation: {
            summary:
                'A TypeError or null reference error occurred — the code attempted to use a value that is undefined or null as if it were a valid object.',
            rootCause:
                'A variable or property is null/undefined when the code expected a valid value.',
            possibleCauses: [
                'API response missing expected fields',
                'Database query returning null instead of an object',
                'Accessing a property before async data is loaded',
                'Incorrect destructuring of undefined objects',
                'Missing null checks after optional chaining',
                'State management issue (accessing before initialization)',
            ],
            recommendedFixes: [
                'Add null checks: use optional chaining (?.) and nullish coalescing (??)',
                'Validate API responses before accessing nested properties',
                'Initialize variables with default values',
                'Use TypeScript strict null checks to catch these at compile time',
                'Add unit tests for edge cases with null/undefined inputs',
                'Implement defensive programming patterns at data boundaries',
            ],
        },
    },
    {
        id: 'APP_MEMORY_LEAK',
        name: 'Memory Leak Detected',
        category: 'memory',
        patterns: [
            /memory\s+leak/i,
            /heap\s+(?:size|used|total).*(?:growing|increasing|exceeded)/i,
            /possible\s+memory\s+leak/i,
            /EventEmitter\s+memory\s+leak/i,
            /MaxListenersExceeded/i,
            /--max-old-space-size/i,
        ],
        keywords: ['memory leak', 'heap growing', 'EventEmitter', 'MaxListenersExceeded'],
        severity: 'HIGH',
        explanation: {
            summary:
                'A potential memory leak was detected — memory usage is continuously growing without being released, eventually leading to OOM crashes.',
            rootCause:
                'Objects are being allocated but never garbage collected, typically due to retained references.',
            possibleCauses: [
                'Event listeners being added without removal (EventEmitter leak)',
                'Global variables accumulating data over time',
                'Caches growing without eviction limits',
                'Closures retaining references to large objects',
                'Database connections or HTTP responses not being closed',
                'Circular references preventing garbage collection',
            ],
            recommendedFixes: [
                'Profile heap usage: node --inspect and Chrome DevTools Memory tab',
                'Set max listeners: emitter.setMaxListeners(N) or fix the leak',
                'Implement cache size limits with LRU eviction',
                'Ensure all event listeners are removed on cleanup: removeListener()',
                'Use WeakMap/WeakRef for object references that should be GC-eligible',
                'Monitor RSS/heap size over time to detect gradual growth',
            ],
        },
    },
    {
        id: 'APP_CORS_PREFLIGHT',
        name: 'CORS Preflight Request Failure',
        category: 'api',
        patterns: [
            /preflight.*(?:fail|error|blocked)/i,
            /OPTIONS.*(?:405|403|blocked)/i,
            /No\s+'Access-Control-Allow-Origin'/i,
            /CORS.*header.*missing/i,
            /Method\s+not\s+allowed.*OPTIONS/i,
        ],
        keywords: ['preflight', 'OPTIONS', 'CORS', 'Access-Control', 'cross-origin'],
        severity: 'MEDIUM',
        explanation: {
            summary:
                'A CORS preflight (OPTIONS) request was blocked or rejected, preventing the browser from making the actual cross-origin request.',
            rootCause:
                'The server does not handle OPTIONS requests correctly or is missing required CORS response headers.',
            possibleCauses: [
                'Server does not respond to OPTIONS requests (405 Method Not Allowed)',
                'Access-Control-Allow-Origin header not set or mismatched',
                'Custom headers used without Access-Control-Allow-Headers listing them',
                'Credentials mode enabled but wildcard (*) origin used',
                'API gateway or reverse proxy stripping CORS headers',
            ],
            recommendedFixes: [
                'Add CORS middleware to handle OPTIONS preflight requests',
                'Set Access-Control-Allow-Origin to the specific frontend domain',
                'List all custom headers in Access-Control-Allow-Headers',
                'Do not use wildcard origin (*) if credentials are needed',
                'Ensure the reverse proxy/CDN forwards CORS headers correctly',
            ],
        },
    },
    {
        id: 'APP_TIMEZONE_ERROR',
        name: 'Timezone / Date Parsing Error',
        category: 'application',
        patterns: [
            /(?:invalid|unexpected)\s+(?:date|time)/i,
            /timezone.*(?:error|invalid|mismatch)/i,
            /RangeError.*Invalid\s+time\s+value/i,
            /NaN.*(?:date|time|timestamp)/i,
            /date.*parsing.*(?:fail|error)/i,
        ],
        keywords: ['invalid date', 'timezone error', 'time parsing', 'NaN date', 'timestamp'],
        severity: 'LOW',
        severityModifiers: [
            {
                condition: /billing|payment|schedule|cron|deadline/i,
                severity: 'HIGH',
                reason: 'Date/time errors in billing, scheduling, or deadlines have business impact',
            },
        ],
        explanation: {
            summary:
                'A date or time value could not be parsed correctly, resulting in an invalid date, NaN, or timezone mismatch.',
            rootCause:
                'The date/time string format does not match the expected format, or timezone handling is inconsistent.',
            possibleCauses: [
                'Date string format differs between environments (US vs EU format)',
                'Missing timezone information causing implicit UTC/local conversions',
                'JavaScript Date constructor receiving an unparseable string',
                'Database returning dates in a different format than expected',
                'Daylight Saving Time (DST) transitions causing off-by-one hour errors',
            ],
            recommendedFixes: [
                'Use ISO 8601 (YYYY-MM-DDTHH:mm:ssZ) for all date communications',
                'Store and transmit all dates in UTC, convert to local only for display',
                'Use a robust date library (date-fns, luxon, dayjs) instead of native Date',
                'Validate date inputs before processing',
                'Set the server timezone explicitly: TZ=UTC',
            ],
        },
    },
];
