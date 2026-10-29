-- Additive college-specific pricing overrides. Existing shop and platform rules remain unchanged.
CREATE TABLE "InstitutionPricingRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "institutionId" TEXT NOT NULL,
  "paperSize" TEXT NOT NULL,
  "colorMode" TEXT NOT NULL,
  "singleSidePrice" REAL NOT NULL,
  "duplexPrice" REAL NOT NULL,
  "duplexDiscountPercent" REAL NOT NULL DEFAULT 0.0,
  "bulkMinPages" INTEGER NOT NULL DEFAULT 50,
  "bulkDiscountPercent" REAL NOT NULL DEFAULT 0.0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "InstitutionPricingRule_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InstitutionPricingRule_institutionId_paperSize_colorMode_key"
  ON "InstitutionPricingRule"("institutionId", "paperSize", "colorMode");
CREATE INDEX "InstitutionPricingRule_institutionId_idx"
  ON "InstitutionPricingRule"("institutionId");
