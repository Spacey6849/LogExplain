import { LogPattern } from '../types';

// ──────────────────────────────────────────────────────────
// Kubernetes & Container Orchestration Patterns
// ──────────────────────────────────────────────────────────

export const kubernetesPatterns: LogPattern[] = [
    {
        id: 'K8S_POD_CRASHLOOP',
        name: 'Pod CrashLoopBackOff',
        category: 'kubernetes',
        patterns: [
            /CrashLoopBackOff/i,
            /Back-off\s+restarting\s+failed\s+container/i,
            /back-off.*restart/i,
            /container.*crash.*loop/i,
        ],
        keywords: ['CrashLoopBackOff', 'restart', 'back-off', 'pod crash'],
        severity: 'CRITICAL',
        explanation: {
            summary:
                'A Kubernetes pod is stuck in a CrashLoopBackOff state — the container keeps crashing and Kubernetes is repeatedly restarting it with increasing delays.',
            rootCause:
                'The container process exits with a non-zero exit code immediately after starting, triggering Kubernetes restart policy.',
            possibleCauses: [
                'Application crashes on startup due to missing configuration or environment variables',
                'Missing or inaccessible dependency (database, API, secret)',
                'Incorrect container entrypoint or command',
                'Insufficient memory causing OOM kills',
                'Liveness probe failing immediately after startup',
                'Application binary not found in the container image',
            ],
            recommendedFixes: [
                'Check container logs: kubectl logs <pod-name> --previous',
                'Describe the pod to see events: kubectl describe pod <pod-name>',
                'Verify environment variables and ConfigMaps are correctly mounted',
                'Check if the container image tag exists and is pullable',
                'Increase memory/CPU resource limits if OOM killed',
                'Adjust liveness probe initialDelaySeconds to give the app time to start',
            ],
        },
    },
    {
        id: 'K8S_IMAGE_PULL_FAIL',
        name: 'Image Pull Failed',
        category: 'kubernetes',
        patterns: [
            /ImagePullBackOff/i,
            /ErrImagePull/i,
            /Failed\s+to\s+pull\s+image/i,
            /image.*(?:not\s+found|pull\s+error)/i,
            /repository\s+does\s+not\s+exist/i,
        ],
        keywords: ['ImagePullBackOff', 'ErrImagePull', 'image pull', 'pull failed'],
        severity: 'HIGH',
        explanation: {
            summary:
                'Kubernetes failed to pull the container image from the registry. The pod cannot start until the image is available.',
            rootCause:
                'The container image specified in the pod spec could not be downloaded from the container registry.',
            possibleCauses: [
                'Image tag does not exist in the registry',
                'Registry authentication credentials are missing or expired',
                'Private registry requires imagePullSecrets not configured in the pod spec',
                'Network connectivity issue between the node and the registry',
                'Image name has a typo',
                'Registry rate limiting (Docker Hub) is blocking the pull',
            ],
            recommendedFixes: [
                'Verify the image exists: docker pull <image>:<tag>',
                'Check imagePullSecrets are configured: kubectl get pod <name> -o yaml',
                'Ensure registry credentials are valid and not expired',
                'For Docker Hub rate limits, use authenticated pulls or a mirror',
                'Check node network connectivity to the container registry',
                'Use a specific image tag instead of :latest for reliability',
            ],
        },
    },
    {
        id: 'K8S_OOM_KILLED',
        name: 'Container OOMKilled',
        category: 'kubernetes',
        patterns: [
            /OOMKilled/i,
            /container.*killed.*oom/i,
            /memory\s+cgroup\s+out\s+of\s+memory/i,
            /Killed\s+process.*oom/i,
            /exit\s+code\s+137/i,
        ],
        keywords: ['OOMKilled', 'exit code 137', 'out of memory', 'cgroup', 'killed'],
        errorCodes: ['137'],
        severity: 'CRITICAL',
        explanation: {
            summary:
                'The container was killed by Kubernetes because it exceeded its memory limit. Exit code 137 indicates the process was terminated by SIGKILL from the OOM killer.',
            rootCause:
                'The container consumed more memory than the configured resource limit, triggering the Kubernetes OOM killer.',
            possibleCauses: [
                'Memory limit set too low for the workload',
                'Memory leak in the application',
                'Spike in traffic causing increased memory usage',
                'Large objects cached in memory without eviction',
                'JVM heap size exceeds container memory limit',
            ],
            recommendedFixes: [
                'Increase memory limits: resources.limits.memory in the pod spec',
                'Profile the application for memory leaks',
                'For JVM apps, set -Xmx to 75% of the container memory limit',
                'Implement memory-efficient data processing (streaming vs. loading all)',
                'Add memory usage monitoring and alerts before hitting the limit',
                'Use Vertical Pod Autoscaler (VPA) to right-size resources',
            ],
        },
    },
    {
        id: 'K8S_NODE_NOT_READY',
        name: 'Node NotReady',
        category: 'kubernetes',
        patterns: [
            /node.*NotReady/i,
            /NodeNotReady/i,
            /node\s+condition.*Ready.*False/i,
            /kubelet\s+stopped\s+posting\s+node\s+status/i,
        ],
        keywords: ['NotReady', 'NodeNotReady', 'node condition', 'kubelet'],
        severity: 'CRITICAL',
        explanation: {
            summary:
                'A Kubernetes node has entered NotReady state. Pods on this node may be evicted and rescheduled to healthy nodes.',
            rootCause:
                'The kubelet on the node has stopped reporting its status to the API server, or the node has failed health checks.',
            possibleCauses: [
                'Kubelet process crashed or is unresponsive',
                'Node ran out of disk space, memory, or PIDs',
                'Network partition between the node and the control plane',
                'Underlying VM/machine has crashed or been terminated',
                'Docker/containerd runtime is unresponsive',
                'Kernel panic or hardware failure',
            ],
            recommendedFixes: [
                'SSH into the node and check kubelet status: systemctl status kubelet',
                'Check node resource pressure: kubectl describe node <node-name>',
                'Review kubelet logs: journalctl -u kubelet',
                'Verify network connectivity between the node and the API server',
                'Cordon and drain the node if it needs maintenance: kubectl drain <node>',
                'Replace the node if the underlying hardware has failed',
            ],
        },
    },
    {
        id: 'K8S_LIVENESS_FAIL',
        name: 'Liveness/Readiness Probe Failed',
        category: 'kubernetes',
        patterns: [
            /Liveness\s+probe\s+failed/i,
            /Readiness\s+probe\s+failed/i,
            /probe\s+failed.*HTTP\s+probe/i,
            /Startup\s+probe\s+failed/i,
            /Unhealthy/i,
        ],
        keywords: ['liveness probe', 'readiness probe', 'health check', 'unhealthy'],
        severity: 'HIGH',
        explanation: {
            summary:
                'A Kubernetes health probe (liveness, readiness, or startup) has failed. If liveness fails, the container will be restarted. If readiness fails, traffic will stop being routed to the pod.',
            rootCause:
                'The probe endpoint returned a non-success HTTP status, or the TCP/command check failed within the timeout.',
            possibleCauses: [
                'Application is overloaded and cannot respond to health checks in time',
                'Health check endpoint has a bug or dependency on a slow service',
                'Probe timeout is too short for the application startup time',
                'Wrong port or path configured for the probe',
                'Application deadlock preventing the health endpoint from responding',
            ],
            recommendedFixes: [
                'Increase probe timeoutSeconds and failureThreshold',
                'Ensure the health endpoint is lightweight and has no external dependencies',
                'Add a startup probe with generous timing for slow-starting applications',
                'Verify probe port matches the containerPort',
                'Check application logs at the time of probe failures',
                'Separate liveness (is it running?) from readiness (can it serve traffic?)',
            ],
        },
    },
    {
        id: 'K8S_EVICTION',
        name: 'Pod Evicted',
        category: 'kubernetes',
        patterns: [
            /pod.*evict/i,
            /Evicted/i,
            /The\s+node\s+was\s+low\s+on\s+resource/i,
            /eviction.*threshold/i,
            /DiskPressure/i,
            /MemoryPressure/i,
            /PIDPressure/i,
        ],
        keywords: ['evicted', 'eviction', 'DiskPressure', 'MemoryPressure', 'PIDPressure'],
        severity: 'HIGH',
        explanation: {
            summary:
                'A pod was evicted from its node due to resource pressure (disk, memory, or PIDs). The pod will need to be rescheduled to another node.',
            rootCause:
                'The node exceeded its eviction threshold for one or more resources, forcing Kubernetes to reclaim capacity by evicting pods.',
            possibleCauses: [
                'Node disk usage exceeded the eviction threshold (typically 85-90%)',
                'Container logs consuming excessive disk space',
                'Temporary files or emptyDir volumes growing without bound',
                'Too many processes (PID exhaustion) on the node',
                'Memory pressure from other pods on the same node',
            ],
            recommendedFixes: [
                'Clean up old pods: kubectl delete pod --field-selector=status.phase==Failed',
                'Implement log rotation and size limits for container logs',
                'Set resource requests and limits on all pods for fair scheduling',
                'Add more nodes to the cluster to distribute load',
                'Use pod priority and preemption to protect critical workloads',
                'Monitor node resources with Prometheus/Grafana or cloud monitoring',
            ],
        },
    },
    {
        id: 'K8S_RBAC_DENIED',
        name: 'RBAC Permission Denied',
        category: 'kubernetes',
        patterns: [
            /forbidden.*RBAC/i,
            /cannot.*(?:get|list|watch|create|update|delete).*(?:pods|services|deployments|secrets)/i,
            /User.*cannot/i,
            /is\s+forbidden/i,
        ],
        keywords: ['forbidden', 'RBAC', 'cannot', 'permission', 'service account'],
        severity: 'HIGH',
        explanation: {
            summary:
                'A Kubernetes RBAC policy denied the requested operation. The user or service account lacks the required permissions.',
            rootCause:
                'The authenticated identity does not have a ClusterRole/Role or ClusterRoleBinding/RoleBinding granting the necessary permissions.',
            possibleCauses: [
                'Service account not assigned the required Role or ClusterRole',
                'RoleBinding is in the wrong namespace',
                'ClusterRole permissions are too restrictive',
                'RBAC policy was recently changed or tightened',
                'Using the default service account which has minimal permissions',
            ],
            recommendedFixes: [
                'Check current permissions: kubectl auth can-i --as=system:serviceaccount:<ns>:<sa> <verb> <resource>',
                'Create or update the Role/ClusterRole with the needed permissions',
                'Bind the role to the service account with a RoleBinding',
                'Avoid using cluster-admin in production — follow least privilege',
                'Review RBAC policies: kubectl get clusterrolebindings -o wide',
            ],
        },
    },
];
