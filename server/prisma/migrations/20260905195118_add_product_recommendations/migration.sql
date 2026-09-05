-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('UPSELL', 'CROSS_SELL');

-- AlterTable
ALTER TABLE "quotation_lines" ADD COLUMN     "suggestedAs" "RecommendationType",
ADD COLUMN     "suggestedFromProductId" INTEGER;

-- CreateTable
CREATE TABLE "product_recommendations" (
    "id" SERIAL NOT NULL,
    "sourceProductId" INTEGER NOT NULL,
    "targetProductId" INTEGER NOT NULL,
    "type" "RecommendationType" NOT NULL,
    "promoted" BOOLEAN NOT NULL DEFAULT false,
    "minMarginPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_recommendations_sourceProductId_type_idx" ON "product_recommendations"("sourceProductId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "product_recommendations_sourceProductId_targetProductId_typ_key" ON "product_recommendations"("sourceProductId", "targetProductId", "type");

-- AddForeignKey
ALTER TABLE "product_recommendations" ADD CONSTRAINT "product_recommendations_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_recommendations" ADD CONSTRAINT "product_recommendations_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_suggestedFromProductId_fkey" FOREIGN KEY ("suggestedFromProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
