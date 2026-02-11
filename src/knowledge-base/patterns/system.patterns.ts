import { LogPattern } from '../types';

// ──────────────────────────────────────────────────────────
// System Resource Patterns (Memory, Disk, CPU, Process)
// ──────────────────────────────────────────────────────────

export const systemPatterns: LogPattern[] = [
  {
    id: 'SYS_OOM',
    name: 'Out of Memory (OOM)',
    category: 'memory',
    patterns: [
      /out\s+of\s+memory/i,
      /OOM\s*(?:killer|kill)/i,
      /cannot\s+allocate\s+memory/i,
      /ENOMEM/i,
      /heap\s+out\s+of\s+memory/i,
      /JavaScript\s+heap\s+out\s+of\s+memory/i,
      /java\.lang\.OutOfMemoryError/i,
      /MemoryError/i,
      /fatal\s+error.*allocation\s+failed/i,
    ],
    keywords: ['out of memory', 'OOM', 'ENOMEM', 'heap', 'MemoryError'],
    errorCodes: ['ENOMEM'],
    severity: 'CRITICAL',
    explanation: {
      summary:
        'The system or application ran out of available memory. The OS may have terminated the process (OOM killer) or the application crashed due to heap exhaustion.',
      rootCause:
        'Memory consumption exceeded the available physical or allocated heap memory.',
      possibleCauses: [
        'Memory leak in the application (objects not being garbage collected)',
        'Processing a dataset too large to fit in memory',
        'Insufficient server memory for the workload',
        'Too many concurrent processes/requests consuming memory',
        'Container memory limit set too low',
        'Java/Node.js heap size not configured for the workload',
      ],
      recommendedFixes: [
        'Profile memory usage to identify leaks (e.g., node --inspect, VisualVM)',
        'Increase available memory or container memory limits',
        'For Node.js: increase heap with --max-old-space-size=4096',
        'For Java: increase heap with -Xmx and -Xms JVM flags',
        'Implement pagination or streaming for large data processing',
        'Review and fix memory leaks: unclosed connections, growing caches, event listener accumulation',
        'Set up memory usage alerts before OOM threshold is reached',
      ],
    },
  },
  {
    id: 'SYS_DISK_FULL',
    name: 'Disk Space Full',
    category: 'disk',
    patterns: [
      /no\s+space\s+left\s+on\s+device/i,
      /disk\s+(?:full|space.*(?:low|critical|exhausted))/i,
      /ENOSPC/i,
      /filesystem.*(?:full|100%)/i,
      /write.*failed.*no\s+space/i,
    ],
    keywords: ['no space left', 'disk full', 'ENOSPC', 'filesystem full'],
    errorCodes: ['ENOSPC'],
    severity: 'CRITICAL',
    explanation: {
      summary:
        'The disk or filesystem has run out of available storage space. Write operations will fail until space is freed.',
      rootCause:
        'All available disk space on the target filesystem/partition has been consumed.',
      possibleCauses: [
        'Log files have grown excessively large without rotation',
        'Temporary files accumulating without cleanup',
        'Database data files consuming all available disk space',
        'Application generating excessive output or cache files',
        'Docker images/volumes consuming disk space',
        'Large file uploads or backups exhausting storage',
      ],
      recommendedFixes: [
        'Check disk usage: df -h (Linux) / Get-PSDrive (Windows)',
        'Find large files: du -sh /* --max-depth=2 or ncdu',
        'Implement log rotation using logrotate or similar tools',
        'Clean up old logs, temp files, and unused Docker images',
        'Expand the disk/volume if possible',
        'Set up disk usage monitoring and alerts at 80% threshold',
        'Move large data to a dedicated storage volume',
      ],
    },
  },
  {
    id: 'SYS_CPU_HIGH',
    name: 'High CPU Utilization',
    category: 'cpu',
    patterns: [
      /cpu\s+(?:usage|utilization).*(?:high|100|9[0-9])/i,
      /load\s+average.*(?:high|critical)/i,
      /cpu.*(?:spike|overload|throttl)/i,
      /process.*consuming.*cpu/i,
    ],
    keywords: ['CPU high', 'CPU usage', 'load average', 'CPU spike', 'CPU throttl'],
    severity: 'HIGH',
    severityModifiers: [
      {
        condition: /100%|sustained|prolonged/i,
        severity: 'CRITICAL',
        reason: 'Sustained 100% CPU will degrade all services on the host',
      },
    ],
    explanation: {
      summary:
        'CPU utilization has reached a very high level, potentially causing slow response times, timeouts, and degraded performance for all processes on the system.',
      rootCause:
        'One or more processes are consuming excessive CPU resources.',
      possibleCauses: [
        'Infinite loop or CPU-intensive computation in application code',
        'Unoptimized database queries causing excessive server-side processing',
        'Sudden traffic spike overwhelming the application',
        'Background processes (backups, cron jobs) competing for CPU',
        'Insufficient CPU capacity for the current workload',
        'Cryptomining malware consuming CPU resources',
      ],
      recommendedFixes: [
        'Identify the high-CPU process: top / htop / Task Manager',
        'Profile the application to find CPU-intensive code paths',
        'Optimize hot code paths and reduce computational complexity',
        'Scale horizontally (add more instances) or vertically (add more CPU)',
        'Schedule CPU-intensive background tasks during off-peak hours',
        'Implement request throttling to prevent traffic spikes from overloading',
        'Check for and remove any unauthorized processes (malware)',
      ],
    },
  },
  {
    id: 'SYS_PROCESS_CRASH',
    name: 'Process Crash / Segmentation Fault',
    category: 'process',
    patterns: [
      /segmentation\s+fault/i,
      /segfault/i,
      /SIGSEGV/i,
      /SIGABRT/i,
      /core\s+dumped/i,
      /process.*(?:crash|died|terminated|killed)/i,
      /unhandled\s+(?:exception|error|rejection)/i,
      /fatal\s+error/i,
    ],
    keywords: ['segfault', 'SIGSEGV', 'core dump', 'crash', 'fatal error', 'unhandled exception'],
    errorCodes: ['SIGSEGV', 'SIGABRT', 'SIGKILL'],
    severity: 'CRITICAL',
    explanation: {
      summary:
        'A process has crashed unexpectedly, potentially causing a complete service outage. A core dump may have been generated for debugging.',
      rootCause:
        'The process encountered a fatal error (memory violation, unhandled exception, or signal) that forced termination.',
      possibleCauses: [
        'Null pointer dereference or buffer overflow (native code)',
        'Unhandled exception or promise rejection (managed code)',
        'Stack overflow from deep recursion',
        'OOM killer terminated the process (see SYS_OOM)',
        'Corrupt application binary or shared library',
        'Hardware failure (faulty RAM, disk errors)',
      ],
      recommendedFixes: [
        'Check the core dump or crash report for the exact error location',
        'Review application logs immediately before the crash',
        'Set up process manager (PM2, systemd) for automatic restart',
        'Add global exception/rejection handlers in your application',
        'Run memory diagnostics: memtest86+ / Windows Memory Diagnostic',
        'Update dependencies and runtime to patch known crash bugs',
        'Implement graceful shutdown and health checks',
      ],
    },
  },
  {
    id: 'SYS_FILE_NOT_FOUND',
    name: 'File or Directory Not Found',
    category: 'filesystem',
    patterns: [
      /no\s+such\s+file\s+or\s+directory/i,
      /ENOENT/i,
      /FileNotFoundException/i,
      /file\s+not\s+found/i,
      /path.*(?:does\s+not\s+exist|not\s+found)/i,
    ],
    keywords: ['ENOENT', 'file not found', 'no such file', 'FileNotFoundException'],
    errorCodes: ['ENOENT'],
    severity: 'MEDIUM',
    severityModifiers: [
      {
        condition: /config|env|\.env|settings|application\.(?:yml|properties)/i,
        severity: 'HIGH',
        reason: 'Missing configuration file can prevent application startup',
      },
    ],
    explanation: {
      summary:
        'The application attempted to access a file or directory that does not exist at the specified path.',
      rootCause:
        'The referenced file path is incorrect, the file was not created, or it was deleted/moved.',
      possibleCauses: [
        'Incorrect file path in configuration or code',
        'File was deleted, moved, or renamed',
        'Volume or mount not attached (Docker, NFS)',
        'Application running from an unexpected working directory',
        'Missing build artifact (not compiled/built yet)',
        'Environment-specific path not set correctly',
      ],
      recommendedFixes: [
        'Verify the file exists at the expected path: ls / dir',
        'Check the working directory of the application process',
        'Use absolute paths instead of relative paths in configuration',
        'Ensure all required files are included in the deployment package',
        'Check Docker volume mounts if running in a container',
        'Verify file permissions allow read access',
      ],
    },
  },
];
