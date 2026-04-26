require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.GATEWAY_PORT || 3000;
const REGISTRY_URL = process.env.REGISTRY_URL || 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET || 'flora-yield-super-secret-key-2024';
const IS_DEV = process.env.NODE_ENV !== 'production';

// ─── Static service routing map (fallback if registry is down) ────────────────
const STATIC_ROUTES = {
'auth-service': [
  `http://localhost:${process.env.AUTH_PORT    || 5001}`,
  'http://localhost:5007'
],
  'climate-service':        `http://localhost:${process.env.CLIMATE_PORT  || 5002}`,
  'government-service':     `http://localhost:${process.env.GOV_PORT      || 5003}`,
  'market-service':         `http://localhost:${process.env.MARKET_PORT   || 5004}`,
  'recommendation-service': `http://localhost:${process.env.REC_PORT      || 5005}`,
};

// ─── Resolve service URL via Registry (with static fallback) ─────────────────
async function resolveService(serviceName) {
  try {
    const { data } = await axios.get(`${REGISTRY_URL}/services/${serviceName}`, { timeout: 1500 });
    return data.url;
  } catch {
    const fallback = STATIC_ROUTES[serviceName];
    if (Array.isArray(fallback)) {
      return fallback[Math.floor(Math.random() * fallback.length)];
    }
    return fallback || null;
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(morgan('dev'));

// Request-ID tracing header
app.use((req, _res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4().slice(0, 8);
  next();
});

// ─── Rate Limiter ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: IS_DEV ? 2000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again after 15 minutes.' },
  skip: (req) => req.path === '/health',
});
app.use(limiter);

// Stricter limiter for auth routes (prevent brute-force)
// In dev: 1000 req/15min so testing is never blocked
// In production: 40 req/15min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_DEV ? 1000 : 40,
  message: { error: 'Too many auth attempts. Please try again later.' },
});

// ─── Gateway Health ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    routes: Object.keys(STATIC_ROUTES),
  });
});

// ─── JWT Auth Guard Middleware ────────────────────────────────────────────────
function jwtGuard(req, res, next) {
  // Public routes: auth endpoints
  const publicPaths = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];
  if (publicPaths.some((p) => req.path.startsWith(p))) return next();

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — missing Bearer token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.headers['x-user-id'] = String(decoded.userId);
    req.headers['x-user-role'] = decoded.role || 'farmer';
    req.headers['x-request-id'] = req.requestId;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired — please refresh' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── Dynamic Proxy Factory ────────────────────────────────────────────────────
function makeProxy(serviceName) {
  return async (req, res, next) => {
    const target = await resolveService(serviceName);
    if (!target) {
      return res.status(503).json({
        error: `Service "${serviceName}" is unavailable`,
        gateway: 'flora-yield-api-gateway',
      });
    }

    const proxy = createProxyMiddleware({
      target,
      changeOrigin: true,
      on: {
        error: (err, _req, _res) => {
          console.error(`[Gateway] Proxy error → ${serviceName}: ${err.message}`);
          if (!res.headersSent) {
            res.status(502).json({ error: `Bad Gateway — ${serviceName} unreachable` });
          }
        },
      },
    });

    proxy(req, res, next);
  };
}

// ─── Route Definitions ────────────────────────────────────────────────────────
// Use app.all with wildcard so Express does NOT strip the path prefix.
// This ensures /api/auth/register is forwarded as-is (not just /register).

// Auth routes — apply auth rate limiter
app.all('/api/auth*', authLimiter, jwtGuard, makeProxy('auth-service'));

// Protected routes — JWT guard + proxy
app.all('/api/climate*',        jwtGuard, makeProxy('climate-service'));
app.all('/api/government*',     jwtGuard, makeProxy('government-service'));
app.all('/api/suppliers*',      jwtGuard, makeProxy('market-service'));
app.all('/api/buyers*',         jwtGuard, makeProxy('market-service'));
app.all('/api/recommendation*', jwtGuard, makeProxy('recommendation-service'));

// ─── 404 for unmatched routes ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    availableRoutes: [
      '/api/auth', '/api/climate', '/api/government',
      '/api/suppliers', '/api/buyers', '/api/recommendation',
    ],
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚪 API Gateway running at http://localhost:${PORT}`);
  console.log(`   Mode:           ${IS_DEV ? 'development (relaxed rate limits)' : 'production'}`);
  console.log(`   Auth:           /api/auth → :${process.env.AUTH_PORT || 5001}, 5007`);
  console.log(`   Climate:        /api/climate → :${process.env.CLIMATE_PORT || 5002}`);
  console.log(`   Government:     /api/government → :${process.env.GOV_PORT || 5003}`);
  console.log(`   Market:         /api/suppliers & /api/buyers → :${process.env.MARKET_PORT || 5004}`);
  console.log(`   Recommendation: /api/recommendation → :${process.env.REC_PORT || 5005}`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`[Gateway] Port ${PORT} is already in use. Stop the existing process on this port or change GATEWAY_PORT.`);
    process.exit(1);
  }
  throw err;
});

module.exports = app;