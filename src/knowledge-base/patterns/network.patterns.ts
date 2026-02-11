import { LogPattern } from '../types';

// ──────────────────────────────────────────────────────────
// Network Log Patterns
// ──────────────────────────────────────────────────────────

export const networkPatterns: LogPattern[] = [
  {
    id: 'NET_CONN_TIMEOUT',
    name: 'Network Connection Timeout',
    category: 'network',
    patterns: [
      /ETIMEDOUT/i,
      /connection\s+timed?\s*out/i,
      /connect\s+ETIMEDOUT/i,
      /network\s+timeout/i,
      /socket\s+timeout/i,
    ],
    keywords: ['ETIMEDOUT', 'connection timeout', 'socket timeout'],
    errorCodes: ['ETIMEDOUT'],
    severity: 'HIGH',
    explanation: {
      summary:
        'A network connection attempt to a remote host timed out. The target server did not respond within the allowed time window.',
      rootCause:
        'The remote host is unreachable or too slow to respond within the timeout period.',
      possibleCauses: [
        'Remote server is down or unreachable',
        'Firewall blocking outbound or inbound traffic on the target port',
        'DNS resolution returning incorrect IP address',
        'Network congestion or packet loss along the route',
        'Timeout value set too low for the expected response time',
        'Target service overloaded and not accepting connections',
      ],
      recommendedFixes: [
        'Test connectivity to the target host: ping / traceroute / curl',
        'Verify firewall and security group rules allow the connection',
        'Check DNS resolution: nslookup / dig for the target hostname',
        'Increase the connection timeout value if appropriate',
        'Contact the remote service operator to verify service health',
        'Implement retry logic with exponential backoff',
      ],
    },
  },
  {
    id: 'NET_DNS_FAILURE',
    name: 'DNS Resolution Failure',
    category: 'dns',
    patterns: [
      /ENOTFOUND/i,
      /getaddrinfo\s+ENOTFOUND/i,
      /DNS.*(?:fail|error|timeout)/i,
      /name\s+resolution.*failed/i,
      /could\s+not\s+resolve\s+host/i,
      /NXDOMAIN/i,
    ],
    keywords: ['ENOTFOUND', 'DNS', 'name resolution', 'getaddrinfo'],
    errorCodes: ['ENOTFOUND', 'NXDOMAIN'],
    severity: 'HIGH',
    explanation: {
      summary:
        'The system failed to resolve a hostname to an IP address via DNS. The requested domain name could not be found.',
      rootCause:
        'DNS lookup failed — the hostname does not exist, DNS servers are unreachable, or there is a misconfiguration.',
      possibleCauses: [
        'Hostname is misspelled in the configuration',
        'Domain name does not exist or has expired',
        'DNS server is down or unreachable',
        'Network partitioning preventing DNS queries',
        'DNS cache poisoning or stale cached records',
        '/etc/resolv.conf or OS DNS settings misconfigured',
      ],
      recommendedFixes: [
        'Verify the hostname spelling in your configuration',
        'Test DNS resolution manually: nslookup <hostname> or dig <hostname>',
        'Check /etc/resolv.conf (Linux) or network DNS settings',
        'Try using a public DNS server (8.8.8.8) temporarily to isolate the issue',
        'Flush DNS cache: systemd-resolve --flush-caches / ipconfig /flushdns',
        'Verify the domain is registered and not expired',
      ],
    },
  },
  {
    id: 'NET_CONN_RESET',
    name: 'Connection Reset by Peer',
    category: 'network',
    patterns: [
      /ECONNRESET/i,
      /connection\s+reset\s+by\s+peer/i,
      /read\s+ECONNRESET/i,
      /broken\s+pipe/i,
      /EPIPE/i,
    ],
    keywords: ['ECONNRESET', 'connection reset', 'broken pipe', 'EPIPE'],
    errorCodes: ['ECONNRESET', 'EPIPE'],
    severity: 'MEDIUM',
    severityModifiers: [
      {
        condition: /repeated|multiple|frequent/i,
        severity: 'HIGH',
        reason: 'Frequent connection resets indicate a systemic issue',
      },
    ],
    explanation: {
      summary:
        'The remote server forcibly closed the connection while data was being transferred. This is an abrupt termination, not a graceful disconnect.',
      rootCause:
        'The peer terminated the TCP connection unexpectedly, possibly due to a crash, timeout, or load balancer eviction.',
      possibleCauses: [
        'Remote server crashed or restarted during the request',
        'Load balancer terminated an idle or long-running connection',
        'Server-side timeout or max request size exceeded',
        'TLS/SSL handshake failure causing abrupt disconnect',
        'Network device (proxy/firewall) dropping long-lived connections',
        'Server resource exhaustion forcing connection termination',
      ],
      recommendedFixes: [
        'Implement retry logic with exponential backoff for transient failures',
        'Check the remote server\'s health and error logs',
        'Review load balancer timeout and keepalive settings',
        'Ensure request payloads are within server-side size limits',
        'Use HTTP keep-alive headers correctly',
        'Monitor connection reset frequency to identify patterns',
      ],
    },
  },
  {
    id: 'NET_SSL_ERROR',
    name: 'SSL/TLS Handshake Error',
    category: 'ssl_tls',
    patterns: [
      /SSL.*(?:handshake|error|fail)/i,
      /TLS.*(?:handshake|error|fail)/i,
      /certificate.*(?:expired|invalid|untrusted|verify)/i,
      /UNABLE_TO_VERIFY_LEAF_SIGNATURE/i,
      /CERT_HAS_EXPIRED/i,
      /DEPTH_ZERO_SELF_SIGNED_CERT/i,
      /ERR_TLS_CERT_ALTNAME_INVALID/i,
      /self[\s-]signed\s+certificate/i,
    ],
    keywords: ['SSL', 'TLS', 'certificate', 'handshake', 'self-signed'],
    errorCodes: [
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'CERT_HAS_EXPIRED',
      'DEPTH_ZERO_SELF_SIGNED_CERT',
      'ERR_TLS_CERT_ALTNAME_INVALID',
    ],
    severity: 'HIGH',
    severityModifiers: [
      {
        condition: /expired/i,
        severity: 'CRITICAL',
        reason: 'Expired certificate will break all HTTPS connections',
      },
    ],
    explanation: {
      summary:
        'A TLS/SSL connection could not be established due to a certificate problem. The secure connection was rejected.',
      rootCause:
        'The SSL/TLS certificate is invalid, expired, self-signed, or does not match the expected hostname.',
      possibleCauses: [
        'SSL certificate has expired and not been renewed',
        'Self-signed certificate used in a production environment',
        'Certificate does not match the domain (CN/SAN mismatch)',
        'Missing intermediate CA certificate in the chain',
        'TLS version or cipher suite mismatch between client and server',
        'System CA certificate bundle is outdated',
      ],
      recommendedFixes: [
        'Check certificate expiry: openssl s_client -connect <host>:443',
        'Renew the expired certificate via your CA or Let\'s Encrypt',
        'Ensure the full certificate chain (including intermediates) is installed',
        'Verify the certificate covers the correct hostname (CN/SAN)',
        'Update the system CA certificates: update-ca-certificates',
        'Do NOT disable TLS validation in production (NODE_TLS_REJECT_UNAUTHORIZED=0)',
      ],
    },
  },
  {
    id: 'NET_PORT_IN_USE',
    name: 'Port Already in Use',
    category: 'network',
    patterns: [
      /EADDRINUSE/i,
      /address\s+already\s+in\s+use/i,
      /port.*already\s+(?:in\s+use|bound|taken)/i,
      /bind.*EADDRINUSE/i,
    ],
    keywords: ['EADDRINUSE', 'address in use', 'port in use'],
    errorCodes: ['EADDRINUSE'],
    severity: 'MEDIUM',
    explanation: {
      summary:
        'The application failed to start because the requested port is already being used by another process.',
      rootCause:
        'Another process is already listening on the same port, preventing this application from binding.',
      possibleCauses: [
        'A previous instance of the application is still running',
        'Another service is using the same port',
        'Application crashed without releasing the port (lingering socket)',
        'Docker container or VM still holding the port',
        'OS-level port reservation conflict',
      ],
      recommendedFixes: [
        'Find the process using the port: lsof -i :<port> (Linux) or netstat -ano | findstr :<port> (Windows)',
        'Kill the conflicting process or change your application port',
        'Wait for TIME_WAIT socket state to expire (or enable SO_REUSEADDR)',
        'Check for zombie processes: ps aux | grep <app_name>',
        'Use a different port via environment configuration',
      ],
    },
  },
];
