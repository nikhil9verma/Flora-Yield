require('dotenv').config(); // ✅ Fix #9: load .env so DATABASE_URL is available when run standalone
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Flora-Yield database for Mandi, Himachal Pradesh...');

  // ─── Clear existing data ───────────────────────────────────────────────────
  await prisma.buyerLead.deleteMany({});
  await prisma.supplier.deleteMany({});

  // ─── Seed: 5 Suppliers in Mandi District ──────────────────────────────────
  const suppliers = await prisma.supplier.createMany({
    data: [
      {
        businessName: 'Mandi Agro Inputs',
        category: 'Fertilizer',
        contactNumber: '+91-9816012345',
        address: 'Near Old Bus Stand, Mandi, HP 175001',
        verifiedStatus: true,
      },
      {
        businessName: 'Himachal Organic Manures',
        category: 'Manure',
        contactNumber: '+91-9816023456',
        address: 'Padhar Road, Thunag, Mandi, HP 175048',
        verifiedStatus: true,
      },
      {
        businessName: 'PaharKisan Pesticide Store',
        category: 'Pesticide',
        contactNumber: '+91-9805034567',
        address: 'Ner Chowk, Mandi, HP 175021',
        verifiedStatus: false,
      },
      {
        businessName: 'HP Farm Machinery Hub',
        category: 'Machinery',
        contactNumber: '+91-9816045678',
        address: 'Industrial Area, Sundernagar, Mandi, HP 175018',
        verifiedStatus: true,
      },
      {
        businessName: 'Uhl Valley Krishi Kendra',
        category: 'Fertilizer',
        contactNumber: '+91-9805056789',
        address: 'Joginder Nagar, Mandi, HP 175015',
        verifiedStatus: true,
      },
    ],
  });

  // ─── Seed: 3 B2B Buyer Leads ───────────────────────────────────────────────
  const buyers = await prisma.buyerLead.createMany({
    data: [
      {
        companyName: 'Himalaya Drug Company',
        targetCrop: 'Ashwagandha',
        requiredQuantityKg: 5000,
        offeredPricePerKg: 285,
        contactEmail: 'procurement@himalaya.in',
        contactPhone: '+91-8023456789',
      },
      {
        companyName: 'Organic India Pvt. Ltd.',
        targetCrop: 'Chamomile',
        requiredQuantityKg: 2000,
        offeredPricePerKg: 420,
        contactEmail: 'sourcing@organicindia.com',
        contactPhone: '+91-9911223344',
      },
      {
        companyName: 'Patanjali Ayurved Ltd.',
        targetCrop: 'Lavender',
        requiredQuantityKg: 3500,
        offeredPricePerKg: 650,
        contactEmail: 'vendor@patanjali.co.in',
        contactPhone: '+91-1334244107',
      },
    ],
  });

  console.log(`✅ Seeded ${suppliers.count} suppliers and ${buyers.count} buyer leads.`);
  console.log('🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
