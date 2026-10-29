-- CreateTable
CREATE TABLE "GuestInstitutionVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "requestedRole" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "evidenceStorageKey" TEXT NOT NULL,
    "evidenceMimeType" TEXT NOT NULL,
    "evidenceSizeBytes" INTEGER NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "identityHash" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" TEXT,
    "reviewedAt" DATETIME,
    "reviewerShopId" TEXT,
    "rejectionReason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GuestInstitutionVerification_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GuestInstitutionVerification_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GuestInstitutionVerification_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GuestInstitutionVerification_reviewerShopId_fkey" FOREIGN KEY ("reviewerShopId") REFERENCES "Shop" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuestInstitutionVerificationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "verificationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestInstitutionVerificationEvent_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "GuestInstitutionVerification" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FileRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL DEFAULT 'DOCUMENT',
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "previewUrl" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guestVerificationId" TEXT,
    CONSTRAINT "FileRecord_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FileRecord_guestVerificationId_fkey" FOREIGN KEY ("guestVerificationId") REFERENCES "GuestInstitutionVerification" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FileRecord" ("category", "createdAt", "expiresAt", "id", "mimeType", "originalName", "pageCount", "previewUrl", "shopId", "sizeBytes", "storageKey", "url") SELECT "category", "createdAt", "expiresAt", "id", "mimeType", "originalName", "pageCount", "previewUrl", "shopId", "sizeBytes", "storageKey", "url" FROM "FileRecord";
DROP TABLE "FileRecord";
ALTER TABLE "new_FileRecord" RENAME TO "FileRecord";
CREATE TABLE "new_FreePrintReservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "userId" TEXT,
    "guestIdentityHash" TEXT,
    "guestVerificationId" TEXT,
    "pages" INTEGER NOT NULL,
    "copies" INTEGER NOT NULL,
    "dayKey" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "policySnapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "releasedAt" DATETIME,
    CONSTRAINT "FreePrintReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FreePrintReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FreePrintReservation_guestVerificationId_fkey" FOREIGN KEY ("guestVerificationId") REFERENCES "GuestInstitutionVerification" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FreePrintReservation" ("completedAt", "copies", "createdAt", "dayKey", "id", "monthKey", "orderId", "pages", "policySnapshot", "releasedAt", "status", "userId") SELECT "completedAt", "copies", "createdAt", "dayKey", "id", "monthKey", "orderId", "pages", "policySnapshot", "releasedAt", "status", "userId" FROM "FreePrintReservation";
DROP TABLE "FreePrintReservation";
ALTER TABLE "new_FreePrintReservation" RENAME TO "FreePrintReservation";
CREATE UNIQUE INDEX "FreePrintReservation_orderId_key" ON "FreePrintReservation"("orderId");
CREATE INDEX "FreePrintReservation_userId_dayKey_status_idx" ON "FreePrintReservation"("userId", "dayKey", "status");
CREATE INDEX "FreePrintReservation_userId_monthKey_status_idx" ON "FreePrintReservation"("userId", "monthKey", "status");
CREATE TABLE "new_FreePrintUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "guestIdentityHash" TEXT,
    "periodType" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "reservedPages" INTEGER NOT NULL DEFAULT 0,
    "completedPages" INTEGER NOT NULL DEFAULT 0,
    "reservedCopies" INTEGER NOT NULL DEFAULT 0,
    "completedCopies" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FreePrintUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FreePrintUsage" ("completedCopies", "completedPages", "id", "periodKey", "periodType", "reservedCopies", "reservedPages", "updatedAt", "userId") SELECT "completedCopies", "completedPages", "id", "periodKey", "periodType", "reservedCopies", "reservedPages", "updatedAt", "userId" FROM "FreePrintUsage";
DROP TABLE "FreePrintUsage";
ALTER TABLE "new_FreePrintUsage" RENAME TO "FreePrintUsage";
CREATE INDEX "FreePrintUsage_periodKey_periodType_idx" ON "FreePrintUsage"("periodKey", "periodType");
CREATE UNIQUE INDEX "FreePrintUsage_userId_periodType_periodKey_key" ON "FreePrintUsage"("userId", "periodType", "periodKey");
CREATE UNIQUE INDEX "FreePrintUsage_guestIdentityHash_periodType_periodKey_key" ON "FreePrintUsage"("guestIdentityHash", "periodType", "periodKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "GuestInstitutionVerification_accessTokenHash_key" ON "GuestInstitutionVerification"("accessTokenHash");

-- CreateIndex
CREATE INDEX "GuestInstitutionVerification_shopId_status_submittedAt_idx" ON "GuestInstitutionVerification"("shopId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "GuestInstitutionVerification_institutionId_status_idx" ON "GuestInstitutionVerification"("institutionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GuestInstitutionVerification_identityHash_shopId_key" ON "GuestInstitutionVerification"("identityHash", "shopId");

-- CreateIndex
CREATE INDEX "GuestInstitutionVerificationEvent_verificationId_createdAt_idx" ON "GuestInstitutionVerificationEvent"("verificationId", "createdAt");

