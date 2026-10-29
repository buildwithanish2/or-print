-- Additive migration: preserve existing SQLite payment, order and subscription data.
CREATE TABLE "SubscriptionPaymentAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "shopId" TEXT,
  "gatewayOrderId" TEXT NOT NULL,
  "gatewayPaymentId" TEXT,
  "amountPaise" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SubscriptionPaymentAttempt_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SubscriptionPaymentAttempt_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SubscriptionPaymentAttempt_gatewayOrderId_key"
  ON "SubscriptionPaymentAttempt"("gatewayOrderId");
CREATE UNIQUE INDEX "SubscriptionPaymentAttempt_gatewayPaymentId_key"
  ON "SubscriptionPaymentAttempt"("gatewayPaymentId");
CREATE INDEX "SubscriptionPaymentAttempt_planId_status_idx"
  ON "SubscriptionPaymentAttempt"("planId", "status");
CREATE INDEX "SubscriptionPaymentAttempt_shopId_createdAt_idx"
  ON "SubscriptionPaymentAttempt"("shopId", "createdAt");

ALTER TABLE "Payment" ADD COLUMN "verifiedByUserId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "verifiedAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "Order" ADD COLUMN "idempotencyHash" TEXT;
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
