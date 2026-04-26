require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');
const { RegistryClient } = require('../../shared/registry.client');
const { cacheGet, cacheSet, isUsingFallback } = require('../../shared/redis.client');

const app = express();
const PORT = process.env.GOV_PORT || 5003;
const DATA_GOV_BASE = 'https://api.data.gov.in/resource';

const SCHEMES_CACHE_TTL  = 6  * 60 * 60; // 6 hours
const MANDI_CACHE_TTL    = 15 * 60;       // 15 minutes

app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'government-service', port: PORT, cache: isUsingFallback() ? 'in-memory' : 'redis' })
);

// ─── GET /api/government/schemes ─────────────────────────────────────────────
app.get('/api/government/schemes', async (_req, res) => {
  const cacheKey = 'gov:schemes';
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ success: true, cached: true, data: cached });

    const data = await _fetchSchemes();
    await cacheSet(cacheKey, data, SCHEMES_CACHE_TTL);
    res.json({ success: true, cached: false, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/government/mandi-prices ────────────────────────────────────────
app.get('/api/government/mandi-prices', async (req, res) => {
  const state = req.query.state || 'Himachal Pradesh';
  const cacheKey = `gov:mandi:${state.replace(/\s/g, '_')}`;
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ success: true, cached: true, data: cached });

    const data = await _fetchMandiPrices(state);
    await cacheSet(cacheKey, data, MANDI_CACHE_TTL);
    res.json({ success: true, cached: false, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Internals ────────────────────────────────────────────────────────────────
async function _fetchSchemes(limit = 20) {
  const key = process.env.DATA_GOV_KEY;
  const resourceId = 'placeholder-scheme-id';
  const url = `${DATA_GOV_BASE}/${resourceId}?api-key=${key}&format=json&limit=${limit}`;
  try {
    const { data } = await axios.get(url, { timeout: 10000 });
    const records = data?.records ?? [];
    if (!records.length) throw new Error('Empty records');
    return records;
  } catch {
    return MOCK_SCHEMES;
  }
}

async function _fetchMandiPrices(state = 'Himachal Pradesh', limit = 30) {
  const key = process.env.DATA_GOV_KEY;
  const resourceId = '9ef84268-d588-465a-a308-a864a43d0070';
  const url = `${DATA_GOV_BASE}/${resourceId}?api-key=${key}&format=json&limit=${limit}&filters[State.keyword]=${encodeURIComponent(state)}`;
  try {
    const { data } = await axios.get(url, { timeout: 10000 });
    const records = data?.records ?? [];
    if (!records.length) throw new Error('Empty records');
    return records;
  } catch {
    return MOCK_MANDI_PRICES;
  }
}

const MOCK_SCHEMES = [
  { schemeName: 'PM-KISAN Samman Nidhi', ministry: 'Ministry of Agriculture & Farmers Welfare', benefit: '₹6,000/year direct income support in 3 equal instalments', eligibility: 'All landholding farmer families', applyLink: 'https://pmkisan.gov.in' },
  { schemeName: 'Paramparagat Krishi Vikas Yojana (PKVY)', ministry: 'Ministry of Agriculture & Farmers Welfare', benefit: '₹50,000/ha over 3 years for organic farming', eligibility: 'Farmers in clusters of 50 acres', applyLink: 'https://pgsindia-ncof.gov.in' },
  { schemeName: 'HP Horticulture Development Programme', ministry: 'HP State Government', benefit: '50% subsidy on planting material, tools, and irrigation', eligibility: 'HP resident farmers', applyLink: 'https://hpagrisnet.gov.in' },
  { schemeName: 'Soil Health Card Scheme', ministry: 'Ministry of Agriculture & Farmers Welfare', benefit: 'Free soil testing + customized fertilizer recommendation', eligibility: 'All farmers across India', applyLink: 'https://soilhealth.dac.gov.in' },
  { schemeName: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)', ministry: 'Ministry of Agriculture & Farmers Welfare', benefit: 'Crop insurance at 2% premium for Kharif, 1.5% for Rabi', eligibility: 'All farmers growing notified crops', applyLink: 'https://pmfby.gov.in' },
  { schemeName: 'National Medicinal Plants Board (NMPB) Grant', ministry: 'AYUSH Ministry', benefit: '30–50% subsidy on cultivation of medicinal plants', eligibility: 'Farmers cultivating AYUSH-listed plants', applyLink: 'https://nmpb.nic.in' },
];

const MOCK_MANDI_PRICES = [
  { commodity: 'Ashwagandha (Root)', market: 'Mandi APMC', minPrice: 240, maxPrice: 310, modalPrice: 280, unit: '₹/kg', date: new Date().toISOString().slice(0, 10) },
  { commodity: 'Chamomile (Dried)', market: 'Sunder Nagar Mandi', minPrice: 380, maxPrice: 460, modalPrice: 420, unit: '₹/kg', date: new Date().toISOString().slice(0, 10) },
  { commodity: 'Lavender', market: 'Kullu APMC', minPrice: 580, maxPrice: 720, modalPrice: 650, unit: '₹/kg', date: new Date().toISOString().slice(0, 10) },
  { commodity: 'Tomato', market: 'Mandi APMC', minPrice: 18, maxPrice: 35, modalPrice: 26, unit: '₹/kg', date: new Date().toISOString().slice(0, 10) },
  { commodity: 'Apple (Delicious)', market: 'Mandi APMC', minPrice: 55, maxPrice: 110, modalPrice: 82, unit: '₹/kg', date: new Date().toISOString().slice(0, 10) },
  { commodity: 'Ginger (Fresh)', market: 'Joginder Nagar Mandi', minPrice: 45, maxPrice: 68, modalPrice: 55, unit: '₹/kg', date: new Date().toISOString().slice(0, 10) },
  { commodity: 'Maize', market: 'Mandi APMC', minPrice: 20, maxPrice: 28, modalPrice: 24, unit: '₹/kg', date: new Date().toISOString().slice(0, 10) },
  { commodity: 'Potato', market: 'Sundernagar APMC', minPrice: 12, maxPrice: 22, modalPrice: 16, unit: '₹/kg', date: new Date().toISOString().slice(0, 10) },
];

app.listen(PORT, async () => {
  console.log(`🏛  Government Service running on http://localhost:${PORT}`);
  const registry = new RegistryClient({ name: 'government-service', port: PORT });
  await registry.register();
  registry.registerShutdownHook();
});

module.exports = app;
