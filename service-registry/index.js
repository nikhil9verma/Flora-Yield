require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.REGISTRY_PORT || 3001;

// ─── In-Memory Service Store ──────────────────────────────────────────────────
// { instanceId: { name, host, port, healthUrl, lastHeartbeat, status } }
const registry = new Map();

const HEARTBEAT_TIMEOUT_MS = 60_000; // 60s without heartbeat → DOWN

app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

// ─── Register a service instance ─────────────────────────────────────────────
app.post('/register', (req, res) => {
  const { instanceId, name, host, port, healthUrl } = req.body;
  if (!instanceId || !name || !port) {
    return res.status(400).json({ error: 'instanceId, name and port are required' });
  }

  registry.set(instanceId, {
    instanceId, name, host: host || 'localhost', port, healthUrl,
    registeredAt: new Date().toISOString(),
    lastHeartbeat: Date.now(),
    status: 'UP',
  });

  console.log(`[Registry] ✓ Registered: ${name} @ ${host}:${port} (${instanceId})`);
  res.status(201).json({ message: 'Registered', instanceId });
});

// ─── Heartbeat ────────────────────────────────────────────────────────────────
app.put('/heartbeat/:instanceId', (req, res) => {
  const instance = registry.get(req.params.instanceId);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  instance.lastHeartbeat = Date.now();
  instance.status = 'UP';
  res.json({ message: 'Heartbeat received', instanceId: req.params.instanceId });
});

// ─── Deregister ──────────────────────────────────────────────────────────────
app.delete('/deregister/:name/:instanceId', (req, res) => {
  const { instanceId } = req.params;
  if (registry.delete(instanceId)) {
    console.log(`[Registry] Deregistered: ${req.params.name} (${instanceId})`);
    return res.json({ message: 'Deregistered' });
  }
  res.status(404).json({ error: 'Instance not found' });
});

// ─── List all services ────────────────────────────────────────────────────────
app.get('/services', (_req, res) => {
  _markStaleInstances();
  const services = {};
  for (const inst of registry.values()) {
    if (!services[inst.name]) services[inst.name] = [];
    services[inst.name].push(inst);
  }
  res.json({ services, totalInstances: registry.size });
});

// ─── Resolve a single service (used by API Gateway) ──────────────────────────
app.get('/services/:name', (req, res) => {
  _markStaleInstances();
  const matches = [...registry.values()]
    .filter((i) => i.name === req.params.name && i.status === 'UP');

  if (!matches.length) {
    return res.status(404).json({ error: `No healthy instances of "${req.params.name}" found` });
  }

  // Simple round-robin (pick random UP instance)
  const instance = matches[Math.floor(Math.random() * matches.length)];
  res.json({ url: `http://${instance.host}:${instance.port}`, instance });
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'service-registry', uptime: process.uptime() });
});

// ─── Dashboard (HTML) ─────────────────────────────────────────────────────────
app.get('/dashboard', (_req, res) => {
  _markStaleInstances();
  const rows = [...registry.values()].map((i) => {
    const age = Math.round((Date.now() - i.lastHeartbeat) / 1000);
    const statusColor = i.status === 'UP' ? '#22c55e' : '#ef4444';
    return `<tr>
      <td>${i.name}</td>
      <td>${i.instanceId}</td>
      <td>${i.host}:${i.port}</td>
      <td style="color:${statusColor};font-weight:bold">${i.status}</td>
      <td>${age}s ago</td>
      <td>${i.registeredAt}</td>
    </tr>`;
  }).join('');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Flora-Yield Service Registry</title>
  <meta http-equiv="refresh" content="10" />
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
    h1 { color: #4ade80; margin-bottom: 0.25rem; }
    p { color: #64748b; margin-bottom: 2rem; }
    table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 12px; overflow: hidden; }
    th { background: #334155; padding: 12px 16px; text-align: left; color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 12px 16px; border-bottom: 1px solid #334155; font-size: 14px; }
    tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>🌱 Flora-Yield Service Registry</h1>
  <p>Auto-refreshes every 10s · ${registry.size} instance(s) registered</p>
  <table>
    <thead><tr>
      <th>Service</th><th>Instance ID</th><th>Address</th><th>Status</th><th>Last Heartbeat</th><th>Registered At</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#475569">No services registered yet</td></tr>'}</tbody>
  </table>
  <p style="margin-top:1rem;font-size:12px;">Endpoints: GET /services · POST /register · PUT /heartbeat/:id · DELETE /deregister/:name/:id</p>
</body>
</html>`);
});

// ─── Mark stale instances as DOWN ─────────────────────────────────────────────
function _markStaleInstances() {
  const now = Date.now();
  for (const inst of registry.values()) {
    if (now - inst.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
      inst.status = 'DOWN';
    }
  }
}

// Periodic stale check every 30s
setInterval(_markStaleInstances, 30_000);

app.listen(PORT, () => {
  console.log(`🗂  Service Registry running at http://localhost:${PORT}`);
  console.log(`📊  Dashboard: http://localhost:${PORT}/dashboard`);
});

module.exports = app;
