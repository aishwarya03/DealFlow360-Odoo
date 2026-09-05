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
  ['PLATINUM', 'Video Surveillance', 20],
  ['PLATINUM', 'Networking & Power', 20],
  ['PLATINUM', 'Storage & Recording', 20],
  ['PLATINUM', 'Installation & Services', 15],

  ['GOLD', 'Video Surveillance', 15],
  ['GOLD', 'Networking & Power', 15],
  ['GOLD', 'Storage & Recording', 15],
  ['GOLD', 'Installation & Services', 10],

  ['SILVER', 'Video Surveillance', 10],
  ['SILVER', 'Networking & Power', 10],
  ['SILVER', 'Storage & Recording', 10],
  ['SILVER', 'Installation & Services', 7],

  ['BRONZE', 'Video Surveillance', 5],
  ['BRONZE', 'Networking & Power', 5],
  ['BRONZE', 'Storage & Recording', 5],
  ['BRONZE', 'Installation & Services', 3],
];

// Surveillance catalogue categories. Products attach to leaf categories while
// discount rules resolve against the root category.
//
// Ceilings are NOT here: a ceiling only means something for a given customer
// tier, so it lives on DiscountRule (tier x category) below.
const CATEGORY_TREE = [
  { name: 'Video Surveillance', children: ['IP Cameras', 'Analog Cameras'] },
  { name: 'Storage & Recording', children: ['NVRs & DVRs', 'Hard Drives'] },
  { name: 'Networking & Power', children: ['PoE Switches', 'Power & UPS'] },
  { name: 'Installation & Services', children: ['Installation', 'Maintenance'] },
];

// Prices in INR. Images are uploaded separately through the product image
// endpoint, so the seed does not overwrite imageUrl values already stored.
// categoryPath resolves against CATEGORY_TREE below at seed time.
const PRODUCTS = [
  {
    sku: 'CAM-IP-DOME-4MP',
    name: '4MP IP Dome Camera',
    description: 'Indoor and outdoor dome camera with infrared night vision.',
    productType: 'GOODS',
    categoryPath: 'Video Surveillance / IP Cameras',
    unit: 'unit',
    listPrice: 6800,
    costPrice: 4200,
    taxRate: 18,
  },
  {
    sku: 'CAM-IP-BULLET-4MP',
    name: '4MP IP Bullet Camera',
    description: 'Weatherproof long-range camera for gates, yards, and perimeters.',
    productType: 'GOODS',
    categoryPath: 'Video Surveillance / IP Cameras',
    unit: 'unit',
    listPrice: 7400,
    costPrice: 4600,
    taxRate: 18,
  },
  {
    sku: 'CAM-ANALOG-2MP',
    name: '2MP Analog Dome Camera',
    description: 'Reliable coaxial camera for cost-conscious surveillance upgrades.',
    productType: 'GOODS',
    categoryPath: 'Video Surveillance / Analog Cameras',
    unit: 'unit',
    listPrice: 3200,
    costPrice: 1900,
    taxRate: 18,
  },
  {
    sku: 'NVR-16CH-4K',
    name: '16-Channel 4K NVR',
    description: 'Network video recorder for up to 16 IP cameras.',
    productType: 'GOODS',
    categoryPath: 'Storage & Recording / NVRs & DVRs',
    unit: 'unit',
    listPrice: 38000,
    costPrice: 25000,
    taxRate: 18,
  },
  {
    sku: 'DVR-8CH-5MP',
    name: '8-Channel 5MP DVR',
    description: 'Hybrid recorder for analog and HD security cameras.',
    productType: 'GOODS',
    categoryPath: 'Storage & Recording / NVRs & DVRs',
    unit: 'unit',
    listPrice: 14500,
    costPrice: 9000,
    taxRate: 18,
  },
  {
    sku: 'HDD-SURV-4TB',
    name: '4TB Surveillance Hard Drive',
    description: '24/7-rated storage designed for continuous video recording.',
    productType: 'GOODS',
    categoryPath: 'Storage & Recording / Hard Drives',
    unit: 'unit',
    listPrice: 9500,
    costPrice: 6800,
    taxRate: 18,
  },
  {
    sku: 'SWITCH-POE-16',
    name: '16-Port PoE Network Switch',
    description: 'Powers and connects up to 16 IP cameras over Ethernet.',
    productType: 'GOODS',
    categoryPath: 'Networking & Power / PoE Switches',
    unit: 'unit',
    listPrice: 14500,
    costPrice: 9200,
    taxRate: 18,
  },
  {
    sku: 'UPS-CCTV-1KVA',
    name: '1KVA CCTV Backup UPS',
    description: 'Backup power for cameras, recorder, and networking equipment.',
    productType: 'GOODS',
    categoryPath: 'Networking & Power / Power & UPS',
    unit: 'unit',
    listPrice: 8200,
    costPrice: 5100,
    taxRate: 18,
  },
  {
    sku: 'SVC-CCTV-INSTALL',
    name: 'CCTV Installation & Commissioning',
    description: 'Professional camera mounting, cabling, configuration, and handover.',
    productType: 'SERVICE',
    categoryPath: 'Installation & Services / Installation',
    unit: 'project',
    listPrice: 25000,
    costPrice: 18000,
    taxRate: 18,
  },
  {
    sku: 'SVC-CCTV-AMC',
    name: 'CCTV Annual Maintenance',
    description: 'Scheduled health checks, cleaning, testing, and priority support.',
    productType: 'SERVICE',
    categoryPath: 'Installation & Services / Maintenance',
    unit: 'year',
    listPrice: 18000,
    costPrice: 11500,
    taxRate: 18,
    isSubscribable: true,
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
  ['MAIN', 'CAM-IP-DOME-4MP', 24, 6, 30],
  ['EAST', 'CAM-IP-DOME-4MP', 12, 4, 20],
  ['MAIN', 'CAM-IP-BULLET-4MP', 18, 5, 24],
  ['NORTH', 'CAM-IP-BULLET-4MP', 8, 3, 12],
  ['MAIN', 'CAM-ANALOG-2MP', 20, 5, 25],
  ['MAIN', 'NVR-16CH-4K', 8, 2, 10],
  ['EAST', 'NVR-16CH-4K', 4, 1, 6],
  ['MAIN', 'DVR-8CH-5MP', 10, 2, 12],
  ['MAIN', 'HDD-SURV-4TB', 15, 4, 20],
  ['MAIN', 'SWITCH-POE-16', 12, 3, 15],
  ['MAIN', 'UPS-CCTV-1KVA', 10, 2, 12],
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
      const childName = typeof child === 'string' ? child : child.name;
      let childRow = await prisma.category.findFirst({
        where: { name: childName, parentId: rootRow.id },
      });
      childRow =
        childRow ??
        (await prisma.category.create({ data: { name: childName, parentId: rootRow.id } }));

      categoryIdByPath[`${root.name} / ${childName}`] = childRow.id;
      console.log(`  category    ${root.name} / ${childName}`);
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

  await prisma.product.updateMany({
    where: { sku: { notIn: PRODUCTS.map((product) => product.sku) } },
    data: { isActive: false },
  });

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
