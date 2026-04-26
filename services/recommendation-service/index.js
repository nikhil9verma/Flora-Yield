require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');
const { RegistryClient } = require('../../shared/registry.client');
const { cacheGet, cacheSet, isUsingFallback } = require('../../shared/redis.client');

const app = express();
const PORT = process.env.REC_PORT || 5005;
const CACHE_TTL = 60 * 60; // 1 hour

app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'recommendation-service', port: PORT, cache: isUsingFallback() ? 'in-memory' : 'redis' })
);

// ─── GET /api/recommendation ──────────────────────────────────────────────────
app.get('/api/recommendation', async (req, res) => {
  const lat = parseFloat(req.query.lat) || 31.7084;
  const lon = parseFloat(req.query.lon) || 76.9320;
  const cacheKey = `rec:${lat.toFixed(4)}:${lon.toFixed(4)}`;

  try {
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ success: true, cached: true, data: cached });

    // Fetch climate profile from climate-service
    let profile = { lat, lon };
    try {
      const CLIMATE_URL = process.env.CLIMATE_URL || `http://localhost:${process.env.CLIMATE_PORT || 5002}`;
      const { data } = await axios.get(`${CLIMATE_URL}/api/climate/profile?lat=${lat}&lon=${lon}`, { timeout: 10000 });
      profile = { ...profile, ...data.data };
    } catch {
      // Use defaults if climate service unavailable
      profile.forecast = { summary: { avgMaxTempC: 24.5, rainfallCategory: 'Moderate', totalRainfallMm: 52 } };
      profile.soil = { phH2O: 7.6 };
    }

    const recommendation = generateRecommendation(profile);
    await cacheSet(cacheKey, recommendation, CACHE_TTL);
    res.json({ success: true, cached: false, data: recommendation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Crop Profiles ────────────────────────────────────────────────────────────
const CROP_PROFILES = [
  { name: 'Ashwagandha', scientificName: 'Withania somnifera', category: 'Medicinal Herb', optimalPh: { min: 7.5, max: 8.5 }, optimalTempC: { min: 20, max: 35 }, rainfallCategory: ['Low', 'Moderate'], baseMarketPrice: 280, avgYieldKgPerHa: 500, growthDays: 150, profitMarginBase: 68, description: 'High-demand ayurvedic adaptogen. HP alkaline soils are ideal. NMPB subsidy eligible.', subsidyAvailable: true, riskLevel: 'Low' },
  { name: 'Chamomile', scientificName: 'Matricaria chamomilla', category: 'Aromatic Herb', optimalPh: { min: 5.6, max: 7.5 }, optimalTempC: { min: 15, max: 28 }, rainfallCategory: ['Moderate'], baseMarketPrice: 420, avgYieldKgPerHa: 350, growthDays: 120, profitMarginBase: 72, description: 'Premium export commodity. Cool Mandi winters are advantageous.', subsidyAvailable: true, riskLevel: 'Medium' },
  { name: 'Lavender', scientificName: 'Lavandula angustifolia', category: 'Aromatic Herb', optimalPh: { min: 6.5, max: 8.0 }, optimalTempC: { min: 15, max: 30 }, rainfallCategory: ['Low', 'Moderate'], baseMarketPrice: 650, avgYieldKgPerHa: 250, growthDays: 180, profitMarginBase: 78, description: 'High-value essential oil crop. HP altitude mirrors French Provence.', subsidyAvailable: false, riskLevel: 'Medium' },
  { name: 'Stevia', scientificName: 'Stevia rebaudiana', category: 'Sugar Substitute', optimalPh: { min: 6.5, max: 7.5 }, optimalTempC: { min: 22, max: 35 }, rainfallCategory: ['Moderate', 'High'], baseMarketPrice: 210, avgYieldKgPerHa: 2000, growthDays: 100, profitMarginBase: 65, description: 'Natural sweetener with growing demand. Multiple annual harvests.', subsidyAvailable: false, riskLevel: 'Low' },
];

function scoreCrop(crop, { ph, avgTempC, rainfallCategory }) {
  let score = 0;
  const reasons = [], warnings = [];
  if (ph >= crop.optimalPh.min && ph <= crop.optimalPh.max) { score += 35; reasons.push(`Soil pH ${ph} is within ideal range.`); }
  else { const dev = Math.min(Math.abs(ph - crop.optimalPh.min), Math.abs(ph - crop.optimalPh.max)); score += Math.max(0, 35 - dev * 12); warnings.push(`pH ${ph} deviates; amendment recommended.`); }
  if (avgTempC >= crop.optimalTempC.min && avgTempC <= crop.optimalTempC.max) { score += 35; reasons.push(`Avg temp ${avgTempC}°C suits ${crop.name}.`); }
  else { const dev = Math.min(Math.abs(avgTempC - crop.optimalTempC.min), Math.abs(avgTempC - crop.optimalTempC.max)); score += Math.max(0, 35 - dev * 3); warnings.push(`Temperature slightly outside ideal.`); }
  if (crop.rainfallCategory.includes(rainfallCategory)) { score += 30; reasons.push(`${rainfallCategory} rainfall matches ${crop.name}'s needs.`); }
  else { score += 10; warnings.push(`Rainfall mismatch; drip irrigation may be needed.`); }
  return { score: Math.round(score), reasons, warnings };
}

function generateRecommendation(profile) {
  const ph = profile.soil?.phH2O ?? 7.6;
  const avgTempC = profile.forecast?.summary?.avgMaxTempC ?? 24.5;
  const rainfallCategory = profile.forecast?.summary?.rainfallCategory ?? 'Moderate';
  const totalRainfallMm = profile.forecast?.summary?.totalRainfallMm ?? 52;

  const ranked = CROP_PROFILES.map((crop) => {
    const { score, reasons, warnings } = scoreCrop(crop, { ph, avgTempC, rainfallCategory });
    const priceMultiplier = rainfallCategory === 'Low' ? 1.08 : 1.0;
    const projectedPricePerKg = Math.round(crop.baseMarketPrice * priceMultiplier);
    const revenuePerHa = projectedPricePerKg * crop.avgYieldKgPerHa;
    const inputCostPerHa = Math.round(revenuePerHa * (1 - crop.profitMarginBase / 100));
    return { rank: 0, cropName: crop.name, scientificName: crop.scientificName, category: crop.category, fitScore: score, description: crop.description, subsidyAvailable: crop.subsidyAvailable, riskLevel: crop.riskLevel, growthDays: crop.growthDays, projectedMarketPricePerKg: projectedPricePerKg, avgYieldKgPerHa: crop.avgYieldKgPerHa, projectedRevenuePerHa: revenuePerHa, estimatedInputCostPerHa: inputCostPerHa, projectedProfitPerHa: revenuePerHa - inputCostPerHa, profitMarginPercent: crop.profitMarginBase, reasons, warnings };
  }).sort((a, b) => b.fitScore - a.fitScore);

  ranked.forEach((c, i) => (c.rank = i + 1));
  return { analysedAt: new Date().toISOString(), location: { lat: profile.lat, lon: profile.lon }, inputParameters: { ph, avgTempC, rainfallCategory, totalRainfallMm }, topRecommendation: ranked[0], allRankedCrops: ranked, engineVersion: '2.0.0-microservice', disclaimer: 'Heuristic engine. Consult a local agronomist for final decisions.' };
}

app.listen(PORT, async () => {
  console.log(`🌾 Recommendation Service running on http://localhost:${PORT}`);
  const registry = new RegistryClient({ name: 'recommendation-service', port: PORT });
  await registry.register();
  registry.registerShutdownHook();
});

module.exports = app;
