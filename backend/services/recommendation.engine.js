/**
 * RecommendationEngine — Heuristic "Mock ML" model
 *
 * Evaluates aggregated climate + soil parameters to suggest the
 * most profitable commercial crop for the given conditions.
 *
 * Decision matrix is designed around Mandi, HP agro-climatic zone.
 */

const CROP_PROFILES = [
  {
    name: 'Ashwagandha',
    scientificName: 'Withania somnifera',
    category: 'Medicinal Herb',
    optimalPh: { min: 7.5, max: 8.5 },
    optimalTempC: { min: 20, max: 35 },
    rainfallCategory: ['Low', 'Moderate'],
    baseMarketPrice: 280, // ₹/kg
    avgYieldKgPerHa: 500,
    growthDays: 150,
    profitMarginBase: 68,
    description:
      'High-demand ayurvedic adaptogen. HP alkaline soils are ideal. NMPB subsidy eligible.',
    subsidyAvailable: true,
    riskLevel: 'Low',
  },
  {
    name: 'Chamomile',
    scientificName: 'Matricaria chamomilla',
    category: 'Aromatic Herb',
    optimalPh: { min: 5.6, max: 7.5 },
    optimalTempC: { min: 15, max: 28 },
    rainfallCategory: ['Moderate'],
    baseMarketPrice: 420,
    avgYieldKgPerHa: 350,
    growthDays: 120,
    profitMarginBase: 72,
    description:
      'Premium export commodity for pharma and cosmetics. Cool Mandi winters are advantageous.',
    subsidyAvailable: true,
    riskLevel: 'Medium',
  },
  {
    name: 'Lavender',
    scientificName: 'Lavandula angustifolia',
    category: 'Aromatic Herb',
    optimalPh: { min: 6.5, max: 8.0 },
    optimalTempC: { min: 15, max: 30 },
    rainfallCategory: ['Low', 'Moderate'],
    baseMarketPrice: 650,
    avgYieldKgPerHa: 250,
    growthDays: 180,
    profitMarginBase: 78,
    description:
      'High-value essential oil crop. HP altitude and climate mirror French Provence conditions.',
    subsidyAvailable: false,
    riskLevel: 'Medium',
  },
  {
    name: 'Stevia',
    scientificName: 'Stevia rebaudiana',
    category: 'Sugar Substitute',
    optimalPh: { min: 6.5, max: 7.5 },
    optimalTempC: { min: 22, max: 35 },
    rainfallCategory: ['Moderate', 'High'],
    baseMarketPrice: 210,
    avgYieldKgPerHa: 2000,
    growthDays: 100,
    profitMarginBase: 65,
    description:
      'Natural sweetener with growing demand. Multiple annual harvests possible in HP plains.',
    subsidyAvailable: false,
    riskLevel: 'Low',
  },
];

/**
 * Score a crop profile against observed environmental parameters
 * Returns a score 0–100 and a set of reasoning strings
 */
function scoreCrop(crop, { ph, avgTempC, rainfallCategory }) {
  let score = 0;
  const reasons = [];
  const warnings = [];

  // ── pH scoring ────────────────────────────────────────────────────────────
  if (ph >= crop.optimalPh.min && ph <= crop.optimalPh.max) {
    score += 35;
    reasons.push(`Soil pH ${ph} is within ideal range (${crop.optimalPh.min}–${crop.optimalPh.max}).`);
  } else {
    const deviation = Math.min(
      Math.abs(ph - crop.optimalPh.min),
      Math.abs(ph - crop.optimalPh.max)
    );
    const partial = Math.max(0, 35 - deviation * 12);
    score += partial;
    warnings.push(`pH ${ph} deviates from ideal. Lime/sulphur amendment recommended.`);
  }

  // ── Temperature scoring ───────────────────────────────────────────────────
  if (avgTempC >= crop.optimalTempC.min && avgTempC <= crop.optimalTempC.max) {
    score += 35;
    reasons.push(`Avg temperature ${avgTempC}°C suits ${crop.name}.`);
  } else {
    const deviation = Math.min(
      Math.abs(avgTempC - crop.optimalTempC.min),
      Math.abs(avgTempC - crop.optimalTempC.max)
    );
    score += Math.max(0, 35 - deviation * 3);
    warnings.push(`Temperature slightly outside ideal; consider protected cultivation.`);
  }

  // ── Rainfall scoring ──────────────────────────────────────────────────────
  if (crop.rainfallCategory.includes(rainfallCategory)) {
    score += 30;
    reasons.push(`${rainfallCategory} rainfall matches ${crop.name}'s water requirements.`);
  } else {
    score += 10;
    warnings.push(`Rainfall category mismatch. Drip irrigation may be required.`);
  }

  return { score: Math.round(score), reasons, warnings };
}

/**
 * Main recommendation function
 * @param {object} profile - aggregated climate and soil data
 * @returns {object} - ranked crops with profit projections
 */
function generateRecommendation(profile) {
  const ph = profile.soil?.phH2O ?? 7.6;
  const avgTempC = profile.forecast?.summary?.avgMaxTempC ?? 24.5;
  const rainfallCategory = profile.forecast?.summary?.rainfallCategory ?? 'Moderate';
  const totalRainfallMm = profile.forecast?.summary?.totalRainfallMm ?? 52;

  // Score all crops
  const ranked = CROP_PROFILES.map((crop) => {
    const { score, reasons, warnings } = scoreCrop(crop, { ph, avgTempC, rainfallCategory });

    // Adjust price based on rainfall (drought stress premium)
    const priceMultiplier = rainfallCategory === 'Low' ? 1.08 : 1.0;
    const projectedPricePerKg = Math.round(crop.baseMarketPrice * priceMultiplier);

    // Projected profit per hectare
    const revenuePerHa = projectedPricePerKg * crop.avgYieldKgPerHa;
    const inputCostPerHa = Math.round(revenuePerHa * (1 - crop.profitMarginBase / 100));
    const profitPerHa = revenuePerHa - inputCostPerHa;

    return {
      rank: 0, // assigned after sort
      cropName: crop.name,
      scientificName: crop.scientificName,
      category: crop.category,
      fitScore: score,
      description: crop.description,
      subsidyAvailable: crop.subsidyAvailable,
      riskLevel: crop.riskLevel,
      growthDays: crop.growthDays,
      projectedMarketPricePerKg: projectedPricePerKg,
      avgYieldKgPerHa: crop.avgYieldKgPerHa,
      projectedRevenuePerHa: revenuePerHa,
      estimatedInputCostPerHa: inputCostPerHa,
      projectedProfitPerHa: profitPerHa,
      profitMarginPercent: crop.profitMarginBase,
      reasons,
      warnings,
    };
  }).sort((a, b) => b.fitScore - a.fitScore);

  // Assign ranks
  ranked.forEach((c, i) => (c.rank = i + 1));

  return {
    analysedAt: new Date().toISOString(),
    location: { lat: profile.lat, lon: profile.lon },
    inputParameters: { ph, avgTempC, rainfallCategory, totalRainfallMm },
    topRecommendation: ranked[0],
    allRankedCrops: ranked,
    engineVersion: '1.0.0-heuristic',
    disclaimer:
      'Recommendation generated by heuristic engine. Consult a local agronomist for final decisions.',
  };
}

module.exports = { generateRecommendation, CROP_PROFILES };
