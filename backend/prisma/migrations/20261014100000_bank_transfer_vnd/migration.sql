-- Thanh toán chuyển khoản VietQR + SePay, tiền tệ VND toàn hệ thống.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'bank_transfer';

ALTER TABLE "Payment" ADD COLUMN "refCode" TEXT;
ALTER TABLE "Payment" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Payment" ALTER COLUMN "currency" SET DEFAULT 'vnd';
CREATE UNIQUE INDEX "Payment_refCode_key" ON "Payment"("refCode");

CREATE TABLE "BankTransaction" (
  "id" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "gateway" TEXT,
  "accountNumber" TEXT,
  "amount" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "referenceCode" TEXT,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "matchedPaymentId" TEXT,
  "credited" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "rawPayload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BankTransaction_externalId_key" ON "BankTransaction"("externalId");
CREATE INDEX "BankTransaction_credited_createdAt_idx" ON "BankTransaction"("credited", "createdAt");
CREATE INDEX "BankTransaction_matchedPaymentId_idx" ON "BankTransaction"("matchedPaymentId");

-- Webhook kiểu cũ (HMAC + event type) bị thay bằng BankTransaction.
DROP TABLE IF EXISTS "WebhookEvent";
DROP TYPE IF EXISTS "WebhookStatus";

-- USD cent -> VND đồng: x250 (1 USD = 25.000 VND = 100 cent). Chỉ áp cho dữ liệu cũ; đơn vị mới của mọi cột *Cents là 1 đồng.
UPDATE "Course" SET "priceCents" = "priceCents" * 250, "priceAnnualCents" = "priceAnnualCents" * 250;
UPDATE "ClassroomModule" SET "priceCents" = "priceCents" * 250;
UPDATE "Payment" SET "amountCents" = "amountCents" * 250, "refundedCents" = "refundedCents" * 250, "currency" = 'vnd';
UPDATE "Subscription" SET "priceCents" = "priceCents" * 250;
UPDATE "RefundRequest" SET "amountCents" = "amountCents" * 250;
UPDATE "Payout" SET "amountCents" = "amountCents" * 250;
UPDATE "Chargeback" SET "amountCents" = "amountCents" * 250;
UPDATE "OwnerBalanceLedger" SET "amountCents" = "amountCents" * 250;
UPDATE "ReferralCommission" SET "baseCents" = "baseCents" * 250, "amountCents" = "amountCents" * 250;
-- Cài đặt chung cũ tính USD/cent: xóa để quay về mặc định VND (env).
UPDATE "PlatformSetting" SET "value" = "value" - 'payments.payoutMinUsd' - 'payments.gatewayFeeFixedCents' - 'payments.currency' WHERE "key" = 'global.settings';
