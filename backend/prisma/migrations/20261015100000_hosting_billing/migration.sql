-- Thu phí gói hosting (Pro) qua chuyển khoản: giao dịch kind = hosting gắn với HostingPlan (additive).
ALTER TYPE "PaymentKind" ADD VALUE IF NOT EXISTS 'hosting';
ALTER TABLE "Payment" ADD COLUMN "hostingPlanId" TEXT;
CREATE INDEX "Payment_hostingPlanId_idx" ON "Payment"("hostingPlanId");
ALTER TABLE "HostingPlan" ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_hostingPlanId_fkey" FOREIGN KEY ("hostingPlanId") REFERENCES "HostingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
