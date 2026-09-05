import '../src/config/env.js';

import prisma from '../src/prisma/client.js';
import { hashPassword } from '../src/utils/password.js';

// One account per role, so every approval path in later features has someone to
// act as. Idempotent: re-running updates the existing rows instead of failing.
const USERS = [
  { name: 'Aditi Admin', email: 'admin@dealflow360.com', role: 'ADMIN' },
  { name: 'Rohan Rep', email: 'rep@dealflow360.com', role: 'SALES_REP' },
  { name: 'Meera Manager', email: 'manager@dealflow360.com', role: 'SALES_MANAGER' },
  { name: 'Farhan Finance', email: 'finance@dealflow360.com', role: 'FINANCE' },
];

const CUSTOMERS = [
  { name: 'Acme Corp', email: 'buyer@acme.com', tier: 'GOLD' },
  { name: 'Beta Industries', email: 'buyer@beta.com', tier: 'SILVER' },
  { name: 'Corner Shop Ltd', email: 'buyer@cornershop.com', tier: 'BRONZE' },
];

// Prices in INR. Cost prices are set so margins differ meaningfully by category:
// hardware carries healthy margin, services are thin. That difference is what
// makes the blended discount risk score interesting later.
const PRODUCTS = [
  {
    sku: 'HW-LAPTOP-14',
    name: 'ProBook 14" Laptop',
    description: 'Business laptop, 16GB RAM, 512GB SSD',
    category: 'HARDWARE',
    unit: 'unit',
    listPrice: 100000,
    costPrice: 72000,
    taxRate: 18,
  },
  {
    sku: 'HW-DOCK-01',
    name: 'Universal Docking Station',
    description: 'Dual-monitor USB-C dock',
    category: 'HARDWARE',
    unit: 'unit',
    listPrice: 8000,
    costPrice: 5000,
    taxRate: 18,
  },
  {
    sku: 'HW-BAG-01',
    name: 'Laptop Carry Case',
    description: 'Padded 14" case',
    category: 'HARDWARE',
    unit: 'unit',
    listPrice: 2500,
    costPrice: 1200,
    taxRate: 18,
  },
  {
    sku: 'SW-OFFICE-STD',
    name: 'Office Suite — Standard',
    description: 'Per-seat productivity suite. Sold outright or on a plan.',
    category: 'SOFTWARE',
    unit: 'seat',
    listPrice: 12000,
    costPrice: 6000,
    taxRate: 18,
    isSubscribable: true,
  },
  {
    sku: 'SW-CLOUD-BACKUP',
    name: 'Cloud Backup — 1TB',
    description: 'Managed offsite backup per device',
    category: 'SOFTWARE',
    unit: 'device',
    listPrice: 5000,
    costPrice: 2000,
    taxRate: 18,
    isSubscribable: true,
  },
  {
    sku: 'SV-SETUP',
    name: 'Onsite Setup & Configuration',
    description: 'Engineer-led deployment, per day',
    category: 'SERVICE',
    unit: 'day',
    listPrice: 20000,
    costPrice: 16000,
    taxRate: 18,
  },
  {
    sku: 'SV-SUPPORT-PREM',
    name: 'Premium Support',
    description: '24/7 support retainer',
    category: 'SERVICE',
    unit: 'month',
    listPrice: 15000,
    costPrice: 11500,
    taxRate: 18,
    isSubscribable: true,
  },
  {
    sku: 'SV-TRAINING',
    name: 'End-user Training',
    description: 'Half-day session, up to 20 attendees',
    category: 'SERVICE',
    unit: 'session',
    listPrice: 18000,
    costPrice: 14000,
    taxRate: 18,
  },
];

// Main is the cheapest to dispatch from and holds most stock. East is pricier but
// carries the overflow — so an order for 10 laptops cannot be filled from one
// location and the split algorithm has a real decision to make.
const WAREHOUSES = [
  { code: 'MAIN', name: 'Main Warehouse', city: 'Bengaluru', shippingCostPerShipment: 250, priority: 10 },
  { code: 'EAST', name: 'East Depot', city: 'Kolkata', shippingCostPerShipment: 400, priority: 20 },
  { code: 'NORTH', name: 'North Hub', city: 'Delhi', shippingCostPerShipment: 380, priority: 30 },
];

// [warehouse code, product sku, on hand, reorder point, reorder qty]
// Physical goods only: services and cloud subscriptions are not stocked, which is
// itself a rule the fulfillment split has to respect later.
const STOCK = [
  ['MAIN', 'HW-LAPTOP-14', 6, 5, 20],
  ['EAST', 'HW-LAPTOP-14', 4, 3, 10],
  ['NORTH', 'HW-LAPTOP-14', 2, 3, 10],

  ['MAIN', 'HW-DOCK-01', 25, 10, 40],
  ['EAST', 'HW-DOCK-01', 8, 10, 20],

  ['MAIN', 'HW-BAG-01', 40, 15, 60],
  ['NORTH', 'HW-BAG-01', 3, 10, 30],

  ['MAIN', 'SW-OFFICE-STD', 100, 20, 100],
];

const DEMO_PASSWORD = 'Password123';

const main = async () => {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const user of USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash, isActive: true },
      create: { ...user, passwordHash },
    });
    console.log(`  user     ${user.role.padEnd(14)} ${user.email}`);
  }

  for (const customer of CUSTOMERS) {
    await prisma.customer.upsert({
      where: { email: customer.email },
      update: { name: customer.name, tier: customer.tier },
      create: customer,
    });
    console.log(`  customer ${customer.tier.padEnd(14)} ${customer.email}`);
  }

  for (const product of PRODUCTS) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: product,
      create: product,
    });
    console.log(`  product  ${product.category.padEnd(14)} ${product.sku.padEnd(18)} ${product.name}`);
  }

  for (const warehouse of WAREHOUSES) {
    await prisma.warehouse.upsert({
      where: { code: warehouse.code },
      update: warehouse,
      create: warehouse,
    });
    console.log(`  warehouse ${warehouse.code.padEnd(13)} ${warehouse.name} (₹${warehouse.shippingCostPerShipment}/shipment)`);
  }

  for (const [code, sku, onHandQty, reorderPoint, reorderQty] of STOCK) {
    const warehouse = await prisma.warehouse.findUnique({ where: { code } });
    const product = await prisma.product.findUnique({ where: { sku } });

    await prisma.inventory.upsert({
      where: {
        warehouseId_productId: { warehouseId: warehouse.id, productId: product.id },
      },
      update: { onHandQty, reorderPoint, reorderQty },
      create: {
        warehouseId: warehouse.id,
        productId: product.id,
        onHandQty,
        reorderPoint,
        reorderQty,
      },
    });
    console.log(`  stock     ${code.padEnd(13)} ${sku.padEnd(18)} ${String(onHandQty).padStart(3)} on hand`);
  }

  console.log(`\nAll seeded accounts use the password: ${DEMO_PASSWORD}\n`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
