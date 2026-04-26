const express = require('express');
const GovernmentIntelligenceService = require('../services/governmentIntelligence.service');

const router = express.Router();

// GET /api/government/schemes
router.get('/schemes', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const schemes = await GovernmentIntelligenceService.getAgriculturalSchemes(limit);
    res.json({ success: true, count: schemes.length, data: schemes });
  } catch (err) {
    next(err);
  }
});

// GET /api/government/mandi-prices?state=Himachal+Pradesh
router.get('/mandi-prices', async (req, res, next) => {
  try {
    const state = req.query.state || 'Himachal Pradesh';
    const limit = parseInt(req.query.limit) || 30;
    const prices = await GovernmentIntelligenceService.getMandiPrices(state, limit);
    res.json({ success: true, count: prices.length, data: prices });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
