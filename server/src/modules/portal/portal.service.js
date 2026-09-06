import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';
import { AUDIENCE, signToken } from '../../utils/jwt.js';
import { toNumber } from '../../utils/money.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { buildLineData } from '../quotations/quotation.service.js';
import { writeAudit } from '../quotations/auditLog.service.js';
import { recalculateCustomerTier } from '../tiers/tierScoring.service.js';

const displayCode = (id) => `Q-${1000 + id}`;

// Never let a passwordHash, a cost, a margin or an internal risk figure reach
// a customer. This is an allowlist, not a denylist, so a field added to
// Customer later cannot leak by default.
const toPublicCustomer = (customer) => ({
  id: customer.id,
  name: customer.name,
  email: customer.email,
  contactName: customer.contactName,
  phone: customer.phone,
});

const issuePortalToken = (customer) =>
  signToken({ sub: String(customer.id), email: customer.email }, AUDIENCE.PORTAL);

/**
 * A self-service quotation still needs an internal owner, because every
 * quotation is somebody's to progress. The lowest-id active rep acts as the
 * house account until a manager reassigns it — the alternative, a nullable
 * owner, would leave these quotes belonging to nobody and invisible in the
 * rep's own list.
 */
const houseOwnerId = async (tx) => {
  const rep = await tx.user.findFirst({
    where: { role: 'SALES_REP', isActive: true },
    orderBy: { id: 'asc' },
  });
  if (!rep) throw ApiError.badRequest('No active sales rep is available to own this request');

  return rep.id;
};

const lowestTierId = async (tx) => {
  const tier = await tx.customerTier.findFirst({
    where: { isActive: true },
    orderBy: { minScore: 'asc' },
  });
  if (!tier) throw ApiError.badRequest('No active customer tiers are configured');

  return tier.id;
};

export const registerCustomer = async (data) => {
  const existing = await prisma.customer.findUnique({ where: { email: data.email } });

  // A customer record may already exist because a rep created it before this
  // person ever visited the site. In that case this is claiming portal access
  // to an existing account, not creating a duplicate — but only if nobody has
  // claimed it yet.
  if (existing?.passwordHash) {
    throw ApiError.conflict('An account with this email already exists. Sign in instead.');
  }

  const passwordHash = await hashPassword(data.password);

  const customer = existing
    ? await prisma.customer.update({
        where: { id: existing.id },
        data: { passwordHash, contactName: data.name, phone: data.phone ?? existing.phone },
      })
    : await prisma.customer.create({
        data: {
          name: data.company,
          email: data.email,
          passwordHash,
          contactName: data.name,
          phone: data.phone,
          tierId: await lowestTierId(prisma),
        },
      });

  // A brand-new customer has no trading history, so this scores 0 and lands
  // in the lowest band — correct, and it means their first quotation resolves
  // a real discount ceiling rather than failing to find one.
  await recalculateCustomerTier(customer.id);

  return { customer: toPublicCustomer(customer), token: issuePortalToken(customer) };
};

export const loginCustomer = async ({ email, password }) => {
  const customer = await prisma.customer.findUnique({ where: { email } });

  // Distinguished on purpose: the client sends an unrecognized email to
  // signup instead of a dead-end "invalid credentials" message.
  if (!customer?.passwordHash) throw ApiError.notFound('No account found with this email');
  if (!(await verifyPassword(password, customer.passwordHash))) {
    throw ApiError.unauthorized('Incorrect password');
  }
  if (!customer.isActive) throw ApiError.forbidden('This account has been deactivated');

  return { customer: toPublicCustomer(customer), token: issuePortalToken(customer) };
};

export const getCurrentCustomer = async (customerId) => {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !customer.isActive) throw ApiError.unauthorized('Account no longer active');

  return toPublicCustomer(customer);
};

// What a customer is allowed to see of their own quotation: no cost, no
// margin, no ceiling, no approval detail, no internal risk score.
const toPortalQuotation = (quotation) => {
  const lines = quotation.lines.map((line) => {
    const unitPrice = toNumber(line.unitPrice);
    const discountPercent = toNumber(line.discountPercent);
    const gross = unitPrice * line.quantity;
    const net = gross * (1 - discountPercent / 100);

    return {
      id: line.id,
      product: { id: line.product.id, name: line.product.name, sku: line.product.sku },
      quantity: line.quantity,
      unitPrice,
      discountPercent,
      lineTotal: Math.round(net * 100) / 100,
    };
  });

  return {
    id: quotation.id,
    code: displayCode(quotation.id),
    status: quotation.status,
    customerReference: quotation.customerReference,
    notes: quotation.notes,
    createdAt: quotation.createdAt,
    lines,
    total: Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100,
  };
};

const portalInclude = {
  lines: { include: { product: { select: { id: true, name: true, sku: true } } } },
};

// A lightweight entry for a superseded quotation in a revision chain — just
// enough to list it under "Previous Quotes", not the full lines/total detail
// the current revision gets.
const toPortalQuotationSummary = (quotation) => ({
  id: quotation.id,
  code: displayCode(quotation.id),
  status: quotation.status,
  createdAt: quotation.createdAt,
});

/**
 * Creates the quotation a customer asked for from the public site.
 *
 * Three rows, one transaction: the QuoteRequest that records where the lead
 * came from, the Quotation itself, and its audit entry. The QuoteRequest is
 * kept rather than skipped because Quotation.sourceQuoteRequestId already
 * exists to answer "which public lead started this chain" — this fills it in
 * instead of leaving the origin unrecorded.
 */
export const createQuotationForCustomer = async (customerId, { lines, message }) => {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !customer.isActive) throw ApiError.unauthorized('Account no longer active');

  // Built through the internal service so the price snapshot and the
  // ceilingAtEntry resolution are identical to a rep-built quotation.
  const lineData = await Promise.all(
    lines.map((input) => buildLineData(customer.tierId, input))
  );

  const productNames = await prisma.product.findMany({
    where: { id: { in: lines.map((line) => line.productId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(productNames.map((p) => [p.id, p.name]));

  const created = await prisma.$transaction(async (tx) => {
    const quoteRequest = await tx.quoteRequest.create({
      data: {
        name: customer.contactName ?? customer.name,
        company: customer.name,
        email: customer.email,
        phone: customer.phone,
        message,
        items: lines.map((line) => ({
          productName: nameById.get(line.productId) ?? `Product ${line.productId}`,
          quantity: line.quantity,
        })),
        // Converted the moment it is raised: unlike an anonymous enquiry, this
        // one already has a customer and a quotation attached.
        status: 'CONVERTED',
      },
    });

    const quotation = await tx.quotation.create({
      data: {
        customerId: customer.id,
        ownerId: await houseOwnerId(tx),
        notes: message,
        sourceQuoteRequestId: quoteRequest.id,
        lines: { create: lineData },
      },
    });

    // userId is null — this was the customer's own action, not a staff member's.
    await writeAudit(tx, {
      quotationId: quotation.id,
      userId: null,
      action: 'CREATED',
      note: 'Requested by customer from the portal',
    });

    return quotation;
    // Same rationale as registerAndRequestQuotation below: three writes over a
    // remote (serverless) database comfortably exceed Prisma's 5s default.
  }, { timeout: 20000 });

  const full = await prisma.quotation.findUnique({
    where: { id: created.id },
    include: portalInclude,
  });

  return toPortalQuotation(full);
};

/**
 * Signup and first quotation as one atomic action, because that is what it is
 * from the customer's side of the screen.
 *
 * Order matters: everything that can fail on validation (an inactive product,
 * a missing discount rule, an email already claimed) is resolved BEFORE the
 * first write. Otherwise a bad product id leaves a registered customer with no
 * quotation and no way to retry — the email is taken but nothing was created.
 */
export const registerAndRequestQuotation = async ({ message, lines, ...registration }) => {
  const existing = await prisma.customer.findUnique({ where: { email: registration.email } });
  if (existing?.passwordHash) {
    throw ApiError.conflict('An account with this email already exists. Sign in instead.');
  }

  // A customer signing up has no trading history, so they start in the lowest
  // band. Resolved up front so lines can be priced before the customer row
  // exists.
  const tierId = await lowestTierId(prisma);

  // Reads and validation only — throws here leave nothing written.
  const lineData = await Promise.all(lines.map((input) => buildLineData(tierId, input)));

  const products = await prisma.product.findMany({
    where: { id: { in: lines.map((line) => line.productId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(products.map((p) => [p.id, p.name]));

  const passwordHash = await hashPassword(registration.password);
  // Resolved before the transaction opens: it is a read, and every query held
  // inside a transaction against a remote database burns its time budget.
  const ownerId = await houseOwnerId(prisma);

  const { customer, quotation } = await prisma.$transaction(async (tx) => {
    const savedCustomer = existing
      ? await tx.customer.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            contactName: registration.name,
            phone: registration.phone ?? existing.phone,
          },
        })
      : await tx.customer.create({
          data: {
            name: registration.company,
            email: registration.email,
            passwordHash,
            contactName: registration.name,
            phone: registration.phone,
            tierId,
          },
        });

    const quoteRequest = await tx.quoteRequest.create({
      data: {
        name: registration.name,
        company: registration.company,
        email: registration.email,
        phone: registration.phone,
        message,
        items: lines.map((line) => ({
          productName: nameById.get(line.productId) ?? `Product ${line.productId}`,
          quantity: line.quantity,
        })),
        status: 'CONVERTED',
      },
    });

    const savedQuotation = await tx.quotation.create({
      data: {
        customerId: savedCustomer.id,
        ownerId,
        notes: message,
        sourceQuoteRequestId: quoteRequest.id,
        lines: { create: lineData },
      },
    });

    await writeAudit(tx, {
      quotationId: savedQuotation.id,
      userId: null,
      action: 'CREATED',
      note: 'Requested by customer from the portal',
    });

    return { customer: savedCustomer, quotation: savedQuotation };
    // Four writes over a remote (serverless) database comfortably exceed
    // Prisma's 5s default, and a signup that half-succeeds is the one outcome
    // this transaction exists to prevent.
  }, { timeout: 20000 });

  // After commit: scoring is a refinement of an already-valid record, so a
  // failure here must not undo a successful signup.
  await recalculateCustomerTier(customer.id);

  const full = await prisma.quotation.findUnique({
    where: { id: quotation.id },
    include: portalInclude,
  });

  return {
    customer: toPublicCustomer(customer),
    token: issuePortalToken(customer),
    quotation: toPortalQuotation(full),
  };
};

/**
 * A revised quotation (previousQuotationId set by a rep re-quoting a
 * rejected/withdrawn one) is the same deal as its predecessor, not a separate
 * entry. The customer should see one row per chain — the latest revision,
 * carrying whatever status it currently holds — with the superseded ones
 * folded underneath as "Previous Quotes", newest first.
 */
export const listCustomerQuotations = async (customerId) => {
  const quotations = await prisma.quotation.findMany({
    where: { customerId },
    include: portalInclude,
    orderBy: { createdAt: 'desc' },
  });

  const byId = new Map(quotations.map((quotation) => [quotation.id, quotation]));
  // Anything referenced as someone else's previousQuotationId has been
  // superseded, so it is not the head of its chain.
  const supersededIds = new Set(
    quotations
      .filter((quotation) => quotation.previousQuotationId != null)
      .map((quotation) => quotation.previousQuotationId)
  );
  const latestQuotations = quotations.filter((quotation) => !supersededIds.has(quotation.id));

  return latestQuotations
    .map((quotation) => {
      const previousQuotations = [];
      let cursor = quotation.previousQuotationId;
      while (cursor != null) {
        const previous = byId.get(cursor);
        if (!previous) break;
        previousQuotations.push(toPortalQuotationSummary(previous));
        cursor = previous.previousQuotationId;
      }

      return { ...toPortalQuotation(quotation), previousQuotations };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const getCustomerQuotation = async (customerId, quotationId) => {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: portalInclude,
  });

  // Scoped by owner, and a mismatch is a 404 rather than a 403 — a customer
  // should not be able to learn that someone else's quotation exists.
  if (!quotation || quotation.customerId !== customerId) {
    throw ApiError.notFound('Quotation not found');
  }

  const previousQuotations = [];
  let cursor = quotation.previousQuotationId;
  while (cursor != null) {
    const previous = await prisma.quotation.findUnique({ where: { id: cursor } });
    if (!previous || previous.customerId !== customerId) break;
    previousQuotations.push(toPortalQuotationSummary(previous));
    cursor = previous.previousQuotationId;
  }

  return { ...toPortalQuotation(quotation), previousQuotations };
};
