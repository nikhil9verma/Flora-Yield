const axios = require('axios');

const DATA_GOV_BASE = 'https://api.data.gov.in/resource';

/**
 * GovernmentIntelligenceService
 * Fetches:
 *  1. Agricultural subsidy schemes (PM-KISAN, PKVY, etc.)
 *  2. Live Mandi market prices for Himachal Pradesh
 */
const GovernmentIntelligenceService = {
  /**
   * Fetch agricultural schemes from Data.gov.in
   * Resource ID for PM-KISAN and allied schemes catalogue
   */
  async getAgriculturalSchemes(limit = 20) {
    const key = process.env.DATA_GOV_KEY;
    // Agri schemes catalogue on Data.gov.in (Requires exact real resource ID)
    const resourceId = 'placeholder-scheme-id';
    const url = `${DATA_GOV_BASE}/${resourceId}?api-key=${key}&format=json&limit=${limit}`;

    try {
      const { data } = await axios.get(url, { timeout: 10000 });
      // Data.gov.in wraps results in 'records'
      const records = data?.records ?? [];
      if (!Array.isArray(records) || records.length === 0) throw new Error('Empty records');
      return records;
    } catch (err) {
      console.warn('[GovService] Data.gov.in schemes failed, using mock:', err.message);
      // Curated fallback mock for Himachal Pradesh
      return [
        {
          schemeName: 'PM-KISAN Samman Nidhi',
          ministry: 'Ministry of Agriculture & Farmers Welfare',
          benefit: '₹6,000/year direct income support in 3 equal instalments',
          eligibility: 'All landholding farmer families with cultivable land',
          applyLink: 'https://pmkisan.gov.in',
        },
        {
          schemeName: 'Paramparagat Krishi Vikas Yojana (PKVY)',
          ministry: 'Ministry of Agriculture & Farmers Welfare',
          benefit: '₹50,000/ha over 3 years for organic farming cluster adoption',
          eligibility: 'Farmers adopting organic farming in clusters of 50 acres',
          applyLink: 'https://pgsindia-ncof.gov.in',
        },
        {
          schemeName: 'HP Horticulture Development Programme',
          ministry: 'HP State Government',
          benefit: '50% subsidy on planting material, tools, and irrigation infra',
          eligibility: 'HP resident farmers with land in identified zones',
          applyLink: 'https://hpagrisnet.gov.in',
        },
        {
          schemeName: 'Soil Health Card Scheme',
          ministry: 'Ministry of Agriculture & Farmers Welfare',
          benefit: 'Free soil testing + customized fertilizer recommendation card',
          eligibility: 'All farmers across India',
          applyLink: 'https://soilhealth.dac.gov.in',
        },
        {
          schemeName: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
          ministry: 'Ministry of Agriculture & Farmers Welfare',
          benefit: 'Crop insurance at 2% premium for Kharif, 1.5% for Rabi crops',
          eligibility: 'All farmers growing notified crops in notified areas',
          applyLink: 'https://pmfby.gov.in',
        },
        {
          schemeName: 'National Medicinal Plants Board (NMPB) Grant',
          ministry: 'AYUSH Ministry',
          benefit: '30–50% subsidy on cultivation of medicinal plants (Ashwagandha, etc.)',
          eligibility: 'Farmers cultivating AYUSH-listed medicinal plants',
          applyLink: 'https://nmpb.nic.in',
        },
      ];
    }
  },

  /**
   * Fetch live Mandi prices for HP from Data.gov.in
   * Agmarknet resource for current market arrivals and prices
   */
  async getMandiPrices(state = 'Himachal Pradesh', limit = 30) {
    const key = process.env.DATA_GOV_KEY;
    // Agmarknet Daily Market Arrivals & Prices — correct resource ID for Mandi HP
    const resourceId = '9ef84268-d588-465a-a308-a864a43d0070';
    // Data.gov.in filter format: filters[field.keyword]=value
    const url =
      `${DATA_GOV_BASE}/${resourceId}?api-key=${key}&format=json&limit=${limit}` +
      `&filters[State.keyword]=${encodeURIComponent(state)}`;

    try {
      const { data } = await axios.get(url, { timeout: 10000 });
      const records = data?.records ?? [];
      if (!Array.isArray(records) || records.length === 0) throw new Error('Empty records');
      return records;
    } catch (err) {
      console.warn('[GovService] Mandi prices API failed, using mock:', err.message);
      return [
        { commodity: 'Ashwagandha (Root)', market: 'Mandi APMC', minPrice: 240, maxPrice: 310, modalPrice: 280, unit: '₹/kg', date: '2026-04-20' },
        { commodity: 'Chamomile (Dried)', market: 'Sunder Nagar Mandi', minPrice: 380, maxPrice: 460, modalPrice: 420, unit: '₹/kg', date: '2026-04-20' },
        { commodity: 'Lavender', market: 'Kullu APMC', minPrice: 580, maxPrice: 720, modalPrice: 650, unit: '₹/kg', date: '2026-04-20' },
        { commodity: 'Tomato', market: 'Mandi APMC', minPrice: 18, maxPrice: 35, modalPrice: 26, unit: '₹/kg', date: '2026-04-20' },
        { commodity: 'Apple (Delicious)', market: 'Mandi APMC', minPrice: 55, maxPrice: 110, modalPrice: 82, unit: '₹/kg', date: '2026-04-20' },
        { commodity: 'Ginger (Fresh)', market: 'Joginder Nagar Mandi', minPrice: 45, maxPrice: 68, modalPrice: 55, unit: '₹/kg', date: '2026-04-20' },
        { commodity: 'Maize', market: 'Mandi APMC', minPrice: 20, maxPrice: 28, modalPrice: 24, unit: '₹/kg', date: '2026-04-20' },
        { commodity: 'Potato', market: 'Sundernagar APMC', minPrice: 12, maxPrice: 22, modalPrice: 16, unit: '₹/kg', date: '2026-04-20' },
      ];
    }
  },
};

module.exports = GovernmentIntelligenceService;
