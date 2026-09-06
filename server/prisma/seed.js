import '../src/config/env.js';

import prisma from '../src/prisma/client.js';
import { hashPassword } from '../src/utils/password.js';

// ── Reconciled to docs/DEMO_SCENARIO.md (Netrix Systems / ZKTeco) — see
// docs/SOURCE_OF_TRUTH.md §6a/§7 for the "seed data doesn't match the demo
// narrative" gap this file closes. Judgment calls made along the way are
// documented inline, right where the call is made, and summarized again at
// the bottom of this header comment:
//
//  - CATEGORY_TREE dropped from 4 nested categories (Video Surveillance /
//    Storage & Recording / Networking & Power / Installation & Services,
//    each with 2 children) to 3 FLAT categories (Hardware / Services /
//    Software), matching DEMO_SCENARIO's own two ceilings ("Hardware 15%,
//    Services 10%") plus a Software bucket for the recurring lines. A flat
//    tree is a real simplification (loses the sub-category granularity the
//    old seed had) but the demo narrative never asks for it, and
//    DiscountRule resolution still walks "up" a 1-level tree fine.
//  - TIERS dropped from 4 (incl. PLATINUM) to the 3 DEMO_SCENARIO.md names.
//    PLATINUM is not deleted (it may still be FK-referenced on a shared dev
//    DB) — it's deactivated (isActive: false) so the scoring engine can
//    never land a customer there. Functionally 3 tiers; structurally a
//    dormant 4th row. Chosen over a hard delete specifically because this
//    DB is shared with a teammate and a delete could 500 on a stale FK.
//  - WAREHOUSES trimmed from 3 (Main/East/North) to the 2 DEMO_SCENARIO.md
//    names (Main Warehouse Bengaluru, Regional Depot Pune) — the doc is
//    explicit that 2 is the point ("forces the split"), and a 3rd added
//    nothing the demo asks for.
//  - Quotations/approvals/subscriptions/chat are NOT upserted — a workflow
//    history doesn't have a stable natural key the way a product SKU does.
//    Instead this script deletes and recreates all transactional rows on
//    every run (see wipeTransactionalData below), while master/catalog data
//    (users, tiers, customers, categories, products, plans, recommendations,
//    discount rules, warehouses, stock levels) stays upsert-idempotent like
//    before. Re-running this script is always safe.
//  - Chat (ChatConversation/ChatParticipant/ChatMessage) IS seeded: despite
//    running over a live socket connection in the app, the tables are plain
//    persisted rows with no invariant beyond FK validity, so a couple of
//    realistic threads are created with direct prisma calls (chat.service.js
//    itself is a thin wrapper around exactly these calls plus socket
//    broadcasting, which has nothing to seed).
//  - One quotation (Q-H, Kaveri Hospitals) is pushed into UNDER_NEGOTIATION.
//    There is currently NO service-layer path that produces this transition
//    — NegotiationMessage / the portal counter-discount flow is explicitly
//    "not yet built" (SOURCE_OF_TRUTH §2.7), so nothing exists to call. It is
//    set directly via `prisma.quotation.update` with an explanatory AuditLog
//    row, clearly commented at the call site. This is a seed-data
//    accommodation for a missing feature, not a business-logic change.

const USERS = [
  { name: 'Aditi Admin', email: 'admin@dealflow360.com', role: 'ADMIN' },
  { name: 'Rohan Rep', email: 'rep@dealflow360.com', role: 'SALES_REP' },
  { name: 'Priya Rep', email: 'priya@dealflow360.com', role: 'SALES_REP' },
  { name: 'Meera Manager', email: 'manager@dealflow360.com', role: 'SALES_MANAGER' },
  { name: 'Farhan Finance', email: 'finance@dealflow360.com', role: 'FINANCE' },
];

// 3 tiers per DEMO_SCENARIO.md. minScore bands re-tuned (see CUSTOMERS below,
// which is tuned to land each named customer in its documented tier against
// this exact scoring config): 0-34 Bronze, 35-64 Silver, 65-100 Gold.
// defaultMaxDiscountPercent matches the doc's "Ceiling" column exactly.
// financeEscalationSeverity keeps the pre-existing 3/4/5 Bronze/Silver/Gold
// placeholders from before this reconciliation — DEMO_SCENARIO.md doesn't
// specify these, and they aren't contradicted by it either.
const TIERS = [
  { code: 'BRONZE', name: 'Bronze', rank: 1, minScore: 0, defaultMaxDiscountPercent: 5, financeEscalationSeverity: 3, isActive: true },
  { code: 'SILVER', name: 'Silver', rank: 2, minScore: 35, defaultMaxDiscountPercent: 10, financeEscalationSeverity: 4, isActive: true },
  { code: 'GOLD', name: 'Gold', rank: 3, minScore: 65, defaultMaxDiscountPercent: 15, financeEscalationSeverity: 5, isActive: true },
];

// Old generic placeholder customers this reconciliation replaces outright.
const OLD_CUSTOMER_EMAILS = ['buyer@acme.com', 'buyer@beta.com', 'buyer@cornershop.com'];

// Raw metrics tuned by hand against TierScoringConfig's seeded defaults
// (purchaseValueWeight 40 / target 1,250,000; orderCountWeight 25 / target 28;
// recencyWeight 20 / horizon 80 days; relationshipWeight 15 / target 3 years)
// so recalculateAllTiers() lands each customer in the tier DEMO_SCENARIO.md
// names them under — never hardcoded, always computed. Worked by hand:
//   Sundaram  ~97.5 -> GOLD    Vistaar ~77.2 -> GOLD
//   Kaveri    ~41.7 -> SILVER  Anand   ~42.1 -> SILVER
//   Rajdhani  ~9.6  -> BRONZE
const CUSTOMERS = [
  {
    name: 'Sundaram Textiles Pvt Ltd',
    email: 'procurement@sundaramtextiles.example',
    contactName: 'Karthik Subramaniam',
    phone: '+91 98450 11223',
    totalPurchaseValue: 1500000,
    completedOrders: 30,
    lastOrderDaysAgo: 10,
    customerSinceYearsAgo: 4,
  },
  {
    name: 'Vistaar Financial Services',
    email: 'admin@vistaarfinancial.example',
    contactName: 'Neha Kapoor',
    phone: '+91 98200 44556',
    totalPurchaseValue: 900000,
    completedOrders: 22,
    lastOrderDaysAgo: 15,
    customerSinceYearsAgo: 2.5,
  },
  {
    name: 'Kaveri Hospitals',
    email: 'facilities@kaverihospitals.example',
    contactName: 'Dr. Lakshmi Rao',
    phone: '+91 90080 77889',
    totalPurchaseValue: 400000,
    completedOrders: 10,
    lastOrderDaysAgo: 30,
    customerSinceYearsAgo: 1.5,
  },
  {
    name: 'Anand Motors',
    email: 'ops@anandmotors.example',
    contactName: 'Suresh Anand',
    phone: '+91 99870 33445',
    totalPurchaseValue: 380000,
    completedOrders: 10,
    lastOrderDaysAgo: 40,
    customerSinceYearsAgo: 2.2,
  },
  {
    name: 'Rajdhani Logistics',
    email: 'warehouse@rajdhanilogistics.example',
    contactName: 'Vikram Chauhan',
    phone: '+91 98110 22334',
    totalPurchaseValue: 90000,
    completedOrders: 3,
    lastOrderDaysAgo: 150,
    customerSinceYearsAgo: 0.8,
  },
];

// Flat, 3-category catalog tree — see header comment for why this replaces
// the old 4-category nested tree.
const CATEGORY_TREE = ['Hardware', 'Services', 'Software'];

// [tier code, category name, max discount %]
// Hardware and Services ceilings are DEMO_SCENARIO.md's numbers verbatim
// (Gold row = the doc's "Hardware ceiling 15% / Services ceiling 10%", with
// Silver/Bronze scaled down consistently with the pre-existing seed's
// Installation & Services numbers). Software ceilings reuse the Hardware
// numbers: no line in the demo ever actually discounts a Software line
// (recurring lines are priced from ProductSubscriptionPlan, discount 0), but
// getApplicableDiscountRule() throws if ANY category has no rule for a
// tier, so a real (if practically unused) ceiling still has to exist.
const DISCOUNT_RULES = [
  ['GOLD', 'Hardware', 15],
  ['GOLD', 'Services', 10],
  ['GOLD', 'Software', 15],

  ['SILVER', 'Hardware', 10],
  ['SILVER', 'Services', 7],
  ['SILVER', 'Software', 10],

  ['BRONZE', 'Hardware', 5],
  ['BRONZE', 'Services', 3],
  ['BRONZE', 'Software', 5],
];

// Prices/costs in INR, straight from DEMO_SCENARIO.md's catalog tables.
// costPrice is not in the doc (which only flags "every product needs one") —
// seeded here at a realistic ~35-45% margin per line, consistent with the
// pre-existing seed's margins.
const PRODUCTS = [
  // Hardware — CCTV
  { sku: 'CAM-IP-DOME-4MP', name: 'IP dome camera, 4MP', description: 'Indoor/outdoor dome camera with IR night vision.', productType: 'GOODS', categoryPath: 'Hardware', unit: 'unit', listPrice: 6800, costPrice: 4200, taxRate: 18 },
  { sku: 'CAM-IP-BULLET-4MP', name: 'IP bullet camera, 4MP, outdoor', description: 'Weatherproof long-range camera for gates, yards, perimeters.', productType: 'GOODS', categoryPath: 'Hardware', unit: 'unit', listPrice: 7400, costPrice: 4600, taxRate: 18 },
  { sku: 'NVR-16CH', name: 'NVR, 16-channel', description: 'Network video recorder for up to 16 IP cameras.', productType: 'GOODS', categoryPath: 'Hardware', unit: 'unit', listPrice: 38000, costPrice: 25000, taxRate: 18 },
  { sku: 'HDD-SURV-4TB', name: 'Surveillance-grade HDD, 4TB', description: '24/7-rated storage for continuous video recording.', productType: 'GOODS', categoryPath: 'Hardware', unit: 'unit', listPrice: 9500, costPrice: 6800, taxRate: 18 },
  { sku: 'SWITCH-POE-16', name: 'PoE network switch, 16-port', description: 'Powers and connects up to 16 IP cameras over Ethernet.', productType: 'GOODS', categoryPath: 'Hardware', unit: 'unit', listPrice: 14500, costPrice: 9200, taxRate: 18 },
  { sku: 'CAM-MOUNT-KIT', name: 'Camera mount / housing kit', description: 'Mounting bracket and weatherproof housing kit.', productType: 'GOODS', categoryPath: 'Hardware', unit: 'unit', listPrice: 1100, costPrice: 550, taxRate: 18 },
  // Hardware — ZKTeco biometric / access control
  { sku: 'ZK-SPEEDFACE-V5L', name: 'ZKTeco SpeedFace V5L (face + fingerprint terminal)', description: 'Authorized ZKTeco channel-partner hardware — face and fingerprint attendance/access terminal.', productType: 'GOODS', categoryPath: 'Hardware', unit: 'unit', listPrice: 18500, costPrice: 12500, taxRate: 18 },
  { sku: 'ZK-INBIO260', name: 'ZKTeco inBio260 (two-door access controller)', description: 'Authorized ZKTeco channel-partner hardware — two-door access controller.', productType: 'GOODS', categoryPath: 'Hardware', unit: 'unit', listPrice: 22000, costPrice: 15000, taxRate: 18 },
  { sku: 'ZK-K40', name: 'ZKTeco K40 (fingerprint time attendance terminal)', description: 'Authorized ZKTeco channel-partner hardware — fingerprint time attendance terminal.', productType: 'GOODS', categoryPath: 'Hardware', unit: 'unit', listPrice: 8200, costPrice: 5200, taxRate: 18 },
  { sku: 'ZK-EMLOCK-600', name: 'Electromagnetic lock, 600 lbs', description: 'Fail-safe electromagnetic door lock for access-control installs.', productType: 'GOODS', categoryPath: 'Hardware', unit: 'unit', listPrice: 3200, costPrice: 1900, taxRate: 18 },
  // Services
  { sku: 'SVC-SITE-SURVEY', name: 'Site survey & design', description: 'On-site survey and camera/access-point layout design.', productType: 'SERVICE', categoryPath: 'Services', unit: 'project', listPrice: 10000, costPrice: 6000, taxRate: 18 },
  { sku: 'SVC-CABLING-PT', name: 'Structured cabling (per point)', description: 'Structured cabling, priced per cable-run point.', productType: 'SERVICE', categoryPath: 'Services', unit: 'point', listPrice: 850, costPrice: 400, taxRate: 18 },
  { sku: 'SVC-INSTALL', name: 'Onsite installation & commissioning', description: 'Professional mounting, wiring, configuration, and handover.', productType: 'SERVICE', categoryPath: 'Services', unit: 'project', listPrice: 15000, costPrice: 9000, taxRate: 18 },
  { sku: 'SVC-HRMS-INTEGRATION', name: 'HRMS / payroll integration', description: 'Integrating biometric attendance data into the customer HRMS/payroll system.', productType: 'SERVICE', categoryPath: 'Services', unit: 'project', listPrice: 35000, costPrice: 22000, taxRate: 18 },
  { sku: 'SVC-TRAINING', name: 'User training (per batch)', description: 'On-site operator training, one batch.', productType: 'SERVICE', categoryPath: 'Services', unit: 'batch', listPrice: 8000, costPrice: 4000, taxRate: 18 },
  { sku: 'SVC-AMC', name: 'AMC comprehensive (per device)', description: 'Annual comprehensive maintenance contract, billed yearly per device.', productType: 'SERVICE', categoryPath: 'Services', unit: 'device', listPrice: 2800, costPrice: 1200, taxRate: 18, isSubscribable: true },
  // Software — recurring, isSubscribable. productType SERVICE: these are
  // cloud/software plans, never physically stocked (see STOCK below, which
  // has no rows for these SKUs, and inventory.service.js's assertion that a
  // SERVICE product type can never be stocked).
  { sku: 'SW-CLOUD-STORAGE', name: 'Cloud video storage (per camera)', description: 'Cloud video storage plan, priced per camera, billed monthly.', productType: 'SERVICE', categoryPath: 'Software', unit: 'camera', listPrice: 450, costPrice: 200, taxRate: 18, isSubscribable: true },
  { sku: 'SW-AI-ANALYTICS', name: 'AI analytics — people counting / ANPR (per camera)', description: 'AI video analytics plan, priced per camera, billed monthly.', productType: 'SERVICE', categoryPath: 'Software', unit: 'camera', listPrice: 600, costPrice: 250, taxRate: 18, isSubscribable: true },
  { sku: 'SW-ZKBIOTIME', name: 'ZKBioTime Cloud attendance (per 100 employees)', description: 'Authorized ZKTeco channel-partner software — cloud attendance plan, per 100 employees, billed monthly.', productType: 'SERVICE', categoryPath: 'Software', unit: '100 employees', listPrice: 2400, costPrice: 1000, taxRate: 18, isSubscribable: true },
];

// [sku, cycle, amount] — resolved by buildLineData() whenever a rep sells a
// subscribable product on a recurring plan; a product with no active plan
// for the chosen cycle is a thrown business error, not a silent fallback.
const PRODUCT_SUBSCRIPTION_PLANS = [
  ['SW-CLOUD-STORAGE', 'MONTHLY', 450],
  ['SW-AI-ANALYTICS', 'MONTHLY', 600],
  ['SW-ZKBIOTIME', 'MONTHLY', 2400],
  ['SVC-AMC', 'YEARLY', 2800],
];

// [source sku, target sku, type, promoted] — DEMO_SCENARIO.md's own upsell
// ladder: "camera -> NVR -> surveillance HDD -> PoE switch -> mounts/cabling
// -> cloud storage -> AMC -> analytics" plus the ZKTeco-specific pairing it
// calls out by name ("ZKTeco inBio260 controller and electromagnetic lock,
// co-purchased with the terminal") and the promoted "AI analytics and AMC"
// pairing.
const PRODUCT_RECOMMENDATIONS = [
  ['CAM-IP-DOME-4MP', 'SWITCH-POE-16', 'CROSS_SELL', false],
  ['CAM-IP-BULLET-4MP', 'SWITCH-POE-16', 'CROSS_SELL', false],
  ['CAM-IP-DOME-4MP', 'CAM-MOUNT-KIT', 'CROSS_SELL', false],
  ['NVR-16CH', 'HDD-SURV-4TB', 'CROSS_SELL', false],
  ['ZK-SPEEDFACE-V5L', 'ZK-INBIO260', 'CROSS_SELL', true],
  ['ZK-SPEEDFACE-V5L', 'ZK-EMLOCK-600', 'CROSS_SELL', true],
  ['CAM-IP-DOME-4MP', 'SW-CLOUD-STORAGE', 'CROSS_SELL', false],
  ['CAM-IP-DOME-4MP', 'SW-AI-ANALYTICS', 'CROSS_SELL', true],
  ['SW-AI-ANALYTICS', 'SVC-AMC', 'CROSS_SELL', true],
  ['SVC-INSTALL', 'SVC-AMC', 'CROSS_SELL', true],
];

// DEMO_SCENARIO.md's exact 2 warehouses — see header comment for why the
// pre-existing 3rd (North Hub) was dropped rather than kept.
const WAREHOUSES = [
  { code: 'MAIN', name: 'Main Warehouse', city: 'Bengaluru', shippingCostPerShipment: 250, priority: 10 },
  { code: 'PUNE', name: 'Regional Depot', city: 'Pune', shippingCostPerShipment: 400, priority: 20 },
];

// [warehouse code, product sku, on hand, reorder point, reorder qty]
// Camera stock is the deliberately-engineered one: MAIN(20) + PUNE(15) = 35
// on hand, but MAIN ALONE (20) cannot cover the demo quotation's 32-unit
// line — the split is real, not staged (DEMO_SCENARIO.md's explicit ask).
// Software/AMC SKUs have no rows here at all: they are productType SERVICE
// and are never stocked.
const STOCK = [
  ['MAIN', 'CAM-IP-DOME-4MP', 20, 6, 30],
  ['PUNE', 'CAM-IP-DOME-4MP', 15, 4, 20],
  ['MAIN', 'CAM-IP-BULLET-4MP', 12, 4, 20],
  ['PUNE', 'CAM-IP-BULLET-4MP', 6, 2, 10],
  ['MAIN', 'NVR-16CH', 6, 2, 10],
  ['PUNE', 'NVR-16CH', 4, 1, 6],
  ['MAIN', 'HDD-SURV-4TB', 10, 3, 15],
  ['PUNE', 'HDD-SURV-4TB', 8, 2, 10],
  ['MAIN', 'SWITCH-POE-16', 10, 3, 15],
  ['MAIN', 'CAM-MOUNT-KIT', 40, 10, 40],
  ['MAIN', 'ZK-SPEEDFACE-V5L', 10, 3, 12],
  ['PUNE', 'ZK-SPEEDFACE-V5L', 6, 2, 8],
  ['MAIN', 'ZK-INBIO260', 6, 2, 8],
  ['MAIN', 'ZK-K40', 8, 2, 10],
  ['MAIN', 'ZK-EMLOCK-600', 15, 3, 15],
];

const DEMO_PASSWORD = 'Password123';

// ── Transactional data (quotations and everything hung off them) is wiped
// and recreated on every run rather than upserted — see header comment for
// why. Order matters: Subscription.quotationLineId is onDelete: Restrict, so
// subscriptions (and their cascading invoices/changes) must go before
// quotations; ChatConversation.quotationId is onDelete: Cascade from
// Quotation but is cleared explicitly anyway for a clean, obvious order.
// Old placeholder customers (Acme/Beta/Corner Shop) are removed only after
// their quotations are gone, since Quotation.customer is onDelete: Restrict.
const wipeTransactionalData = async () => {
  await prisma.subscription.deleteMany({});
  await prisma.chatConversation.deleteMany({});
  await prisma.quotation.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.inventory.updateMany({ data: { reservedQty: 0 } });
  await prisma.customer.deleteMany({ where: { email: { in: OLD_CUSTOMER_EMAILS } } });
  console.log('  wiped     previous quotations / approvals / subscriptions / chat / old customers\n');
};

const main = async () => {
  await wipeTransactionalData();

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const userByEmail = {};
  for (const user of USERS) {
    const row = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash, isActive: true },
      create: { ...user, passwordHash },
    });
    userByEmail[user.email] = row;
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
  // Dormant, not deleted — see header comment.
  await prisma.customerTier.updateMany({ where: { code: 'PLATINUM' }, data: { isActive: false } });

  const DAY_MS = 24 * 60 * 60 * 1000;
  for (const { lastOrderDaysAgo, customerSinceYearsAgo, ...customer } of CUSTOMERS) {
    const data = {
      ...customer,
      lastOrderAt: new Date(Date.now() - lastOrderDaysAgo * DAY_MS),
      customerSince: new Date(Date.now() - customerSinceYearsAgo * 365.25 * DAY_MS),
      passwordHash, // portal login, same demo password as staff for convenience
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

  const categoryIdByPath = {};
  for (const name of CATEGORY_TREE) {
    let row = await prisma.category.findFirst({ where: { name, parentId: null } });
    row = row ?? (await prisma.category.create({ data: { name } }));
    categoryIdByPath[name] = row.id;
    console.log(`  category  ${name}`);
  }

  const productIdBySku = {};
  for (const { categoryPath, ...product } of PRODUCTS) {
    const categoryId = categoryIdByPath[categoryPath];
    if (!categoryId) throw new Error(`Unknown categoryPath "${categoryPath}" for ${product.sku}`);

    const row = await prisma.product.upsert({
      where: { sku: product.sku },
      update: { ...product, categoryId },
      create: { ...product, categoryId },
    });
    productIdBySku[product.sku] = row.id;
    console.log(`  product   ${product.productType.padEnd(8)} ${product.sku.padEnd(20)} ${product.name}`);
  }

  await prisma.product.updateMany({
    where: { sku: { notIn: PRODUCTS.map((product) => product.sku) } },
    data: { isActive: false },
  });

  for (const [sku, cycle, amount] of PRODUCT_SUBSCRIPTION_PLANS) {
    const productId = productIdBySku[sku];
    if (!productId) throw new Error(`Unknown SKU "${sku}" in PRODUCT_SUBSCRIPTION_PLANS`);

    await prisma.productSubscriptionPlan.upsert({
      where: { productId_cycle: { productId, cycle } },
      update: { amount, isActive: true },
      create: { productId, cycle, amount },
    });
    console.log(`  plan     ${sku.padEnd(20)} ${cycle.padEnd(10)} ₹${amount}`);
  }

  for (const [sourceSku, targetSku, type, promoted] of PRODUCT_RECOMMENDATIONS) {
    const sourceProductId = productIdBySku[sourceSku];
    const targetProductId = productIdBySku[targetSku];
    if (!sourceProductId || !targetProductId) {
      throw new Error(`Unknown SKU in PRODUCT_RECOMMENDATIONS: ${sourceSku} -> ${targetSku}`);
    }

    await prisma.productRecommendation.upsert({
      where: { sourceProductId_targetProductId_type: { sourceProductId, targetProductId, type } },
      update: { promoted, isActive: true },
      create: { sourceProductId, targetProductId, type, promoted },
    });
    console.log(`  recommend ${type.padEnd(10)} ${sourceSku.padEnd(20)} -> ${targetSku}`);
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
    console.log(`  rule     ${tierCode.padEnd(8)} ${categoryPath.padEnd(10)} max ${String(max).padStart(2)}%`);
  }

  for (const warehouse of WAREHOUSES) {
    await prisma.warehouse.upsert({
      where: { code: warehouse.code },
      update: warehouse,
      create: warehouse,
    });
    console.log(`  warehouse ${warehouse.code.padEnd(6)} ${warehouse.name} (₹${warehouse.shippingCostPerShipment}/shipment)`);
  }

  // Old warehouses (e.g. the pre-existing EAST/NORTH) are deactivated, not
  // deleted — Inventory/StockMovement rows may still reference them on a
  // shared dev DB, same "deactivate, don't break FKs" reasoning as the
  // customer/tier cleanup above.
  await prisma.warehouse.updateMany({
    where: { code: { notIn: WAREHOUSES.map((w) => w.code) } },
    data: { isActive: false },
  });

  for (const [code, sku, onHandQty, reorderPoint, reorderQty] of STOCK) {
    const warehouse = await prisma.warehouse.findUnique({ where: { code } });
    const product = await prisma.product.findUnique({ where: { sku } });

    await prisma.inventory.upsert({
      where: { warehouseId_productId: { warehouseId: warehouse.id, productId: product.id } },
      update: { onHandQty, reorderPoint, reorderQty },
      create: { warehouseId: warehouse.id, productId: product.id, onHandQty, reorderPoint, reorderQty },
    });
    console.log(`  stock     ${code.padEnd(6)} ${sku.padEnd(20)} ${String(onHandQty).padStart(3)} on hand`);
  }

  // ── Quotations, approvals, subscriptions, chat ──────────────────────────
  // Built through the REAL service layer (quotation.service.js /
  // approval.service.js / subscription.service.js), never raw inserts, so
  // evaluateDiscount()'s routing, stock reservation, and subscription
  // creation all run for real. The one exception (Q-H's UNDER_NEGOTIATION
  // flip) is called out at the point it happens — see header comment.
  console.log('\n  --- quotations / approvals / subscriptions / chat ---\n');

  const {
    createQuotation,
    submitQuotation,
    updateQuotationLines,
    withdrawQuotation,
    getQuotationById,
  } = await import('../src/modules/quotations/quotation.service.js');
  const { actOnStep } = await import('../src/modules/approvals/approval.service.js');
  const { cancelSubscription, runBillingCycle } = await import('../src/modules/subscriptions/subscription.service.js');
  const { writeAudit } = await import('../src/modules/quotations/auditLog.service.js');

  const rep1 = { id: userByEmail['rep@dealflow360.com'].id, role: 'SALES_REP' };
  const rep2 = { id: userByEmail['priya@dealflow360.com'].id, role: 'SALES_REP' };
  const manager = { id: userByEmail['manager@dealflow360.com'].id, role: 'SALES_MANAGER' };
  const finance = { id: userByEmail['finance@dealflow360.com'].id, role: 'FINANCE' };

  const customerByEmail = {};
  for (const c of CUSTOMERS) {
    customerByEmail[c.name] = await prisma.customer.findUnique({ where: { email: c.email } });
  }
  const sundaram = customerByEmail['Sundaram Textiles Pvt Ltd'];
  const vistaar = customerByEmail['Vistaar Financial Services'];
  const kaveri = customerByEmail['Kaveri Hospitals'];
  const anand = customerByEmail['Anand Motors'];
  const rajdhani = customerByEmail['Rajdhani Logistics'];

  const pid = (sku) => productIdBySku[sku];

  const findActiveStep = (quotation) => {
    for (const request of quotation.approvalRequests) {
      const step = request.steps.find((s) => s.status === 'ACTIVE');
      if (step) return { request, step };
    }
    return null;
  };

  // actOnStep() returns the ApprovalRequest, not the Quotation — refetch the
  // quotation (as an admin, to bypass the "reps only see their own" scope)
  // after every approval action so the local variable always reflects the
  // quotation's current status/approvalRequests.
  const refreshQuotation = (quotation) => getQuotationById(quotation.id, { role: 'ADMIN' });

  // Q-A — THE demo quotation (DEMO_SCENARIO.md's worked example). Sundaram
  // Textiles, Gold/15%. Exercises all four "must not be faked" rules: a
  // breaching Services line (cabling 18% vs 10% ceiling) auto-routes to
  // Sales Manager, 32 cameras force a Bengaluru+Pune split, three
  // independent recurring lines with different cycles ride the same order,
  // and it's left PENDING_APPROVAL — reachable in the approvals queue from
  // minute one of the demo.
  let demoQuotation = await createQuotation(
    {
      customerId: sundaram.id,
      customerReference: 'PO-SUN-2026-014',
      notes: 'Pune factory floor: CCTV surveillance + worker biometric attendance rollout.',
      lines: [
        { productId: pid('CAM-IP-DOME-4MP'), quantity: 32, discountPercent: 12 },
        { productId: pid('NVR-16CH'), quantity: 2, discountPercent: 10 },
        { productId: pid('HDD-SURV-4TB'), quantity: 4, discountPercent: 8 },
        { productId: pid('ZK-SPEEDFACE-V5L'), quantity: 4, discountPercent: 10 },
        { productId: pid('SVC-CABLING-PT'), quantity: 32, discountPercent: 18 },
        { productId: pid('SW-CLOUD-STORAGE'), quantity: 32, discountPercent: 0, isRecurring: true, recurringCycle: 'MONTHLY' },
        { productId: pid('SW-ZKBIOTIME'), quantity: 1, discountPercent: 0, isRecurring: true, recurringCycle: 'MONTHLY' },
        { productId: pid('SVC-AMC'), quantity: 36, discountPercent: 0, isRecurring: true, recurringCycle: 'YEARLY' },
      ],
    },
    rep1
  );
  demoQuotation = await submitQuotation(demoQuotation.id, rep1);
  console.log(
    `  quote A   ${demoQuotation.code}  Sundaram Textiles  ${demoQuotation.status}` +
      (demoQuotation.approvalRequests?.[0] ? ` / ${demoQuotation.approvalRequests[0].approvalLevel}` : '')
  );

  // Q-B — Sundaram, small and fully compliant, left as a DRAFT (a rep still
  // shaping it — the other common real-world state besides "submitted").
  const draftB = await createQuotation(
    {
      customerId: sundaram.id,
      customerReference: 'PO-SUN-2026-021',
      notes: 'Reception-area camera top-up.',
      lines: [{ productId: pid('CAM-IP-DOME-4MP'), quantity: 5, discountPercent: 5 }],
    },
    rep1
  );
  console.log(`  quote B   ${draftB.code}  Sundaram Textiles  ${draftB.status}`);

  // Q-C — Vistaar Financial, fully compliant -> auto-confirms with no
  // ApprovalRequest at all (the DRAFT -> CONFIRMED edge, §4). Carries one
  // recurring line so confirmation exercises createSubscriptionsForQuotation.
  let quoteC = await createQuotation(
    {
      customerId: vistaar.id,
      customerReference: 'PO-VIS-2026-005',
      notes: 'Branch camera refresh with cloud backup.',
      lines: [
        { productId: pid('CAM-IP-DOME-4MP'), quantity: 10, discountPercent: 10 },
        { productId: pid('NVR-16CH'), quantity: 1, discountPercent: 5 },
        { productId: pid('SW-CLOUD-STORAGE'), quantity: 10, discountPercent: 0, isRecurring: true, recurringCycle: 'MONTHLY' },
      ],
    },
    rep2
  );
  quoteC = await submitQuotation(quoteC.id, rep2);
  console.log(`  quote C   ${quoteC.code}  Vistaar Financial  ${quoteC.status} (auto-confirmed, compliant)`);

  // Q-D — Vistaar, a mild breach that only needs a Sales Manager. Approved
  // by the manager and left at APPROVED (customer hasn't confirmed yet).
  let quoteD = await createQuotation(
    {
      customerId: vistaar.id,
      customerReference: 'PO-VIS-2026-009',
      notes: 'New branch opening — perimeter cameras + install.',
      lines: [
        { productId: pid('CAM-IP-BULLET-4MP'), quantity: 6, discountPercent: 18 },
        { productId: pid('SVC-INSTALL'), quantity: 1, discountPercent: 5 },
      ],
    },
    rep1
  );
  quoteD = await submitQuotation(quoteD.id, rep1);
  {
    const found = findActiveStep(quoteD);
    await actOnStep(found.request.id, found.step.id, { action: 'APPROVE', note: 'Within reason for a new-branch launch.' }, manager);
    quoteD = await refreshQuotation(quoteD);
  }
  console.log(`  quote D   ${quoteD.code}  Vistaar Financial  ${quoteD.status}`);

  // Q-E — Kaveri Hospitals (Silver), a large breach whose blended severity
  // clears Silver's finance-escalation threshold -> MANAGER_FINANCE. Manager
  // approves and hands off to Finance, who rejects it -> REJECTED (terminal
  // for this row, per §1.6).
  let quoteE = await createQuotation(
    {
      customerId: kaveri.id,
      customerReference: 'PO-KAV-2026-002',
      notes: 'Storage upgrade across both hospital sites.',
      lines: [
        { productId: pid('HDD-SURV-4TB'), quantity: 10, discountPercent: 25 },
        { productId: pid('CAM-IP-DOME-4MP'), quantity: 5, discountPercent: 5 },
      ],
    },
    rep2
  );
  quoteE = await submitQuotation(quoteE.id, rep2);
  {
    const found = findActiveStep(quoteE);
    await actOnStep(found.request.id, found.step.id, { action: 'APPROVE', note: 'Escalating to Finance — discount well past ceiling.' }, manager);
    quoteE = await refreshQuotation(quoteE);
  }
  {
    const found = findActiveStep(quoteE);
    await actOnStep(found.request.id, found.step.id, { action: 'REJECT', note: '25% off surveillance HDD is not supportable at Kaveri\'s current tier.' }, finance);
    quoteE = await refreshQuotation(quoteE);
  }
  console.log(`  quote E   ${quoteE.code}  Kaveri Hospitals   ${quoteE.status}`);

  // Q-F — Anand Motors (Silver), a mild manager-only breach. Manager
  // approves, then the customer withdraws (APPROVED -> WITHDRAWN, §1.6) —
  // terminal for this row, but the deal continues as a new linked quotation.
  let quoteF = await createQuotation(
    {
      customerId: anand.id,
      customerReference: 'PO-ANM-2026-011',
      notes: 'Showroom network refresh.',
      lines: [
        { productId: pid('SWITCH-POE-16'), quantity: 4, discountPercent: 12 },
        { productId: pid('SVC-TRAINING'), quantity: 1, discountPercent: 5 },
      ],
    },
    rep1
  );
  quoteF = await submitQuotation(quoteF.id, rep1);
  {
    const found = findActiveStep(quoteF);
    await actOnStep(found.request.id, found.step.id, { action: 'APPROVE', note: null }, manager);
    quoteF = await refreshQuotation(quoteF);
  }
  quoteF = await withdrawQuotation(quoteF.id, rep1, 'Customer wants to renegotiate the switch discount before committing.');
  console.log(`  quote F   ${quoteF.code}  Anand Motors       ${quoteF.status}`);

  // Q-F child — the re-quote DEMO_SCENARIO.md/§1.6 asks for: created from the
  // WITHDRAWN Q-F (previousQuotationId chain), discount brought back within
  // ceiling and a recurring AMC line added, then submitted compliant ->
  // auto-confirms. Demonstrates both the requote chain AND a second
  // CONFIRMED quotation with its own subscription.
  let quoteFChild = await createQuotation({ sourceQuotationId: quoteF.id }, rep1);
  const switchLine = quoteFChild.lines.find((l) => l.productId === pid('SWITCH-POE-16'));
  quoteFChild = await updateQuotationLines(
    quoteFChild.id,
    {
      update: [{ lineId: switchLine.id, discountPercent: 8 }],
      add: [{ productId: pid('SVC-AMC'), quantity: 4, discountPercent: 0, isRecurring: true, recurringCycle: 'YEARLY' }],
    },
    rep1
  );
  quoteFChild = await submitQuotation(quoteFChild.id, rep1);
  console.log(`  quote F'  ${quoteFChild.code}  Anand Motors       ${quoteFChild.status} (requoted from ${quoteF.code}, now compliant)`);

  // Q-G — Rajdhani Logistics (Bronze), small and compliant, left DRAFT.
  const draftG = await createQuotation(
    {
      customerId: rajdhani.id,
      customerReference: 'PO-RAJ-2026-003',
      notes: 'Gate attendance terminals for the warehouse.',
      lines: [
        { productId: pid('ZK-K40'), quantity: 2, discountPercent: 3 },
        { productId: pid('SVC-SITE-SURVEY'), quantity: 1, discountPercent: 2 },
      ],
    },
    rep2
  );
  console.log(`  quote G   ${draftG.code}  Rajdhani Logistics ${draftG.status}`);

  // Q-H — Kaveri Hospitals, a mild manager-only breach, approved, then
  // pushed into UNDER_NEGOTIATION. NOTE: no service function currently
  // performs this transition (the portal/NegotiationMessage counter-discount
  // flow is not built — SOURCE_OF_TRUTH.md §2.7/§1.4). This is a direct,
  // explicitly-audited status write standing in for that missing feature,
  // not a business-logic shortcut around an existing one.
  let quoteH = await createQuotation(
    {
      customerId: kaveri.id,
      customerReference: 'PO-KAV-2026-006',
      notes: 'Mount/housing kit refresh across both sites.',
      lines: [
        { productId: pid('CAM-MOUNT-KIT'), quantity: 10, discountPercent: 12 },
        { productId: pid('SVC-TRAINING'), quantity: 1, discountPercent: 3 },
      ],
    },
    rep1
  );
  quoteH = await submitQuotation(quoteH.id, rep1);
  {
    const found = findActiveStep(quoteH);
    await actOnStep(found.request.id, found.step.id, { action: 'APPROVE', note: null }, manager);
    quoteH = await refreshQuotation(quoteH);
  }
  await prisma.$transaction(async (tx) => {
    await tx.quotation.update({ where: { id: quoteH.id }, data: { status: 'UNDER_NEGOTIATION', lastActivityAt: new Date() } });
    await writeAudit(tx, {
      quotationId: quoteH.id,
      userId: rep1.id,
      action: 'NEGOTIATION_REOPENED',
      note: 'Customer called in requesting a larger discount on the mount kits (recorded manually — portal negotiation flow not yet built, see SOURCE_OF_TRUTH.md §2.7).',
    });
  });
  quoteH = await getQuotationById(quoteH.id, { role: 'ADMIN' });
  console.log(`  quote H   ${quoteH.code}  Kaveri Hospitals   ${quoteH.status}`);

  // ── Subscriptions: give the Subscriptions page ACTIVE / CANCELLED /
  // PENDING_RENEWAL_APPROVAL examples (the real SubscriptionStatus enum —
  // see schema.prisma; there is no PAUSED status, so it is not seeded).
  const subs = await prisma.subscription.findMany({ where: { customerId: { in: [vistaar.id, anand.id] } } });
  const cloudStorageSub = subs.find((s) => s.productId === pid('SW-CLOUD-STORAGE'));
  const amcSub = subs.find((s) => s.productId === pid('SVC-AMC'));

  if (amcSub) {
    await cancelSubscription(amcSub.id, 'immediate', amcSub.customerId, 'Customer switching to in-house maintenance.');
    console.log(`  subscription ${amcSub.id} (AMC, Anand Motors) -> CANCELLED`);
  }
  if (cloudStorageSub) {
    // Force this one's billing cycle to be due now, then run the real
    // billing-cycle tick so it lands in PENDING_RENEWAL_APPROVAL with a real
    // PENDING_APPROVAL SubscriptionInvoice — not a hand-set status.
    await prisma.subscription.update({ where: { id: cloudStorageSub.id }, data: { nextBillingDate: new Date() } });
    await runBillingCycle();
    console.log(`  subscription ${cloudStorageSub.id} (Cloud storage, Vistaar) -> PENDING_RENEWAL_APPROVAL (invoice raised)`);
  }

  // ── Chat: one thread on the flagship demo quotation, one on a resolved
  // deal, so the chat panel has real history instead of an empty state.
  const chatSeed = [
    {
      quotationId: demoQuotation.id,
      customerId: sundaram.id,
      repId: rep1.id,
      messages: [
        { from: 'CUSTOMER', body: 'Hi, following up on the Pune factory quote — any update on approval?' },
        { from: 'USER', body: 'Hi Karthik, it\'s with our Sales Manager right now — the structured cabling line needed a second look. Should hear back within the day.' },
        { from: 'CUSTOMER', body: 'Understood. Can we also confirm the AMC covers all 36 devices, cameras and terminals both?' },
        { from: 'USER', body: 'Yes — AMC comprehensive is quoted per device across the full rollout, 36 units, billed yearly.' },
      ],
    },
    {
      quotationId: quoteFChild.id,
      customerId: anand.id,
      repId: rep1.id,
      messages: [
        { from: 'CUSTOMER', body: 'Thanks for revisiting the switch pricing — the 8% works for us.' },
        { from: 'USER', body: 'Great, glad we could land on a number that works. I\'ve added the AMC line too as discussed, confirming the order now.' },
      ],
    },
  ];

  for (const thread of chatSeed) {
    const conversation = await prisma.chatConversation.create({
      data: {
        quotationId: thread.quotationId,
        customerId: thread.customerId,
        status: 'ACTIVE',
        participants: { create: [{ userId: thread.repId }] },
      },
    });
    for (const message of thread.messages) {
      await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          senderType: message.from,
          senderCustomerId: message.from === 'CUSTOMER' ? thread.customerId : null,
          senderUserId: message.from === 'USER' ? thread.repId : null,
          body: message.body,
        },
      });
    }
    console.log(`  chat      conversation ${conversation.id} on quotation ${thread.quotationId} (${thread.messages.length} messages)`);
  }

  const statusCounts = await prisma.quotation.groupBy({ by: ['status'], _count: { _all: true } });
  console.log('\n  Quotation status distribution:');
  for (const row of statusCounts) {
    console.log(`    ${row.status.padEnd(18)} ${row._count._all}`);
  }

  console.log(`\nAll seeded accounts (staff and customer portal logins) use the password: ${DEMO_PASSWORD}\n`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
