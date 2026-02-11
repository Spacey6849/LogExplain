# LogExplain — Human-Readable Log Interpretation API

> **Production-Ready API** that converts raw, machine-generated system logs into structured, actionable insights: plain-English explanations, root-cause analysis, severity classification, and recommended actions.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Project Objectives](#2-project-objectives)
3. [System Architecture](#3-system-architecture)
4. [Why This Is NOT "Just a Chatbot"](#4-why-this-is-not-just-a-chatbot)
5. [API Design & Endpoints](#5-api-design--endpoints)
6. [Tech Stack & Justification](#6-tech-stack--justification)
7. [Getting Started](#7-getting-started)
8. [Deployment](#8-deployment)
9. [Product & Business View](#9-product--business-view)
10. [Academic (FYP) Sections](#10-academic-fyp-sections)

---

## 1. Problem Statement

Modern systems generate massive volumes of machine-formatted logs — cryptic error codes, stack traces, and system messages that are unintelligible to most stakeholders. Existing solutions like **Google Cloud Logging**, **Auth0 Logs API**, and **Thales Logs API** focus on log *collection and storage*, not *interpretation*.

**LogExplain** fills this gap as a pure **interpretation layer** — it does not read or store logs. Instead, it consumes raw log text from *any source* and returns structured, deterministic, human-readable analysis.

### The Gap

| Capability | Google Cloud Logging | Auth0 Logs | Thales Logs | **LogExplain** |
|---|---|---|---|---|
| Log collection & storage | ✅ | ✅ | ✅ | ❌ |
| Platform-specific | ✅ (GCP only) | ✅ (Auth0 only) | ✅ (Thales only) | ❌ (any source) |
| Human-readable explanation | ❌ | ❌ | ❌ | ✅ |
| Root-cause analysis | ❌ | ❌ | ❌ | ✅ |
| Severity scoring | ❌ | ❌ | ❌ | ✅ |
| Recommended actions | ❌ | ❌ | ❌ | ✅ |
| Incident correlation | ❌ | ❌ | ❌ | ✅ |
| Structured JSON output | Partial | Partial | Partial | ✅ |

---

## 2. Project Objectives

1. **Accept raw log strings** as input (single and batch) from any system
2. **Identify log category** (database, network, auth, memory, disk, API, timeout, etc.)
3. **Generate structured explanations**: summary, root cause, possible causes, fixes, severity
4. **Provide incident summary** analysis for correlated multi-log events
5. **Deliver deterministic, system-consumable JSON** — not free-form text
6. **Maintain accuracy** via rule-based pattern matching with template explanations
7. **Ensure extensibility** via a modular knowledge base architecture

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT / CONSUMER                            │
│   (DevOps Dashboard, CI/CD Pipeline, Monitoring Tool, SaaS App)    │
└─────────────────┬───────────────────────────────────────────────────┘
                  │  POST /v1/logs/explain
                  │  POST /v1/logs/batch-explain
                  │  POST /v1/logs/incident-summary
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                              │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────┐                │
│  │ Helmet   │  │ API Key Guard │  │ Rate Limiter │                │
│  │ (Security)│  │ (Auth)        │  │ (Throttler)  │                │
│  └──────────┘  └───────────────┘  └──────────────┘                │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     INTERPRETATION ENGINE                           │
│                                                                     │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │  Log Parser   │───▶│  Pattern Matcher  │───▶│  Severity Scorer │  │
│  │ (Metadata     │    │  (Knowledge Base  │    │  (0-100 scoring  │  │
│  │  extraction)  │    │   regex+keyword)  │    │   engine)        │  │
│  └──────────────┘    └───────┬──────────┘    └──────────────────┘  │
│                              │                                      │
│                    ┌─────────▼──────────┐                           │
│                    │ Explanation        │                           │
│                    │ Generator          │                           │
│                    │ (Template-based)   │                           │
│                    └─────────┬──────────┘                           │
│                              │                                      │
│                    ┌─────────▼──────────┐                           │
│                    │ Incident Correlator│  (for /incident-summary)  │
│                    │ (Cross-log         │                           │
│                    │  analysis)         │                           │
│                    └───────────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE BASE                                   │
│                                                                     │
│  ┌────────────┐ ┌──────────┐ ┌──────┐ ┌────────┐ ┌─────────────┐  │
│  │ Database   │ │ Network  │ │ Auth │ │ System │ │ API/Config  │  │
│  │ Patterns   │ │ Patterns │ │ Pats │ │ Pats   │ │ Patterns    │  │
│  │ (5 rules)  │ │ (5 rules)│ │ (4)  │ │ (5)    │ │ (9 rules)   │  │
│  └────────────┘ └──────────┘ └──────┘ └────────┘ └─────────────┘  │
│                                                                     │
│  Total: 28+ patterns across 16 categories                          │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Internal Processing Flow

```
Raw Log String
      │
      ▼
  ┌─────────────────────────┐
  │ 1. LOG PARSER            │
  │    • Extract timestamp   │
  │    • Extract log level   │
  │    • Extract error code  │
  │    • Extract IP/port     │
  │    • Extract source      │
  │    • Extract username    │
  └──────────┬──────────────┘
             │
             ▼
  ┌─────────────────────────┐
  │ 2. PATTERN MATCHER      │
  │    • Scan all 28+       │
  │      regex patterns     │
  │    • Keyword matching   │
  │    • Error code lookup  │
  │    • Score confidence   │
  │      (0.0 – 1.0)       │
  │    • Select best match  │
  └──────────┬──────────────┘
             │
      ┌──────┴───────┐
      │              │
   MATCHED        NO MATCH
      │              │
      ▼              ▼
  ┌────────┐   ┌──────────┐
  │Template│   │ Unknown  │
  │ Based  │   │ Handler  │
  │ Explain│   │ (generic │
  └───┬────┘   │  advice) │
      │        └────┬─────┘
      └──────┬──────┘
             │
             ▼
  ┌─────────────────────────┐
  │ 3. SEVERITY SCORER      │
  │    • Base score from    │
  │      pattern severity   │
  │    • Context modifiers  │
  │      (prod? repeated?) │
  │    • Log-level boost   │
  │    • Output: 0-100     │
  │      + LOW/MED/HIGH/   │
  │        CRITICAL        │
  └──────────┬──────────────┘
             │
             ▼
  ┌─────────────────────────┐
  │ 4. STRUCTURED RESPONSE  │
  │    • summary            │
  │    • rootCause          │
  │    • possibleCauses[]   │
  │    • recommendedFixes[] │
  │    • severity + score   │
  │    • metadata           │
  │    • confidence         │
  │    • engine type        │
  └─────────────────────────┘
```

---

## 4. Why This Is NOT "Just a Chatbot"

| Aspect | ChatGPT / LLM Chatbot | LogExplain |
|---|---|---|
| **Determinism** | Different answer each time | Same log → same explanation, always |
| **Response format** | Free-form text, varies | Structured JSON schema, guaranteed |
| **Speed** | 1-5 seconds (LLM inference) | <10ms per log (regex matching) |
| **Accuracy** | Hallucination-prone | Pre-validated templates, 0% hallucination |
| **Cost** | $0.01-0.10 per request (token cost) | Zero per request (no LLM calls) |
| **Offline** | Requires internet/API | Fully self-contained |
| **Extensibility** | Retraining or prompt engineering | Add a JSON pattern object |
| **Auditability** | Black box | Every explanation traceable to a pattern ID |

### How Accuracy and Consistency Are Maintained

1. **Rule-based pattern matching** — each pattern is a hand-crafted regex + keyword set, tested against real logs
2. **Template-based explanations** — pre-written by domain experts, not generated at runtime
3. **Confidence scoring** — each match reports a 0-1 confidence score so consumers can decide thresholds
4. **Pattern IDs** — every response includes a `patternId` for audit trail and debugging
5. **No LLM in the critical path** — LLM fallback planned only for unknown logs (opt-in, future)
6. **Severity scoring engine** — deterministic multi-signal scoring (base + modifiers + context)

---

## 5. API Design & Endpoints

### Base URL

```
https://api.logexplain.io/v1
```

### Authentication

All endpoints (except health check) require an `x-api-key` header.

```
x-api-key: your_api_key_here
```

---

### 5.1 `POST /v1/logs/explain`

Explain a single log entry.

**Request:**
```json
{
  "log": "2026-02-11T10:30:00Z ERROR [database] FATAL: password authentication failed for user \"admin\"",
  "source": "production-api-server-01"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "rawLog": "2026-02-11T10:30:00Z ERROR [database] FATAL: password authentication failed for user \"admin\"",
    "patternId": "DB_AUTH_FAILED",
    "summary": "The database rejected the connection because the supplied username or password is incorrect. The application cannot authenticate with the database.",
    "category": "database",
    "severity": "HIGH",
    "severityScore": 70,
    "rootCause": "Invalid credentials provided in the database connection configuration.",
    "possibleCauses": [
      "Incorrect password in connection string or environment variable",
      "Database user does not exist",
      "Password was recently changed but not updated in app config",
      "Database authentication method mismatch (e.g., md5 vs scram-sha-256)",
      "User lacks required privileges for the target database",
      "Host-based authentication rules (pg_hba.conf) reject the connection"
    ],
    "recommendedFixes": [
      "Verify database credentials in your environment/config files",
      "Test login manually: psql -U <user> -h <host> <database>",
      "Reset the database user password if unsure",
      "Check pg_hba.conf (PostgreSQL) or user grants (MySQL) for access rules",
      "Ensure the user has CONNECT privilege on the target database",
      "Verify the authentication method matches what the client supports"
    ],
    "metadata": {
      "logLevel": "ERROR",
      "username": "admin",
      "errorCode": "ERROR"
    },
    "timestamp": "2026-02-11T10:30:00Z",
    "source": "production-api-server-01",
    "confidence": 0.85,
    "engine": "rule-based"
  },
  "timestamp": "2026-02-11T16:34:55.548Z",
  "processingTimeMs": 7
}
```

---

### 5.2 `POST /v1/logs/batch-explain`

Explain multiple log entries at once (max 50).

**Request:**
```json
{
  "logs": [
    "2026-02-11T10:30:00Z ERROR ECONNREFUSED 127.0.0.1:5432",
    "2026-02-11T10:30:05Z ERROR ENOSPC: no space left on device",
    "FATAL: out of memory, JavaScript heap out of memory"
  ],
  "source": "production-api-server-01"
}
```

**Response:** Array of `LogExplanation` objects (same structure as single endpoint).

---

### 5.3 `POST /v1/logs/incident-summary`

Analyze multiple related logs as a single incident.

**Request:**
```json
{
  "logs": [
    "2026-02-11T10:30:00Z ERROR Connection refused to database at 10.0.1.5:5432",
    "2026-02-11T10:30:02Z ERROR Request timeout on /api/v1/users after 30000ms",
    "2026-02-11T10:30:03Z CRITICAL 503 Service Unavailable - upstream server not responding"
  ],
  "incidentContext": "API outage reported at 10:30 UTC"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "title": "CRITICAL Incident — 3 issue types detected across Database — API outage reported at 10:30 UTC",
    "summary": "Analyzed 3 log entries. Overall severity: CRITICAL (score: 95/100). Affected systems: database, timeout, api. 1 critical-severity log(s) require immediate attention. 2 high-severity log(s) detected. Correlations found: Database issues detected alongside API timeouts — the database may be the root cause of slow API responses.",
    "severity": "CRITICAL",
    "severityScore": 95,
    "rootCauseChain": [
      "The database service is unreachable — it may be stopped, crashed, or blocked by a firewall.",
      "The upstream service processing the request exceeded the timeout threshold.",
      "The server is unable to handle requests due to overload, maintenance, or a crash."
    ],
    "affectedSystems": ["database", "timeout", "api"],
    "timeline": [
      {
        "timestamp": "2026-02-11T10:30:00Z",
        "summary": "The application failed to establish a connection to the database server...",
        "severity": "HIGH",
        "category": "database"
      },
      {
        "timestamp": "2026-02-11T10:30:02Z",
        "summary": "An API request timed out...",
        "severity": "HIGH",
        "category": "timeout"
      },
      {
        "timestamp": "2026-02-11T10:30:03Z",
        "summary": "The service is currently unavailable...",
        "severity": "CRITICAL",
        "category": "api"
      }
    ],
    "recommendedActions": [
      "Verify the database service is running",
      "Check upstream service health and response times",
      "..."
    ],
    "totalLogsAnalyzed": 3,
    "categoryBreakdown": { "database": 1, "timeout": 1, "api": 1 },
    "correlations": [
      "Database issues detected alongside API timeouts — the database may be the root cause of slow API responses"
    ]
  },
  "timestamp": "2026-02-11T16:35:27.937Z",
  "processingTimeMs": 11
}
```

---

### 5.4 Error Responses

**401 Unauthorized:**
```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Missing x-api-key header"
}
```

**400 Bad Request:**
```json
{
  "statusCode": 400,
  "message": ["Log entry must not be empty"],
  "error": "Bad Request"
}
```

**429 Too Many Requests:**
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

---

## 6. Tech Stack & Justification

| Component | Technology | Justification |
|---|---|---|
| **Runtime** | Node.js 22 | High-performance async I/O, ideal for API workloads |
| **Framework** | NestJS 11 | Enterprise-grade, modular architecture, built-in DI, Swagger support |
| **Language** | TypeScript 5.7 | Type safety, better developer experience, compile-time error detection |
| **Validation** | class-validator + class-transformer | Declarative DTO validation with decorators |
| **API Docs** | Swagger / OpenAPI 3.0 | Auto-generated interactive docs at `/docs` |
| **Security** | Helmet + API Key Guard | HTTP security headers + custom API key authentication |
| **Rate Limiting** | @nestjs/throttler | Per-IP rate limiting built into the NestJS lifecycle |
| **Container** | Docker (multi-stage) | Reproducible builds, 90MB production image |
| **Orchestration** | Docker Compose | Single-command local and staging deployment |

### Why No Database?

LogExplain is **stateless by design** — it does not store logs or results. The knowledge base is compiled into the application binary. This enables:
- Zero external dependencies (no DB to manage)
- Horizontal scaling (any instance handles any request)
- Sub-10ms response times
- Simplified deployment and operations

### Future Considerations

| Need | Solution |
|---|---|
| Pattern analytics | Redis for counters |
| User management / billing | PostgreSQL |
| LLM fallback cache | Redis or SQLite |
| Pattern CRUD API | PostgreSQL + admin UI |

---

## 7. Getting Started

### Prerequisites

- Node.js ≥ 18 (22 recommended)
- npm ≥ 8

### Installation

```bash
git clone <repository-url>
cd logexplain-api
npm install
cp .env.example .env
# Edit .env with your API keys
```

### Development

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000` and Swagger docs at `http://localhost:3000/docs`.

### Build for Production

```bash
npm run build
npm run start:prod
```

### Test an Endpoint

```bash
curl -X POST http://localhost:3000/v1/logs/explain \
  -H "Content-Type: application/json" \
  -H "x-api-key: logexplain_dev_key_2026" \
  -d '{"log": "ERROR: ECONNREFUSED 10.0.0.1:5432"}'
```

---

## 8. Deployment

### Docker

```bash
# Build
docker build -t logexplain-api .

# Run
docker run -p 3000:3000 \
  -e API_KEYS=your_production_key \
  -e NODE_ENV=production \
  logexplain-api
```

### Docker Compose

```bash
docker-compose up -d
```

### Cloud Deployment Options

| Platform | Approach |
|---|---|
| **AWS** | ECS Fargate or EKS with ALB |
| **GCP** | Cloud Run (serverless) or GKE |
| **Azure** | Azure Container Apps or AKS |
| **DigitalOcean** | App Platform or Kubernetes |
| **Railway/Render** | Direct Docker deploy |

### Monitoring

The API itself logs all operations internally:
- Request/response timing (`processingTimeMs` in every response)
- Pattern matching results (pattern ID, confidence, severity)
- Health check endpoint for uptime monitoring

Recommended external monitoring:
- **Prometheus + Grafana** for metrics (request rate, latency, error rate)
- **Sentry** for error tracking
- **ELK Stack** for the API's own logs (yes, LogExplain's logs could be analyzed by LogExplain itself!)

---

## 9. Product & Business View

### 9.1 Differentiation

LogExplain is **not** a log management platform. It is an **interpretation API**.

```
Traditional:   App → Logs → [Store] → [Search] → Human reads raw logs
                                                    ↑ painful

LogExplain:    App → Logs → [Any Store] → LogExplain API → Human reads explanation
                                                            ↑ instant understanding
```

### 9.2 Real-World Usage Scenarios

| Scenario | How LogExplain Fits |
|---|---|
| **DevOps Dashboard** | Pipe alerts from Prometheus/Grafana through LogExplain to auto-generate incident summaries |
| **CI/CD Pipeline** | Parse build/deploy failure logs, surface root cause in Slack/Teams notifications |
| **Customer Support** | Non-technical support agents paste error logs → get plain-English explanation |
| **Education** | Students learning system administration get instant explanations of unfamiliar errors |
| **SaaS Product** | Embed LogExplain in your product to help users self-diagnose issues |
| **SIEM Integration** | Security tools pipe auth failure logs for automated threat assessment |

### 9.3 Who Uses It

| Persona | Pain Point | LogExplain Value |
|---|---|---|
| DevOps Engineer | Alert fatigue, cryptic error messages | Instant root cause + fix suggestions |
| Junior Developer | Doesn't recognize error patterns | Learning tool with explanations |
| Support Agent | Can't interpret customer error logs | Plain-English translations |
| Platform Team | Incident response takes too long | Automated incident summaries |
| SaaS Builder | Users need help debugging | Embed as a feature in your product |

### 9.4 Pricing Model

| Tier | Requests/Month | Price | Features |
|---|---|---|---|
| **Free** | 500 | $0 | Single explain, 5 req/min |
| **Developer** | 10,000 | $19/mo | Batch + incident summary, 30 req/min |
| **Team** | 100,000 | $79/mo | Priority support, 120 req/min |
| **Enterprise** | Unlimited | Custom | SLA, dedicated instance, custom patterns |

### 9.5 MVP vs. Future Roadmap

**MVP (Current):**
- ✅ Single log explanation
- ✅ Batch explanation
- ✅ Incident summary with correlation
- ✅ 28+ patterns across 16 categories
- ✅ API key authentication
- ✅ Rate limiting
- ✅ Swagger documentation
- ✅ Docker deployment

**Phase 2:**
- [ ] LLM fallback for unknown logs (opt-in, cached)
- [ ] Custom pattern upload API
- [ ] Webhook integration (Slack, Teams, PagerDuty)
- [ ] User dashboard with usage analytics

**Phase 3:**
- [ ] Real-time log stream processing (WebSocket)
- [ ] Pattern suggestion engine (learn from unknown logs)
- [ ] Multi-language explanations (i18n)
- [ ] SDK libraries (Python, JavaScript, Go)

---

## 10. Academic (FYP) Sections

### 10.1 Problem Statement

System administrators, DevOps engineers, and developers face a persistent challenge: **interpreting machine-generated log messages**. Modern infrastructure produces millions of log entries daily, yet the vast majority of these messages are cryptic, vendor-specific, and require deep domain expertise to understand.

While tools exist for log *collection* (ELK Stack, Splunk, CloudWatch) and log *storage* (Google Cloud Logging, Datadog), **no widely available API exists to automatically interpret raw log content and produce structured, human-readable explanations with root-cause analysis**.

This project addresses this gap by developing **LogExplain**, a RESTful API that transforms raw log strings into structured, actionable insights — without requiring access to the logging infrastructure itself.

### 10.2 Objectives

1. Design and implement a rule-based log interpretation engine using regex pattern matching and template-based explanation generation
2. Develop a severity scoring algorithm that deterministically classifies log severity on a 0-100 scale
3. Build an incident correlation system that identifies relationships across multiple log entries
4. Create a modular, extensible knowledge base architecture for log patterns
5. Deploy the system as a production-ready REST API with authentication, rate limiting, and API documentation

### 10.3 Innovation & Uniqueness

1. **Interpretation, not Collection** — fundamentally different approach from existing log platforms
2. **Deterministic by Design** — guaranteed consistent output (unlike LLM-based approaches)
3. **Source-Agnostic** — works with logs from any platform, language, or infrastructure
4. **Incident Correlation** — cross-log analysis identifies causal chains (e.g., "database failure caused API timeouts")
5. **Confidence Scoring** — each explanation includes a quantified confidence level
6. **Zero External Dependencies** — no database, no LLM API calls, fully self-contained

### 10.4 Real-World Relevance

- 73% of IT professionals report spending significant time interpreting error logs manually (Splunk State of Observability 2024)
- Mean Time to Resolution (MTTR) is directly impacted by log interpretation speed
- Cloud-native architectures generate 10x more logs than traditional monoliths
- Junior engineers and support staff frequently lack the expertise to interpret system logs

### 10.5 Limitations & Future Scope

**Current Limitations:**
- Knowledge base is static (requires code deployment to add patterns)
- No persistent storage for analytics or usage tracking
- LLM fallback not yet implemented for unknown patterns
- English-only explanations
- No real-time stream processing (request-response only)

**Future Scope:**
- Dynamic pattern management via admin API
- Machine learning-based pattern discovery from unknown logs
- Multi-language support for explanations
- WebSocket-based real-time log stream interpretation
- Integration SDKs for popular programming languages
- Federated deployment for air-gapped environments

---

## Project Structure

```
logexplain-api/
├── src/
│   ├── main.ts                              # Application entry point
│   ├── app.module.ts                        # Root module
│   ├── auth/
│   │   ├── auth.module.ts                   # Auth module
│   │   └── api-key.guard.ts                 # API key authentication guard
│   ├── health/
│   │   ├── health.module.ts                 # Health check module
│   │   └── health.controller.ts             # GET /v1/health
│   ├── logs/
│   │   ├── logs.module.ts                   # Logs feature module
│   │   ├── logs.controller.ts               # Logs endpoints controller
│   │   ├── logs.service.ts                  # Core orchestration service
│   │   └── dto/
│   │       ├── request.dto.ts               # Request validation DTOs
│   │       └── response.dto.ts              # Response schema DTOs
│   ├── engine/
│   │   ├── log-parser.ts                    # Metadata extraction engine
│   │   ├── severity-scorer.ts               # Severity scoring algorithm
│   │   └── explanation-generator.ts         # Template-based explanation builder
│   └── knowledge-base/
│       ├── types.ts                         # Core type definitions
│       ├── pattern-registry.ts              # Pattern aggregation & search index
│       └── patterns/
│           ├── database.patterns.ts         # Database error patterns (5)
│           ├── network.patterns.ts          # Network error patterns (5)
│           ├── auth.patterns.ts             # Auth/security patterns (4)
│           ├── system.patterns.ts           # Memory/disk/CPU/process patterns (5)
│           ├── api.patterns.ts              # API & HTTP error patterns (6)
│           └── config.patterns.ts           # Configuration patterns (3)
├── .env                                     # Environment configuration
├── .env.example                             # Environment template
├── .gitignore
├── .dockerignore
├── Dockerfile                               # Multi-stage production build
├── docker-compose.yml                       # Development/staging compose
├── nest-cli.json                            # NestJS CLI configuration
├── tsconfig.json                            # TypeScript configuration
├── tsconfig.build.json                      # Build-specific TS config
├── package.json                             # Dependencies & scripts
└── README.md                                # This file
```

---

## License

MIT

---

*Built this project for fun as it was my first project related to api*
