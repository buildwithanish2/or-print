-- Additive SQLite migration for college free-print policy and verification.
-- No existing user, order, payment, or usage data is removed.
CREATE TABLE "FileOwnership" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "fileId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FileOwnership_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FileOwnership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FileOwnership_fileId_key" ON "FileOwnership"("fileId");
CREATE INDEX "FileOwnership_userId_createdAt_idx" ON "FileOwnership"("userId", "createdAt");

CREATE TABLE "Institution" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "domain" TEXT,
  "isEligible" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Institution_name_key" ON "Institution"("name");

CREATE TABLE "InstitutionVerification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "requestedRole" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "evidenceStorageKey" TEXT,
  "evidenceMimeType" TEXT NOT NULL,
  "evidenceSizeBytes" INTEGER NOT NULL,
  "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedByUserId" TEXT,
  "reviewedAt" DATETIME,
  "rejectionReason" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "InstitutionVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InstitutionVerification_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InstitutionVerification_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InstitutionVerification_userId_key" ON "InstitutionVerification"("userId");
CREATE INDEX "InstitutionVerification_status_submittedAt_idx" ON "InstitutionVerification"("status", "submittedAt");
CREATE INDEX "InstitutionVerification_institutionId_status_idx" ON "InstitutionVerification"("institutionId", "status");

CREATE TABLE "InstitutionVerificationEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "verificationId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstitutionVerificationEvent_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "InstitutionVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "InstitutionVerificationEvent_verificationId_createdAt_idx" ON "InstitutionVerificationEvent"("verificationId", "createdAt");

CREATE TABLE "FreePrintPolicy" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "studentDailyPages" INTEGER NOT NULL DEFAULT 0,
  "studentMonthlyPages" INTEGER NOT NULL DEFAULT 0,
  "teacherDailyPages" INTEGER NOT NULL DEFAULT 0,
  "teacherMonthlyPages" INTEGER NOT NULL DEFAULT 0,
  "studentDailyCopies" INTEGER NOT NULL DEFAULT 0,
  "studentMonthlyCopies" INTEGER NOT NULL DEFAULT 0,
  "teacherDailyCopies" INTEGER NOT NULL DEFAULT 0,
  "teacherMonthlyCopies" INTEGER NOT NULL DEFAULT 0,
  "allowBlackWhite" BOOLEAN NOT NULL DEFAULT true,
  "allowColor" BOOLEAN NOT NULL DEFAULT false,
  "startsAt" DATETIME,
  "expiresAt" DATETIME,
  "updatedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "FreePrintShopSetting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shopId" TEXT NOT NULL,
  "participating" BOOLEAN NOT NULL DEFAULT false,
  "updatedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "FreePrintShopSetting_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FreePrintShopSetting_shopId_key" ON "FreePrintShopSetting"("shopId");

CREATE TABLE "FreePrintPolicyAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorUserId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "scopeId" TEXT,
  "action" TEXT NOT NULL,
  "beforeJson" TEXT,
  "afterJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "FreePrintPolicyAudit_scope_createdAt_idx" ON "FreePrintPolicyAudit"("scope", "createdAt");

CREATE TABLE "FreePrintUsage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "periodType" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "reservedPages" INTEGER NOT NULL DEFAULT 0,
  "completedPages" INTEGER NOT NULL DEFAULT 0,
  "reservedCopies" INTEGER NOT NULL DEFAULT 0,
  "completedCopies" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "FreePrintUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FreePrintUsage_userId_periodType_periodKey_key" ON "FreePrintUsage"("userId", "periodType", "periodKey");
CREATE INDEX "FreePrintUsage_periodKey_periodType_idx" ON "FreePrintUsage"("periodKey", "periodType");

CREATE TABLE "FreePrintReservation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pages" INTEGER NOT NULL,
  "copies" INTEGER NOT NULL,
  "dayKey" TEXT NOT NULL,
  "monthKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RESERVED',
  "policySnapshot" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME,
  "releasedAt" DATETIME,
  CONSTRAINT "FreePrintReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FreePrintReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FreePrintReservation_orderId_key" ON "FreePrintReservation"("orderId");
CREATE INDEX "FreePrintReservation_userId_dayKey_status_idx" ON "FreePrintReservation"("userId", "dayKey", "status");
CREATE INDEX "FreePrintReservation_userId_monthKey_status_idx" ON "FreePrintReservation"("userId", "monthKey", "status");
