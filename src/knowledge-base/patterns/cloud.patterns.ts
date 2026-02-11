import { LogPattern } from '../types';

// ──────────────────────────────────────────────────────────
// Cloud Infrastructure Patterns (AWS, GCP, Azure)
// ──────────────────────────────────────────────────────────

export const cloudPatterns: LogPattern[] = [
    {
        id: 'CLOUD_LAMBDA_TIMEOUT',
        name: 'Lambda/Cloud Function Timeout',
        category: 'cloud',
        patterns: [
            /Task\s+timed\s+out\s+after\s+\d+.*seconds/i,
            /Lambda.*timeout/i,
            /FUNCTION_INVOCATION_TIMEOUT/i,
            /Function\s+execution\s+took\s+\d+\s+ms.*finished\s+with\s+status.*timeout/i,
            /cloud\s*function.*timed?\s*out/i,
        ],
        keywords: ['Lambda', 'timeout', 'cloud function', 'function invocation', 'serverless'],
        severity: 'HIGH',
        explanation: {
            summary:
                'A serverless function (AWS Lambda, GCP Cloud Function, Azure Function) exceeded its maximum execution time and was terminated.',
            rootCause:
                'The function did not complete within the configured timeout limit.',
            possibleCauses: [
                'Function timeout configured too low for the workload',
                'Slow external API call or database query blocking execution',
                'Cold start adding significant latency',
                'Infinite loop or recursive call in the function code',
                'Large payload processing exceeding time limits',
                'VPC-attached Lambda with slow ENI provisioning',
            ],
            recommendedFixes: [
                'Increase the function timeout setting (max 15 min for Lambda)',
                'Optimize the function code to complete faster',
                'Move long-running work to a queue + worker pattern (SQS, Cloud Tasks)',
                'Use provisioned concurrency to eliminate cold starts',
                'Add connection pooling for database connections',
                'Break large tasks into smaller, chained function invocations',
            ],
        },
    },
    {
        id: 'CLOUD_LAMBDA_MEMORY',
        name: 'Lambda/Function Out of Memory',
        category: 'cloud',
        patterns: [
            /Runtime\.ExitError/i,
            /RequestId.*Process\s+exited\s+before\s+completing/i,
            /FUNCTION_INVOCATION_FAILED/i,
            /memory\s+size.*exceeded/i,
            /Runtime\.OutOfMemory/i,
        ],
        keywords: ['Lambda', 'out of memory', 'function invocation failed', 'Runtime.ExitError'],
        severity: 'HIGH',
        explanation: {
            summary:
                'A serverless function ran out of memory and was terminated. The function was allocated insufficient memory for its workload.',
            rootCause:
                'The function consumed more memory than its configured memory allocation allows.',
            possibleCauses: [
                'Memory allocation set too low for the workload',
                'Large file or data processing consuming excessive memory',
                'Memory leak across warm invocations',
                'Loading too many dependencies at cold start',
                'Buffer overflow from large HTTP response bodies',
            ],
            recommendedFixes: [
                'Increase the function memory allocation',
                'Stream large files instead of loading them entirely into memory',
                'Profile memory usage with AWS Lambda Power Tuning',
                'Implement pagination for large data sets',
                'Clean up resources at the end of each invocation',
            ],
        },
    },
    {
        id: 'CLOUD_S3_ACCESS_DENIED',
        name: 'S3/Storage Access Denied',
        category: 'cloud',
        patterns: [
            /AccessDenied.*(?:S3|s3|bucket)/i,
            /Access\s+Denied.*(?:storage|blob|bucket|object)/i,
            /NoSuchBucket/i,
            /NoSuchKey/i,
            /Storage.*permission.*denied/i,
            /403.*(?:S3|bucket|storage)/i,
        ],
        keywords: ['S3', 'AccessDenied', 'bucket', 'storage', 'NoSuchBucket', 'NoSuchKey'],
        errorCodes: ['AccessDenied', 'NoSuchBucket', 'NoSuchKey', '403'],
        severity: 'HIGH',
        explanation: {
            summary:
                'Access to a cloud storage resource (S3 bucket, GCS bucket, Azure Blob) was denied, or the resource does not exist.',
            rootCause:
                'The IAM identity lacks permissions to access the storage resource, or the resource name is incorrect.',
            possibleCauses: [
                'IAM policy does not grant s3:GetObject, s3:PutObject, etc.',
                'Bucket policy explicitly denies access',
                'Bucket name or object key is incorrect',
                'Bucket is in a different region or account',
                'VPC endpoint policy is restricting access',
                'KMS key access denied for encrypted objects',
            ],
            recommendedFixes: [
                'Check IAM permissions: aws iam simulate-principal-policy',
                'Review the bucket policy for explicit deny statements',
                'Verify the bucket name and object key are correct',
                'Ensure the role has KMS decrypt permissions for encrypted buckets',
                'Check VPC endpoint policy if accessing from within a VPC',
                'Use AWS CloudTrail to investigate the denied API call',
            ],
        },
    },
    {
        id: 'CLOUD_THROTTLING',
        name: 'Cloud API Throttling',
        category: 'cloud',
        patterns: [
            /Throttling/i,
            /Rate\s+exceeded/i,
            /TooManyRequestsException/i,
            /SlowDown/i,
            /ProvisionedThroughputExceededException/i,
            /ThrottlingException/i,
            /API\s+rate\s+limit\s+exceeded/i,
        ],
        keywords: ['throttling', 'rate exceeded', 'SlowDown', 'TooManyRequests', 'provisioned throughput'],
        errorCodes: ['Throttling', 'SlowDown', 'TooManyRequestsException'],
        severity: 'MEDIUM',
        severityModifiers: [
            {
                condition: /repeated|sustained|continuous/i,
                severity: 'HIGH',
                reason: 'Sustained API throttling causes cascading failures and data loss',
            },
        ],
        explanation: {
            summary:
                'Cloud API requests are being throttled — the service is rejecting requests because the rate limit has been exceeded.',
            rootCause:
                'The application is sending API requests faster than the cloud provider allows for the configured service tier.',
            possibleCauses: [
                'Burst of requests exceeding the per-second API rate limit',
                'DynamoDB table provisioned throughput is too low',
                'S3 request rate limit per prefix exceeded (5,500 GET/s)',
                'Missing exponential backoff on API calls',
                'Parallel processing creating too many concurrent API calls',
            ],
            recommendedFixes: [
                'Implement exponential backoff with jitter on retries',
                'Request a service quota increase from the cloud provider',
                'Use batch APIs instead of individual item operations',
                'Distribute requests across multiple partitions/prefixes',
                'Enable auto-scaling for DynamoDB or increase provisioned capacity',
                'Cache frequently accessed data to reduce API call volume',
            ],
        },
    },
    {
        id: 'CLOUD_IAM_ERROR',
        name: 'IAM Authentication/Authorization Error',
        category: 'cloud',
        patterns: [
            /UnauthorizedAccess/i,
            /InvalidClientTokenId/i,
            /SignatureDoesNotMatch/i,
            /ExpiredToken/i,
            /AssumeRole.*(?:fail|denied|error)/i,
            /sts.*(?:error|fail|denied)/i,
            /credentials.*(?:expired|invalid|not\s+found)/i,
        ],
        keywords: ['IAM', 'credentials', 'AssumeRole', 'STS', 'unauthorized', 'expired token'],
        errorCodes: ['InvalidClientTokenId', 'SignatureDoesNotMatch', 'ExpiredToken'],
        severity: 'HIGH',
        explanation: {
            summary:
                'An AWS/cloud IAM authentication or authorization error occurred. The provided credentials are invalid, expired, or lack required permissions.',
            rootCause:
                'The cloud credentials used for the API call are invalid, expired, or have insufficient permissions.',
            possibleCauses: [
                'AWS access key or secret key is incorrect or rotated',
                'Temporary credentials (STS) have expired',
                'AssumeRole failed due to missing trust relationship',
                'Instance profile or service account not attached to the resource',
                'Clock skew causing signature validation failures',
                'MFA required but not provided for the API call',
            ],
            recommendedFixes: [
                'Verify credentials: aws sts get-caller-identity',
                'Rotate and update access keys if compromised',
                'Check the IAM role trust policy for AssumeRole issues',
                'Ensure the EC2 instance has an instance profile attached',
                'Synchronize system clock: sudo ntpdate ntp.ubuntu.com',
                'Use IAM roles instead of long-lived access keys',
            ],
        },
    },
];
