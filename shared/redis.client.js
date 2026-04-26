/**
 * Redis Client — with graceful in-memory fallback
 * If Redis is not running, uses a Map-based mock with TTL support.
 * Zero configuration required.
 */

let redis = null;
let usingFallback = false;

// ─── In-Memory Fallback (MockRedis) ──────────────────────────────────────────
class MockRedis {
  constructor() {
    this.store = new Map();
    this.timers = new Map();
    console.warn('[Redis] Using in-memory fallback cache (Redis not available)');
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    return entry.value;
  }

  async set(key, value, ...args) {
    // Handle: set(key, value, 'EX', seconds)
    let ttlMs = null;
    for (let i = 0; i < args.length - 1; i++) {
      if (typeof args[i] === 'string' && args[i].toUpperCase() === 'EX') {
        ttlMs = parseInt(args[i + 1]) * 1000;
      }
    }
    this.store.set(key, { value });
    if (ttlMs) {
      if (this.timers.has(key)) clearTimeout(this.timers.get(key));
      const timer = setTimeout(() => {
        this.store.delete(key);
        this.timers.delete(key);
      }, ttlMs);
      this.timers.set(key, timer);
    }
    return 'OK';
  }

  async del(key) {
    const existed = this.store.has(key);
    this.store.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    return existed ? 1 : 0;
  }

  async exists(key) {
    return this.store.has(key) ? 1 : 0;
  }

  async expire(key, seconds) {
    if (!this.store.has(key)) return 0;
    if (this.timers.has(key)) clearTimeout(this.timers.get(key));
    const timer = setTimeout(() => {
      this.store.delete(key);
      this.timers.delete(key);
    }, seconds * 1000);
    this.timers.set(key, timer);
    return 1;
  }

  async keys(pattern) {
    // Simple wildcard matching (only supports * at end)
    const prefix = pattern.replace('*', '');
    return [...this.store.keys()].filter((k) => k.startsWith(prefix));
  }

  async flushall() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.store.clear();
    this.timers.clear();
    return 'OK';
  }

  on() { return this; } // no-op event emitter compatibility
  quit() { return Promise.resolve('OK'); }
}

// ─── Redis Initializer ────────────────────────────────────────────────────────
async function getRedisClient() {
  if (redis) return redis;

  try {
    const IORedis = require('ioredis');
    const client = new IORedis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    await client.connect();
    await client.ping();

    console.log('[Redis] Connected to Redis successfully ✓');
    redis = client;
    return redis;
  } catch {
    usingFallback = true;
    redis = new MockRedis();
    return redis;
  }
}

// ─── Cache Helpers ────────────────────────────────────────────────────────────
async function cacheGet(key) {
  const client = await getRedisClient();
  const val = await client.get(key);
  return val ? JSON.parse(val) : null;
}

async function cacheSet(key, data, ttlSeconds = 300) {
  const client = await getRedisClient();
  await client.set(key, JSON.stringify(data), 'EX', ttlSeconds);
}

async function cacheDel(key) {
  const client = await getRedisClient();
  await client.del(key);
}

async function cacheExists(key) {
  const client = await getRedisClient();
  return (await client.exists(key)) === 1;
}

function isUsingFallback() {
  return usingFallback;
}

module.exports = { getRedisClient, cacheGet, cacheSet, cacheDel, cacheExists, isUsingFallback };
