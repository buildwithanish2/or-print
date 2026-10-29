-- Additive marker to prevent repeated welcome-email sends for the same account.
ALTER TABLE "User" ADD COLUMN "welcomeEmailSentAt" DATETIME;
