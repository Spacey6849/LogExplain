import { LogPattern } from '../types';

// ──────────────────────────────────────────────────────────
// Authentication & Authorization Log Patterns
// ──────────────────────────────────────────────────────────

export const authPatterns: LogPattern[] = [
  {
    id: 'AUTH_LOGIN_FAILED',
    name: 'Authentication Login Failed',
    category: 'authentication',
    patterns: [
      /authentication\s+fail/i,
      /login\s+fail/i,
      /invalid\s+(?:credentials|username|password)/i,
      /unauthorized.*login/i,
      /failed\s+password\s+for/i,
      /pam_unix.*authentication\s+failure/i,
    ],
    keywords: ['login failed', 'authentication failure', 'invalid credentials', 'failed password'],
    severity: 'MEDIUM',
    severityModifiers: [
      {
        condition: /repeated|multiple|brute|consecutive/i,
        severity: 'CRITICAL',
        reason: 'Repeated login failures indicate a potential brute-force attack',
      },
      {
        condition: /root|admin|administrator/i,
        severity: 'HIGH',
        reason: 'Failed login attempt on a privileged account',
      },
    ],
    explanation: {
      summary:
        'A user authentication attempt failed. The supplied credentials were rejected by the system.',
      rootCause:
        'The provided username or password does not match any valid account in the system.',
      possibleCauses: [
        'Incorrect password entered by the user',
        'Account does not exist in the system',
        'Account is locked, disabled, or expired',
        'Brute-force attack if failures are repeated from the same or multiple IPs',
        'Password policy change requiring updated credentials',
        'LDAP/SSO backend is unreachable',
      ],
      recommendedFixes: [
        'Check if the user account exists and is active',
        'Review login failure frequency for brute-force indicators',
        'Implement account lockout after N failed attempts',
        'Enable Multi-Factor Authentication (MFA) for sensitive accounts',
        'Check authentication backend (LDAP, database, SSO) connectivity',
        'Implement rate limiting on login endpoints',
      ],
    },
  },
  {
    id: 'AUTH_TOKEN_EXPIRED',
    name: 'JWT/Session Token Expired',
    category: 'authentication',
    patterns: [
      /token.*expired/i,
      /jwt.*expired/i,
      /session.*expired/i,
      /TokenExpiredError/i,
      /invalid.*token/i,
      /token.*invalid/i,
    ],
    keywords: ['token expired', 'JWT', 'session expired', 'TokenExpiredError'],
    errorCodes: ['TokenExpiredError'],
    severity: 'LOW',
    severityModifiers: [
      {
        condition: /service[\s-]to[\s-]service|machine|internal/i,
        severity: 'HIGH',
        reason: 'Service-to-service token expiration can cause cascading failures',
      },
    ],
    explanation: {
      summary:
        'An authentication token (JWT or session) has expired and is no longer valid. The client must re-authenticate to obtain a new token.',
      rootCause:
        'The token\'s expiration time (exp claim) has passed, invalidating the session.',
      possibleCauses: [
        'Token TTL is too short for the use case',
        'Client is not refreshing tokens before expiry',
        'Clock skew between servers causing premature expiration',
        'User session deliberately timed out for security',
        'Refresh token is also expired (no valid way to renew)',
      ],
      recommendedFixes: [
        'Implement token refresh logic in the client application',
        'Adjust token TTL to match the expected session duration',
        'Synchronize server clocks using NTP',
        'Implement sliding window sessions for active users',
        'Return clear 401 responses with a "token_expired" error code',
      ],
    },
  },
  {
    id: 'AUTH_PERMISSION_DENIED',
    name: 'Permission/Authorization Denied',
    category: 'authorization',
    patterns: [
      /permission\s+denied/i,
      /access\s+denied/i,
      /forbidden/i,
      /not\s+authorized/i,
      /insufficient\s+(?:privileges|permissions)/i,
      /EACCES/i,
      /HTTP\s+403/i,
      /403\s+Forbidden/i,
    ],
    keywords: ['permission denied', 'access denied', 'forbidden', '403', 'EACCES'],
    errorCodes: ['EACCES', '403'],
    severity: 'MEDIUM',
    severityModifiers: [
      {
        condition: /admin|root|system|superuser/i,
        severity: 'HIGH',
        reason: 'Permission denial on privileged resources is security-relevant',
      },
    ],
    explanation: {
      summary:
        'An operation was blocked because the user or process lacks the required permissions. The authentication succeeded, but authorization failed.',
      rootCause:
        'The authenticated identity does not have the necessary role or permission to access the requested resource.',
      possibleCauses: [
        'User role does not include the required permission',
        'Resource-level access control (ACL) blocking the request',
        'File system permissions preventing read/write/execute',
        'API endpoint requires elevated privileges',
        'RBAC policy recently changed, revoking access',
        'Service account missing required IAM/role bindings',
      ],
      recommendedFixes: [
        'Verify the user\'s role and permissions in the access control system',
        'Grant the necessary permission via RBAC/IAM if appropriate',
        'Check file ownership and permissions: ls -la / icacls',
        'Review recent permission or role policy changes',
        'Use the principle of least privilege — grant only what is needed',
        'Audit authorization failures for potential security incidents',
      ],
    },
  },
  {
    id: 'AUTH_BRUTE_FORCE',
    name: 'Brute Force Attack Detected',
    category: 'security',
    patterns: [
      /brute[\s-]?force/i,
      /too\s+many\s+(?:failed\s+)?(?:login|auth)\s+attempts/i,
      /account\s+locked.*(?:failed|attempts)/i,
      /rate\s+limit.*(?:auth|login)/i,
      /multiple\s+failed\s+login/i,
    ],
    keywords: ['brute force', 'account locked', 'too many attempts', 'failed login attempts'],
    severity: 'CRITICAL',
    explanation: {
      summary:
        'Multiple rapid, failed login attempts were detected, indicating a potential brute-force attack against user accounts.',
      rootCause:
        'An automated system or attacker is systematically guessing credentials to gain unauthorized access.',
      possibleCauses: [
        'Active brute-force attack from a malicious actor',
        'Credential stuffing using leaked password databases',
        'Misconfigured automated system retrying with wrong credentials',
        'Password spray attack across multiple accounts',
        'Bot traffic targeting the login endpoint',
      ],
      recommendedFixes: [
        'Block the offending IP addresses immediately',
        'Enable account lockout after 5 failed attempts',
        'Implement CAPTCHA on the login page after 3 failures',
        'Deploy Web Application Firewall (WAF) rules',
        'Enable Multi-Factor Authentication (MFA) organization-wide',
        'Monitor and alert on abnormal login failure rates',
        'Review access logs for additional indicators of compromise',
      ],
    },
  },
];
