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

// rank orders the tiers; defaultMaxDiscountPercent is the tier-wide ceiling
// from the brief, used only for the order-level check;
// financeEscalationSeverity is the blended risk score above which Finance is
// pulled in on top of the Sales Manager.
// minScore is the band: a customer lands in the highest tier their score
// reaches. 0-39 Bronze, 40-59 Silver, 60-79 Gold, 80-100 Platinum.
const TIERS = [
  { code: 'BRONZE', name: 'Bronze', rank: 1, minScore: 0, defaultMaxDiscountPercent: 5, financeEscalationSeverity: 3 },
  { code: 'SILVER', name: 'Silver', rank: 2, minScore: 40, defaultMaxDiscountPercent: 10, financeEscalationSeverity: 4 },
  { code: 'GOLD', name: 'Gold', rank: 3, minScore: 60, defaultMaxDiscountPercent: 15, financeEscalationSeverity: 5 },
  { code: 'PLATINUM', name: 'Platinum', rank: 4, minScore: 80, defaultMaxDiscountPercent: 20, financeEscalationSeverity: 6 },
];

// No tier here — it is calculated from these metrics by the scoring engine.
// Acme carries the worked example's numbers, so seeding reproduces
// ~89/100 -> PLATINUM. daysAgo is turned into a real date at seed time so the
// recency component stays meaningful however long after seeding you look.
const CUSTOMERS = [
  {
    name: 'Acme Corp',
    email: 'buyer@acme.com',
    totalPurchaseValue: 1200000,
    completedOrders: 24,
    lastOrderDaysAgo: 12,
    customerSinceYearsAgo: 2.5,
  },
  {
    name: 'Beta Industries',
    email: 'buyer@beta.com',
    totalPurchaseValue: 450000,
    completedOrders: 11,
    lastOrderDaysAgo: 40,
    customerSinceYearsAgo: 1.5,
  },
  {
    name: 'Corner Shop Ltd',
    email: 'buyer@cornershop.com',
    totalPurchaseValue: 60000,
    completedOrders: 2,
    lastOrderDaysAgo: 200,
    customerSinceYearsAgo: 0.5,
  },
];

// The entire discount policy, as data. Nothing in application code knows any
// of these numbers — change a row here (or via PATCH /discounts/rules/:id) and
// the engine's behaviour changes with no redeploy.
//
// [tier code, category path, max discount %]
// At or below max, no approval. Above it, a Sales Manager must approve.
const DISCOUNT_RULES = [
  ['PLATINUM', 'Hardware', 20],
  ['PLATINUM', 'Service', 15],
  ['PLATINUM', 'Software', 20],

  ['GOLD', 'Hardware', 15],
  ['GOLD', 'Service', 10],
  ['GOLD', 'Software', 15],

  ['SILVER', 'Hardware', 10],
  ['SILVER', 'Service', 7],
  ['SILVER', 'Software', 10],

  ['BRONZE', 'Hardware', 5],
  ['BRONZE', 'Service', 3],
  ['BRONZE', 'Software', 5],
];

// A real tree, not a flat enum — "Hardware" holds a child category
// (Computers) that products attach to, while "Software" and "Service" hold
// products directly at the root, demonstrating both valid patterns.
//
// Ceilings are NOT here: a ceiling only means something for a given customer
// tier, so it lives on DiscountRule (tier x category) below.
const CATEGORY_TREE = [
  { name: 'Hardware', children: [{ name: 'Computers' }] },
  { name: 'Software', children: [] },
  { name: 'Service', children: [] },
];

// Prices in INR. Cost prices are set so margins differ meaningfully by
// category: hardware carries healthy margin, services are thin. That
// difference is what makes the blended discount risk score interesting later.
// categoryPath resolves against CATEGORY_TREE below at seed time.
const PRODUCTS = [
  {
    sku: 'HW-LAPTOP-14',
    name: 'ProBook 14" Laptop',
    description: 'Business laptop, 16GB RAM, 512GB SSD',
    productType: 'GOODS',
    categoryPath: 'Hardware / Computers',
    unit: 'unit',
    listPrice: 100000,
    costPrice: 72000,
    taxRate: 18,
  },
  {
    sku: 'HW-DOCK-01',
    name: 'Universal Docking Station',
    description: 'Dual-monitor USB-C dock',
    productType: 'GOODS',
    categoryPath: 'Hardware / Computers',
    unit: 'unit',
    listPrice: 8000,
    costPrice: 5000,
    taxRate: 18,
  },
  {
    sku: 'HW-BAG-01',
    name: 'Laptop Carry Case',
    description: 'Padded 14" case',
    productType: 'GOODS',
    categoryPath: 'Hardware / Computers',
    unit: 'unit',
    listPrice: 2500,
    costPrice: 1200,
    taxRate: 18,
  },
  {
    sku: 'SW-OFFICE-STD',
    name: 'Office Suite — Standard',
    description: 'Per-seat productivity suite. Sold outright or on a plan.',
    productType: 'SERVICE',
    categoryPath: 'Software',
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
    productType: 'SERVICE',
    categoryPath: 'Software',
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
    productType: 'SERVICE',
    categoryPath: 'Service',
    unit: 'day',
    listPrice: 20000,
    costPrice: 16000,
    taxRate: 18,
  },
  {
    sku: 'SV-SUPPORT-PREM',
    name: 'Premium Support',
    description: '24/7 support retainer',
    productType: 'SERVICE',
    categoryPath: 'Service',
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
    productType: 'SERVICE',
    categoryPath: 'Service',
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

  const tierIdByCode = {};
  for (const tier of TIERS) {
    const row = await prisma.customerTier.upsert({
      where: { code: tier.code },
      update: tier,
      create: tier,
    });
    tierIdByCode[tier.code] = row.id;
    console.log(`  tier     ${tier.code.padEnd(14)} ceiling ${tier.defaultMaxDiscountPercent}%`);
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  for (const { lastOrderDaysAgo, customerSinceYearsAgo, ...customer } of CUSTOMERS) {
    const data = {
      ...customer,
      lastOrderAt: new Date(Date.now() - lastOrderDaysAgo * DAY_MS),
      customerSince: new Date(Date.now() - customerSinceYearsAgo * 365.25 * DAY_MS),
      // Placeholder — overwritten by the scoring pass below.
      tierId: tierIdByCode.BRONZE,
    };

    await prisma.customer.upsert({
      where: { email: customer.email },
      update: data,
      create: data,
    });
  }

  // Tiers are calculated, never seeded: run the real engine so the seeded
  // data proves the flow rather than asserting an answer.
  const { recalculateAllTiers } = await import('../src/modules/tiers/tierScoring.service.js');
  const scored = await recalculateAllTiers();
  for (const row of scored.results) {
    console.log(`  customer ${row.tier.padEnd(9)} score ${String(row.score).padStart(5)}  ${row.name}`);
  }

  // Path ("Hardware / Computers") -> categoryId, built as categories are
  // created so PRODUCTS can reference categories by name instead of a
  // database id that doesn't exist until this script runs.
  const categoryIdByPath = {};

  for (const root of CATEGORY_TREE) {
    let rootRow = await prisma.category.findFirst({
      where: { name: root.name, parentId: null },
    });
    rootRow = rootRow ?? (await prisma.category.create({ data: { name: root.name } }));

    categoryIdByPath[root.name] = rootRow.id;
    console.log(`  category  ${root.name}`);

    for (const child of root.children) {
      let childRow = await prisma.category.findFirst({
        where: { name: child.name, parentId: rootRow.id },
      });
      childRow =
        childRow ??
        (await prisma.category.create({ data: { name: child.name, parentId: rootRow.id } }));

      categoryIdByPath[`${root.name} / ${child.name}`] = childRow.id;
      console.log(`  category    ${root.name} / ${child.name}`);
    }
  }

  for (const { categoryPath, ...product } of PRODUCTS) {
    const categoryId = categoryIdByPath[categoryPath];
    if (!categoryId) throw new Error(`Unknown categoryPath "${categoryPath}" for ${product.sku}`);

    await prisma.product.upsert({
      where: { sku: product.sku },
      update: { ...product, categoryId },
      create: { ...product, categoryId },
    });
    console.log(`  product   ${product.productType.padEnd(8)} ${product.sku.padEnd(18)} ${product.name}`);
  }

  for (const [tierCode, categoryPath, max] of DISCOUNT_RULES) {
    const customerTierId = tierIdByCode[tierCode];
    const categoryId = categoryIdByPath[categoryPath];
    if (!categoryId) throw new Error(`Unknown categoryPath "${categoryPath}" in DISCOUNT_RULES`);

    await prisma.discountRule.upsert({
      where: { customerTierId_categoryId: { customerTierId, categoryId } },
      update: { maxDiscountPercent: max, isActive: true },
      create: { customerTierId, categoryId, maxDiscountPercent: max },
    });
    console.log(
      `  rule     ${tierCode.padEnd(8)} ${categoryPath.padEnd(10)} max ${String(max).padStart(2)}%`
    );
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
