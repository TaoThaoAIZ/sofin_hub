-- CreateIndex
CREATE INDEX "Payment_paymentCardId_idx" ON "Payment"("paymentCardId");

-- CreateIndex
CREATE INDEX "Subscription_paymentCardId_idx" ON "Subscription"("paymentCardId");
