require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const climateRoutes = require('./routes/climate.routes');
const govRoutes = require('./routes/government.routes');
const supplierRoutes = require('./routes/supplier.routes');
const buyerRoutes = require('./routes/buyer.routes');
const recommendationRoutes = require('./routes/recommendation.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ──────────────────────────────────────────────────────────────
// CORS must be first — handles OPTIONS preflight before any other middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Flora-Yield API', timestamp: new Date().toISOString() });
});

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/climate', climateRoutes);
app.use('/api/government', govRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/buyers', buyerRoutes);
app.use('/api/recommendation', recommendationRoutes);

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`🌱 Flora-Yield API running on http://localhost:${PORT}`);
});

module.exports = app;
