import { LogPattern } from '../types';

// ──────────────────────────────────────────────────────────
// Configuration & Deployment Patterns
// ──────────────────────────────────────────────────────────

export const configPatterns: LogPattern[] = [
  {
    id: 'CFG_ENV_MISSING',
    name: 'Missing Environment Variable',
    category: 'configuration',
    patterns: [
      /(?:env|environment)\s*(?:var|variable)?.*(?:missing|not\s+set|undefined|not\s+found|required)/i,
      /missing\s+(?:required\s+)?(?:env|environment|config)/i,
      /undefined.*(?:env|environment|config|process\.env)/i,
      /config.*(?:not\s+found|missing|required)/i,
    ],
    keywords: ['environment variable', 'env missing', 'config not found', 'undefined env'],
    severity: 'HIGH',
    explanation: {
      summary:
        'A required environment variable or configuration value is missing. The application may fail to start or behave incorrectly.',
      rootCause:
        'The deployment environment does not have a required configuration variable set.',
      possibleCauses: [
        '.env file not present or not loaded',
        'Environment variable not set in the deployment platform (Docker, Kubernetes, PaaS)',
        'Variable name misspelled in code or configuration',
        'Config file not included in the deployment package',
        'Environment-specific config not applied (dev vs prod)',
        'Secrets manager (Vault, AWS Secrets Manager) not accessible',
      ],
      recommendedFixes: [
        'Verify all required environment variables are set: printenv / echo $VAR',
        'Check the .env file exists and is loaded by the application',
        'Cross-reference with .env.example for required variables',
        'Set the variable in your deployment platform configuration',
        'Implement startup validation that fails fast on missing config',
        'Use a config validation library (e.g., Joi, zod) at boot time',
      ],
    },
  },
  {
    id: 'CFG_PORT_CONFLICT',
    name: 'Port Configuration Conflict',
    category: 'configuration',
    patterns: [
      /port.*(?:conflict|mismatch|incorrect)/i,
      /listen.*(?:EACCES|EADDRINUSE)/i,
      /permission\s+denied.*port/i,
    ],
    keywords: ['port conflict', 'EACCES port', 'port permission'],
    errorCodes: ['EACCES'],
    severity: 'MEDIUM',
    explanation: {
      summary:
        'The application cannot bind to the configured port due to a conflict, permission issue, or misconfiguration.',
      rootCause:
        'The specified port is either in use, requires elevated privileges, or is misconfigured.',
      possibleCauses: [
        'Port below 1024 requires root/admin privileges',
        'Another process already using the port (see NET_PORT_IN_USE)',
        'Port number misconfigured in environment variables',
        'Container port mapping conflict',
      ],
      recommendedFixes: [
        'Use a port above 1024 to avoid privilege requirements',
        'Check and kill conflicting processes on the port',
        'Verify port configuration in .env and Docker Compose',
        'Grant the application CAP_NET_BIND_SERVICE capability if needed',
      ],
    },
  },
  {
    id: 'CFG_DEPENDENCY_ERROR',
    name: 'Module/Dependency Not Found',
    category: 'application',
    patterns: [
      /cannot\s+find\s+module/i,
      /MODULE_NOT_FOUND/i,
      /ModuleNotFoundError/i,
      /ImportError.*No\s+module\s+named/i,
      /ClassNotFoundException/i,
      /require.*not\s+found/i,
    ],
    keywords: ['cannot find module', 'MODULE_NOT_FOUND', 'ImportError', 'dependency'],
    errorCodes: ['MODULE_NOT_FOUND'],
    severity: 'HIGH',
    explanation: {
      summary:
        'The application failed to load a required module or dependency. It cannot start or function correctly without it.',
      rootCause:
        'A required package is not installed, or the import path is incorrect.',
      possibleCauses: [
        'npm install / pip install was not run after adding a dependency',
        'Package was removed from node_modules (corrupted installation)',
        'Import path or module name is misspelled',
        'Package version incompatibility',
        'Monorepo workspace linking not configured correctly',
        'Build/transpilation step skipped, missing compiled output',
      ],
      recommendedFixes: [
        'Run the package manager install: npm install / pip install -r requirements.txt',
        'Delete node_modules/vendor and reinstall: rm -rf node_modules && npm install',
        'Verify the package is listed in package.json or requirements.txt',
        'Check for typos in the import statement',
        'Ensure the build step completes before running the application',
        'Verify package version compatibility with your runtime version',
      ],
    },
  },
];
