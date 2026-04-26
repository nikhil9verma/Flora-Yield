const axios = require('axios');

const MANDI_LAT = 31.7084;
const MANDI_LON = 76.9320;

/**
 * ClimateAndSoilService
 * Aggregates data from:
 *  1. OpenWeatherMap — current conditions
 *  2. Open-Meteo    — 15-day forecast + historical rainfall
 *  3. SoilGrids     — soil pH + organic carbon
 */
const ClimateAndSoilService = {
  /**
   * Fetch current weather from OpenWeatherMap
   */
  async getCurrentWeather(lat = MANDI_LAT, lon = MANDI_LON) {
    const key = process.env.OPEN_WEATHER_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric`;
    try {
      const { data } = await axios.get(url, { timeout: 8000 });
      return {
        temperature: data.main.temp,
        feelsLike: data.main.feels_like,
        humidity: data.main.humidity,
        description: data.weather[0].description,
        windSpeed: data.wind.speed,
        city: data.name,
        country: data.sys.country,
      };
    } catch (err) {
      console.warn('[ClimateService] OpenWeatherMap failed, using mock:', err.message);
      // Graceful fallback for MVP demos without a valid key
      return {
        temperature: 22.4,
        feelsLike: 21.0,
        humidity: 68,
        description: 'partly cloudy',
        windSpeed: 3.2,
        city: 'Mandi',
        country: 'IN',
        _source: 'mock',
      };
    }
  },

  /**
   * Fetch 15-day forecast + historical rainfall from Open-Meteo (no key required)
   */
  async getForecast(lat = MANDI_LAT, lon = MANDI_LON) {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&forecast_days=15&timezone=Asia%2FKolkata`;
    try {
      const { data } = await axios.get(url, { timeout: 8000 });
      const daily = data.daily;
      const totalRainfall = daily.precipitation_sum.reduce((s, v) => s + (v || 0), 0);
      const avgMaxTemp =
        daily.temperature_2m_max.reduce((s, v) => s + v, 0) / daily.temperature_2m_max.length;
      return {
        forecastDays: daily.time,
        maxTemps: daily.temperature_2m_max,
        minTemps: daily.temperature_2m_min,
        precipitation: daily.precipitation_sum,
        summary: {
          totalRainfallMm: parseFloat(totalRainfall.toFixed(2)),
          avgMaxTempC: parseFloat(avgMaxTemp.toFixed(1)),
          rainfallCategory:
            totalRainfall < 30 ? 'Low' : totalRainfall < 80 ? 'Moderate' : 'High',
        },
      };
    } catch (err) {
      console.warn('[ClimateService] Open-Meteo failed:', err.message);
      return {
        forecastDays: [],
        precipitation: [],
        summary: { totalRainfallMm: 52, avgMaxTempC: 24.5, rainfallCategory: 'Moderate' },
        _source: 'mock',
      };
    }
  },

  /**
   * Fetch soil properties from SoilGrids REST API (no key required)
   */
  async getSoilData(lat = MANDI_LAT, lon = MANDI_LON) {
    const url = `https://rest.soilgrids.org/soilgrids/v2.0/properties/query?lat=${lat}&lon=${lon}&property=phh2o&property=soc&depth=0-5cm&value=mean`;
    try {
      const { data } = await axios.get(url, { timeout: 10000 });
      const layers = data.properties?.layers || [];

      const phLayer = layers.find((l) => l.name === 'phh2o');
      const socLayer = layers.find((l) => l.name === 'soc');

      // SoilGrids returns pH × 10 (e.g., 75 = 7.5)
      const rawPh = phLayer?.depths?.[0]?.values?.mean;
      const rawSoc = socLayer?.depths?.[0]?.values?.mean;

      return {
        phH2O: rawPh != null ? parseFloat((rawPh / 10).toFixed(2)) : null,
        organicCarbonGkg: rawSoc != null ? parseFloat((rawSoc / 10).toFixed(2)) : null,
        depthCm: '0–5',
        interpretation: {
          ph:
            rawPh != null
              ? rawPh / 10 < 6.0
                ? 'Acidic'
                : rawPh / 10 <= 7.5
                ? 'Neutral'
                : 'Alkaline'
              : 'Unknown',
        },
      };
    } catch (err) {
      console.warn('[ClimateService] SoilGrids failed, using mock:', err.message);
      return {
        phH2O: 7.6,
        organicCarbonGkg: 12.4,
        depthCm: '0–5',
        interpretation: { ph: 'Alkaline' },
        _source: 'mock',
      };
    }
  },

  /**
   * Master aggregation — returns combined climate + soil snapshot
   */
  async getFullProfile(lat, lon) {
    const [weather, forecast, soil] = await Promise.all([
      this.getCurrentWeather(lat, lon),
      this.getForecast(lat, lon),
      this.getSoilData(lat, lon),
    ]);
    return { weather, forecast, soil };
  },
};

module.exports = ClimateAndSoilService;
