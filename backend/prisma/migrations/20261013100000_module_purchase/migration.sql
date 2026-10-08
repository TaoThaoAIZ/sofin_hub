-- Mua lẻ module trả phí: thanh toán một lần gắn với module (additive).
ALTER TYPE "PaymentKind" ADD VALUE IF NOT EXISTS 'module';
ALTER TABLE "Payment" ADD COLUMN "moduleId" TEXT;
CREATE INDEX "Payment_moduleId_idx" ON "Payment"("moduleId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "ClassroomModule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
