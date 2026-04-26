const express = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

const VALID_CATEGORIES = ['Manure', 'Fertilizer', 'Pesticide', 'Machinery'];

// GET /api/suppliers — list all with optional category filter
router.get('/', async (req, res, next) => {
  try {
    const { category, verified } = req.query;
    const where = {};

    // Only apply category filter if it's a recognised value
    if (category && VALID_CATEGORIES.includes(category)) {
      where.category = category;
    }

    // Only apply verified filter when query param is explicitly provided
    if (verified === 'true') where.verifiedStatus = true;
    if (verified === 'false') where.verifiedStatus = false;

    const suppliers = await prisma.supplier.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, count: suppliers.length, data: suppliers });
  } catch (err) {
    next(err);
  }
});

// GET /api/suppliers/:id — single supplier
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) return res.status(404).json({ success: false, error: 'Supplier not found' });
    res.json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
});

// POST /api/suppliers — create new supplier
router.post('/', async (req, res, next) => {
  try {
    const { businessName, category, contactNumber, address, verifiedStatus } = req.body;

    if (!businessName || !category || !contactNumber || !address) {
      return res.status(400).json({ success: false, error: 'Missing required fields: businessName, category, contactNumber, address' });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, error: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    const supplier = await prisma.supplier.create({
      data: { businessName, category, contactNumber, address, verifiedStatus: !!verifiedStatus },
    });
    res.status(201).json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
});

// PUT /api/suppliers/:id — update supplier (only safe fields)
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

    // ✅ Bug Fix #3: Whitelist allowed fields — prevents overwriting id/createdAt/updatedAt
    const { businessName, category, contactNumber, address, verifiedStatus } = req.body;

    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, error: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    const updateData = {};
    if (businessName !== undefined) updateData.businessName = businessName;
    if (category !== undefined) updateData.category = category;
    if (contactNumber !== undefined) updateData.contactNumber = contactNumber;
    if (address !== undefined) updateData.address = address;
    if (verifiedStatus !== undefined) updateData.verifiedStatus = !!verifiedStatus;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields provided for update' });
    }

    const supplier = await prisma.supplier.update({ where: { id }, data: updateData });
    res.json({ success: true, data: supplier });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, error: 'Supplier not found' });
    next(err);
  }
});

// DELETE /api/suppliers/:id — remove supplier
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

    await prisma.supplier.delete({ where: { id } });
    res.json({ success: true, message: 'Supplier deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, error: 'Supplier not found' });
    next(err);
  }
});

module.exports = router;
