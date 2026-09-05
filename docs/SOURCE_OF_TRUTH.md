# DealFlow360 — Source of Truth

**Read this before writing a model, an endpoint, or a screen that touches data.**
Both teammates and both Claude sessions build against this file. If a decision here changes, edit this file in the same breath — see ground rule 15.

Business context: [DEMO_SCENARIO.md](./DEMO_SCENARIO.md). Design tokens: [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).

---

## 1. Non-negotiable modeling decisions

Four calls that shape everything downstream. Each is a deliberate trade-off, not a default — if a judge asks "why," the answer is here.

### 1.1 The Quotation *is* the Order

No separate `SalesOrder` table created on confirmation. One row, `Quotation`, carries a `status` that walks through the whole lifecycle including post-confirmation fulfillment and billing references.

**Why:** the mockup carries `Q-1042` unchanged from the quotation list into Fulfillment Detail and Invoice Detail. A second table on confirmation means two writes, two IDs, and a sync bug waiting to happen, for zero benefit — nothing in the brief needs a quotation and its resulting order to be independently queryable as different entities.

### 1.2 Approval binds to a *version of the terms*, not to the quote

`Quotation.termsVersion` is an integer, starting at 1, incremented on **any pricing-relevant change** (line added/removed, quantity, discount, product swap). `Quotation.approvedTermsVersion` records which version was last approved.

**An approval is valid only while `approvedTermsVersion === termsVersion`.** Any edit after approval silently invalidates it — no explicit "unapprove" step needed.

**Why:** this single field is what makes the customer-portal re-approval loop (mockup Screen 11: *"If final terms exceed approval thresholds, the quotation automatically re-enters the approval flow"*) fall out for free instead of becoming a pile of special-case checks. It also answers the obvious question — "what stops a rep editing an approved quote to slip in a bigger discount?" — with one field instead of a policy nobody enforces.

### 1.3 Each approval round is a new `ApprovalRequest`, not a mutated one

Every time a quotation needs approval (initial submission, or re-entry after negotiation), a new `ApprovalRequest` row is created, holding its own chain of `ApprovalStep`s. Old requests are never edited after they close.

**Why:** gives Screen 6's audit trail and the Submitted → Manager → Finance chain visualiser for free, and makes post-negotiation re-approval a fresh, independently-auditable round rather than a reset of the first one. "All approvals, rejections, and edits must be logged with user, timestamp, and reason" (brief, A3) is satisfied by construction, not by a separate audit table bolted on.

### 1.4 Customer *proposes*, rep *applies*

The portal's counter-discount / change-request creates a `NegotiationMessage` (a proposal, inert on its own). It only becomes real when a rep applies it to the quotation's lines — which bumps `termsVersion` per 1.2 and triggers re-routing.

**Why:** auto-applying a customer's own discount request would let a customer approve their own discount, which is a security/business hole, not just bad UX. It's also consistent with the mockup: Screen 11 has both "Submit Request" and "Confirm Quotation" as separate buttons, implying request and acceptance are different actions.

### 1.5 Stock is a three-state ledger, not a counter

Per warehouse per product: `onHand`, `reserved`, `available` (`= onHand - reserved`). Confirming a quotation reserves stock against the chosen warehouse split; shipping decrements `onHand` and `reserved` together.

**Why:** mockup Screen 7 shows exactly these three columns. A single "quantity" field can't express "this stock exists but is already promised to another order," which is the entire premise of backorder handling.

### 1.6 A rejected/withdrawn quotation can be re-quoted — as a new, linked row

`REJECTED` (an approver said no) and `WITHDRAWN` (the customer said no) are both terminal for that `Quotation` row, but not for the deal. A rep can open a `REJECTED` or `WITHDRAWN` quotation and choose "Create New Quotation" from inside it; that creates a new `Quotation` with `previousQuotationId` pointing at the one it replaces, inheriting the customer and a copy of the lines (re-snapshotted against current prices/rules). `sourceQuoteRequestId` (§2.11), if the chain started from a public lead, is copied forward to every quotation in the chain.

**Why a new row, not reopening the old one:** `RETURNED` (an approval step sends a quotation back for rework) already loops the *same row* back to `DRAFT` — that path exists precisely for "needs changes, same deal." `REJECTED`/`WITHDRAWN` are meant to be a harder, final no; if either looped back to `DRAFT` too, a quotation's own `status` could walk all the way to `CONFIRMED` with no trace that it was ever rejected, breaking win/loss reporting. A new linked row keeps the rejected/withdrawn record permanently honest while still letting the deal continue.

**Why a chain (`previousQuotationId` is `@unique`), not a flat link to the original lead:** the same re-quote-after-no can happen more than once (reject → child → withdrawn → child → …). A unique self-relation makes this a strict linked list, walkable in either direction, rather than a branching tree — matching that only one live attempt should ever exist per deal at a time (enforced in the service layer: a child can only be requested from a source that is already `REJECTED` or `WITHDRAWN`, never from a live one).

No stored sequence number — "3rd attempt on this deal" is a chain-walk at read time if ever displayed, same as everything else in this schema that's derived rather than stored.

---

## 2. Data model

Written as Prisma models — this is what goes in `schema.prisma`, not a paraphrase of it. Field types are illustrative; exact Prisma syntax (relations, `@default`, indexes) to be finalized when implemented, but **names and shapes should not drift from this without updating this file.**

### 2.1 Identity & company

**§2.1–2.2 are already built** — `server/prisma/schema.prisma`, as of the auth + customer/product/warehouse/inventory slice. What follows is reconciled to match that reality, not the original draft. Two real decisions replace what was proposed here — both adopted, not overridden:

- **All IDs are `Int @default(autoincrement())`**, not `String cuid()`. Applies everywhere below.
- **No separate `PortalUser` model.** `Customer` carries its own nullable `passwordHash` directly — one login per customer company. The original draft proposed a `PortalUser` per named contact; the brief never asks for multiple logins per customer, so that was solving a problem we don't have. Simpler, and it's what's actually running.

```
enum Role {
  ADMIN
  SALES_REP
  SALES_MANAGER
  FINANCE
}

model User {
  id           Int      @id @default(autoincrement())
  name         String
  email        String   @unique
  passwordHash String
  role         Role     @default(SALES_REP)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  quotationsOwned   Quotation[]        @relation("QuotationOwner")
  approvalStepsDone ApprovalStep[]
  auditEntries      AuditLog[]

  @@map("users")
}

/* Not yet built. Singleton. Admin edits the one row; the public site and the
 * portal brand from it. No tenantId anywhere else in the schema — see
 * DEMO_SCENARIO.md "Single company, deliberately". */
model Company {
  id        String  @id @default("singleton")
  name      String  @default("Netrix Systems Pvt Ltd")
  gstin     String?
  address   String?
  logoUrl   String?
  accentHex String  @default("#7C3AED")
}
```

### 2.2 Customers (also the portal login)

**Superseded from the original draft — `CustomerTier` is a real table with a scoring engine, not an enum.** Built in `0e38df4`/`ee39862`, independently of this doc. An admin doesn't assign a customer's tier; it's *calculated*:

```
// A table, not an enum: adding PLATINUM is a row, not a migration.
model CustomerTier {
  id                        Int     @id @default(autoincrement())
  code                      String  @unique   // BRONZE | SILVER | GOLD | PLATINUM (seeded)
  name                      String
  rank                      Int     @unique   // ordering only
  minScore                  Int     @default(0)   // lands the highest tier a customer's score reaches
  defaultMaxDiscountPercent Decimal @db.Decimal(5, 2)  // tier-wide ceiling, order-level check only (§3)
  financeEscalationSeverity Decimal @db.Decimal(5, 2) @default(5) // blended severity above which Finance joins Manager
}

// Singleton. Weights (must total 100) and targets the scoring engine reads —
// tunable by an admin, not compiled into the calculation.
model TierScoringConfig {
  id Int @id @default(1)
  purchaseValueWeight, orderCountWeight, recencyWeight, relationshipWeight  Decimal
  purchaseValueTarget, orderCountTarget, recencyHorizonDays, relationshipTargetYears
}

model Customer {
  id           Int     @id @default(autoincrement())
  name         String
  email        String  @unique
  passwordHash String?

  tierId           Int
  tier             CustomerTier @relation(fields: [tierId], references: [id])
  tierScore        Decimal      @db.Decimal(5, 2) @default(0)
  tierCalculatedAt DateTime?

  // Raw metrics the score is computed from. Stored here because there was no
  // order history when this was built; once Quotation confirmation is wired
  // to feed these (open item, §7), they become derived instead of seeded.
  totalPurchaseValue Decimal   @db.Decimal(14, 2) @default(0)
  completedOrders    Int       @default(0)
  lastOrderAt        DateTime?
  customerSince      DateTime  @default(now())

  contactName String?
  phone       String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  quotations Quotation[]

  @@map("customers")
}
```

Recalculated by `tierScoring.service.js`'s `recalculateAllTiers()` — a weighted blend of purchase value, order count, recency, and relationship length against `TierScoringConfig`'s targets. `NegotiationMessage` (portal negotiation) is not built yet — see §2.7, unchanged from the original draft, still not started.

### 2.3 Catalog

**Superseded twice over from the original draft, both times for the better.** First cut: `category` was a `HARDWARE/SOFTWARE/SERVICE` enum (dropping the original draft's `SUBSCRIPTION`-as-category mistake — recurring billing is `isSubscribable` here, the cycle chosen **per `QuotationLine`**, since the same product can be sold one-time to one customer and on a plan to another). **Second cut, built in `0e38df4`/`ee39862`: category is now `Category`, a real self-referencing tree an admin manages like products, not a fixed enum** — a `ProductType` enum (`GOODS`/`SERVICE`/`COMBO`) was split off to separately answer "is this stocked at all," orthogonal to which category it's filed under.

```
// Physical/stocking nature — orthogonal to Category. Services are never stocked.
enum ProductType {
  GOODS
  SERVICE
  COMBO
}

// A real tree: a product can attach at a root ("Software") or a leaf
// ("Hardware / Computers"). Ceilings are NOT here — see §2.4, DiscountRule.
model Category {
  id       Int        @id @default(autoincrement())
  name     String
  parentId Int?
  parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children Category[] @relation("CategoryTree")
  products Product[]

  @@unique([parentId, name])
}

model Product {
  id             Int         @id @default(autoincrement())
  sku            String      @unique
  name           String
  description    String?
  productType    ProductType @default(GOODS)
  categoryId     Int
  category       Category    @relation(fields: [categoryId], references: [id])
  unit           String      @default("unit")
  imageUrl       String?
  isSubscribable Boolean     @default(false)
  listPrice      Decimal     @db.Decimal(12, 2)
  costPrice      Decimal     @db.Decimal(12, 2) // margin — see §3.4
  taxRate        Decimal     @db.Decimal(5, 2)  @default(0)
  isActive       Boolean     @default(true)

  inventory      Inventory[]
  quotationLines QuotationLine[]

  @@index([categoryId])
  @@map("products")
}

// Not on Product — chosen per QuotationLine (§2.5), since one-time vs
// recurring is a per-sale decision, not a catalog-fixed one.
enum RecurringCycle {
  MONTHLY
  QUARTERLY
  YEARLY
}
```

**Built.** Superseding the `UpsellRule` name above: the actual model is `ProductRecommendation` (source product → target product, `type: UPSELL | CROSS_SELL`, `promoted`, `minMarginPercent`), evaluated by `recommendation.service.js`'s `getSuggestions(productIds)` against whatever's currently in an order. See §5 for the real endpoints (not the `/quotations/:id/upsell-suggestions` shape originally sketched) and §2.5 for `QuotationLine.suggestedAs`/`suggestedFromProductId` (attribution only, server-reverified on every add — never trusted from the client as-is). UI: product pages + cart (client, public suggestions, no margin) and the quotation line editor + Products admin form (internal, staff suggestions with margin, and the only place recommendation pairs are configured).

### 2.4 Discount governance (A3 / Section 10)

**Built in `0e38df4`/`ee39862` — a materially different, more complete design than this file originally proposed.** The two-ceiling model (`TierDiscountCeiling` × `CategoryDiscountCeiling`, `min()`'d together) and the `RiskBand`/`ApprovalRoutingRule` config table **do not exist and should not be built** — both are superseded by what's below. `evaluateDiscount()` in `discountEvaluation.service.js` already fully implements the routing decision described in §3.

```
model DiscountRule {
  id             Int          @id @default(autoincrement())
  customerTierId Int
  customerTier   CustomerTier @relation(fields: [customerTierId], references: [id])
  categoryId     Int
  category       Category     @relation(fields: [categoryId], references: [id])
  maxDiscountPercent Decimal  @db.Decimal(5, 2)
  isActive       Boolean      @default(true)

  // Exactly one rule per (tier, category) pair. Resolution walks UP the
  // category tree from a product's own category — a rule on "Hardware"
  // also governs "Hardware / Computers" — and a missing rule anywhere up
  // the chain is a thrown business error, never a silent allowance.
  @@unique([customerTierId, categoryId])
}
```

Two config tables replace `TierDiscountCeiling`/`CategoryDiscountCeiling`/`ApprovalRoutingRule` entirely:
- **`DiscountRule.maxDiscountPercent`** — the per-line ceiling (§3.1), one direct lookup instead of `min(tier, category)`.
- **`CustomerTier.financeEscalationSeverity`** (§2.2) — the blended-severity threshold above which Finance joins the Sales Manager (§3.2). Routing is no longer a separate `RiskBand`→chain config table; it's computed directly: any breach → Manager; `blendedSeverity > financeEscalationSeverity` → also Finance.

See §3 for the full computation — still derived at evaluation time, never stored as a standalone number; only `DiscountRule` rows and `financeEscalationSeverity` are configuration.

### 2.5 The quotation

**Built 2026-09-05, migration `quotation_lifecycle_core`.** Three things here differ from the original draft, decided in the design conversation that preceded this migration:

- **No stored `code` column.** `"Q-1042"` is 100% derivable from the autoincrement `id` (`Q-${1000 + id}`) — storing it would mean a two-step insert just to satisfy a unique-not-null constraint for a value that can never legitimately drift. Computed in the serializer instead, same "derived, never stored" rule as `Inventory.available` (§1.5).
- **`WITHDRAWN` added alongside `REJECTED`**, and a self-referencing `previousQuotationId` chain (§1.6) — both new since the original draft only had a bare `REJECTED` with no way to re-attempt a dead deal.
- **`confirmedAt`, `customerReference`, `notes`, `updatedAt` added** — the first three inspired by Odoo's `sale.order` (`date_order`'s confirmation analogue, `client_order_ref`, `note`); `updatedAt` was simply missing despite every other model having it.

```
enum QuotationStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  UNDER_NEGOTIATION
  CONFIRMED
  REJECTED    // an approver said no — terminal for this row (§1.6)
  WITHDRAWN   // the customer said no — terminal for this row (§1.6)
}

model Quotation {
  id         Int      @id @default(autoincrement())
  customerId Int
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Restrict)
  ownerId    Int      // sales rep
  owner      User     @relation("QuotationOwner", fields: [ownerId], references: [id], onDelete: Restrict)
  status     QuotationStatus @default(DRAFT)

  termsVersion         Int @default(1)
  approvedTermsVersion Int? // null until first approval; valid only while === termsVersion

  customerReference String? // the customer's own PO / reference number
  notes             String? // free-text terms, printed on the quote
  confirmedAt       DateTime? // set once, on the transition into CONFIRMED

  // Which public lead (if any) started this chain — copied forward at
  // creation time to every quotation in the chain (§2.11, §1.6).
  sourceQuoteRequestId Int?
  sourceQuoteRequest   QuoteRequest? @relation(fields: [sourceQuoteRequestId], references: [id], onDelete: SetNull)

  // The REJECTED/WITHDRAWN quotation this one re-quotes, if any (§1.6).
  // @unique makes it a strict chain, not a branching tree.
  previousQuotationId Int?       @unique
  previousQuotation   Quotation? @relation("QuotationSupersession", fields: [previousQuotationId], references: [id], onDelete: SetNull)
  supersededBy        Quotation? @relation("QuotationSupersession")

  lastActivityAt DateTime @default(now()) // curated — bumped only on real activity, drives "stalled" (§2.10)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt        // raw DB bookkeeping, distinct from lastActivityAt above

  lines            QuotationLine[]
  approvalRequests ApprovalRequest[]
  auditLog         AuditLog[]
  // negotiationMessages / fulfillmentSplits / subscriptionSchedules / invoices — later slices, §2.7–2.9

  @@index([customerId])
  @@index([ownerId])
  @@index([status])
  @@index([status, lastActivityAt])
  @@index([sourceQuoteRequestId])
  @@index([confirmedAt])
  @@map("quotations")
}

model QuotationLine {
  id          Int       @id @default(autoincrement())
  quotationId Int
  quotation   Quotation @relation(fields: [quotationId], references: [id], onDelete: Cascade)
  productId   Int
  product     Product   @relation(fields: [productId], references: [id], onDelete: Restrict)
  quantity    Int

  // Snapshotted at add-time, never recomputed live — an already-approved
  // quotation must not silently drift when Admin later changes a price, a
  // DiscountRule, or a GST rate. The audit trail must reflect what was
  // actually approved, at the time it was approved.
  unitPrice       Decimal @db.Decimal(12, 2) // Product.listPrice at add-time
  discountPercent Decimal @default(0) @db.Decimal(5, 2)
  ceilingAtEntry  Decimal @db.Decimal(5, 2) // resolved DiscountRule.maxDiscountPercent at add-time (§2.4)
  taxRateAtEntry  Decimal @db.Decimal(5, 2) // Product.taxRate at add-time — added alongside the other two snapshots

  isRecurring    Boolean         @default(false)
  recurringCycle RecurringCycle?

  @@index([quotationId])
  @@index([productId])
  @@map("quotation_lines")
}
```

### 2.6 Approval

**Built alongside §2.5.** `riskBand`/`RiskBand` from the original draft doesn't exist — §2.4's rework replaced bands with a direct `ApprovalLevel`, which is exactly the `APPROVAL_LEVEL` constant already defined in `discountEvaluation.service.js` (that file's own comment predicted this: *"becomes a stored enum [when] the ApprovalRequest/ApprovalStep chain arrives with the quotation slice"*). `NONE` is not a stored value — a fully compliant quotation auto-confirms with no `ApprovalRequest` row at all (§4).

```
enum ApprovalLevel {
  MANAGER
  MANAGER_FINANCE
}

enum ApprovalRequestStatus {
  PENDING
  APPROVED
  REJECTED
  RETURNED
}

model ApprovalRequest {
  id            Int       @id @default(autoincrement())
  quotationId   Int
  quotation     Quotation @relation(fields: [quotationId], references: [id], onDelete: Cascade)
  termsVersion  Int           // snapshot: which version this request is judging
  approvalLevel ApprovalLevel // from evaluateDiscount()
  status        ApprovalRequestStatus @default(PENDING)
  createdAt     DateTime  @default(now())

  steps ApprovalStep[]

  @@index([quotationId])
  @@index([status])
  @@map("approval_requests")
}

enum ApprovalStepRole {
  SALES_MANAGER
  FINANCE
}

enum ApprovalStepStatus {
  PENDING
  ACTIVE
  APPROVED
  REJECTED
  RETURNED
}

model ApprovalStep {
  id                Int             @id @default(autoincrement())
  approvalRequestId Int
  approvalRequest   ApprovalRequest @relation(fields: [approvalRequestId], references: [id], onDelete: Cascade)
  role              ApprovalStepRole
  sequence          Int // 1 = Sales Manager, 2 = Finance — generated from evaluateDiscount()'s approvalChain
  status            ApprovalStepStatus @default(PENDING)
  actedById         Int?
  actedBy           User?     @relation(fields: [actedById], references: [id], onDelete: SetNull)
  note              String?
  actedAt           DateTime?

  @@unique([approvalRequestId, sequence])
  @@index([role, status])
  @@map("approval_steps")
}
```

FK policy applied throughout §2.5–2.6, decided once and reused everywhere rather than case-by-case: references to master data (`Customer`, `User`, `Product`) are `Restrict` (the app already only soft-deletes these via `isActive` — see `customer.service.js`/`product.service.js` — so the DB now guarantees what the app already does); a detail row's reference to its own aggregate root (`QuotationLine`/`ApprovalRequest`/`AuditLog` → `Quotation`, `ApprovalStep` → `ApprovalRequest`) is `Cascade`; nullable "who acted" references (`ApprovalStep.actedById`, `AuditLog.userId`, `Quotation.sourceQuoteRequestId`/`previousQuotationId`) are `SetNull` — the record itself must outlive the thing it points to.

### 2.7 Negotiation (portal)

*Not yet built.* References `Customer` directly per §2.2 — no `PortalUser` indirection.

```
enum NegotiationMessageType {
  LINE_COMMENT
  COUNTER_DISCOUNT
  DELIVERY_REQUEST
}

enum NegotiationMessageStatus {
  OPEN
  APPLIED    // rep applied it -> mutated the quotation
  DISMISSED
}

model NegotiationMessage {
  id          Int       @id @default(autoincrement())
  quotationId Int
  quotation   Quotation @relation(fields: [quotationId], references: [id])
  customerId  Int
  customer    Customer  @relation(fields: [customerId], references: [id])
  type        NegotiationMessageType
  lineId      Int?      // set for LINE_COMMENT / a line-scoped counter
  proposedDiscountPercent Decimal? @db.Decimal(5, 2)
  body        String?
  status      NegotiationMessageStatus @default(OPEN)
  createdAt   DateTime  @default(now())
}
```

### 2.8 Fulfillment

**`Warehouse`, `Inventory` and `StockMovement` are already built** — real field names below, replacing this doc's original `StockLevel` guess. Two things worth keeping in mind that the real schema does better than the original draft:

- `Warehouse.shippingCostPerShipment` (fixed cost per dispatch) + `priority` (tie-breaker) — cleaner than a vague "shipping cost weight," and directly usable in the split scoring formula in §7.
- `StockMovement` is an append-only ledger of every stock change (`RECEIPT`, `ADJUSTMENT`, `RESERVATION`, `RELEASE`, `SHIPMENT`) — `Inventory` holds the current balance, this explains how it got there. Reuse it for "consolidate remaining backorder" rather than inventing a second trail.

```
model Warehouse {
  id   Int    @id @default(autoincrement())
  code String @unique
  name String
  city String?

  shippingCostPerShipment Decimal @db.Decimal(10, 2) @default(0)
  priority                Int     @default(100) // lower wins on a cost tie

  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  inventory Inventory[]
  movements StockMovement[]

  @@map("warehouses")
}

// available = onHandQty - reservedQty, always derived, never stored (§1.5).
model Inventory {
  id           Int @id @default(autoincrement())
  warehouseId  Int
  productId    Int
  onHandQty    Int @default(0)
  reservedQty  Int @default(0)
  reorderPoint Int @default(0)
  reorderQty   Int @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  warehouse Warehouse @relation(fields: [warehouseId], references: [id])
  product   Product   @relation(fields: [productId], references: [id])

  @@unique([warehouseId, productId])
  @@index([productId])
  @@map("inventory")
}

enum StockMovementType {
  RECEIPT
  ADJUSTMENT
  RESERVATION
  RELEASE
  SHIPMENT
}

model StockMovement {
  id            Int               @id @default(autoincrement())
  warehouseId   Int
  productId     Int
  type          StockMovementType
  onHandDelta   Int @default(0)
  reservedDelta Int @default(0)
  reason        String?
  userId        Int?
  createdAt     DateTime @default(now())

  warehouse Warehouse @relation(fields: [warehouseId], references: [id])

  @@index([warehouseId, productId])
  @@map("stock_movements")
}
```

**Not yet built:**

```
enum FulfillmentLineStatus {
  RESERVED
  BACKORDERED
  SHIPPED
}

model FulfillmentSplit {
  id              Int       @id @default(autoincrement())
  quotationId     Int
  quotation       Quotation @relation(fields: [quotationId], references: [id])
  quotationLineId Int
  warehouseId     Int
  warehouse       Warehouse @relation(fields: [warehouseId], references: [id])
  productId       Int       // denormalized — the Inventory row this reserves against
  quantity        Int
  status          FulfillmentLineStatus @default(RESERVED)
  shippedAt       DateTime?
}
```

### 2.9 Billing

*Not yet built.*

```
enum InvoiceKind {
  ONE_TIME
  RECURRING
}

enum InvoiceStatus {
  UNPAID
  PAID
  OVERDUE
}

model Invoice {
  id          Int       @id @default(autoincrement())
  quotationId Int
  quotation   Quotation @relation(fields: [quotationId], references: [id])
  kind        InvoiceKind
  amount      Decimal   @db.Decimal(12, 2)
  status      InvoiceStatus @default(UNPAID)
  dueDate     DateTime
  paidAt      DateTime?

  // Gate: one-time invoice lines only include quotation lines whose
  // FulfillmentSplit.status = SHIPPED. See DEMO_SCENARIO / mockup Screen 13.
}

model SubscriptionSchedule {
  id              Int       @id @default(autoincrement())
  quotationId     Int
  quotation       Quotation @relation(fields: [quotationId], references: [id])
  quotationLineId Int
  cycle           RecurringCycle
  amount          Decimal   @db.Decimal(12, 2)
  nextBillDate    DateTime
  status          SubscriptionStatus @default(ACTIVE)
}

enum SubscriptionStatus {
  ACTIVE
  PAUSED
  CANCELLED
}

model CreditNote {
  id         Int      @id @default(autoincrement())
  scheduleId Int
  schedule   SubscriptionSchedule @relation(fields: [scheduleId], references: [id])
  amount     Decimal  @db.Decimal(12, 2)
  reason     String
  createdAt  DateTime @default(now())
}
```

### 2.10 Audit & deal health

**Built alongside §2.5–2.6.**

```
model AuditLog {
  id          Int       @id @default(autoincrement())
  quotationId Int
  quotation   Quotation @relation(fields: [quotationId], references: [id], onDelete: Cascade)
  userId      Int?
  user        User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
  action      String    // "APPROVED", "REJECTED", "RETURNED", "WITHDRAWN", "LINE_EDITED", ...
  note        String?
  createdAt   DateTime  @default(now())

  @@index([quotationId, createdAt])
}
```

**Deal Health / anomaly dashboard is a read model, not a stored entity.** `Stalled` = `lastActivityAt` older than a configured threshold on a non-terminal quotation. `Discount Anomaly` = a confirmed line's discount percent significantly above that rep's historical average for the category. Both are computed queries over existing tables — nothing new to keep in sync.

### 2.11 Public quote requests (leads)

**Schema built alongside §2.5** (the `Quotation.sourceQuoteRequestId` link in §1.6/§2.5 needed it to exist). The public API endpoint is still not built — see below. The public site's "Request a Quote" form submits to this, not to `Quotation`. Deliberately a separate, minimal model: the submitter has no account and isn't a `Customer` yet — forcing the form through `Quotation`/`Customer` creation would mean either an unauthenticated write path into real sales data, or inventing a placeholder Customer for every anonymous enquiry. A rep reviews the lead and manually creates a real `Customer` + `Quotation` if it goes anywhere; no automatic conversion logic, nothing to keep in sync.

Updated 2026-09-05: the public Products page now has a "quote cart" (add multiple products, adjust quantity, review on `/cart`) instead of one free-text field only. `message` stays for context, `items` carries the structured picks:

```
enum QuoteRequestStatus {
  NEW
  CONTACTED
  CONVERTED
  DISMISSED
}

model QuoteRequest {
  id          Int      @id @default(autoincrement())
  name        String
  company     String
  email       String
  phone       String?
  message     String?  // now optional — only required client-side when items is empty
  items       Json?    // [{ productName: string, quantity: number }], structured cart picks
  status      QuoteRequestStatus @default(NEW)
  createdAt   DateTime @default(now())

  quotations  Quotation[] // reps' manually-created quotations that trace back to this lead — §1.6, §2.5
}
```

**Why `items: Json?` and not a relational `QuoteRequestLine` table:** nobody queries this beyond a rep reading it by eye (per §5, review is a simple `GET/PATCH` list), and `productName` is a free-text snapshot of the frontend's static catalog, not an FK to a real `Product` — the requester isn't a known customer and the catalog they saw may not even match live `Product` rows yet. A join buys nothing here. If quote-request reporting ever becomes a real feature, this is the field to normalize then, not now.

**API:** `POST /api/public/quote-requests` (no auth — anonymous submission) and `GET/PATCH /api/internal/quote-requests` (staff review — teammate's territory, not built by this session). The public-facing form (this session's scope) calls the `POST` endpoint; until it exists server-side, submission will fail honestly rather than fake a success.

**Backend note (not decided by this session):** the public Products page (client-facing scope) currently renders from a static local catalog (`client/src/data/catalog.js`) with `imageUrl: null` on every item, falling back to a category icon tile. Per-product and per-category image columns are planned on the backend side — once `Product.imageUrl` (and whatever holds category-level images, since `ProductCategory` is currently a plain enum, not a table — see §2.3) exist, swapping the static catalog for a real `GET /api/public/products` fetch is a small, mechanical change on the frontend; the card/cart components already handle both an image and the icon fallback.

---

## 3. The blended discount risk score

The brief (Section 10) devotes a full page to this and gives no formula — it describes *symptoms* a correct formula must reproduce. **Implemented** (`discountEvaluation.service.js`'s `evaluateDiscount({ customerId, lines })`), superseding the `RiskBand`-based design originally sketched here. Same three triggers as originally reverse-engineered from the worked example plus mockup Screen 18 — the routing mechanism underneath changed with §2.4's rework, the logic didn't.

### 3.1 Per-line ceiling

```
rule       = getApplicableDiscountRule(customer.tierId, product.categoryId)  // walks the Category tree, §2.4
lineBreach = line.discountPercent > rule.maxDiscountPercent
```

Any single `lineBreach = true` → `requiredLevel = MANAGER` at minimum, **regardless of order size.** This is the Laptop/Setup-Service example verbatim: a Gold customer, one compliant hardware line, one breaching service line → the whole quote flags. A missing `DiscountRule` anywhere up the category chain is a thrown business error, never a silent allowance — "no rule" must never read as "no limit."

### 3.2 Blended severity (decides Manager-only vs Manager+Finance)

A naive value-weighted average **fails the brief's own example** — a large compliant line dilutes a small breaching one to statistical insignificance. Instead, weight by *overage*, not by line value:

```
excessPercent    = max(0, line.discountPercent - rule.maxDiscountPercent)
weightedOverage  = Σ excessPercent × line.lineTotal     (every line)
blendedSeverity  = weightedOverage / Σ line.lineTotal   (order-wide)

if blendedSeverity > customer.tier.financeEscalationSeverity:
    requiredLevel = MANAGER_FINANCE
```

No `RiskBand`/`LOW·MEDIUM·HIGH` table — the threshold is `CustomerTier.financeEscalationSeverity` (§2.2/§2.4), one seeded number per tier (Bronze 3, Silver 4, Gold 5, Platinum 6 as currently seeded — tune against real demo numbers before presenting, same caveat as the original placeholder thresholds).

### 3.3 Order-level compliant-but-heavy check

Reconciles a genuine tension between the brief's prose and the mockup: even when **every line individually complies**, an order whose overall discount is disproportionate to what the tier intends should not sail through silently.

```
orderDiscountPercent = (1 - netTotal / grossTotal) × 100

if no lineBreach AND orderDiscountPercent > customer.tier.defaultMaxDiscountPercent:
    requiredLevel = max(requiredLevel, MANAGER)   // never escalates to MANAGER_FINANCE on this check alone
```

**This is a deliberate reconciliation, called out explicitly:** the brief's prose says the blended score exists partly to catch "every line technically within limits while still discounting the order more than the company intends" — but mockup Screen 18 lists "within tier/category limit → no approval needed" without qualification. §3.3 is what makes both texts true at once. If asked, this is the answer: *"we read the two together — full compliance still gets a lightweight order-level check, but can only escalate to MANAGER, never MANAGER_FINANCE, since no line is actually broken."*

`evaluateDiscount()` returns `approvalRequired`, `approvalLevel` (`NONE`/`MANAGER`/`MANAGER_FINANCE`), and `approvalChain` (`[]` / `['SALES_MANAGER']` / `['SALES_MANAGER','FINANCE']`) — the quotation-submit flow persists `approvalLevel` onto `ApprovalRequest` (§2.6) only when it isn't `NONE`, and generates `ApprovalStep` rows straight from `approvalChain`.

### 3.4 Margin (separate from risk — do not conflate)

`Product.cost` feeds the live margin indicator (B3), upsell margin delta (B5), and minimum-margin upsell thresholds (A6). It is informational to the rep, not an input to the risk band — the brief never says thin margin alone should trigger approval, only that discount-vs-ceiling does. Keep these two calculations independent in code.

---

## 4. Quotation state machine

```
DRAFT
  --submit for approval--> PENDING_APPROVAL          (evaluateDiscount() §3 returns approvalRequired)
  --submit, fully compliant--> CONFIRMED              ("Auto Approved", mockup Screen 5)

PENDING_APPROVAL
  --all steps approve--> APPROVED
  --any step rejects--> REJECTED                       (terminal for this row — §1.6)
  --any step returns--> DRAFT                          (rep edits and resubmits, SAME row)

APPROVED
  --customer opens portal, still just viewing--> APPROVED   (no transition)
  --customer confirms as-is--> CONFIRMED
  --customer withdraws--> WITHDRAWN                    (terminal for this row — §1.6)
  --customer submits a counter / rep applies a change--> UNDER_NEGOTIATION

UNDER_NEGOTIATION
  --customer withdraws--> WITHDRAWN
  --customer clicks "Confirm Quotation" with current (already-approved) terms--> CONFIRMED
  --rep applies a change that bumps termsVersion--
      --new terms re-evaluated per §3, breach--> PENDING_APPROVAL   (new ApprovalRequest, §1.3)
      --new terms compliant--> CONFIRMED

CONFIRMED
  (terminal for the quotation state machine — fulfillment/billing/subscription
   states progress independently from here, see §2.8–2.9)

REJECTED / WITHDRAWN
  (terminal for THIS ROW, not for the deal — §1.6. A rep opens it and requests
   a new quotation from inside it, creating a new DRAFT with previousQuotationId
   pointing back here. Never triggered by the customer; never gated by anything
   other than the source being REJECTED or WITHDRAWN.)
```

**The DRAFT → CONFIRMED auto-approve edge is what "Auto Approved" on mockup Screen 5 means** — no ApprovalRequest row is ever created for a fully-compliant quotation. Don't model auto-approval as an ApprovalRequest that happens to be instantly approved; it's a distinct path with no approval artifact, which is also why it appears green/terminal immediately in the pipeline view.

**`REJECTED` vs `RETURNED` vs `WITHDRAWN`, precisely, since the names are close:** `RETURNED` is an `ApprovalStepStatus` — an approver sends the quotation back for rework, same row, loops to `DRAFT`. `REJECTED` is a `QuotationStatus` — an approver says a final no, new row required to continue. `WITHDRAWN` is also a `QuotationStatus` — the customer says no instead, same "new row required" consequence as `REJECTED`, different actor.

---

## 5. API surface

`/api/internal/*` = staff (JWT from `authenticateInternal`). `/api/portal/*` = customers, once that auth exists. Grouped by mockup screen, not REST purity.

**Already built:**

```
POST /api/internal/auth/register        { name, email, password, role }
POST /api/internal/auth/login           { email, password }
GET  /api/internal/auth/me

GET/POST/PATCH/DELETE  /api/internal/customers
GET/POST/PATCH/DELETE  /api/internal/products
GET/POST/PATCH/DELETE  /api/internal/warehouses
GET/POST/PATCH         /api/internal/inventory
```

**Not yet built:**

```
GET    /api/internal/quotations                    ?status=&customerId=&ownerId=  [BUILT]
POST   /api/internal/quotations                     { customerId, lines }  OR  { sourceQuotationId, lines? }
                                                     [BUILT] — the second form is "Create New Quotation" from
                                                     inside an existing quotation's screen (§1.6): customerId
                                                     is inherited, not supplied; lines omitted copies the
                                                     source's; only a REJECTED/WITHDRAWN source is accepted,
                                                     and a source that already has a child is rejected (409)
GET    /api/internal/quotations/:id                 [BUILT]
PATCH  /api/internal/quotations/:id/lines           [BUILT] (add/edit/remove — only while DRAFT or
                                                     UNDER_NEGOTIATION; bumps termsVersion; if UNDER_NEGOTIATION,
                                                     immediately re-evaluates and re-routes per §3/§4)
POST   /api/internal/quotations/:id/submit          [BUILT] (DRAFT -> PENDING_APPROVAL | CONFIRMED)
POST   /api/internal/quotations/:id/confirm         [BUILT, not in original sketch] { note? } — records a
                                                     customer's acceptance; internal-triggered until the portal
                                                     exists (§1.6), same service call the portal will use later
POST   /api/internal/quotations/:id/withdraw        [BUILT, not in original sketch] { note? } — records a
                                                     customer's decline, same internal-triggered reasoning
GET    /api/internal/product-recommendations/suggest        ?productIds=1,2,3  [BUILT] — margin included
GET    /api/public/product-recommendations/suggest           ?productIds=1,2,3  [BUILT] — no auth, margin stripped
GET/POST/PATCH/DELETE  /api/internal/product-recommendations  [BUILT] — catalog config; write is ADMIN-only,
                                                     read is open to all staff (a rep needs it live while
                                                     building a quotation, same reasoning as discount policy)

GET    /api/internal/approvals                      ?status=  [BUILT] (scoped to the caller's own role's
                                                     ACTIVE steps — Manager and Finance each see only their own
                                                     turn; Admin sees everything)
GET    /api/internal/approvals/:id                  [BUILT]
POST   /api/internal/approvals/:id/steps/:stepId/act   { action: APPROVE|REJECT|RETURN, note }  [BUILT] — note
                                                     is required for REJECT/RETURN, optional for APPROVE; only
                                                     the currently-ACTIVE step accepts an action, and only from
                                                     the matching role (or ADMIN)

GET    /api/internal/quotations/:id/fulfillment-suggestion   (computed, not stored)
POST   /api/internal/quotations/:id/fulfillment     { splits: [...] }   (accept suggested or manual override)

GET    /api/internal/quotations/:id/subscriptions
POST   /api/internal/subscriptions/:id/modify | /cancel

GET    /api/internal/invoices                       ?status=
POST   /api/internal/invoices/:id/payments

GET    /api/internal/deal-health                    (stalled / anomaly / slippage — computed, §2.10)
GET    /api/internal/reports                        ?period=&repId=&status=&category=

GET/POST/PATCH  /api/internal/discount-tiers | /api/internal/approval-rules | /api/internal/company

POST   /api/portal/auth/login                       { email, password }  (Customer, §2.2 — no PortalUser)
GET    /api/portal/quotations/:id                   (Customer-scoped; internal fields stripped — see §6)
POST   /api/portal/quotations/:id/messages           (NegotiationMessage — proposal only, §1.4)
POST   /api/portal/quotations/:id/confirm

GET    /api/portal/catalog                          (product/service list for the logged-in customer — see §8)
```

---

## 6. Role → access matrix

Enforced **server-side** (middleware, not hidden nav) — this is what makes the portal a "real, separate, restricted view" rather than a relabelled internal screen, per brief §7.

| | Sales Rep | Sales Manager | Finance | Admin | Portal User |
|---|---|---|---|---|---|
| Create/edit own quotations | ✅ | ✅ | — | — | — |
| View all quotations | — | ✅ | ✅ (billing-relevant) | ✅ | — |
| Act on Manager approval step | — | ✅ | — | ✅ | — |
| Act on Finance approval step | — | — | ✅ | ✅ | — |
| Configure tiers/ceilings/routing | — | — | — | ✅ | — |
| Manage products/warehouses/plans | — | — | — | ✅ | — |
| Record payments / credit notes | — | — | ✅ | ✅ | — |
| View Deal Health dashboard | — | ✅ | ✅ | ✅ | — |
| View own quotation | — | — | — | — | ✅ (own Customer only) |
| Comment / counter-discount | — | — | — | — | ✅ |
| See margin, cost, internal risk band, approval-stage detail | — | — | — | — | ❌ **never** |

The last row is the one to enforce carefully: it's a serialization concern (a shared `Quotation` fetch must return a stripped DTO to the portal route), not just a UI hiding concern.

---

## 6a. Reconciliation with the implemented backend (2026-09-05)

This file and the backend were written independently and diverged repeatedly. Resolved as: **keep what's built and tested, adopt what's new.** Recorded here per ground rule 15 so neither side re-decides these differently later. This table itself went stale once already (it didn't mention the §2.2–2.4 tier/category/discount-rule rework below until this pass caught it) — a reminder that this section needs re-checking against `schema.prisma`, not just trusted, whenever a design conversation is about to build on top of it.

| Point | This file said | Backend actually does | Kept |
|---|---|---|---|
| Primary keys | `String @default(cuid())` | `Int @default(autoincrement())` | **Int.** Deliberate, made directly with the product owner: readable in Postman/Studio during a live demo, and IDs are never portal-facing (see §1.2 note below). |
| Auth routes | `/auth/login`, `/portal/auth/login` | `/api/internal/auth/*`, `/api/portal/*` (portal not yet built) | **`/api/internal/*` / `/api/portal/*`.** Same internal/portal boundary this file requires (§6) — different spelling, not a different design. Enforced by JWT audience, not just the path (a portal token fails signature verification on an internal route, not just a route check). |
| Product category | `HARDWARE / SERVICE / SUBSCRIPTION` as one enum | First cut: `HARDWARE / SOFTWARE / SERVICE` enum + `isSubscribable`. **Second cut (`0e38df4`/`ee39862`): a real `Category` tree** (§2.3), plus a separate `ProductType` enum (`GOODS`/`SERVICE`/`COMBO`) for stocking behavior. | **The tree.** An admin manages categories the same way they manage products; a flat enum can't express "Hardware / Computers" governed by a rule written at "Hardware." |
| Discount ceilings | Two ceiling tables, `min()`'d (`TierDiscountCeiling` × `CategoryDiscountCeiling`) | **`DiscountRule`** — one direct `(tier, category)` lookup, resolved by walking up the category tree (§2.4) | **`DiscountRule`.** One number per real pair beats `min()`-ing two independently-configured numbers, and resolution-by-tree-walk falls out naturally once category is a tree anyway. |
| Approval routing | `RiskBand` (LOW/MEDIUM/HIGH) + `ApprovalRoutingRule` config table | **`ApprovalLevel`** (`MANAGER`/`MANAGER_FINANCE`), computed directly in `evaluateDiscount()` against `CustomerTier.financeEscalationSeverity` (§2.4, §3.2) | **`ApprovalLevel`.** No band abstraction in between the score and the routing decision — one less config table, same three triggers from §3 preserved. |
| Customer tier | `enum CustomerTier { BRONZE, SILVER, GOLD }`, assigned | **`CustomerTier` table + a scoring engine** (`tierScoring.service.js`, `TierScoringConfig`) — tier is *calculated* from purchase value, order count, recency, relationship length, not assigned (§2.2). Adds a `PLATINUM` tier beyond the brief's three. | **The scoring engine.** Not asked for by the brief, but already built, tested, and not in conflict with anything this file requires — the discount/approval logic only ever reads `tierId`/`financeEscalationSeverity`/`defaultMaxDiscountPercent`, indifferent to how the tier was arrived at. |
| Warehouse cost | `shippingCostWeight` (a multiplier) | `shippingCostPerShipment` (₹ per dispatch) + `priority` (tie-break) | **The backend's version.** An absolute cost lets the split score an allocation as `shipments × cost`, so two shipments from a cheap depot can legitimately beat one from an expensive one — the actual point of weighting shipments rather than just counting them. |

**Adopted from this file, unchanged, for everything built from here on:** the `Company` singleton (not yet built), the `Customer` / no-`PortalUser` split, `termsVersion` / `approvedTermsVersion` approval-versioning (§1.2), one `ApprovalRequest` per round with its own `ApprovalStep` chain (§1.3), negotiation as propose-then-apply (§1.4, not yet built), and the three-trigger blended risk logic (§3, now implemented against `DiscountRule`/`ApprovalLevel` instead of the originally-sketched tables). Nothing built so far conflicts with any of these — Quotation/QuotationLine/ApprovalRequest/ApprovalStep/AuditLog/QuoteRequest (§2.5–2.6, §2.10–2.11, built 2026-09-05) are additive to this schema, not competing with it.

`Role` already matched exactly (`ADMIN`, `SALES_REP`, `SALES_MANAGER`, `FINANCE`) — no change needed there.

**Seed-data / demo-narrative note, not yet reconciled:** `server/prisma/seed.js` currently seeds a generic placeholder business (Acme Corp / Beta Industries, a "ProBook 14-inch Laptop" catalog, 4 tiers including `PLATINUM`) built while the discount engine was developed in isolation — not the Netrix Systems / ZKTeco catalog `DEMO_SCENARIO.md` describes (3 tiers, no Platinum). Flagging rather than fixing here — reconciling the seed data to the demo narrative is a separate task from the schema work in this pass, but it needs doing before the demo is rehearsed against real seeded numbers (§3.2's thresholds especially).

---

## 7. Open items

Tracked here so they don't get silently decided twice by two different sessions.

- [x] ~~Portal auth mechanism~~ — **resolved by the built schema**: `Customer.passwordHash`, email + password, no magic link, no separate `PortalUser`. See §2.2.
- [x] ~~Discount governance schema~~ — **built, differently than originally sketched**: `CustomerTier`/`DiscountRule`/`ApprovalLevel` replace `RiskBand`/`ApprovalRoutingRule`/the two ceiling tables. See §2.4, §3, §6a.
- [x] ~~Quotation/Approval core schema~~ — **built** (`quotation_lifecycle_core` migration, 2026-09-05). See §2.5–2.6, §2.10.
- [x] ~~Quotation/approval workflow service layer~~ — **built and end-to-end tested** 2026-09-05: `modules/quotations/` (create incl. requote, list, get, edit lines, submit, confirm, withdraw) and `modules/approvals/` (list my queue, act on step). Verified against live seed data: compliant auto-confirm, a breach routing to `MANAGER_FINANCE`, role-gated step actions, manager-approve → finance-active handoff, finance-reject → `Quotation.REJECTED`, a full `previousQuotationId` requote chain, and both requote guardrails (no double child, no requoting a live quotation). `Quotation.termsVersion`/`AuditLog` confirmed populating correctly throughout.
- [ ] Portal auth + customer-triggered `/confirm`/`/withdraw`/negotiation — the internal `/confirm` and `/withdraw` endpoints exist now as a stand-in (a rep records what the customer decided), same service functions a real portal will call later.
- [ ] 4 test quotations (ids 1–4, customer "Beta Industries") exist in the shared dev DB from this verification pass — harmless, but flagging since it's shared with your teammate. Ask if you want them cleared before further testing.
- [ ] `CustomerTier.financeEscalationSeverity` thresholds (currently 3/4/5/6 for Bronze/Silver/Gold/Platinum, §3.2) — seeded placeholders, tune once demo seed data is loaded and the demo quote's numbers can be checked by hand.
- [ ] **Seed data does not match `DEMO_SCENARIO.md`** — see §6a's seed-data note. Needs reconciling (Netrix/ZKTeco catalog, 3 tiers not 4) before rehearsing the demo.
- [ ] Feed `Quotation` confirmation into `Customer.totalPurchaseValue`/`completedOrders`/`lastOrderAt` (§2.2) so tier scores become real once orders exist, instead of only reflecting seeded values.
- [ ] Warehouse split algorithm exact greedy rule — real fields now exist to build it against: `Warehouse.shippingCostPerShipment` + `priority` (§2.8). Largest-coverage-first, remainder to backorder, tie-break on priority.
- [ ] Proration formula for mid-cycle subscription quantity changes.
- [ ] Should "Create New Quotation" (§1.6) be blocked while a source is still live (DRAFT/PENDING_APPROVAL/APPROVED/UNDER_NEGOTIATION), or is that already impossible by construction since only REJECTED/WITHDRAWN sources are eligible? Leaning "already impossible, no extra check needed" — confirm when the submit/requote service is written.

## 8. Pending requirement — customer product/service catalog

Requested by the user 2026-09-05, explicitly queued for **after** auth + the negotiation/portal slice — not being built yet, tracked here so it isn't lost.

*"As a customer I would like to have a product and service list as well."*

Not explicit in the original brief — the brief's portal (B8) is scoped to viewing/negotiating one's own live quotation, not browsing the full catalog. Two candidate surfaces, not yet decided:

- **A public "Solutions" page on Netrix's own site (`/`)** — marketing content, no auth needed, natural home for "what we sell" in general.
- **An authenticated view inside the customer portal** — "browse what Netrix offers" as a portal feature, separate from "view my current quotation."

Likely both matter, but which one is default/primary is worth a real answer before building, since it changes whether this is public-site work or `/api/portal/catalog` work (added as a placeholder in §5 above). Revisit when this slice starts.

---

*Last updated against: `server/prisma/schema.prisma` as of migration `20260905151646_quotation_lifecycle_core` (auth + customers/products/warehouses/inventory + tier-scoring/category/discount-rule engine + quotation/approval/audit/quote-request core all built), DEMO_SCENARIO.md (Netrix Systems / ZKTeco catalog — not yet reflected in seed data, §6a/§7), DESIGN_SYSTEM.md (light + violet). If you change the demo business or a routing rule, update this file in the same commit.*
