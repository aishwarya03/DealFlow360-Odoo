/*
  Warnings:

  - You are about to drop the column `category` on the `products` table. All the data in the column will be lost.
  - Added the required column `categoryId` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('GOODS', 'SERVICE', 'COMBO');

-- DropIndex
DROP INDEX "products_category_idx";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "category",
ADD COLUMN     "categoryId" INTEGER NOT NULL,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "productType" "ProductType" NOT NULL DEFAULT 'GOODS';

-- DropEnum
DROP TYPE "ProductCategory";

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" INTEGER,
    "discountCeiling" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_parentId_name_key" ON "categories"("parentId", "name");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
