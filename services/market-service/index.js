require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { PrismaClient } = require(require('path').resolve(__dirname, '../../backend/node_modules/@prisma/client'));
const { RegistryClient } = require('../../shared/registry.client');
const { cacheGet, cacheSet, cacheDel } = require('../../shared/redis.client');

const app = express();
const PORT = process.env.MARKET_PORT || 5004;
const CACHE_TTL = 5 * 60;
const VALID_CATEGORIES = ['Manure', 'Fertilizer', 'Pesticide', 'Machinery'];

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${path.resolve(__dirname, '../../backend/prisma/dev.db')}` } },
});

app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'market-service', port: PORT })
);

// ── SUPPLIERS ─────────────────────────────────────────────────────────────────
app.get('/api/suppliers', async (req, res) => {
  const { category, verified } = req.query;
  const ck = `suppliers:${category || 'all'}:${verified || 'all'}`;
  try {
    const cached = await cacheGet(ck);
    if (cached) return res.json({ success: true, cached: true, count: cached.length, data: cached });
    const where = {};
    if (category && VALID_CATEGORIES.includes(category)) where.category = category;
    if (verified === 'true') where.verifiedStatus = true;
    if (verified === 'false') where.verifiedStatus = false;
    const suppliers = await prisma.supplier.findMany({ where, orderBy: { createdAt: 'desc' } });
    await cacheSet(ck, suppliers, CACHE_TTL);
    res.json({ success: true, cached: false, count: suppliers.length, data: suppliers });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/suppliers/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });
  try {
    const s = await prisma.supplier.findUnique({ where: { id } });
    if (!s) return res.status(404).json({ success: false, error: 'Supplier not found' });
    res.json({ success: true, data: s });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/suppliers', async (req, res) => {
  const { businessName, category, contactNumber, address, verifiedStatus } = req.body;
  if (!businessName || !category || !contactNumber || !address)
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  if (!VALID_CATEGORIES.includes(category))
    return res.status(400).json({ success: false, error: `Category must be: ${VALID_CATEGORIES.join(', ')}` });
  try {
    const s = await prisma.supplier.create({ data: { businessName, category, contactNumber, address, verifiedStatus: !!verifiedStatus } });
    await _clearSupplierCache();
    res.status(201).json({ success: true, data: s });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.put('/api/suppliers/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });
  const { businessName, category, contactNumber, address, verifiedStatus } = req.body;
  if (category && !VALID_CATEGORIES.includes(category))
    return res.status(400).json({ success: false, error: `Category must be: ${VALID_CATEGORIES.join(', ')}` });
  const upd = {};
  if (businessName !== undefined) upd.businessName = businessName;
  if (category !== undefined) upd.category = category;
  if (contactNumber !== undefined) upd.contactNumber = contactNumber;
  if (address !== undefined) upd.address = address;
  if (verifiedStatus !== undefined) upd.verifiedStatus = !!verifiedStatus;
  if (!Object.keys(upd).length) return res.status(400).json({ success: false, error: 'No valid fields' });
  try {
    const s = await prisma.supplier.update({ where: { id }, data: upd });
    await _clearSupplierCache();
    res.json({ success: true, data: s });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, error: 'Supplier not found' });
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/suppliers/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });
  try {
    await prisma.supplier.delete({ where: { id } });
    await _clearSupplierCache();
    res.json({ success: true, message: 'Supplier deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, error: 'Supplier not found' });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── BUYERS ────────────────────────────────────────────────────────────────────
app.get('/api/buyers', async (req, res) => {
  const { crop } = req.query;
  const ck = `buyers:${crop || 'all'}`;
  try {
    const cached = await cacheGet(ck);
    if (cached) return res.json({ success: true, cached: true, count: cached.length, data: cached });
    const where = crop ? { targetCrop: { contains: crop } } : {};
    const buyers = await prisma.buyerLead.findMany({ where, orderBy: { offeredPricePerKg: 'desc' } });
    await cacheSet(ck, buyers, CACHE_TTL);
    res.json({ success: true, cached: false, count: buyers.length, data: buyers });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/buyers/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });
  try {
    const b = await prisma.buyerLead.findUnique({ where: { id } });
    if (!b) return res.status(404).json({ success: false, error: 'Buyer not found' });
    res.json({ success: true, data: b });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/buyers', async (req, res) => {
  const { companyName, targetCrop, requiredQuantityKg, offeredPricePerKg, contactEmail, contactPhone } = req.body;
  if (!companyName || !targetCrop || !contactEmail || !contactPhone)
    return res.status(400).json({ success: false, error: 'companyName, targetCrop, contactEmail, contactPhone required' });
  const qty = parseFloat(requiredQuantityKg);
  const price = parseFloat(offeredPricePerKg);
  if (isNaN(qty) || qty <= 0) return res.status(400).json({ success: false, error: 'requiredQuantityKg must be positive' });
  if (isNaN(price) || price <= 0) return res.status(400).json({ success: false, error: 'offeredPricePerKg must be positive' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
    return res.status(400).json({ success: false, error: 'Invalid contactEmail' });
  try {
    const b = await prisma.buyerLead.create({ data: { companyName, targetCrop, requiredQuantityKg: qty, offeredPricePerKg: price, contactEmail, contactPhone } });
    await cacheDel('buyers:all');
    res.status(201).json({ success: true, data: b });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/buyers/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });
  try {
    await prisma.buyerLead.delete({ where: { id } });
    await cacheDel('buyers:all');
    res.json({ success: true, message: 'Buyer deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, error: 'Buyer not found' });
    res.status(500).json({ success: false, error: err.message });
  }
});

async function _clearSupplierCache() {
  for (const cat of ['all', ...VALID_CATEGORIES])
    for (const v of ['all', 'true', 'false'])
      await cacheDel(`suppliers:${cat}:${v}`);
}

app.listen(PORT, async () => {
  console.log(`🛒 Market Service running on http://localhost:${PORT}`);
  const registry = new RegistryClient({ name: 'market-service', port: PORT });
  await registry.register();
  registry.registerShutdownHook();
});

module.exports = app;
