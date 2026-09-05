/*
  Warnings:

  - You are about to drop the column `discountCeiling` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `tier` on the `customers` table. All the data in the column will be lost.
  - Added the required column `tierId` to the `customers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "categories" DROP COLUMN "discountCeiling";

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "tier",
ADD COLUMN     "tierId" INTEGER NOT NULL;

-- DropEnum
DROP TYPE "CustomerTier";

-- CreateTable
CREATE TABLE "customer_tiers" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "defaultMaxDiscountPercent" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_rules" (
    "id" SERIAL NOT NULL,
    "customerTierId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "maxDiscountPercent" DECIMAL(5,2) NOT NULL,
    "managerApprovalThreshold" DECIMAL(5,2) NOT NULL,
    "financeApprovalThreshold" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_tiers_code_key" ON "customer_tiers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "customer_tiers_rank_key" ON "customer_tiers"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "discount_rules_customerTierId_categoryId_key" ON "discount_rules"("customerTierId", "categoryId");

-- CreateIndex
CREATE INDEX "customers_tierId_idx" ON "customers"("tierId");

-- AddForeignKey
ALTER TABLE "discount_rules" ADD CONSTRAINT "discount_rules_customerTierId_fkey" FOREIGN KEY ("customerTierId") REFERENCES "customer_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_rules" ADD CONSTRAINT "discount_rules_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "customer_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
