import { useState, useCallback } from 'react';
import { fetchClimateProfile, fetchRecommendation, geocodeLocation } from '../api/client';
import {
  FiMapPin, FiSearch, FiThermometer, FiDroplet, FiWind, FiSun, FiAlertCircle,
} from 'react-icons/fi';
import { GiWheat } from 'react-icons/gi';
import { TbPlant } from 'react-icons/tb';

const SkeletonBlock = ({ className }) => (
  <div className={`rounded-lg bg-white/5 shimmer ${className}`} />
);

const StatCard = ({ icon: Icon, label, value, unit, color = 'brand' }) => (
  <div className="glass-card p-4 flex items-center gap-3 animate-slide-up">
    <div className={`p-2.5 rounded-xl bg-${color}-500/15`}>
      <Icon className={`text-${color}-400 text-xl`} />
    </div>
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-white">
        {value} <span className="text-sm font-normal text-slate-400">{unit}</span>
      </p>
    </div>
  </div>
);

const RecommendationCard = ({ rec }) => {
  const riskColor = { Low: 'green', Medium: 'yellow', High: 'red' }[rec.riskLevel] || 'slate';
  return (
    <div className="glass-card p-6 border-brand-500/20 animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TbPlant className="text-brand-400 text-2xl" />
            <h3 className="text-2xl font-bold text-brand-400">{rec.cropName}</h3>
          </div>
          <p className="text-slate-400 text-sm italic">{rec.scientificName}</p>
          <span className="status-badge bg-brand-500/20 text-brand-300 mt-2">{rec.category}</span>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black gradient-text">{rec.fitScore}%</p>
          <p className="text-xs text-slate-400">Fit Score</p>
        </div>
      </div>

      <p className="text-slate-300 text-sm mb-4 leading-relaxed">{rec.description}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="glass-card p-3 text-center">
          <p className="text-brand-400 font-bold text-lg">₹{rec.projectedMarketPricePerKg}/kg</p>
          <p className="text-xs text-slate-400">Market Price</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-earth-400 font-bold text-lg">₹{(rec.projectedProfitPerHa / 1000).toFixed(1)}K</p>
          <p className="text-xs text-slate-400">Profit/Hectare</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-purple-400 font-bold text-lg">{rec.profitMarginPercent}%</p>
          <p className="text-xs text-slate-400">Margin</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-blue-400 font-bold text-lg">{rec.growthDays}d</p>
          <p className="text-xs text-slate-400">Harvest Time</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {rec.reasons.map((r, i) => (
          <span key={i} className="px-2.5 py-1 bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs rounded-full">
            ✓ {r}
          </span>
        ))}
        {rec.warnings.map((w, i) => (
          <span key={i} className="px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs rounded-full">
            ⚠ {w}
          </span>
        ))}
        {rec.subsidyAvailable && (
          <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-full">
            🏛 Subsidy Available
          </span>
        )}
      </div>
    </div>
  );
};

export default function IntelligenceHub() {
  const [location, setLocation] = useState('Mandi, Himachal Pradesh');
  const [coords, setCoords] = useState({ lat: 31.7084, lon: 76.932 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [climate, setClimate] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const geo = await geocodeLocation(location);
      setCoords({ lat: geo.lat, lon: geo.lon });
      const [climateData, recData] = await Promise.all([
        fetchClimateProfile(geo.lat, geo.lon),
        fetchRecommendation(geo.lat, geo.lon),
      ]);
      setClimate(climateData);
      setRecommendation(recData);
      setSearched(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [location]);

  const handleDefaultLoad = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [climateData, recData] = await Promise.all([
        fetchClimateProfile(coords.lat, coords.lon),
        fetchRecommendation(coords.lat, coords.lon),
      ]);
      setClimate(climateData);
      setRecommendation(recData);
      setSearched(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [coords]);

  return (
    <section id="intelligence-hub">
      <h2 className="section-header">
        <span className="p-2 bg-brand-500/20 rounded-xl"><FiSun className="text-brand-400" /></span>
        Intelligence Hub
      </h2>

      {/* Location Search */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <div className="flex-1 flex items-center gap-2 glass-card px-4 py-3">
          <FiMapPin className="text-brand-400 shrink-0" />
          <input
            id="location-search"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Enter village, taluk, or district in India..."
            className="flex-1 bg-transparent outline-none text-white placeholder-slate-500 text-sm"
          />
        </div>
        <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
          <FiSearch />
          {loading ? 'Analysing...' : 'Analyse'}
        </button>
        {!searched && !loading && (
          <button type="button" onClick={handleDefaultLoad} className="btn-ghost text-sm">
            Load Mandi
          </button>
        )}
      </form>

      {/* Error */}
      {error && (
        <div className="glass-card p-4 border-red-500/30 bg-red-500/5 flex items-center gap-3 mb-4 text-red-400">
          <FiAlertCircle className="shrink-0 text-xl" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <SkeletonBlock key={i} className="h-20" />)}
          </div>
          <SkeletonBlock className="h-64" />
        </div>
      )}

      {/* Weather + Soil */}
      {!loading && climate && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={FiThermometer} label="Temperature" value={climate.weather.temperature} unit="°C" />
            <StatCard icon={FiDroplet} label="Humidity" value={climate.weather.humidity} unit="%" color="blue" />
            <StatCard icon={FiWind} label="Wind Speed" value={climate.weather.windSpeed} unit="m/s" color="purple" />
            <StatCard icon={GiWheat} label="Soil pH" value={climate.soil.phH2O ?? '—'} unit="" color="earth" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card p-4">
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-semibold">🌡 Current Conditions</p>
              <p className="text-slate-200 capitalize mb-1">{climate.weather.description}</p>
              <p className="text-slate-400 text-sm">Feels like <span className="text-white font-medium">{climate.weather.feelsLike}°C</span></p>
              <p className="text-slate-400 text-sm mt-1">Location: <span className="text-white font-medium">{climate.weather.city}, {climate.weather.country}</span></p>
              {climate.weather._source === 'mock' && (
                <span className="status-badge bg-yellow-500/10 text-yellow-400 text-xs mt-2">Demo Data</span>
              )}
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-semibold">🌱 Soil Profile (0–5 cm)</p>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300 text-sm">pH (H₂O)</span>
                <span className="font-bold text-earth-400">{climate.soil.phH2O ?? '—'} <span className="text-xs text-slate-400">({climate.soil.interpretation?.ph})</span></span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300 text-sm">Organic Carbon</span>
                <span className="font-bold text-brand-400">{climate.soil.organicCarbonGkg ?? '—'} g/kg</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">15-Day Rainfall</span>
                <span className="font-bold text-blue-400">{climate.forecast.summary.totalRainfallMm} mm <span className="text-xs text-slate-400">({climate.forecast.summary.rainfallCategory})</span></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendation */}
      {!loading && recommendation && (
        <div className="mt-6">
          <h3 className="text-sm uppercase tracking-widest text-slate-400 font-semibold mb-3 flex items-center gap-2">
            <span>🤖 AI Crop Recommendation</span>
          </h3>
          <RecommendationCard rec={recommendation.topRecommendation} />

          {/* Other ranked crops */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {recommendation.allRankedCrops.slice(1).map((crop) => (
              <div key={crop.cropName} className="glass-card-hover p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-white">#{crop.rank} {crop.cropName}</p>
                  <span className="text-brand-400 font-bold">{crop.fitScore}%</span>
                </div>
                <p className="text-xs text-slate-400 mb-1">₹{crop.projectedMarketPricePerKg}/kg · {crop.profitMarginPercent}% margin</p>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full" style={{ width: `${crop.fitScore}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !searched && (
        <div className="glass-card p-12 text-center">
          <TbPlant className="text-5xl text-brand-500/40 mx-auto mb-3" />
          <p className="text-slate-400">Enter a location above to analyse soil and climate data, or click <strong className="text-brand-400">Load Mandi</strong> to use default coordinates.</p>
        </div>
      )}
    </section>
  );
}
