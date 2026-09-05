# DealFlow360 — Design System

Decisions locked. Both teammates (and both Claude sessions) build from this file.
If you change something here, say so — silent divergence is what this document exists to prevent.

---

## Core decisions

| Decision | Choice | Why |
|---|---|---|
| Theme | **Light** | ~12 of 18 screens are dense numeric tables. Light wins on legibility, and survives a washed-out projector in a bright judging room. |
| Brand accent | **Violet `#7C3AED`** | Maximum hue separation from all five status colors, so "brand" is never confused with "state". |
| Typography | One family, two scales | Internal 14px / tight leading. Portal 16px / generous leading. Different posture, no second font to load. |
| Numerics | `font-variant-numeric: tabular-nums` | On every money and percent column. Non-negotiable — it's what makes financial tables look professional. |
| Elevation | Borders over shadows | Subtle row borders, hover highlight, sticky headers, **no zebra striping**. Reads as a tool. |
| Radius | `lg` cards/panels, `md` controls | — |

**Deliberately deferred:** dark mode, product variants, custom illustration.

---

## Status color system

Five colors. **Resist a sixth** — every new state maps into one of these.

| Token | Hex | Meaning |
|---|---|---|
| Neutral | `#64748B` | Inert / not started |
| Blue | `#2563EB` | In progress / informational |
| Green | `#16A34A` | Healthy / complete |
| Amber | `#D97706` | Needs attention |
| Red | `#DC2626` | Breach / failure |

### Full state mapping

Every state in the app, pre-assigned. Use `<StatusBadge>` — never hand-pick a color at the call site.

| Domain | State | Token |
|---|---|---|
| Quotation | Draft | Neutral |
| | Pending Approval | Blue |
| | Under Negotiation | Blue |
| | Approved | Green |
| | Confirmed | Green |
| | Returned for Revision | Amber |
| | Rejected | Red |
| Risk band | LOW | Green |
| | MEDIUM | Amber |
| | HIGH | Red |
| Discount line | OK | Green |
| | OVER (+N pt) | Red |
| Approval stage | Auto Approved | Green |
| | Sales Manager / Finance (active) | Blue |
| | Step not yet reached | Neutral |
| Approval action | Approve | Green |
| | Return for Revision | Amber |
| | Reject | Red |
| Fulfillment | Split Pending | Blue |
| | Backorder | Amber |
| | Complete | Green |
| Subscription | Active | Green |
| | Paused | Neutral |
| | Cancelled | Neutral |
| Invoice | Paid | Green |
| | Unpaid | Amber |
| | Overdue | Red |
| Deal health | Stalled | Amber |
| | Delivery Slippage | Amber |
| | Discount Anomaly | Red |

---

## Two shells, one system

Same tokens. The difference is **proportion and density**, not a second design system.

### Internal shell — rep / manager / finance / admin
A **tool**. Persistent 9-tab nav (Dashboard, Quotations, Approvals, Fulfillment, Subscriptions, Invoices, Deal Health, Reports, Products). Compact type, tight padding, tables as the primary surface.

Mostly neutral — violet appears only on interactive elements (primary button, active tab, focus ring, links). **Screen color should overwhelmingly be status information, not brand.**

> **Role controls which tabs render.** A rep does not see the Approvals queue as an approver; Finance sees a narrower set than Admin. Same shell, filtered nav — and enforced server-side, not just hidden in React.

### Portal shell — customer
A **document**. Branded header with the mark at real size plus the customer name. Only three nav items: `My Quotation` / `Messages` / `Profile`. Generous whitespace, larger type.

Violet leads here — branded header, section headers, CTAs.

**No internal jargon ever reaches the customer.** They never see "blended risk score", "margin", cost, or approval-stage internals. It should feel like something you'd be comfortable signing.

*This visual separation is evidence for a stated grading criterion — the brief requires the portal be "a real, separate, restricted view, not just another internal screen with a different label."*

---

## Component inventory

Nearly every screen is list → detail, so ~10 components cover all 18. **Build these before building screens.**

| Component | Used by |
|---|---|
| `AppShell` | All internal screens |
| `PortalShell` | Customer portal |
| `PageHeader` | Every screen (title, subtitle, actions) |
| `DataTable` | ~12 screens — the workhorse |
| `StatCard` | Dashboards (2, 14, 15, 16) |
| `StatusBadge` | Everywhere — drives the table above |
| `DetailSection` | All detail screens |
| `StepProgress` | Approval chain (6), invoice progress (13) |
| `FilterBar` | Lists (5, 9, 12, 15) |
| `EmptyState` | Everywhere |
| `KanbanBoard` | Quotations pipeline (3) only |

`DataTable` + a form modal is also the answer to the Section A config CRUD (products, pricelists, tiers, warehouses, plans) — that's a third of the spec's surface built from components you already have.

---

## Identity

The name contains its own concept: **Quote → Approve → Fulfil → Bill → Negotiate → back to Quote.** That loop is literally the architecture.

Circular/loop mark + wordmark with `360` in violet. Timebox: 15 minutes. It also gives the landing page a "how it works" strip that doubles as the demo narrative.

---

## Landing page scope

**Not in the rubric** — absent from the 8-step test flow and from all 18 mockup screens. Justified only as the demo opener. **Timebox: ~1 hour.**

- Hero: name, one-line value prop, Log In / Sign Up
- Four tiles = the four *must-not-be-faked* pillars: discount governance with auto-routing · multi-warehouse splitting against live stock · hybrid one-time + recurring billing · in-portal negotiation
- The 360 loop strip

No pricing, no testimonials, no footer sitemap.

---

## Build order

1. Tokens + the 10 shared components
2. Landing page
3. Login / Signup — **build against a stubbed API** so the frontend isn't blocked on the auth backend landing
4. Internal shell + role-filtered nav
5. Screens, critical path first
