# Campus Help Desk Board

> **Stack**: Next.js 14, Node.js, PostgreSQL, Redis  
> **Repository Name**: helpdesk-app(PES1UG24AM430)  
> **Candidate SRN**: PES1UG24AM430 

A real-time Campus Help Desk web application where students post short help questions and view the latest inquiries. **PostgreSQL** serves as the permanent source of truth, while **Redis** provides 60-second response caching and atomic visit counting. Next.js handles both the responsive frontend UI and backend Route Handler APIs.

---

## 📋 Table of Contents
1. [Architecture & Workflow](#-architecture--workflow)
2. [Features & Specifications](#-features--specifications)
3. [Project Structure](#-project-structure)
4. [Commit History & Time Plan](#-commit-history--time-plan)
5. [Getting Started & Setup](#-getting-started--setup)
6. [API Specification](#-api-specification)
7. [Evaluator Verification Checklist](#-evaluator-verification-checklist)
8. [Bonus Challenge](#-bonus-challenge)

---

## 🏛 Architecture & Workflow

```mermaid
flowchart TD
    Client["Browser / Next.js Client"]
    API_Requests["/api/requests (Route Handler)"]
    API_Views["/api/views (Route Handler)"]
    Redis[("Redis Cache & Counters")]
    Postgres[("PostgreSQL Permanent Store")]

    Client -->|"1. Page Load / Refresh"| API_Views
    API_Views -->|"INCR help:views"| Redis
    API_Views -->|"Return count"| Client

    Client -->|"2. GET /api/requests"| API_Requests
    API_Requests -->|"Check help:latest"| Redis
    Redis -- "Hit (source: Redis)" --> API_Requests
    Redis -- "Miss (source: PostgreSQL)" --> Postgres
    Postgres -->|"Store in Redis (TTL: 60s)"| Redis
    API_Requests -->|"Return { source, requests }"| Client

    Client -->|"3. POST /api/requests"| API_Requests
    API_Requests -->|"Parameterized INSERT"| Postgres
    API_Requests -->|"DEL help:latest (Invalidate)"| Redis
    API_Requests -->|"Return { success: true, id }"| Client
```

### Key Engineering Rules Followed:
- **Parameterized SQL Only**: All database operations use `$1, $2` parameters via `pg.Pool` to prevent SQL injection.
- **PostgreSQL as Source of Truth**: Redis is strictly a cache and counter. Redis failure does not cause data loss.
- **Fail-safe Resilience**: If Redis is offline or disconnected, the application continues to serve requests directly from PostgreSQL without crashing.
- **Atomic Counting**: Page views are incremented via Redis `INCR help:views`, eliminating read-then-write race conditions.
- **Visible Cache Hits & Misses**: The UI displays a high-visibility badge indicating whether the response was loaded from `Redis` (hit) or `PostgreSQL` (miss).

---

## 🚀 Features & Specifications

### 1. Post a Help Request
- Student enters `student_name` (max 50 chars) and `message` (max 200 chars).
- Validation: Rejects empty or whitespace-only inputs with an informative error message.
- Storage: Inserts into PostgreSQL table `help_requests`.
- Cache Invalidation: Immediately deletes Redis key `help:latest` so new requests appear on the next read.

### 2. View Latest Requests
- Queries the 10 most recent requests ordered by `created_at DESC`.
- Checks Redis `help:latest`:
  - **Hit**: Returns cached list with `"source": "Redis"`.
  - **Miss**: Queries PostgreSQL, caches result in Redis with a 60-second TTL, and returns `"source": "PostgreSQL"`.
- Displays real-time source badge on the UI.

### 3. Count Board Views
- Increments Redis key `help:views` on every page load/refresh.
- Displays `Board views: <count>` on the page header.
- Atomic `INCR` operation guarantees consistency under concurrent traffic.

### 4. Bonus: Resolve Help Requests
- Click the **Resolve** button next to any open question.
- Updates PostgreSQL (`resolved = TRUE`) and invalidates the Redis cache.

---

## 📁 Project Structure

```
helpdesk-app(PES1UG24AM430)/
├── app/
│   ├── api/
│   │   ├── requests/
│   │   │   ├── [id]/
│   │   │   │   └── route.ts   # PATCH: Marks request as resolved & clears cache (Bonus)
│   │   │   └── route.ts       # GET (cached list) & POST (create request & invalidate)
│   │   └── views/
│   │       └── route.ts       # GET/POST (atomic INCR help:views)
│   ├── globals.css            # Styles for cards, badges, and layout
│   ├── layout.tsx             # Root layout with metadata
│   └── page.tsx               # Main page: Form, request list, source badge, view count
├── lib/
│   ├── db.ts                  # PostgreSQL pool, parameterized queries, and auto-init
│   └── redis.ts               # Resilient Redis client with caching & fallback helpers
├── scripts/
│   ├── init-db.js             # Table setup & migration script
│   ├── setup.sql              # Raw SQL migration script
│   └── test-api.js            # Automated verification test suite
├── docker-compose.yml         # 1-Click PostgreSQL & Redis services
├── .env.example               # Environment variables template
├── .env.local                 # Local environment configuration
├── package.json               # Scripts & dependencies
├── tsconfig.json              # TypeScript configuration
└── README.md                  # Complete documentation
```

---

## ⏱ Commit History & Time Plan

The repository commits follow the 120-minute development schedule specified in the brief:

| Milestone Time | Commit Hash & Message | Purpose |
| :--- | :--- | :--- |
| **0:00 to 0:15** | `feat: initial project setup with Next.js, dependencies, and configuration` | Scaffold project, TypeScript, Next.js configuration, environment templates |
| **0:15 to 0:35 (a)** | `feat(db): setup PostgreSQL schema and database connection pool (lib/db.ts)` | `pg.Pool` connection, parameterized query helper, `help_requests` table schema |
| **0:15 to 0:35 (b)** | `feat(redis): setup Redis client with connection resilience and fallback handling (lib/redis.ts)` | Redis client with lazy connect, error trapping, fallback and helper functions |
| **0:15 to 0:35 (c)** | `feat(api): implement POST /api/requests endpoint with validation and cache invalidation` | Validation, parameterized INSERT, `help:latest` invalidation, 201/400 responses |
| **0:35 to 0:55** | `feat(api): implement GET /api/requests with Redis caching (60s TTL) and PostgreSQL fallback` | Cache check, 60s TTL storage, source badge indicator ("Redis" / "PostgreSQL") |
| **0:55 to 1:10** | `feat(api): implement view counter API with Redis INCR help:views (/api/views)` | Atomic `INCR help:views` route handler and counter getter |
| **1:10 to 1:35** | `feat(ui): build responsive Help Desk Board UI with live updates, source badge, and view counter` | Complete frontend with form, requests feed, live source badge, and view counter |
| **1:35 to 1:50** | `feat(bonus): add request resolution endpoint with Redis cache invalidation (Section 10)` | Request resolve button, PostgreSQL update, and cache clearing |
| **1:35 to 1:50** | `test: add automated test suite for API endpoints, cache hits/misses, and validation` | Comprehensive automated test script and docker-compose orchestration |
| **1:50 to 2:00** | `docs: complete documentation with evaluator checklist, architecture diagram, and run instructions` | Complete submission documentation |

---

## ⚙️ Getting Started & Setup

### Prerequisites
- Node.js 18+ (tested on Node.js v24)
- PostgreSQL and Redis (via Docker or local services)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start PostgreSQL & Redis
Using Docker Compose:
```bash
docker compose up -d
```
*Or ensure local PostgreSQL is running on port 5432 and Redis on port 6379.*

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env.local` (pre-created with sensible defaults):
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/campus_helpdesk
REDIS_URL=redis://localhost:6379
SRN=PES1UG24AM430
```

### Step 4: Initialize PostgreSQL Database
```bash
npm run db:setup
```
*(The application also auto-initializes the table on first boot).*

### Step 5: Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📡 API Specification

### `POST /api/requests`
Creates a new question.

**Request Body:**
```json
{
  "student_name": "Abhi",
  "message": "How do I reset my campus Wi-Fi password?"
}
```

**Success (201 Created):**
```json
{
  "success": true,
  "id": 1
}
```

**Validation Error (400 Bad Request):**
```json
{
  "success": false,
  "error": "student_name and message are required"
}
```

---

### `GET /api/requests`
Retrieves latest 10 requests.

**Cache Miss (`PostgreSQL`):**
```json
{
  "source": "PostgreSQL",
  "requests": [
    {
      "id": 1,
      "student_name": "Abhi",
      "message": "How do I reset my campus Wi-Fi password?",
      "resolved": false,
      "created_at": "2026-11-02T16:45:00.000Z"
    }
  ]
}
```

**Cache Hit (`Redis` - within 60s):**
```json
{
  "source": "Redis",
  "requests": [ ... ]
}
```

---

### `GET /api/views`
Increments `help:views` via Redis `INCR` and returns current count.

**Response (200 OK):**
```json
{
  "views": 42,
  "count": 42
}
```

---

### `PATCH /api/requests/[id]` (Bonus)
Marks request as resolved in PostgreSQL and clears the Redis cache.

**Response (200 OK):**
```json
{
  "success": true,
  "id": 1,
  "message": "Request marked as resolved and cache invalidated"
}
```

---

## 🧪 Evaluator Verification Checklist

You can verify all evaluation criteria directly through the UI or with the automated test suite:

### Option A: Run Automated Test Suite
With the server running on `http://localhost:3000`:
```bash
npm run test:api
```

### Option B: Interactive Verification (from Section 7 of Brief)
1. **Submit an empty form**:
   - Leave the form blank and click "Post Request".
   - Verified: Error message `student_name and message are required` appears.
2. **Post one help request**:
   - Name: `Abhi`, Question: `How do I reset my campus Wi-Fi password?`.
   - Click "Post Request".
   - Verified: Request is saved to PostgreSQL and appears at the top of the feed.
3. **Show source: PostgreSQL**:
   - On the newly updated list, the badge displays `Source: PostgreSQL` (cache was invalidated upon write).
4. **Show source: Redis**:
   - Click "Refresh" within 60 seconds.
   - Verified: The badge switches to `Source: Redis` (served from Redis memory cache).
5. **Cache invalidation upon new post**:
   - Post another question (e.g. `Sneha`: `Which lab is open after 5 pm?`).
   - Verified: The new item appears, and the source reverts to `Source: PostgreSQL`.
6. **Show view counter increasing**:
   - Refresh the page in your browser.
   - Verified: `Board views: <N>` increments by 1 on every refresh using atomic Redis `INCR`.
7. **Bonus: Resolve request**:
   - Click `✓ Resolve` on any request.
   - Verified: Status marks as resolved and cache is cleared.
