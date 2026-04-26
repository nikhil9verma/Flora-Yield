require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');
const { RegistryClient } = require('../../shared/registry.client');
const { cacheGet, cacheSet, isUsingFallback } = require('../../shared/redis.client');

const app = express();
const PORT = process.env.CLIMATE_PORT || 5002;

const MANDI_LAT = 31.7084;
const MANDI_LON = 76.9320;
const CACHE_TTL = 30 * 60; // 30 minutes

app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'climate-service', port: PORT, cache: isUsingFallback() ? 'in-memory' : 'redis' })
);

// ─── GET /api/climate/profile ─────────────────────────────────────────────────
app.get('/api/climate/profile', async (req, res) => {
  const lat = parseFloat(req.query.lat) || MANDI_LAT;
  const lon = parseFloat(req.query.lon) || MANDI_LON;
  const cacheKey = `climate:${lat.toFixed(4)}:${lon.toFixed(4)}`;

  try {
    // 1. Check cache
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, data: cached });
    }

    // 2. Fetch fresh data
    const [weather, forecast, soil] = await Promise.all([
      _getCurrentWeather(lat, lon),
      _getForecast(lat, lon),
      _getSoilData(lat, lon),
    ]);

    const profile = { weather, forecast, soil, fetchedAt: new Date().toISOString() };

    // 3. Store in cache
    await cacheSet(cacheKey, profile, CACHE_TTL);

    res.json({ success: true, cached: false, data: profile });
  } catch (err) {
    console.error('[Climate] Profile error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch climate data' });
  }
});

// ─── GET /api/climate/weather ─────────────────────────────────────────────────
app.get('/api/climate/weather', async (req, res) => {
  const lat = parseFloat(req.query.lat) || MANDI_LAT;
  const lon = parseFloat(req.query.lon) || MANDI_LON;
  try {
    const data = await _getCurrentWeather(lat, lon);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/climate/forecast ────────────────────────────────────────────────
app.get('/api/climate/forecast', async (req, res) => {
  const lat = parseFloat(req.query.lat) || MANDI_LAT;
  const lon = parseFloat(req.query.lon) || MANDI_LON;
  try {
    const data = await _getForecast(lat, lon);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/climate/soil ────────────────────────────────────────────────────
app.get('/api/climate/soil', async (req, res) => {
  const lat = parseFloat(req.query.lat) || MANDI_LAT;
  const lon = parseFloat(req.query.lon) || MANDI_LON;
  try {
    const data = await _getSoilData(lat, lon);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Internals ────────────────────────────────────────────────────────────────
async function _getCurrentWeather(lat, lon) {
  const key = process.env.OPEN_WEATHER_KEY;
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric`;
  try {
    const { data } = await axios.get(url, { timeout: 8000 });
    return {
      temperature: data.main.temp, feelsLike: data.main.feels_like,
      humidity: data.main.humidity, description: data.weather[0].description,
      windSpeed: data.wind.speed, city: data.name, country: data.sys.country,
    };
  } catch {
    return { temperature: 22.4, feelsLike: 21.0, humidity: 68, description: 'partly cloudy', windSpeed: 3.2, city: 'Mandi', country: 'IN', _source: 'mock' };
  }
}

async function _getForecast(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=15&timezone=Asia%2FKolkata`;
  try {
    const { data } = await axios.get(url, { timeout: 8000 });
    const daily = data.daily;
    const totalRainfall = daily.precipitation_sum.reduce((s, v) => s + (v || 0), 0);
    const avgMaxTemp = daily.temperature_2m_max.reduce((s, v) => s + v, 0) / daily.temperature_2m_max.length;
    return {
      forecastDays: daily.time, maxTemps: daily.temperature_2m_max,
      minTemps: daily.temperature_2m_min, precipitation: daily.precipitation_sum,
      summary: {
        totalRainfallMm: parseFloat(totalRainfall.toFixed(2)),
        avgMaxTempC: parseFloat(avgMaxTemp.toFixed(1)),
        rainfallCategory: totalRainfall < 30 ? 'Low' : totalRainfall < 80 ? 'Moderate' : 'High',
      },
    };
  } catch {
    return { forecastDays: [], precipitation: [], summary: { totalRainfallMm: 52, avgMaxTempC: 24.5, rainfallCategory: 'Moderate' }, _source: 'mock' };
  }
}

async function _getSoilData(lat, lon) {
  const url = `https://rest.soilgrids.org/soilgrids/v2.0/properties/query?lat=${lat}&lon=${lon}&property=phh2o&property=soc&depth=0-5cm&value=mean`;
  try {
    const { data } = await axios.get(url, { timeout: 10000 });
    const layers = data.properties?.layers || [];
    const phLayer = layers.find((l) => l.name === 'phh2o');
    const socLayer = layers.find((l) => l.name === 'soc');
    const rawPh = phLayer?.depths?.[0]?.values?.mean;
    const rawSoc = socLayer?.depths?.[0]?.values?.mean;
    return {
      phH2O: rawPh != null ? parseFloat((rawPh / 10).toFixed(2)) : null,
      organicCarbonGkg: rawSoc != null ? parseFloat((rawSoc / 10).toFixed(2)) : null,
      depthCm: '0-5',
      interpretation: { ph: rawPh != null ? (rawPh / 10 < 6 ? 'Acidic' : rawPh / 10 <= 7.5 ? 'Neutral' : 'Alkaline') : 'Unknown' },
    };
  } catch {
    return { phH2O: 7.6, organicCarbonGkg: 12.4, depthCm: '0-5', interpretation: { ph: 'Alkaline' }, _source: 'mock' };
  }
}

// ─── Start + Register ─────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`🌤  Climate Service running on http://localhost:${PORT}`);
  const registry = new RegistryClient({ name: 'climate-service', port: PORT });
  await registry.register();
  registry.registerShutdownHook();
});

module.exports = app;
