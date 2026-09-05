/*
  Warnings:

  - You are about to drop the `Test` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "QuoteRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'UNDER_NEGOTIATION', 'CONFIRMED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "RecurringCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "ApprovalLevel" AS ENUM ('MANAGER', 'MANAGER_FINANCE');

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ApprovalStepRole" AS ENUM ('SALES_MANAGER', 'FINANCE');

-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('PENDING', 'ACTIVE', 'APPROVED', 'REJECTED', 'RETURNED');

-- DropTable
DROP TABLE "Test";

-- CreateTable
CREATE TABLE "quote_requests" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "items" JSONB,
    "status" "QuoteRequestStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "termsVersion" INTEGER NOT NULL DEFAULT 1,
    "approvedTermsVersion" INTEGER,
    "customerReference" TEXT,
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "sourceQuoteRequestId" INTEGER,
    "previousQuotationId" INTEGER,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_lines" (
    "id" SERIAL NOT NULL,
    "quotationId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "ceilingAtEntry" DECIMAL(5,2) NOT NULL,
    "taxRateAtEntry" DECIMAL(5,2) NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringCycle" "RecurringCycle",

    CONSTRAINT "quotation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" SERIAL NOT NULL,
    "quotationId" INTEGER NOT NULL,
    "termsVersion" INTEGER NOT NULL,
    "approvalLevel" "ApprovalLevel" NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" SERIAL NOT NULL,
    "approvalRequestId" INTEGER NOT NULL,
    "role" "ApprovalStepRole" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'PENDING',
    "actedById" INTEGER,
    "note" TEXT,
    "actedAt" TIMESTAMP(3),

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "quotationId" INTEGER NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotations_previousQuotationId_key" ON "quotations"("previousQuotationId");

-- CreateIndex
CREATE INDEX "quotations_customerId_idx" ON "quotations"("customerId");

-- CreateIndex
CREATE INDEX "quotations_ownerId_idx" ON "quotations"("ownerId");

-- CreateIndex
CREATE INDEX "quotations_status_idx" ON "quotations"("status");

-- CreateIndex
CREATE INDEX "quotations_status_lastActivityAt_idx" ON "quotations"("status", "lastActivityAt");

-- CreateIndex
CREATE INDEX "quotations_sourceQuoteRequestId_idx" ON "quotations"("sourceQuoteRequestId");

-- CreateIndex
CREATE INDEX "quotations_confirmedAt_idx" ON "quotations"("confirmedAt");

-- CreateIndex
CREATE INDEX "quotation_lines_quotationId_idx" ON "quotation_lines"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_lines_productId_idx" ON "quotation_lines"("productId");

-- CreateIndex
CREATE INDEX "approval_requests_quotationId_idx" ON "approval_requests"("quotationId");

-- CreateIndex
CREATE INDEX "approval_requests_status_idx" ON "approval_requests"("status");

-- CreateIndex
CREATE INDEX "approval_steps_role_status_idx" ON "approval_steps"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "approval_steps_approvalRequestId_sequence_key" ON "approval_steps"("approvalRequestId", "sequence");

-- CreateIndex
CREATE INDEX "audit_logs_quotationId_createdAt_idx" ON "audit_logs"("quotationId", "createdAt");

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_sourceQuoteRequestId_fkey" FOREIGN KEY ("sourceQuoteRequestId") REFERENCES "quote_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_previousQuotationId_fkey" FOREIGN KEY ("previousQuotationId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
