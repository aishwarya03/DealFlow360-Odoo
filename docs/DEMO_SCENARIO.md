# DealFlow360 — Demo Scenario & Seed Data

The business the demo is built around. Both teammates seed against this file.

---

## The three parties

| Party | Who | What they see |
|---|---|---|
| **DealFlow360** | The platform (us) | The internal shell is DealFlow360-branded |
| **The tenant** | Netrix Systems — the company that bought the software | Internal shell: rep, manager, finance, admin |
| **The tenant's customers** | Corporate buyers (Sundaram Textiles, Kaveri Hospitals…) | The **portal, wearing Netrix's branding — never DealFlow360's** |

### Single company, deliberately

One deployment serves **one** company. `Company` is a settings singleton — name, logo, address, GSTIN, accent color — that Admin edits and the portal brands from.

**No `tenantId` on any table. No scoped queries. No tenant claim in the JWT.**

> **If a judge asks about multi-tenancy:** the brief marks multi-company as a bonus, not a requirement. The migration path is a tenant FK on Customer, Product, Warehouse and Quotation. We designed for it and deliberately scoped it out, because it buys nothing for the eight flows being demonstrated and costs hours we needed elsewhere.

---

## The tenant

**Netrix Systems Pvt Ltd** — a Bengaluru-based security and surveillance systems integrator, and an **authorized ZKTeco channel partner**. Sells CCTV hardware plus ZKTeco biometric access/attendance hardware and software to corporate customers, with site survey, structured cabling, installation, HRMS integration and AMC.

*Fictional — coined name, no real-company collision. GSTIN `29AABCN4567P1Z8` (29 = Karnataka). Lives in one settings record, trivial to change.*

> **Why an integrator, not a single hardware brand.** A real SI carries multiple manufacturers and sells the labor around them — exactly the category spread the discount ceilings need (hardware at one ceiling, services at a stricter one), without the catalog looking reverse-engineered from the rules. CCTV hardware in the catalog uses generic/fictional model names. The ZKTeco access-control and attendance line uses **real ZKTeco product and software names** (SpeedFace, inBio, ZKBioTime) — that's normal for a reseller's price list and is what "authorized channel partner" means in practice; Netrix remains the seller of record on every invoice and quotation, GSTIN included, so nothing fabricated is attributed to ZKTeco itself.

Why this business fits the brief:

- **A camera rollout is naturally high-quantity.** Thirty-plus cameras plus NVRs and drives cannot ship from one warehouse without contrivance — the split feature is inevitable, not staged.
- **Three independent recurring streams** — cloud video storage, AMC, and biometric cloud attendance — each with its own quantity and cycle, all possibly on one order. Hybrid billing gets genuinely interesting instead of one bolted-on SaaS line.
- **The upsell ladder is long and honest:** camera → NVR → surveillance HDD → PoE switch → mounts/cabling accessories → cloud storage → AMC → analytics. Real co-purchases, not invented pairings.
- **Structured cabling is genuinely thin-margin** and exactly where Indian SIs give ground — so a breaching service line is true to life.

Currency: **INR only.** Multi-currency is a bonus in the brief; single currency is simpler and fits the framing.

---

## Catalog

### Hardware — discount ceiling 15%

| Product | Price (₹) |
|---|---|
| IP dome camera, 4MP | 6,800 |
| IP bullet camera, 4MP, outdoor | 7,400 |
| NVR, 16-channel | 38,000 |
| Surveillance-grade HDD, 4TB | 9,500 |
| PoE network switch, 16-port | 14,500 |
| ZKTeco SpeedFace V5L (face + fingerprint terminal) | 18,500 |
| ZKTeco inBio260 (two-door access controller) | 22,000 |
| ZKTeco K40 (fingerprint time attendance terminal) | 8,200 |
| Electromagnetic lock, 600 lbs | 3,200 |
| Camera mount / housing kit | 1,100 |

### Services — discount ceiling 10%

| Service | Price (₹) |
|---|---|
| Site survey & design | 10,000 |
| Structured cabling (per point) | 850 |
| Onsite installation & commissioning | 15,000 |
| HRMS / payroll integration | 35,000 |
| User training (per batch) | 8,000 |

### Recurring lines — `category: SOFTWARE`, `isSubscribable: true`

> **Schema note:** the real `Product.category` enum is `HARDWARE | SOFTWARE | SERVICE` — there is no `SUBSCRIPTION` category (see `SOURCE_OF_TRUTH.md` §2.3). These are `SOFTWARE`-category products with `isSubscribable = true`; the cycle below is what gets chosen on the `QuotationLine` when a rep actually sells it, not a fixed property of the catalog item. AMC is the exception — it's a maintenance `SERVICE`, also `isSubscribable`, billed yearly.

| Plan | Category | Cycle | Price (₹) |
|---|---|---|---|
| Cloud video storage (per camera) | Software | Monthly | 450 |
| AI analytics — people counting / ANPR (per camera) | Software | Monthly | 600 |
| ZKBioTime Cloud attendance (per 100 employees) | Software | Monthly | 2,400 |
| AMC comprehensive (per device) | Service | Yearly | 2,800 |

**Every product needs a `costPrice` value seeded** — margin is required by three features (live margin indicator, upsell margin delta, minimum-margin thresholds) and is absent from the brief's product form. Field is already in the real schema (`Product.costPrice`); just needs seed data.

---

## Warehouses

| Warehouse | Location | Role |
|---|---|---|
| Main Warehouse | Bengaluru | Primary stock |
| Regional Depot | Pune | Overflow — forces the split |

Seed stock so the demo quotation **cannot** be filled from one warehouse. That is the whole point — if Bengaluru alone can cover it, the split never triggers and the feature looks fake on stage.

---

## Customers

| Customer | Tier | Ceiling | Profile |
|---|---|---|---|
| Sundaram Textiles Pvt Ltd | Gold | 15% | Multi-plant textile manufacturer |
| Vistaar Financial Services | Gold | 15% | Multi-branch NBFC |
| Kaveri Hospitals | Silver | 10% | Two-hospital group |
| Anand Motors | Silver | 10% | Dealership network |
| Rajdhani Logistics | Bronze | 5% | Warehouse operator |

Effective line ceiling = `min(tier ceiling, category ceiling)`.

---

## The demo quotation

**One quotation that exercises all four must-not-be-faked rules.** Seed so this is reachable in the first 60 seconds of the demo.

**Customer:** Sundaram Textiles (Gold, 15%) — requests a quotation from Netrix Systems for a combined CCTV surveillance and worker biometric attendance rollout across their Pune factory floor. (A textile plant needs both: cameras on the floor, and attendance terminals at the gate — one natural project, one order.)

| Line | Category | Qty | Price | Discount | Ceiling | Result |
|---|---|---|---|---|---|---|
| IP dome camera, 4MP | Hardware | 32 | ₹6,800 | 12% | 15% | OK |
| NVR, 16-channel | Hardware | 2 | ₹38,000 | 10% | 15% | OK |
| Surveillance HDD, 4TB | Hardware | 4 | ₹9,500 | 8% | 15% | OK |
| ZKTeco SpeedFace V5L terminal | Hardware | 4 | ₹18,500 | 10% | 15% | OK |
| Structured cabling (32 points) | Services | 32 | ₹850 | 18% | 10% | **OVER +8 pt** |
| Cloud video storage | Subscription | 32 | ₹450/mo | — | — | Recurring |
| ZKBioTime Cloud attendance | Subscription | 1 | ₹2,400/mo | — | — | Recurring |
| AMC comprehensive | Subscription | 36 | ₹2,800/yr | — | — | Recurring |

Order value ≈ ₹3.6 lakh — large enough that a customer would genuinely negotiate.

What this single quote demonstrates:

1. **Discount governance** — the cabling line breaches its own stricter ceiling even though the customer is Gold and every hardware line (CCTV *and* ZKTeco) is compliant. Blended risk flags it and auto-routes to Sales Manager. The brief's own worked example, in rupees.
2. **Warehouse splitting** — 32 cameras cannot ship from Bengaluru alone, so the order splits Bengaluru + Pune with a shipment-count estimate.
3. **Hybrid billing** — cameras, NVRs, terminals and cabling invoice one-time; cloud video storage and ZKBioTime bill monthly, AMC bills yearly — three independent recurring schedules, different cycles, on the same order.
4. **Portal negotiation** — Sundaram counters for a larger discount from the portal, invalidating the approval and re-routing it.

Upsell suggestions on this quote: PoE switch and mount/housing kits (co-purchased with cameras), ZKTeco inBio260 controller and electromagnetic lock (co-purchased with the terminal), AI analytics and AMC (promoted, healthy margin).

---

## Cheap authenticity wins

- Label the product tax field **GST %** rather than "Tax %".
- Show **GSTIN** on the company record and the invoice header.

Near-zero cost, and the invoice reads as a real Indian B2B document rather than a generic template.

## Explicitly not doing

Multi-currency · multi-company · product variants · fabricated statistics anywhere in the UI or landing page · anything that implies ZKTeco itself operates or endorses the platform (Netrix is always the seller of record).
