-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('HARDWARE', 'SOFTWARE', 'SERVICE');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ProductCategory" NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "isSubscribable" BOOLEAN NOT NULL DEFAULT false,
    "listPrice" DECIMAL(12,2) NOT NULL,
    "costPrice" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");
