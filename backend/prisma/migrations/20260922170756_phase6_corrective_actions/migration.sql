-- CreateTable
CREATE TABLE "CorrectiveAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "sourceInspectionId" TEXT,
    "sourceResponseId" TEXT,
    "failedItemText" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "raisedById" TEXT NOT NULL,
    "raisedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigneeId" TEXT,
    "targetDate" DATETIME,
    "resolutionRemarks" TEXT,
    "resolvedAt" DATETIME,
    "resolvedById" TEXT,
    "closureRemarks" TEXT,
    "closedAt" DATETIME,
    "closedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CorrectiveAction_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CorrectiveAction_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CorrectiveAction_sourceInspectionId_fkey" FOREIGN KEY ("sourceInspectionId") REFERENCES "Inspection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CorrectiveAction_sourceResponseId_fkey" FOREIGN KEY ("sourceResponseId") REFERENCES "InspectionResponse" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CorrectiveAction_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CorrectiveAction_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CorrectiveAction_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CorrectiveAction_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CorrectiveActionAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "correctiveActionId" TEXT NOT NULL,
    "storedFilename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "caption" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'EVIDENCE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "CorrectiveActionAttachment_correctiveActionId_fkey" FOREIGN KEY ("correctiveActionId") REFERENCES "CorrectiveAction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CorrectiveActionAttachment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CorrectiveAction_code_key" ON "CorrectiveAction"("code");

-- CreateIndex
CREATE INDEX "CorrectiveAction_equipmentId_idx" ON "CorrectiveAction"("equipmentId");

-- CreateIndex
CREATE INDEX "CorrectiveAction_unitId_idx" ON "CorrectiveAction"("unitId");

-- CreateIndex
CREATE INDEX "CorrectiveAction_status_idx" ON "CorrectiveAction"("status");

-- CreateIndex
CREATE INDEX "CorrectiveAction_priority_idx" ON "CorrectiveAction"("priority");

-- CreateIndex
CREATE INDEX "CorrectiveAction_targetDate_idx" ON "CorrectiveAction"("targetDate");

-- CreateIndex
CREATE INDEX "CorrectiveAction_assigneeId_idx" ON "CorrectiveAction"("assigneeId");

-- CreateIndex
CREATE INDEX "CorrectiveAction_raisedById_idx" ON "CorrectiveAction"("raisedById");

-- CreateIndex
CREATE INDEX "CorrectiveAction_sourceInspectionId_idx" ON "CorrectiveAction"("sourceInspectionId");

-- CreateIndex
CREATE INDEX "CorrectiveActionAttachment_correctiveActionId_idx" ON "CorrectiveActionAttachment"("correctiveActionId");
