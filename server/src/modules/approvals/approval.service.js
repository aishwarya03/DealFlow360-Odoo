import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';
import { writeAudit } from '../quotations/auditLog.service.js';

const detailInclude = {
  quotation: {
    select: { id: true, status: true, customerId: true, ownerId: true, customer: { select: { id: true, name: true } } },
  },
  steps: {
    orderBy: { sequence: 'asc' },
    include: { actedBy: { select: { id: true, name: true } } },
  },
};

const toPublicRequest = (request) => ({
  id: request.id,
  quotationId: request.quotationId,
  quotation: request.quotation
    ? {
        id: request.quotation.id,
        code: `Q-${1000 + request.quotation.id}`,
        status: request.quotation.status,
        customer: request.quotation.customer,
      }
    : undefined,
  termsVersion: request.termsVersion,
  approvalLevel: request.approvalLevel,
  status: request.status,
  createdAt: request.createdAt,
  steps: request.steps.map((step) => ({
    id: step.id,
    role: step.role,
    sequence: step.sequence,
    status: step.status,
    actedBy: step.actedBy ? { id: step.actedBy.id, name: step.actedBy.name } : null,
    note: step.note,
    actedAt: step.actedAt,
  })),
});

// Sales Manager and Finance each see only the requests where it is currently
// their turn to act — mirrors the access matrix's split between "Act on
// Manager approval step" and "Act on Finance approval step" (§6). Admin, who
// can act on either, sees everything regardless of whose turn it is.
const scopeToRole = (actingUser, where) => {
  if (actingUser.role === 'ADMIN') return where;

  return {
    ...where,
    steps: { some: { role: actingUser.role, status: 'ACTIVE' } },
  };
};

export const listApprovalRequests = async (filters, actingUser) => {
  const where = scopeToRole(actingUser, {});
  if (filters.status) where.status = filters.status;

  const requests = await prisma.approvalRequest.findMany({
    where,
    include: detailInclude,
    orderBy: { createdAt: 'asc' },
  });

  return requests.map(toPublicRequest);
};

export const getApprovalRequestById = async (id) => {
  const request = await prisma.approvalRequest.findUnique({ where: { id }, include: detailInclude });
  if (!request) throw ApiError.notFound(`No approval request with id ${id}`);

  return toPublicRequest(request);
};

const STEP_RESULT = {
  APPROVE: { stepStatus: 'APPROVED', auditAction: 'APPROVED' },
  REJECT: { stepStatus: 'REJECTED', auditAction: 'REJECTED' },
  RETURN: { stepStatus: 'RETURNED', auditAction: 'RETURNED' },
};

export const actOnStep = async (approvalRequestId, stepId, { action, note }, actingUser) => {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: approvalRequestId },
    include: { steps: { orderBy: { sequence: 'asc' } } },
  });
  if (!request) throw ApiError.notFound(`No approval request with id ${approvalRequestId}`);

  const step = request.steps.find((s) => s.id === stepId);
  if (!step) throw ApiError.notFound(`No step ${stepId} on approval request ${approvalRequestId}`);

  if (step.status !== 'ACTIVE') {
    throw ApiError.badRequest('This step is not currently awaiting action');
  }
  if (actingUser.role !== step.role && actingUser.role !== 'ADMIN') {
    throw ApiError.forbidden(`This step requires ${step.role}. You are ${actingUser.role}.`);
  }

  const { stepStatus, auditAction } = STEP_RESULT[action];
  const nextStep = request.steps.find((s) => s.sequence === step.sequence + 1);

  await prisma.$transaction(async (tx) => {
    await tx.approvalStep.update({
      where: { id: step.id },
      data: { status: stepStatus, actedById: actingUser.id, actedAt: new Date(), note },
    });

    if (action === 'APPROVE' && nextStep) {
      // Not the last step — hand off to whoever is next, request stays PENDING.
      await tx.approvalStep.update({ where: { id: nextStep.id }, data: { status: 'ACTIVE' } });
      await tx.quotation.update({ where: { id: request.quotationId }, data: { lastActivityAt: new Date() } });
    } else {
      // Either the chain is exhausted (approve) or it stopped here (reject/return).
      const requestStatus = action === 'APPROVE' ? 'APPROVED' : stepStatus;
      const quotationStatus = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'DRAFT';

      await tx.approvalRequest.update({ where: { id: request.id }, data: { status: requestStatus } });

      const quotationData = { status: quotationStatus, lastActivityAt: new Date() };
      if (action === 'APPROVE') quotationData.approvedTermsVersion = request.termsVersion;

      await tx.quotation.update({ where: { id: request.quotationId }, data: quotationData });
    }

    await writeAudit(tx, {
      quotationId: request.quotationId,
      userId: actingUser.id,
      action: auditAction,
      note,
    });
  });

  return getApprovalRequestById(approvalRequestId);
};
