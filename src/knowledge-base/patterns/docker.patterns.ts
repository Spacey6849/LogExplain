import { LogPattern } from '../types';

// ──────────────────────────────────────────────────────────
// Docker & Container Runtime Patterns
// ──────────────────────────────────────────────────────────

export const dockerPatterns: LogPattern[] = [
    {
        id: 'DOCKER_DAEMON_ERROR',
        name: 'Docker Daemon Error',
        category: 'docker',
        patterns: [
            /docker\s+daemon.*(?:error|fail|not\s+running)/i,
            /Cannot\s+connect\s+to\s+the\s+Docker\s+daemon/i,
            /Is\s+the\s+docker\s+daemon\s+running/i,
            /docker\.sock.*(?:permission|denied|not\s+found)/i,
        ],
        keywords: ['docker daemon', 'docker.sock', 'dockerd', 'daemon not running'],
        severity: 'CRITICAL',
        explanation: {
            summary:
                'The Docker daemon is not running or not accessible. All container operations will fail until the daemon is restored.',
            rootCause:
                'The Docker daemon process (dockerd) is not running, or the current user lacks permission to access the Docker socket.',
            possibleCauses: [
                'Docker daemon crashed or was stopped',
                'Docker socket permissions prevent access (need sudo or docker group)',
                'systemd service for Docker failed to start',
                'Disk space exhaustion preventing daemon operations',
                'Docker configuration file is corrupted or invalid',
            ],
            recommendedFixes: [
                'Start the Docker daemon: sudo systemctl start docker',
                'Check daemon status: sudo systemctl status docker',
                'Add user to docker group: sudo usermod -aG docker $USER',
                'Check daemon logs: journalctl -u docker.service',
                'Verify disk space is available for Docker: df -h /var/lib/docker',
            ],
        },
    },
    {
        id: 'DOCKER_BUILD_FAIL',
        name: 'Docker Build Failed',
        category: 'docker',
        patterns: [
            /(?:docker|buildx?)\s+build.*(?:error|fail)/i,
            /COPY\s+failed.*(?:file\s+not\s+found|no\s+such\s+file)/i,
            /RUN.*returned\s+a\s+non-zero\s+code/i,
            /failed\s+to\s+compute\s+cache\s+key/i,
            /executor\s+failed\s+running/i,
        ],
        keywords: ['docker build', 'Dockerfile', 'build failed', 'COPY failed', 'RUN failed'],
        severity: 'HIGH',
        explanation: {
            summary:
                'A Docker image build failed during one of its steps. The container image was not created.',
            rootCause:
                'A Dockerfile instruction (RUN, COPY, ADD) failed during build execution.',
            possibleCauses: [
                'File referenced in COPY/ADD does not exist in the build context',
                'RUN command failed (package install error, compilation failure)',
                '.dockerignore is excluding required files',
                'Base image not available or incompatible architecture',
                'Network issues during package downloads in RUN steps',
                'Incorrect working directory (WORKDIR) path',
            ],
            recommendedFixes: [
                'Check that all files referenced in COPY exist relative to the Dockerfile',
                'Review .dockerignore to ensure required files are not excluded',
                'Run failing RUN commands locally to debug the issue',
                'Use multi-stage builds to isolate build dependencies',
                'Pin base image versions instead of using :latest',
                'Add --no-cache flag to rebuild from scratch: docker build --no-cache',
            ],
        },
    },
    {
        id: 'DOCKER_CONTAINER_EXIT',
        name: 'Container Exited Unexpectedly',
        category: 'docker',
        patterns: [
            /container.*exited\s+with\s+code\s+[1-9]/i,
            /Exited\s+\([1-9]\d*\)/i,
            /container.*died/i,
            /process.*exited.*status\s+[1-9]/i,
        ],
        keywords: ['exited', 'container died', 'exit code', 'non-zero'],
        severity: 'HIGH',
        explanation: {
            summary:
                'A Docker container exited with a non-zero exit code, indicating an error or crash. The containerized application terminated unexpectedly.',
            rootCause:
                'The main process inside the container exited with an error code.',
            possibleCauses: [
                'Application crashed due to unhandled exception',
                'Missing environment variables or configuration',
                'Entrypoint script has an error',
                'Dependency service not available (database, API)',
                'Exit code 137 = OOM killed, 139 = segfault, 143 = SIGTERM',
            ],
            recommendedFixes: [
                'Check container logs: docker logs <container-id>',
                'Inspect the exit code: docker inspect <container-id> --format="{{.State.ExitCode}}"',
                'Run interactively to debug: docker run -it <image> /bin/sh',
                'Verify all required environment variables are passed with -e or --env-file',
                'Check if the entrypoint command exists and is executable',
            ],
        },
    },
    {
        id: 'DOCKER_NETWORK_ERROR',
        name: 'Docker Network Error',
        category: 'docker',
        patterns: [
            /docker.*network.*(?:error|fail|not\s+found)/i,
            /failed\s+to\s+(?:create|join|connect)\s+(?:to\s+)?network/i,
            /network\s+.*?\s+not\s+found/i,
            /endpoint.*already\s+exists\s+in\s+network/i,
        ],
        keywords: ['docker network', 'network not found', 'endpoint', 'bridge'],
        severity: 'MEDIUM',
        explanation: {
            summary:
                'A Docker networking operation failed. Containers may not be able to communicate with each other or the outside world.',
            rootCause:
                'The specified Docker network does not exist, is misconfigured, or has a conflict.',
            possibleCauses: [
                'Referenced network was not created before starting the container',
                'Network name typo in docker-compose.yml or docker run command',
                'IP address conflict within the Docker network',
                'Docker network driver issue (bridge, overlay, macvlan)',
                'iptables/firewall rules interfering with Docker networking',
            ],
            recommendedFixes: [
                'Create the network: docker network create <network-name>',
                'List existing networks: docker network ls',
                'Inspect network: docker network inspect <network-name>',
                'Restart Docker daemon to reset networking: sudo systemctl restart docker',
                'Remove stale networks: docker network prune',
            ],
        },
    },
    {
        id: 'DOCKER_VOLUME_ERROR',
        name: 'Docker Volume Mount Error',
        category: 'docker',
        patterns: [
            /volume.*(?:error|fail|not\s+found|permission)/i,
            /bind\s+mount.*(?:denied|error|fail)/i,
            /mount.*(?:denied|error|fail).*container/i,
            /invalid\s+mount\s+config/i,
        ],
        keywords: ['volume', 'mount', 'bind mount', 'volume error'],
        severity: 'HIGH',
        explanation: {
            summary:
                'A Docker volume mount operation failed. The container cannot access the host filesystem or persistent storage as configured.',
            rootCause:
                'The volume mount path is invalid, the source does not exist, or permissions prevent mounting.',
            possibleCauses: [
                'Host directory does not exist',
                'SELinux or AppArmor blocking the mount',
                'Incorrect volume syntax in docker-compose.yml',
                'Windows path format issues when using Docker Desktop',
                'Volume driver is not installed or configured',
            ],
            recommendedFixes: [
                'Ensure the host path exists before mounting',
                'Use named volumes instead of bind mounts for portability',
                'Check SELinux context: add :z or :Z suffix to the volume mount',
                'Verify file ownership inside the container matches the running user',
                'On Windows, ensure the drive is shared in Docker Desktop settings',
            ],
        },
    },
];
