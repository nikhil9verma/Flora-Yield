require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require(require('path').resolve(__dirname, '../../backend/node_modules/@prisma/client'));
const { RegistryClient } = require('../../shared/registry.client');
const { cacheGet, cacheSet, cacheDel } = require('../../shared/redis.client');

const app = express();
const PORT = process.env.AUTH_PORT || 5001;
const INSTANCE_ID = process.env.SERVICE_INSTANCE_ID || `auth-${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'flora-yield-super-secret-key-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days in seconds

// Prisma — points to the shared SQLite db
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${require('path').resolve(__dirname, '../../backend/prisma/dev.db')}` } },
});

app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));
app.use((_req, res, next) => {
  res.setHeader('x-service-name', 'auth-service');
  res.setHeader('x-service-port', String(PORT));
  res.setHeader('x-service-instance', INSTANCE_ID);
  next();
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'auth-service', port: PORT, instanceId: INSTANCE_ID })
);

// ─── POST /api/auth/register ──────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: 'name, email and password are required' });

    if (password.length < 6)
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ success: false, error: 'Invalid email format' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return res.status(409).json({ success: false, error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: role === 'admin' ? 'farmer' : (role || 'farmer') },
    });

    const accessToken = _signAccess(user);
    const refreshToken = _signRefresh(user);
    await cacheSet(`refresh:${user.id}`, refreshToken, REFRESH_EXPIRES_IN);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { user: _safeUser(user), accessToken, refreshToken, servedBy: { port: PORT, instanceId: INSTANCE_ID } },
    });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, error: 'email and password are required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid)
      return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const accessToken = _signAccess(user);
    const refreshToken = _signRefresh(user);
    await cacheSet(`refresh:${user.id}`, refreshToken, REFRESH_EXPIRES_IN);

    res.json({
      success: true,
      message: 'Login successful',
      data: { user: _safeUser(user), accessToken, refreshToken, servedBy: { port: PORT, instanceId: INSTANCE_ID } },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (token) {
      // Blacklist token for 15 min (access token lifetime)
      await cacheSet(`blacklist:${token}`, '1', 15 * 60);
    }
    const userId = req.headers['x-user-id'];
    if (userId) await cacheDel(`refresh:${userId}`);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch {
    res.json({ success: true, message: 'Logged out' });
  }
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(400).json({ success: false, error: 'refreshToken is required' });

    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    if (decoded.type !== 'refresh')
      return res.status(401).json({ success: false, error: 'Invalid refresh token' });

    const stored = await cacheGet(`refresh:${decoded.userId}`);
    if (!stored || stored !== refreshToken)
      return res.status(401).json({ success: false, error: 'Refresh token expired or revoked' });

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });

    const accessToken = _signAccess(user);
    res.json({ success: true, data: { accessToken } });
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
app.get('/api/auth/me', async (req, res) => {
  try {
    const userId = parseInt(req.headers['x-user-id']);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    res.json({ success: true, data: _safeUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not fetch user' });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _signAccess(user) {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function _signRefresh(user) {
  return jwt.sign({ userId: user.id, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
}

function _safeUser(user) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

// ─── Start + Register ─────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`🔐 Auth Service running on http://localhost:${PORT} (${INSTANCE_ID})`);
  const registry = new RegistryClient({ name: 'auth-service', port: PORT });
  await registry.register();
  registry.registerShutdownHook();
});

module.exports = app;
