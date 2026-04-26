const express = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/buyers — list all buyer leads with optional crop filter
router.get('/', async (req, res, next) => {
  try {
    const { crop } = req.query;
    const where = {};

    // ✅ Bug Fix #1: SQLite doesn't support mode:'insensitive'.
    // Use a plain `contains` (case-sensitive substring) which works on SQLite.
    // For case-insensitive search use string.toLowerCase comparison in JS if needed.
    if (crop) {
      where.targetCrop = { contains: crop };
    }

    const buyers = await prisma.buyerLead.findMany({ where, orderBy: { offeredPricePerKg: 'desc' } });
    res.json({ success: true, count: buyers.length, data: buyers });
  } catch (err) {
    next(err);
  }
});

// GET /api/buyers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

    const buyer = await prisma.buyerLead.findUnique({ where: { id } });
    if (!buyer) return res.status(404).json({ success: false, error: 'Buyer not found' });
    res.json({ success: true, data: buyer });
  } catch (err) {
    next(err);
  }
});

// POST /api/buyers — register new buyer lead
router.post('/', async (req, res, next) => {
  try {
    const { companyName, targetCrop, requiredQuantityKg, offeredPricePerKg, contactEmail, contactPhone } = req.body;

    if (!companyName || !targetCrop || !contactEmail || !contactPhone) {
      return res.status(400).json({ success: false, error: 'companyName, targetCrop, contactEmail, and contactPhone are required' });
    }

    // ✅ Bug Fix: Validate numeric fields separately to give useful errors
    const qty = parseFloat(requiredQuantityKg);
    const price = parseFloat(offeredPricePerKg);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, error: 'requiredQuantityKg must be a positive number' });
    }
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ success: false, error: 'offeredPricePerKg must be a positive number' });
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return res.status(400).json({ success: false, error: 'Invalid contactEmail format' });
    }

    const buyer = await prisma.buyerLead.create({
      data: {
        companyName,
        targetCrop,
        requiredQuantityKg: qty,
        offeredPricePerKg: price,
        contactEmail,
        contactPhone,
      },
    });
    res.status(201).json({ success: true, data: buyer });
  } catch (err) {
    next(err);
  }
});

// PUT /api/buyers/:id — update buyer lead (only safe fields)
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

    // ✅ Bug Fix #3: Whitelist allowed fields — prevents overwriting id/createdAt/updatedAt
    const { companyName, targetCrop, requiredQuantityKg, offeredPricePerKg, contactEmail, contactPhone } = req.body;

    const updateData = {};
    if (companyName !== undefined) updateData.companyName = companyName;
    if (targetCrop !== undefined) updateData.targetCrop = targetCrop;
    if (requiredQuantityKg !== undefined) {
      const qty = parseFloat(requiredQuantityKg);
      if (isNaN(qty) || qty <= 0) return res.status(400).json({ success: false, error: 'requiredQuantityKg must be a positive number' });
      updateData.requiredQuantityKg = qty;
    }
    if (offeredPricePerKg !== undefined) {
      const price = parseFloat(offeredPricePerKg);
      if (isNaN(price) || price <= 0) return res.status(400).json({ success: false, error: 'offeredPricePerKg must be a positive number' });
      updateData.offeredPricePerKg = price;
    }
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields provided for update' });
    }

    const buyer = await prisma.buyerLead.update({ where: { id }, data: updateData });
    res.json({ success: true, data: buyer });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, error: 'Buyer not found' });
    next(err);
  }
});

// DELETE /api/buyers/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

    await prisma.buyerLead.delete({ where: { id } });
    res.json({ success: true, message: 'Buyer lead deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, error: 'Buyer not found' });
    next(err);
  }
});

module.exports = router;
