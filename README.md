# 🌱 Flora-Yield — Agritech Platform

> **Mandi, Himachal Pradesh** · AI-powered crop intelligence with production-grade microservices architecture

[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org) [![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org) [![Redis](https://img.shields.io/badge/Redis-Optional-red)](https://redis.io) [![SQLite](https://img.shields.io/badge/SQLite-Prisma-orange)](https://prisma.io)

---

## 🏗️ System Design Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
│              React Frontend  (http://localhost:5173)                 │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP (proxied via Vite)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY  :3000                             │
│   ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│   │ Rate Limiter│  │  JWT Guard   │  │   Request-ID Tracer     │  │
│   │ 200/15 min  │  │ (Bearer tok) │  │   Morgan Logger         │  │
│   └─────────────┘  └──────────────┘  └─────────────────────────┘  │
│                                                                      │
│   Route → Service Resolution via Service Registry                   │
└────┬────────┬────────┬────────┬────────┬────────────────────────────┘
     │        │        │        │        │  (http-proxy-middleware)
     ▼        ▼        ▼        ▼        ▼
  :5001    :5002    :5003    :5004    :5005
  AUTH    CLIMATE   GOV     MARKET    REC
                                           
┌─────────────────────────────────────────────────────────────────────┐
│                  SERVICE REGISTRY  :3001                            │
│                   (Eureka-like)                                     │
│  • Services self-register on startup                                │
│  • Heartbeat every 30s (missed → DOWN after 60s)                   │
│  • Gateway resolves service URL from registry                       │
│  • Dashboard: http://localhost:3001/dashboard                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     CACHE LAYER (Redis)                             │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │  Key                    │ TTL      │ Service                 │ │
│   │─────────────────────────┼──────────┼─────────────────────────│ │
│   │  climate:{lat}:{lon}    │ 30 min   │ Climate Service         │ │
│   │  gov:schemes            │ 6 hrs    │ Government Service      │ │
│   │  gov:mandi:{state}      │ 15 min   │ Government Service      │ │
│   │  rec:{lat}:{lon}        │ 1 hr     │ Recommendation Svc      │ │
│   │  suppliers:{cat}:{v}    │ 5 min    │ Market Service          │ │
│   │  buyers:{crop}          │ 5 min    │ Market Service          │ │
│   │  refresh:{userId}       │ 7 days   │ Auth Service            │ │
│   │  blacklist:{token}      │ 15 min   │ Auth Service            │ │
│   └──────────────────────────────────────────────────────────────┘ │
│   ⚡ Falls back to in-memory Map if Redis not installed             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Services & Ports

| Service | Port | Purpose |
|---|---|---|
| **Service Registry** | 3001 | Eureka-like self-registration + health dashboard |
| **API Gateway** | 3000 | Rate limiting, JWT auth guard, reverse proxy |
| **Auth Service** | 5001 | Register, Login, Logout, Refresh tokens |
| **Climate Service** | 5002 | OpenWeatherMap + Open-Meteo + SoilGrids |
| **Government Service** | 5003 | Subsidy schemes + Live Mandi prices |
| **Market Service** | 5004 | Suppliers (CRUD) + Buyers (CRUD) |
| **Recommendation Service** | 5005 | Heuristic crop recommendation engine |
| **Frontend (Vite)** | 5173 | React dashboard with auth |

---

## 🚀 Quick Start (Single Command)

### Prerequisites
- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Redis** (optional) — Falls back to in-memory cache automatically

### 1. Install all dependencies
```bash
npm run install:all
```

### 2. Push the database schema (adds User model)
```bash
npm run db:push
```

### 3. Seed sample data
```bash
npm run db:seed
```

### 4. Start everything
```bash
npm run dev
```

This starts **8 processes** simultaneously via `concurrently`:
- Service Registry → `http://localhost:3001`
- API Gateway → `http://localhost:3000`
- 5 microservices → ports 5001–5005
- React frontend → `http://localhost:5173`

### 5. Open the app
```
http://localhost:5173  →  Register/Login → Dashboard
http://localhost:3001/dashboard  →  Service Registry Dashboard
```

---

## 🔐 Authentication Flow

```
User → POST /api/auth/register → Auth Service
                                      ↓
                            bcrypt hash password
                                      ↓
                            Create User in SQLite
                                      ↓
                     Return JWT (15min) + Refresh (7 days)
                                      ↓
Frontend stores tokens in localStorage
                                      ↓
Every API request → Bearer token in Authorization header
                                      ↓
API Gateway validates JWT before proxying to service
```

### Auth Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | `/api/auth/register` | ❌ | Create account |
| POST | `/api/auth/login` | ❌ | Get JWT tokens |
| POST | `/api/auth/logout` | ✅ | Blacklist token |
| POST | `/api/auth/refresh` | ❌ | New access token |
| GET  | `/api/auth/me` | ✅ | Current user profile |

---

## ⚡ Redis Caching Strategy

**Cache-Aside Pattern**: Services check cache first, fetch from source on miss, then populate cache.

**Write-Through Invalidation**: On any write (POST/PUT/DELETE), the relevant cache keys are deleted to prevent stale reads.

**Graceful Fallback**: If Redis is not running, a `MockRedis` class backed by an in-memory `Map` with `setTimeout`-based TTL is used transparently. Zero configuration required.

---

## 🗂️ Service Registry (Eureka-like)

Inspired by Netflix Eureka, implemented in Node.js:

```
POST   /register              ← Service registers on startup
PUT    /heartbeat/:instanceId ← Heartbeat every 30s
DELETE /deregister/:name/:id  ← Graceful shutdown deregister
GET    /services              ← List all registered services
GET    /services/:name        ← Resolve URL (round-robin for multiple instances)
GET    /dashboard             ← Visual HTML dashboard (auto-refresh 10s)
```

The API Gateway resolves service URLs from the registry at request-time, with a static fallback map if the registry is temporarily unavailable.

---

## 🌐 API Gateway Patterns

| Pattern | Implementation |
|---|---|
| **Reverse Proxy** | `http-proxy-middleware` routes to microservices |
| **Rate Limiting** | `express-rate-limit`: 200 req/15min (global), 40 req/15min (auth) |
| **JWT Validation** | Verifies Bearer token on all non-auth routes |
| **Request Tracing** | `x-request-id` header injected on every request |
| **Service Discovery** | Queries registry at runtime, falls back to static map |
| **Error Handling** | 503 if service is down, 502 if proxy error occurs |

---

## 📁 Project Structure

```
Flora Yield/
├── .env                          ← Root environment variables
├── package.json                  ← Root: concurrently scripts
│
├── service-registry/             ← Eureka-like registry (port 3001)
│   └── index.js
│
├── api-gateway/                  ← API Gateway (port 3000)
│   └── index.js
│
├── services/
│   ├── auth-service/             ← JWT Auth (port 5001)
│   ├── climate-service/          ← Climate + Soil (port 5002)
│   ├── government-service/       ← Schemes + Mandi (port 5003)
│   ├── market-service/           ← Buyers + Suppliers (port 5004)
│   └── recommendation-service/   ← Crop AI (port 5005)
│
├── shared/
│   ├── redis.client.js           ← Redis + in-memory fallback
│   ├── logger.js                 ← Winston logger
│   └── registry.client.js       ← Service self-registration helper
│
├── backend/                      ← Legacy monolith (preserved)
│   └── prisma/
│       ├── schema.prisma         ← SQLite schema (User + Supplier + BuyerLead)
│       ├── seed.js
│       └── dev.db
│
└── frontend/                     ← React (Vite + Tailwind)
    └── src/
        ├── contexts/AuthContext.jsx
        ├── pages/LoginPage.jsx
        ├── pages/RegisterPage.jsx
        ├── components/ProtectedRoute.jsx
        └── api/client.js
```

---

## 🛠️ Individual Service Commands

```bash
# Start only the registry
npm run start:registry

# Start only the gateway
npm run start:gateway

# Start individual services
npm run start:auth
npm run start:climate
npm run start:gov
npm run start:market
npm run start:rec

# Frontend only
npm run start:frontend
```

---

## 🧪 Testing the API

```bash
# 1. Register a new farmer
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Rajan Sharma","email":"rajan@farm.com","password":"secure123"}'

# 2. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rajan@farm.com","password":"secure123"}'

# 3. Use token (replace TOKEN below)
curl http://localhost:3000/api/climate/profile \
  -H "Authorization: Bearer TOKEN"

# 4. Second call = cached (cached: true in response)
curl http://localhost:3000/api/climate/profile \
  -H "Authorization: Bearer TOKEN"

# 5. View service registry
curl http://localhost:3001/services
```

---

## 🔑 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | `flora-yield-super-secret...` | Change in production! |
| `JWT_EXPIRES_IN` | `15m` | Access token lifetime |
| `REDIS_HOST` | `127.0.0.1` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `AUTH_PORT` | `5001` | Auth service port |
| `CLIMATE_PORT` | `5002` | Climate service port |
| `GOV_PORT` | `5003` | Government service port |
| `MARKET_PORT` | `5004` | Market service port |
| `REC_PORT` | `5005` | Recommendation service port |
| `OPEN_WEATHER_KEY` | — | OpenWeatherMap API key |
| `DATA_GOV_KEY` | — | data.gov.in API key |

---

*Built for Mandi, Himachal Pradesh · Flora-Yield v2.0 · Microservices Architecture*
