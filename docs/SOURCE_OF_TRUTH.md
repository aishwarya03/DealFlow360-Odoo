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

```
enum CustomerTier {
  BRONZE
  SILVER
  GOLD
}

// Authenticates against /api/portal/* only, never internal routes (once that
// auth endpoint exists — see §7). passwordHash is nullable: a Customer exists
// as a sales entity the moment a rep creates it, long before it's given
// portal access.
model Customer {
  id           Int          @id @default(autoincrement())
  name         String
  email        String       @unique
  passwordHash String?
  tier         CustomerTier @default(BRONZE)
  contactName  String?
  phone        String?
  isActive     Boolean      @default(true)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  quotations          Quotation[]
  negotiationMessages NegotiationMessage[]

  @@map("customers")
}
```

### 2.3 Catalog

**Already built, and better than the original draft.** That draft made `SUBSCRIPTION` a third product category — meaning a recurring product would need its own discount ceiling, and the brief's worked example only defines Hardware and Service ceilings. The real schema keeps category as *what the product is* (the ceiling lookup) and treats recurring billing as an orthogonal axis: `isSubscribable` here, the actual cycle chosen **per `QuotationLine`**, not fixed on the product — the same product could conceivably be sold one-time to one customer and on a plan to another. Adopted; `DEMO_SCENARIO.md`'s catalog table is updated to match (category = Hardware/Software/Service; "Subscription" items are Software or Service with `isSubscribable = true`).

```
enum ProductCategory {
  HARDWARE
  SOFTWARE
  SERVICE
}

model Product {
  id             Int             @id @default(autoincrement())
  sku            String          @unique
  name           String
  description    String?
  category       ProductCategory
  unit           String          @default("unit")
  isSubscribable Boolean         @default(false)
  listPrice      Decimal         @db.Decimal(12, 2)
  costPrice      Decimal         @db.Decimal(12, 2) // margin — see §3.4
  taxRate        Decimal         @db.Decimal(5, 2)  @default(0)
  isActive       Boolean         @default(true)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  inventory        Inventory[]
  discountCeilings CategoryDiscountCeiling[]
  quotationLines   QuotationLine[]
  upsellFrom       UpsellRule[] @relation("UpsellSource")
  upsellTo         UpsellRule[] @relation("UpsellTarget")

  @@index([category])
  @@map("products")
}

// Not on Product — chosen per QuotationLine (see §2.5), since recurring vs
// one-time is a per-sale decision, not a catalog-fixed one.
enum RecurringCycle {
  MONTHLY
  QUARTERLY
  YEARLY
}

/* Not yet built. A2/A6: pairing-based upsell, seeded from co-purchase + promotion flags. */
model UpsellRule {
  id               Int     @id @default(autoincrement())
  sourceProductId  Int
  targetProductId  Int
  source Product @relation("UpsellSource", fields: [sourceProductId], references: [id])
  target Product @relation("UpsellTarget", fields: [targetProductId], references: [id])
  promoted         Boolean @default(false)
  minMarginPercent Decimal @default(0)
}
```

### 2.4 Discount governance (A3 / Section 10)

*Not yet built — next slice after auth/customers/products/warehouses.*

```
model TierDiscountCeiling {
  id          Int          @id @default(autoincrement())
  tier        CustomerTier @unique
  maxDiscount Decimal      @db.Decimal(5, 2) // percent
}

model CategoryDiscountCeiling {
  id          Int             @id @default(autoincrement())
  category    ProductCategory @unique
  maxDiscount Decimal         @db.Decimal(5, 2)
}

/* Which band needs which chain. Seeded, editable by Admin (Screen 18). */
model ApprovalRoutingRule {
  id              Int      @id @default(autoincrement())
  riskBand        RiskBand @unique
  requiresManager Boolean  @default(false)
  requiresFinance Boolean  @default(false)
}

enum RiskBand {
  LOW
  MEDIUM
  HIGH
}
```

See §3 for how the band is computed — it is **derived at evaluation time**, not stored as a standalone editable number; only the ceilings and routing thresholds are configuration.

### 2.5 The quotation

*Not yet built — this is the next real slice of work.*

```
enum QuotationStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  UNDER_NEGOTIATION
  CONFIRMED
  REJECTED
}

model Quotation {
  id          Int             @id @default(autoincrement())
  code        String          @unique // "Q-1042"
  customerId  Int
  customer    Customer        @relation(fields: [customerId], references: [id])
  ownerId     Int             // sales rep
  owner       User            @relation("QuotationOwner", fields: [ownerId], references: [id])
  status      QuotationStatus @default(DRAFT)

  termsVersion         Int @default(1)
  approvedTermsVersion Int? // null until first approval

  lastActivityAt DateTime @default(now()) // drives "stalled" on the Deal Health dashboard
  createdAt      DateTime @default(now())

  lines                 QuotationLine[]
  approvalRequests      ApprovalRequest[]
  negotiationMessages   NegotiationMessage[]
  fulfillmentSplits     FulfillmentSplit[]
  subscriptionSchedules SubscriptionSchedule[]
  invoices              Invoice[]
  auditLog              AuditLog[]

  @@map("quotations")
}

model QuotationLine {
  id              Int       @id @default(autoincrement())
  quotationId     Int
  quotation       Quotation @relation(fields: [quotationId], references: [id])
  productId       Int
  product         Product   @relation(fields: [productId], references: [id])
  quantity        Int
  unitPrice       Decimal   @db.Decimal(12, 2) // snapshot of Product.listPrice at add-time
  discountPercent Decimal   @default(0) @db.Decimal(5, 2)

  // Denormalized at write-time so history survives a later ceiling change.
  ceilingAtEntry  Decimal   @db.Decimal(5, 2)

  // Per-line billing mode — see §2.3: Product.isSubscribable gates whether
  // this is allowed, the actual choice is made here, per sale.
  isRecurring    Boolean         @default(false)
  recurringCycle RecurringCycle?

  @@map("quotation_lines")
}
```

**Why snapshot `unitPrice` and `ceilingAtEntry` onto the line** rather than always reading live from `Product`/ceiling config: if Admin changes a discount ceiling next week, an already-approved quotation from today must not silently become "over limit" retroactively. The audit trail has to reflect what was actually approved, at the time it was approved.

### 2.6 Approval

*Not yet built.*

```
enum ApprovalRequestStatus {
  PENDING
  APPROVED
  REJECTED
  RETURNED
}

model ApprovalRequest {
  id           Int       @id @default(autoincrement())
  quotationId  Int
  quotation    Quotation @relation(fields: [quotationId], references: [id])
  termsVersion Int       // snapshot: which version this request is judging
  riskBand     RiskBand
  status       ApprovalRequestStatus @default(PENDING)
  createdAt    DateTime  @default(now())

  steps ApprovalStep[]
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
  id                Int      @id @default(autoincrement())
  approvalRequestId Int
  approvalRequest   ApprovalRequest @relation(fields: [approvalRequestId], references: [id])
  role              ApprovalStepRole
  sequence          Int      // 1 = Sales Manager, 2 = Finance
  status            ApprovalStepStatus @default(PENDING)
  actedById         Int?
  actedBy           User?    @relation(fields: [actedById], references: [id])
  note              String?
  actedAt           DateTime?
}
```

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

*Not yet built.*

```
model AuditLog {
  id          Int       @id @default(autoincrement())
  quotationId Int
  quotation   Quotation @relation(fields: [quotationId], references: [id])
  userId      Int?
  user        User?     @relation(fields: [userId], references: [id])
  action      String    // "APPROVED", "REJECTED", "RETURNED", "LINE_EDITED", "COUNTER_APPLIED", ...
  note        String?
  createdAt   DateTime  @default(now())
}
```

**Deal Health / anomaly dashboard is a read model, not a stored entity.** `Stalled` = `lastActivityAt` older than a configured threshold on a non-terminal quotation. `Discount Anomaly` = a confirmed line's discount percent significantly above that rep's historical average for the category. Both are computed queries over existing tables — nothing new to keep in sync.

### 2.11 Public quote requests (leads)

*Not yet built.* Added 2026-09-05 — the public site's "Request a Quote" form submits to this, not to `Quotation`. Deliberately a separate, minimal model: the submitter has no account and isn't a `Customer` yet — forcing the form through `Quotation`/`Customer` creation would mean either an unauthenticated write path into real sales data, or inventing a placeholder Customer for every anonymous enquiry. A rep reviews the lead and manually creates a real `Customer` + `Quotation` if it goes anywhere; no automatic conversion logic, nothing to keep in sync.

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
}
```

**Why `items: Json?` and not a relational `QuoteRequestLine` table:** nobody queries this beyond a rep reading it by eye (per §5, review is a simple `GET/PATCH` list), and `productName` is a free-text snapshot of the frontend's static catalog, not an FK to a real `Product` — the requester isn't a known customer and the catalog they saw may not even match live `Product` rows yet. A join buys nothing here. If quote-request reporting ever becomes a real feature, this is the field to normalize then, not now.

**API:** `POST /api/public/quote-requests` (no auth — anonymous submission) and `GET/PATCH /api/internal/quote-requests` (staff review — teammate's territory, not built by this session). The public-facing form (this session's scope) calls the `POST` endpoint; until it exists server-side, submission will fail honestly rather than fake a success.

**Backend note (not decided by this session):** the public Products page (client-facing scope) currently renders from a static local catalog (`client/src/data/catalog.js`) with `imageUrl: null` on every item, falling back to a category icon tile. Per-product and per-category image columns are planned on the backend side — once `Product.imageUrl` (and whatever holds category-level images, since `ProductCategory` is currently a plain enum, not a table — see §2.3) exist, swapping the static catalog for a real `GET /api/public/products` fetch is a small, mechanical change on the frontend; the card/cart components already handle both an image and the icon fallback.

---

## 3. The blended discount risk score

The brief (Section 10) devotes a full page to this and gives no formula — it describes *symptoms* a correct formula must reproduce. Reverse-engineered from the worked example plus mockup Screen 18, the model has **three independent triggers**, not one number:

### 3.1 Per-line ceiling

```
lineCeiling = min(tier.maxDiscount, category.maxDiscount)
lineBreach  = line.discountPercent > lineCeiling
```

Any single `lineBreach = true` → the quotation requires at least Sales Manager approval, **regardless of order size.** This is the Laptop/Setup-Service example verbatim: a Gold customer, one compliant hardware line, one breaching service line → the whole quote flags.

### 3.2 Blended severity (decides Manager-only vs Manager→Finance)

A naive value-weighted average **fails the brief's own example** — a large compliant line dilutes a small breaching one to statistical insignificance. Instead, weight by *overage*, not by line value:

```
totalOverage = Σ max(0, line.discountPercent - line.lineCeiling) × line.lineTotal
              for every line

blendedSeverity = totalOverage / Σ line.lineTotal   (order-wide)
```

Band thresholds (seeded, Admin-editable — placeholder values, tune against real seed data before demo):

| blendedSeverity | Band |
|---|---|
| 0 | LOW |
| 0 < x ≤ 5 | MEDIUM |
| x > 5 | HIGH |

### 3.3 Order-level compliant-but-heavy check

Reconciles a genuine tension between the brief's prose and the mockup (see below): even when **every line individually complies**, an order whose overall discount is disproportionate to what the tier intends should not sail through silently.

```
orderDiscountPercent = 1 - (Σ line.unitPrice × line.qty × (1 - line.discountPercent))
                              / Σ line.unitPrice × line.qty

if no lineBreach AND orderDiscountPercent > tier.maxDiscount:
    band = max(band, MEDIUM)   // never silently escalates past MEDIUM on this check alone
```

**This is a deliberate reconciliation, called out explicitly:** the brief's prose says the blended score exists partly to catch "every line technically within limits while still discounting the order more than the company intends" — but mockup Screen 18 lists "within tier/category limit → no approval needed" without qualification. §3.3 is what makes both texts true at once. If asked, this is the answer: *"we read the two together — full compliance still gets a lightweight order-level check, but can only escalate to MEDIUM, never HIGH, since no line is actually broken."*

### 3.4 Margin (separate from risk — do not conflate)

`Product.cost` feeds the live margin indicator (B3), upsell margin delta (B5), and minimum-margin upsell thresholds (A6). It is informational to the rep, not an input to the risk band — the brief never says thin margin alone should trigger approval, only that discount-vs-ceiling does. Keep these two calculations independent in code.

---

## 4. Quotation state machine

```
DRAFT
  --submit for approval--> PENDING_APPROVAL          (if any trigger in §3 fires)
  --submit, fully compliant--> CONFIRMED              ("Auto Approved", mockup Screen 5)

PENDING_APPROVAL
  --all steps approve--> APPROVED
  --any step rejects--> REJECTED
  --any step returns--> DRAFT                          (rep edits and resubmits)

APPROVED
  --customer opens portal, still just viewing--> APPROVED   (no transition)
  --customer submits a counter / rep applies a change--> UNDER_NEGOTIATION

UNDER_NEGOTIATION
  --rep applies a change that bumps termsVersion--
      --new terms re-evaluated per §3, breach--> PENDING_APPROVAL   (new ApprovalRequest, §1.3)
      --new terms compliant--> CONFIRMED
  --customer clicks "Confirm Quotation" with current (already-approved) terms--> CONFIRMED

CONFIRMED
  (terminal for the quotation state machine — fulfillment/billing/subscription
   states progress independently from here, see §2.8–2.9)
```

**The DRAFT → CONFIRMED auto-approve edge is what "Auto Approved" on mockup Screen 5 means** — no ApprovalRequest row is ever created for a fully-compliant quotation. Don't model auto-approval as an ApprovalRequest that happens to be instantly approved; it's a distinct path with no approval artifact, which is also why it appears green/terminal immediately in the pipeline view.

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
GET    /api/internal/quotations                    ?status=&repId=&customerId=
POST   /api/internal/quotations
GET    /api/internal/quotations/:id
PATCH  /api/internal/quotations/:id/lines           (add/edit/remove — bumps termsVersion, re-evaluates §3)
POST   /api/internal/quotations/:id/submit          (DRAFT -> PENDING_APPROVAL | CONFIRMED)
GET    /api/internal/quotations/:id/upsell-suggestions

GET    /api/internal/approvals                      ?status=pending
GET    /api/internal/approvals/:approvalRequestId
POST   /api/internal/approvals/:approvalRequestId/steps/:stepId/act   { action: APPROVE|REJECT|RETURN, note }

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

## 7. Open items

Tracked here so they don't get silently decided twice by two different sessions.

- [x] ~~Portal auth mechanism~~ — **resolved by the built schema**: `Customer.passwordHash`, email + password, no magic link, no separate `PortalUser`. See §2.2.
- [ ] Exact `blendedSeverity` thresholds (§3.2) — placeholders, tune once seed data (DEMO_SCENARIO.md) is loaded and the demo quote's numbers can be checked by hand.
- [ ] Warehouse split algorithm exact greedy rule — real fields now exist to build it against: `Warehouse.shippingCostPerShipment` + `priority` (§2.8). Largest-coverage-first, remainder to backorder, tie-break on priority.
- [ ] Proration formula for mid-cycle subscription quantity changes.

## 8. Pending requirement — customer product/service catalog

Requested by the user 2026-09-05, explicitly queued for **after** auth + the negotiation/portal slice — not being built yet, tracked here so it isn't lost.

*"As a customer I would like to have a product and service list as well."*

Not explicit in the original brief — the brief's portal (B8) is scoped to viewing/negotiating one's own live quotation, not browsing the full catalog. Two candidate surfaces, not yet decided:

- **A public "Solutions" page on Netrix's own site (`/`)** — marketing content, no auth needed, natural home for "what we sell" in general.
- **An authenticated view inside the customer portal** — "browse what Netrix offers" as a portal feature, separate from "view my current quotation."

Likely both matter, but which one is default/primary is worth a real answer before building, since it changes whether this is public-site work or `/api/portal/catalog` work (added as a placeholder in §5 above). Revisit when this slice starts.

---

*Last updated against: server/prisma/schema.prisma as of commit `d994df8` (auth + customers/products/warehouses/inventory built), DEMO_SCENARIO.md (Netrix Systems / ZKTeco catalog), DESIGN_SYSTEM.md (light + violet). If you change the demo business or a routing rule, update this file in the same commit.*
