-- CreateTable
CREATE TABLE "quotation_line_allocations" (
    "id" SERIAL NOT NULL,
    "quotationLineId" INTEGER NOT NULL,
    "warehouseId" INTEGER,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "quotation_line_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotation_line_allocations_quotationLineId_idx" ON "quotation_line_allocations"("quotationLineId");

-- AddForeignKey
ALTER TABLE "quotation_line_allocations" ADD CONSTRAINT "quotation_line_allocations_quotationLineId_fkey" FOREIGN KEY ("quotationLineId") REFERENCES "quotation_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_line_allocations" ADD CONSTRAINT "quotation_line_allocations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
