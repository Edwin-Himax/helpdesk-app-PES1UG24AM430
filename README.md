# Campus Help Desk Board

A high-performance Campus Help Desk Board built with **Next.js**, **PostgreSQL**, and **Redis**.

Students can post questions and view recent queries in real time. The architecture uses **PostgreSQL as the permanent source of truth** and **Redis for 60-second response caching and atomic visit counting**, complete with graceful degradation if Redis is unavailable.

---

## 🌟 Features

- **Post Help Requests**: Validate and persist questions from students (`student_name`, `message`) into PostgreSQL.
- **Auto Cache Invalidation**: Writing a new request invalidates the Redis `help:latest` cache key immediately.
- **High-Speed Cached Reads**: Latest 10 requests are served with a 60-second TTL from Redis (`help:latest`).
- **Cache Hit / Miss Inspector**: Evaluator-friendly UI indicator displaying whether data was loaded from `Redis` (cache hit) or `PostgreSQL` (cache miss).
- **Atomic View Counter**: Increments board views using Redis `INCR help:views` on every page load/refresh.
- **Fail-safe Resilience**: If Redis goes offline, the app seamlessly falls back to PostgreSQL without crashing.
- **Parameterized SQL**: 100% protected against SQL injection using parameterized queries with `pg`.
- **Bonus Feature**: Ability to resolve requests, updating PostgreSQL and invalidating the Redis cache.

---

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Runtime**: Node.js
- **Database**: PostgreSQL (`pg` pool)
- **Cache & Counter**: Redis (`redis` v4 client)
- **Language**: TypeScript

---

## 📁 Project Structure

```
Campus help desk/
├── app/
│   ├── page.tsx               # Main Help Desk board with form, cache badge, and view counter
│   ├── layout.tsx             # Root layout with responsive design
│   ├── globals.css            # Styles for UI, badges, and cards
│   └── api/
│       ├── requests/
│       │   ├── route.ts       # POST (create) & GET (fetch with Redis cache)
│       │   └── [id]/
│       │       └── route.ts   # PATCH (mark resolved bonus)
│       └── views/
│           └── route.ts       # GET/POST (atomic INCR help:views)
├── lib/
│   ├── db.ts                  # PostgreSQL pool and parameterized query helper
│   └── redis.ts               # Resilient Redis client with caching & fallback helpers
├── scripts/
│   ├── init-db.js             # Table setup & migration script
│   └── test-api.js            # Automated evaluator test suite
├── docker-compose.yml         # 1-click Docker setup for PostgreSQL & Redis
├── .env.example
├── .env.local
├── package.json
└── tsconfig.json
```
