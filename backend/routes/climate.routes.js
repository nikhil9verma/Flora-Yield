const express = require('express');
const ClimateAndSoilService = require('../services/climateAndSoil.service');

const router = express.Router();

// GET /api/climate/profile?lat=31.70&lon=76.93
router.get('/profile', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat) || 31.7084;
    const lon = parseFloat(req.query.lon) || 76.9320;
    const profile = await ClimateAndSoilService.getFullProfile(lat, lon);
    res.json({ success: true, data: { ...profile, lat, lon } });
  } catch (err) {
    next(err);
  }
});

// GET /api/climate/weather?lat=31.70&lon=76.93
router.get('/weather', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat) || 31.7084;
    const lon = parseFloat(req.query.lon) || 76.9320;
    const weather = await ClimateAndSoilService.getCurrentWeather(lat, lon);
    res.json({ success: true, data: weather });
  } catch (err) {
    next(err);
  }
});

// GET /api/climate/forecast
router.get('/forecast', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat) || 31.7084;
    const lon = parseFloat(req.query.lon) || 76.9320;
    const forecast = await ClimateAndSoilService.getForecast(lat, lon);
    res.json({ success: true, data: forecast });
  } catch (err) {
    next(err);
  }
});

// GET /api/climate/soil
router.get('/soil', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat) || 31.7084;
    const lon = parseFloat(req.query.lon) || 76.9320;
    const soil = await ClimateAndSoilService.getSoilData(lat, lon);
    res.json({ success: true, data: soil });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
