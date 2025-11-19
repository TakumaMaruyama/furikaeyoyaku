-- CreateTable
CREATE TABLE "AbsenceNotice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childName" TEXT NOT NULL,
    "declaredClassBand" TEXT NOT NULL,
    "contactEmail" TEXT,
    "absentDate" DATETIME NOT NULL,
    "originalSlotId" TEXT NOT NULL,
    "resumeToken" TEXT NOT NULL,
    "makeupDeadline" DATETIME NOT NULL,
    "makeupStatus" TEXT NOT NULL DEFAULT 'ABSENT_LOGGED',
    "makeupSlotId" TEXT,
    "makeupAllowanceDelta" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AbsenceNotice_originalSlotId_fkey" FOREIGN KEY ("originalSlotId") REFERENCES "ClassSlot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AbsenceNotice_makeupSlotId_fkey" FOREIGN KEY ("makeupSlotId") REFERENCES "ClassSlot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childName" TEXT NOT NULL,
    "declaredClassBand" TEXT NOT NULL,
    "absentDate" DATETIME NOT NULL,
    "toSlotId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "contactEmail" TEXT,
    "confirmToken" TEXT,
    "declineToken" TEXT,
    "toSlotStartDateTime" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "absenceNoticeId" TEXT,
    CONSTRAINT "Request_absenceNoticeId_fkey" FOREIGN KEY ("absenceNoticeId") REFERENCES "AbsenceNotice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Request" ("absentDate", "childName", "confirmToken", "contactEmail", "createdAt", "declaredClassBand", "declineToken", "id", "status", "toSlotId", "toSlotStartDateTime") SELECT "absentDate", "childName", "confirmToken", "contactEmail", "createdAt", "declaredClassBand", "declineToken", "id", "status", "toSlotId", "toSlotStartDateTime" FROM "Request";
DROP TABLE "Request";
ALTER TABLE "new_Request" RENAME TO "Request";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceNotice_resumeToken_key" ON "AbsenceNotice"("resumeToken");

-- CreateIndex
CREATE INDEX "AbsenceNotice_originalSlotId_idx" ON "AbsenceNotice"("originalSlotId");

-- CreateIndex
CREATE INDEX "AbsenceNotice_makeupDeadline_idx" ON "AbsenceNotice"("makeupDeadline");

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceNotice_childName_originalSlotId_key" ON "AbsenceNotice"("childName", "originalSlotId");
