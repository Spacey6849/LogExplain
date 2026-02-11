import { LogPattern } from '../types';

// ──────────────────────────────────────────────────────────
// Message Queue & Event Streaming Patterns
// ──────────────────────────────────────────────────────────

export const messagingPatterns: LogPattern[] = [
    {
        id: 'MQ_CONNECTION_LOST',
        name: 'Message Broker Connection Lost',
        category: 'messaging',
        patterns: [
            /(?:rabbit|amqp|kafka|redis|nats).*connection.*(?:lost|closed|refused|fail)/i,
            /broker.*(?:disconnected|unreachable|down)/i,
            /AMQP.*(?:error|connection|closed)/i,
            /KafkaJSConnectionError/i,
            /lost\s+connection\s+to\s+(?:broker|queue|message)/i,
        ],
        keywords: ['RabbitMQ', 'Kafka', 'AMQP', 'broker', 'connection lost', 'message queue'],
        severity: 'HIGH',
        explanation: {
            summary:
                'The application lost its connection to the message broker (RabbitMQ, Kafka, Redis, NATS). Messages cannot be published or consumed until the connection is restored.',
            rootCause:
                'The message broker is unreachable — it may be down, overloaded, or a network issue is preventing communication.',
            possibleCauses: [
                'Message broker process crashed or was restarted',
                'Network connectivity issue between the application and the broker',
                'Broker maximum connection limit reached',
                'Firewall rule blocking the broker port',
                'Broker authentication credentials changed',
                'DNS resolution failure for the broker hostname',
            ],
            recommendedFixes: [
                'Check broker status and health',
                'Verify network connectivity to the broker on the correct port',
                'Implement automatic reconnection with exponential backoff',
                'Check broker logs for resource exhaustion or crash reasons',
                'Ensure broker credentials and connection string are correct',
                'Set up broker clustering/HA for high availability',
            ],
        },
    },
    {
        id: 'MQ_CONSUMER_LAG',
        name: 'Message Consumer Lag',
        category: 'messaging',
        patterns: [
            /consumer\s+(?:lag|behind|falling\s+behind)/i,
            /message.*backlog/i,
            /queue\s+(?:depth|size).*(?:high|growing|exceeded)/i,
            /offset.*lag/i,
            /unacked.*(?:messages|count).*(?:high|growing)/i,
        ],
        keywords: ['consumer lag', 'backlog', 'queue depth', 'offset lag', 'unacked messages'],
        severity: 'MEDIUM',
        severityModifiers: [
            {
                condition: /critical|emergency|very\s+high/i,
                severity: 'HIGH',
                reason: 'Extreme consumer lag can cause data loss if messages expire',
            },
        ],
        explanation: {
            summary:
                'Message consumers are falling behind producers — messages are accumulating faster than they are being processed.',
            rootCause:
                'Consumer processing speed is slower than the message production rate.',
            possibleCauses: [
                'Consumer application is processing messages too slowly',
                'Not enough consumer instances to handle the load',
                'Consumer is blocked by a slow downstream dependency',
                'Network bandwidth limiting message throughput',
                'Poison message causing repeated processing failures',
                'Consumer group rebalancing frequently, causing pauses',
            ],
            recommendedFixes: [
                'Scale up consumer instances or increase parallelism',
                'Optimize consumer processing logic (batch processing, async I/O)',
                'Implement dead letter queues for poison messages',
                'Increase consumer prefetch/batch size for throughput',
                'Monitor consumer lag with alerting: kafka-consumer-groups --describe',
                'Consider partitioning strategy for better parallelism',
            ],
        },
    },
    {
        id: 'MQ_DEAD_LETTER',
        name: 'Dead Letter Queue Message',
        category: 'messaging',
        patterns: [
            /dead[.\s-]?letter/i,
            /DLQ/i,
            /message.*(?:rejected|failed|undeliverable)/i,
            /max\s+retries?\s+exceeded/i,
            /message.*poison/i,
        ],
        keywords: ['dead letter', 'DLQ', 'rejected', 'max retries', 'poison message', 'undeliverable'],
        severity: 'MEDIUM',
        explanation: {
            summary:
                'A message was moved to the dead letter queue (DLQ) after exhausting all retry attempts. The message could not be processed successfully.',
            rootCause:
                'The consumer failed to process the message after the maximum number of retries.',
            possibleCauses: [
                'Message format is invalid or schema has changed',
                'Processing logic throws an unhandled exception for this message',
                'Downstream service required for processing is unavailable',
                'Message payload exceeds size limits',
                'Serialization/deserialization error (incompatible data types)',
            ],
            recommendedFixes: [
                'Inspect DLQ messages: identify the common failure pattern',
                'Fix the consumer code to handle the failing message type',
                'Implement schema validation on message ingestion',
                'Set up DLQ monitoring and alerting',
                'Create a DLQ replay mechanism for reprocessing fixed messages',
                'Add structured error logging to capture why each message fails',
            ],
        },
    },
    {
        id: 'MQ_PUBLISH_FAIL',
        name: 'Message Publish Failed',
        category: 'messaging',
        patterns: [
            /(?:publish|produce|send).*(?:fail|error|timeout).*(?:message|queue|topic)/i,
            /message.*(?:not\s+)?(?:publish|deliver|sent)/i,
            /KafkaJSNumberOfRetriesExceeded/i,
            /channel\s+closed/i,
            /exchange.*not\s+found/i,
        ],
        keywords: ['publish failed', 'produce error', 'message delivery', 'channel closed'],
        severity: 'HIGH',
        explanation: {
            summary:
                'The application failed to publish a message to the message broker. The message was not delivered and may be lost.',
            rootCause:
                'The publish operation to the message broker failed due to connectivity, configuration, or broker issues.',
            possibleCauses: [
                'Broker connection is down (see MQ_CONNECTION_LOST)',
                'Topic or exchange does not exist',
                'Publisher confirmation timed out',
                'Message exceeds the broker maximum message size',
                'Broker disk is full, rejecting new messages',
                'Incorrect routing key or topic name',
            ],
            recommendedFixes: [
                'Verify broker connectivity and topic/exchange existence',
                'Implement publisher confirms/acknowledgments',
                'Add a local fallback queue for messages that fail to publish',
                'Check broker disk usage and increase storage if needed',
                'Validate message size before publishing',
                'Use transactions or idempotent producers to prevent message loss',
            ],
        },
    },
];
