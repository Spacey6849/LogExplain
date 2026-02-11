import { LogPattern } from '../types';

// ──────────────────────────────────────────────────────────
// Database Log Patterns
// ──────────────────────────────────────────────────────────

export const databasePatterns: LogPattern[] = [
  {
    id: 'DB_CONN_REFUSED',
    name: 'Database Connection Refused',
    category: 'database',
    patterns: [
      /connection\s+refused.*(?:5432|3306|27017|6379|1433)/i,
      /ECONNREFUSED.*(?:5432|3306|27017|6379|1433)/i,
      /ECONNREFUSED.*(?:postgres|mysql|mongo|redis|mssql)/i,
      /could\s+not\s+connect\s+to\s+(?:server|database)/i,
      /connection\s+to\s+.*\s+refused/i,
    ],
    keywords: ['connection refused', 'ECONNREFUSED', 'could not connect'],
    errorCodes: ['ECONNREFUSED', 'CR_CONN_HOST_ERROR'],
    severity: 'HIGH',
    severityModifiers: [
      {
        condition: /production|prod/i,
        severity: 'CRITICAL',
        reason: 'Database connection failure in production environment',
      },
    ],
    explanation: {
      summary:
        'The application failed to establish a connection to the database server. The database is either not running, unreachable, or rejecting connections on the specified port.',
      rootCause:
        'The database service is unreachable — it may be stopped, crashed, or blocked by a firewall.',
      possibleCauses: [
        'Database service is not running or has crashed',
        'Firewall or security group blocking the database port',
        'Incorrect host or port in database connection string',
        'Database server is overloaded and refusing new connections',
        'Network partition between application and database servers',
        'Database max connections limit reached',
      ],
      recommendedFixes: [
        'Verify the database service is running: systemctl status postgresql / mysql',
        'Check the connection string (host, port, credentials) in your config',
        'Ensure firewall rules allow traffic on the database port',
        'Check database max_connections setting and current active connections',
        'Test network connectivity: telnet <db_host> <db_port>',
        'Review database server logs for crash or startup errors',
      ],
    },
  },
  {
    id: 'DB_TIMEOUT',
    name: 'Database Query Timeout',
    category: 'database',
    patterns: [
      /query\s+timed?\s*out/i,
      /statement\s+timeout/i,
      /lock\s+wait\s+timeout\s+exceeded/i,
      /canceling\s+statement\s+due\s+to\s+statement\s+timeout/i,
      /Error\s+Code:\s*1205/i,
    ],
    keywords: ['query timeout', 'statement timeout', 'lock wait timeout'],
    errorCodes: ['1205', '57014'],
    severity: 'HIGH',
    explanation: {
      summary:
        'A database query exceeded its maximum allowed execution time and was terminated. This typically indicates a slow query, missing indexes, or a deadlock.',
      rootCause:
        'The query took longer than the configured timeout threshold, likely due to inefficient query execution or resource contention.',
      possibleCauses: [
        'Missing or inefficient database indexes on queried columns',
        'Full table scan on a large table',
        'Deadlock or lock contention between concurrent transactions',
        'Database server under heavy load or resource exhaustion',
        'Complex query with multiple JOINs on large datasets',
        'Insufficient server resources (CPU, memory, I/O)',
      ],
      recommendedFixes: [
        'Run EXPLAIN/EXPLAIN ANALYZE on the slow query to identify bottlenecks',
        'Add appropriate indexes on frequently queried columns',
        'Optimize the query to reduce complexity (avoid SELECT *, use LIMIT)',
        'Increase the statement timeout if the query is legitimately long-running',
        'Check for deadlocks in the database logs',
        'Consider query caching or materialized views for complex reports',
      ],
    },
  },
  {
    id: 'DB_AUTH_FAILED',
    name: 'Database Authentication Failed',
    category: 'database',
    patterns: [
      /password\s+authentication\s+failed/i,
      /access\s+denied\s+for\s+user/i,
      /authentication\s+failed.*database/i,
      /Login\s+failed\s+for\s+user/i,
      /FATAL:\s+password\s+authentication\s+failed\s+for\s+user/i,
    ],
    keywords: ['authentication failed', 'access denied', 'login failed', 'password'],
    errorCodes: ['28P01', '1045', '18456'],
    severity: 'HIGH',
    explanation: {
      summary:
        'The database rejected the connection because the supplied username or password is incorrect. The application cannot authenticate with the database.',
      rootCause:
        'Invalid credentials provided in the database connection configuration.',
      possibleCauses: [
        'Incorrect password in connection string or environment variable',
        'Database user does not exist',
        'Password was recently changed but not updated in app config',
        'Database authentication method mismatch (e.g., md5 vs scram-sha-256)',
        'User lacks required privileges for the target database',
        'Host-based authentication rules (pg_hba.conf) reject the connection',
      ],
      recommendedFixes: [
        'Verify database credentials in your environment/config files',
        'Test login manually: psql -U <user> -h <host> <database>',
        'Reset the database user password if unsure',
        'Check pg_hba.conf (PostgreSQL) or user grants (MySQL) for access rules',
        'Ensure the user has CONNECT privilege on the target database',
        'Verify the authentication method matches what the client supports',
      ],
    },
  },
  {
    id: 'DB_POOL_EXHAUSTED',
    name: 'Database Connection Pool Exhausted',
    category: 'database',
    patterns: [
      /connection\s+pool\s+(?:exhausted|full|maxed|saturated)/i,
      /too\s+many\s+connections/i,
      /remaining\s+connection\s+slots\s+are\s+reserved/i,
      /FATAL:\s+too\s+many\s+connections/i,
      /max_connections/i,
    ],
    keywords: ['connection pool', 'too many connections', 'pool exhausted'],
    errorCodes: ['53300'],
    severity: 'CRITICAL',
    explanation: {
      summary:
        'The database connection pool has reached its maximum capacity. New connection requests are being rejected, which will cause application errors and downtime.',
      rootCause:
        'All available database connections are in use, and no connections can be allocated for new requests.',
      possibleCauses: [
        'Connection leak — connections not being returned to the pool',
        'Sudden traffic spike exhausting the connection pool',
        'Pool size configured too low for current workload',
        'Long-running transactions holding connections for too long',
        'Multiple application instances sharing the same pool limit',
        'Database max_connections setting is too restrictive',
      ],
      recommendedFixes: [
        'Review and increase pool size (poolMin/poolMax) settings',
        'Audit code for connection leaks (unreleased connections)',
        'Use connection pool monitoring to track utilization',
        'Implement connection timeout and idle connection reaping',
        'Consider using PgBouncer or ProxySQL for connection pooling',
        'Increase database max_connections if server resources allow',
      ],
    },
  },
  {
    id: 'DB_REPLICATION_LAG',
    name: 'Database Replication Lag',
    category: 'database',
    patterns: [
      /replication\s+lag/i,
      /slave\s+(?:is\s+)?behind\s+master/i,
      /replica.*behind/i,
      /Seconds_Behind_Master:\s*\d+/i,
    ],
    keywords: ['replication lag', 'slave behind', 'replica behind'],
    severity: 'MEDIUM',
    severityModifiers: [
      {
        condition: /lag.*(?:\d{3,}|seconds)/i,
        severity: 'HIGH',
        reason: 'Replication lag exceeds acceptable threshold',
      },
    ],
    explanation: {
      summary:
        'The database replica is falling behind the primary server. Data read from replicas may be stale, which can cause inconsistencies in read operations.',
      rootCause:
        'The replica cannot keep up with the rate of writes on the primary database.',
      possibleCauses: [
        'Heavy write workload on the primary server',
        'Network latency between primary and replica',
        'Replica server has insufficient CPU/IO resources',
        'Large transactions or DDL operations blocking replication',
        'Disk I/O bottleneck on the replica',
      ],
      recommendedFixes: [
        'Monitor replication lag metrics continuously',
        'Scale up replica server resources (CPU, memory, faster disks)',
        'Optimize write-heavy queries on the primary',
        'Consider parallel replication for multi-threaded apply',
        'Route time-sensitive reads to the primary temporarily',
        'Break large transactions into smaller batches',
      ],
    },
  },
];
