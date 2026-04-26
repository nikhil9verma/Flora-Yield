const express = require('express');
const ClimateAndSoilService = require('../services/climateAndSoil.service');
const { generateRecommendation } = require('../services/recommendation.engine');

const router = express.Router();

/**
 * GET /api/recommendation
 * Query params: lat, lon
 *
 * Pipeline:
 *  1. Fetch full climate + soil profile for coordinates
 *  2. Pass to heuristic engine
 *  3. Return ranked crop recommendations with profit projections
 */
router.get('/', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat) || 31.7084;
    const lon = parseFloat(req.query.lon) || 76.9320;

    // Step 1: Gather environmental intelligence
    const profile = await ClimateAndSoilService.getFullProfile(lat, lon);

    // Step 2: Run heuristic engine
    const recommendation = generateRecommendation({ ...profile, lat, lon });

    res.json({ success: true, data: recommendation });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/recommendation
 * Body: { ph, avgTempC, rainfallCategory, lat, lon }
 * For manual override / demo mode — bypasses external APIs
 */
router.post('/', async (req, res, next) => {
  try {
    // ✅ Bug Fix #7: use ?? not || so ph=0 is not replaced with default
    const body = req.body || {};
    const ph = body.ph ?? 7.6;
    const avgTempC = body.avgTempC ?? 24.5;
    const lat = body.lat ?? 31.7084;
    const lon = body.lon ?? 76.932;

    const VALID_RAINFALL = ['Low', 'Moderate', 'High'];
    const rainfallCategory = VALID_RAINFALL.includes(body.rainfallCategory)
      ? body.rainfallCategory
      : 'Moderate';

    const manualProfile = {
      lat,
      lon,
      soil: { phH2O: ph },
      forecast: {
        summary: {
          avgMaxTempC: avgTempC,
          rainfallCategory,
          totalRainfallMm: body.totalRainfallMm ?? 52,
        },
      },
    };

    const recommendation = generateRecommendation(manualProfile);
    res.json({ success: true, data: recommendation });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
