-- AlterTable
ALTER TABLE "customer_tiers" ADD COLUMN     "minScore" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "completedOrders" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "customerSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastOrderAt" TIMESTAMP(3),
ADD COLUMN     "tierCalculatedAt" TIMESTAMP(3),
ADD COLUMN     "tierScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalPurchaseValue" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "tier_scoring_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "purchaseValueWeight" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "orderCountWeight" DECIMAL(5,2) NOT NULL DEFAULT 25,
    "recencyWeight" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "relationshipWeight" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "purchaseValueTarget" DECIMAL(14,2) NOT NULL DEFAULT 1250000,
    "orderCountTarget" INTEGER NOT NULL DEFAULT 28,
    "recencyHorizonDays" INTEGER NOT NULL DEFAULT 80,
    "relationshipTargetYears" DECIMAL(5,2) NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tier_scoring_config_pkey" PRIMARY KEY ("id")
);
