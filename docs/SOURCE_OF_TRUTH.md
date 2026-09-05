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

```
enum Role {
  ADMIN
  SALES_MANAGER
  FINANCE
  SALES_REP
  // Portal users are NOT this enum — see Customer/PortalUser below.
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  role         Role
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())

  quotationsOwned   Quotation[]        @relation("QuotationOwner")
  approvalStepsDone ApprovalStep[]
  auditEntries      AuditLog[]
}

/* Singleton. Admin edits the one row; the portal brands from it.
 * No tenantId anywhere else in the schema — see DEMO_SCENARIO.md "Single company, deliberately". */
model Company {
  id        String  @id @default("singleton")
  name      String  @default("Netrix Systems Pvt Ltd")
  gstin     String?
  address   String?
  logoUrl   String?
  accentHex String  @default("#7C3AED")
}
```

### 2.2 Customers & portal access

```
enum CustomerTier {
  BRONZE
  SILVER
  GOLD
}

model Customer {
  id      String       @id @default(cuid())
  name    String
  tier    CustomerTier
  gstin   String?
  billingAddress String?

  portalUsers  PortalUser[]
  quotations   Quotation[]
}

/* Deliberately separate from User: different auth surface (magic link /
 * email+password per the brief), no internal role, scoped to exactly one Customer. */
model PortalUser {
  id         String   @id @default(cuid())
  email      String   @unique
  name       String
  customerId String
  customer   Customer @relation(fields: [customerId], references: [id])

  messages NegotiationMessage[]
}
```

### 2.3 Catalog

```
enum ProductCategory {
  HARDWARE
  SERVICE
  SUBSCRIPTION
}

enum RecurringCycle {
  MONTHLY
  QUARTERLY
  YEARLY
}

model Product {
  id          String          @id @default(cuid())
  name        String
  category    ProductCategory
  price       Decimal
  cost        Decimal          // required for margin — see 3.4. Not in the brief's mockup form; add it anyway.
  gstPercent  Decimal          @default(18)
  unit        String           @default("unit")
  description String?
  active      Boolean          @default(true)

  // Only meaningful when category = SUBSCRIPTION.
  isRecurring     Boolean         @default(false)
  recurringCycle  RecurringCycle?

  discountCeilings CategoryDiscountCeiling[]
  quotationLines   QuotationLine[]
  stockLevels      StockLevel[]
  upsellFrom       UpsellRule[] @relation("UpsellSource")
  upsellTo         UpsellRule[] @relation("UpsellTarget")
}

/* A2/A6: pairing-based upsell, seeded from historical co-purchase + promotion flags. */
model UpsellRule {
  id              String  @id @default(cuid())
  sourceProductId String
  targetProductId String
  source Product @relation("UpsellSource", fields: [sourceProductId], references: [id])
  target Product @relation("UpsellTarget", fields: [targetProductId], references: [id])
  promoted        Boolean @default(false)
  minMarginPercent Decimal @default(0)
}
```

### 2.4 Discount governance (A3 / Section 10)

```
model TierDiscountCeiling {
  id           String       @id @default(cuid())
  tier         CustomerTier @unique
  maxDiscount  Decimal      // percent
}

model CategoryDiscountCeiling {
  id          String          @id @default(cuid())
  category    ProductCategory @unique
  maxDiscount Decimal
}

/* Which band needs which chain. Seeded, editable by Admin (Screen 18). */
model ApprovalRoutingRule {
  id        String @id @default(cuid())
  riskBand  RiskBand @unique
  requiresManager Boolean @default(false)
  requiresFinance Boolean @default(false)
}

enum RiskBand {
  LOW
  MEDIUM
  HIGH
}
```

See §3 for how the band is computed — it is **derived at evaluation time**, not stored as a standalone editable number; only the ceilings and routing thresholds are configuration.

### 2.5 The quotation

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
  id          String          @id @default(cuid())
  code        String          @unique // "Q-1042"
  customerId  String
  customer    Customer        @relation(fields: [customerId], references: [id])
  ownerId     String          // sales rep
  owner       User            @relation("QuotationOwner", fields: [ownerId], references: [id])
  status      QuotationStatus @default(DRAFT)

  termsVersion         Int @default(1)
  approvedTermsVersion Int? // null until first approval

  lastActivityAt DateTime @default(now()) // drives "stalled" on the Deal Health dashboard
  createdAt      DateTime @default(now())

  lines             QuotationLine[]
  approvalRequests  ApprovalRequest[]
  negotiationMessages NegotiationMessage[]
  fulfillmentSplits FulfillmentSplit[]
  subscriptionSchedules SubscriptionSchedule[]
  invoices          Invoice[]
  auditLog          AuditLog[]
}

model QuotationLine {
  id           String    @id @default(cuid())
  quotationId  String
  quotation    Quotation @relation(fields: [quotationId], references: [id])
  productId    String
  product      Product   @relation(fields: [productId], references: [id])
  quantity     Int
  unitPrice    Decimal   // snapshot of Product.price at add-time; price list can move independently
  discountPercent Decimal @default(0)

  // Denormalized at write-time so history survives a later ceiling change:
  ceilingAtEntry Decimal
}
```

**Why snapshot `unitPrice` and `ceilingAtEntry` onto the line** rather than always reading live from `Product`/ceiling config: if Admin changes a discount ceiling next week, an already-approved quotation from today must not silently become "over limit" retroactively. The audit trail has to reflect what was actually approved, at the time it was approved.

### 2.6 Approval

```
enum ApprovalRequestStatus {
  PENDING
  APPROVED
  REJECTED
  RETURNED
}

model ApprovalRequest {
  id           String    @id @default(cuid())
  quotationId  String
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
  id                String   @id @default(cuid())
  approvalRequestId String
  approvalRequest   ApprovalRequest @relation(fields: [approvalRequestId], references: [id])
  role              ApprovalStepRole
  sequence          Int      // 1 = Sales Manager, 2 = Finance
  status            ApprovalStepStatus @default(PENDING)
  actedById         String?
  actedBy           User?    @relation(fields: [actedById], references: [id])
  note              String?
  actedAt           DateTime?
}
```

### 2.7 Negotiation (portal)

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
  id            String   @id @default(cuid())
  quotationId   String
  quotation     Quotation @relation(fields: [quotationId], references: [id])
  portalUserId  String
  portalUser    PortalUser @relation(fields: [portalUserId], references: [id])
  type          NegotiationMessageType
  lineId        String?  // set for LINE_COMMENT / a line-scoped counter
  proposedDiscountPercent Decimal?
  body          String?
  status        NegotiationMessageStatus @default(OPEN)
  createdAt     DateTime @default(now())
}
```

### 2.8 Fulfillment

```
model Warehouse {
  id       String @id @default(cuid())
  name     String
  location String
  shippingCostWeight Decimal @default(1) // used by the split algorithm, §3.3

  stockLevels StockLevel[]
}

model StockLevel {
  id          String    @id @default(cuid())
  warehouseId String
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id])
  productId   String
  product     Product   @relation(fields: [productId], references: [id])
  onHand      Int       @default(0)
  reserved    Int       @default(0)
  // available = onHand - reserved, computed, not stored

  @@unique([warehouseId, productId])
}

enum FulfillmentLineStatus {
  RESERVED
  BACKORDERED
  SHIPPED
}

model FulfillmentSplit {
  id           String    @id @default(cuid())
  quotationId  String
  quotation    Quotation @relation(fields: [quotationId], references: [id])
  warehouseId  String
  warehouse    Warehouse @relation(fields: [warehouseId], references: [id])
  quotationLineId String
  quantity     Int
  status       FulfillmentLineStatus @default(RESERVED)
  shippedAt    DateTime?
}
```

### 2.9 Billing

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
  id          String   @id @default(cuid())
  quotationId String
  quotation   Quotation @relation(fields: [quotationId], references: [id])
  kind        InvoiceKind
  amount      Decimal
  status      InvoiceStatus @default(UNPAID)
  dueDate     DateTime
  paidAt      DateTime?

  // Gate: one-time invoice lines only include quotation lines whose
  // FulfillmentSplit.status = SHIPPED. See DEMO_SCENARIO / mockup Screen 13.
}

model SubscriptionSchedule {
  id              String   @id @default(cuid())
  quotationId     String
  quotation       Quotation @relation(fields: [quotationId], references: [id])
  quotationLineId String
  cycle           RecurringCycle
  amount          Decimal
  nextBillDate    DateTime
  status          SubscriptionStatus @default(ACTIVE)
}

enum SubscriptionStatus {
  ACTIVE
  PAUSED
  CANCELLED
}

model CreditNote {
  id           String   @id @default(cuid())
  scheduleId   String
  schedule     SubscriptionSchedule @relation(fields: [scheduleId], references: [id])
  amount       Decimal
  reason       String
  createdAt    DateTime @default(now())
}
```

### 2.10 Audit & deal health

```
model AuditLog {
  id          String   @id @default(cuid())
  quotationId String
  quotation   Quotation @relation(fields: [quotationId], references: [id])
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  action      String   // "APPROVED", "REJECTED", "RETURNED", "LINE_EDITED", "COUNTER_APPLIED", ...
  note        String?
  createdAt   DateTime @default(now())
}
```

**Deal Health / anomaly dashboard is a read model, not a stored entity.** `Stalled` = `lastActivityAt` older than a configured threshold on a non-terminal quotation. `Discount Anomaly` = a confirmed line's discount percent significantly above that rep's historical average for the category. Both are computed queries over existing tables — nothing new to keep in sync.

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

## 5. API surface (indicative)

Grouped by the screens in the mockup, not by REST purity — this is what the frontend actually calls.

```
POST   /auth/login | /auth/signup                  (internal users)
POST   /portal/auth/login                           (magic link or email+password, PortalUser)

GET    /quotations                    ?status=&repId=&customerId=
POST   /quotations
GET    /quotations/:id
PATCH  /quotations/:id/lines                        (add/edit/remove — bumps termsVersion, re-evaluates §3)
POST   /quotations/:id/submit                       (DRAFT -> PENDING_APPROVAL | CONFIRMED)
GET    /quotations/:id/upsell-suggestions

GET    /approvals                     ?status=pending
GET    /approvals/:approvalRequestId
POST   /approvals/:approvalRequestId/steps/:stepId/act   { action: APPROVE|REJECT|RETURN, note }

GET    /quotations/:id/fulfillment-suggestion       (computed, not stored — §3-analogous derivation)
POST   /quotations/:id/fulfillment                  { splits: [...] }   (accept suggested or manual override)

GET    /quotations/:id/subscriptions
POST   /subscriptions/:id/modify | /cancel

GET    /invoices                      ?status=
POST   /invoices/:id/payments

GET    /portal/quotations/:id                       (PortalUser-scoped; internal fields stripped — see §6)
POST   /portal/quotations/:id/messages              (NegotiationMessage — proposal only, §1.4)
POST   /portal/quotations/:id/confirm

GET    /deal-health                                 (stalled / anomaly / slippage — computed, §2.10)
GET    /reports                       ?period=&repId=&status=&category=

GET/POST/PATCH  /admin/products | /admin/warehouses | /admin/discount-tiers | /admin/approval-rules | /admin/company
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

- [ ] Exact `blendedSeverity` thresholds (§3.2) — placeholders, tune once seed data (DEMO_SCENARIO.md) is loaded and the demo quote's numbers can be checked by hand.
- [ ] Portal auth mechanism — magic link vs email+password (brief allows either; pick one, don't build both).
- [ ] Warehouse split algorithm exact greedy rule (§2.8 references it; full spec not yet written here — largest-coverage-first, remainder to backorder, per shipping-cost weight).
- [ ] Proration formula for mid-cycle subscription quantity changes.

---

*Last updated against: DEMO_SCENARIO.md (Netrix Systems / ZKTeco catalog), DESIGN_SYSTEM.md (light + violet). If you change the demo business or a routing rule, update this file in the same commit.*
