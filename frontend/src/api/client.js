import axios from 'axios';

// All requests go through Vite proxy → API Gateway (port 3000)
const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});
// ─── Auto-inject token from localStorage on every request ────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('flora_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// ─── Auth token injection (kept for manual use if needed) ────────────────────
export function setAuthToken(token) {
  if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  else delete api.defaults.headers.common['Authorization'];
}


// ─── Climate & Soil ──────────────────────────────────────────────────────────
export const fetchClimateProfile = (lat, lon) =>
  api.get(`/climate/profile?lat=${lat}&lon=${lon}`).then((r) => r.data.data);

// ─── Recommendation ──────────────────────────────────────────────────────────
export const fetchRecommendation = (lat, lon) =>
  api.get(`/recommendation?lat=${lat}&lon=${lon}`).then((r) => r.data.data);

// ─── Government ──────────────────────────────────────────────────────────────
export const fetchSchemes = () =>
  api.get('/government/schemes').then((r) => r.data.data);

export const fetchMandiPrices = () =>
  api.get('/government/mandi-prices').then((r) => r.data.data);

// ─── Suppliers ───────────────────────────────────────────────────────────────
export const fetchSuppliers = (params = {}) =>
  api.get('/suppliers', { params }).then((r) => r.data.data);

// ─── Buyers ──────────────────────────────────────────────────────────────────
export const fetchBuyers = () =>
  api.get('/buyers').then((r) => r.data.data);

// ─── Nominatim Geocoding (free, no key) ──────────────────────────────────────
export const geocodeLocation = async (query) => {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  if (!data.length) throw new Error('Location not found');
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), displayName: data[0].display_name };
};

export default api;
