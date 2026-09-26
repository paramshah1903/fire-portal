-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "remarks" TEXT,
    "hasSafetyCriticalFailure" BOOLEAN NOT NULL DEFAULT false,
    "confirmationName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Inspection_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inspection_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "ChecklistTemplateVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inspection_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectionResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspectionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "isSafetyCritical" BOOLEAN NOT NULL DEFAULT false,
    "requiresCorrectiveActionOnFail" BOOLEAN NOT NULL DEFAULT false,
    "numericMin" REAL,
    "numericMax" REAL,
    "numericUnit" TEXT,
    "optionsJson" TEXT,
    "valueString" TEXT,
    "valueNumeric" REAL,
    "valueDate" DATETIME,
    "isFail" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InspectionResponse_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InspectionResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ChecklistQuestion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectionAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspectionId" TEXT NOT NULL,
    "responseId" TEXT,
    "storedFilename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "caption" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "InspectionAttachment_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InspectionAttachment_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "InspectionResponse" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InspectionAttachment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Inspection_status_idx" ON "Inspection"("status");

-- CreateIndex
CREATE INDEX "Inspection_unitId_idx" ON "Inspection"("unitId");

-- CreateIndex
CREATE INDEX "Inspection_inspectorId_idx" ON "Inspection"("inspectorId");

-- CreateIndex
CREATE INDEX "Inspection_completedAt_idx" ON "Inspection"("completedAt");

-- CreateIndex
CREATE INDEX "Inspection_dueDate_idx" ON "Inspection"("dueDate");

-- CreateIndex
CREATE INDEX "Inspection_equipmentId_idx" ON "Inspection"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_equipmentId_periodKey_key" ON "Inspection"("equipmentId", "periodKey");

-- CreateIndex
CREATE INDEX "InspectionResponse_inspectionId_idx" ON "InspectionResponse"("inspectionId");

-- CreateIndex
CREATE INDEX "InspectionResponse_questionId_idx" ON "InspectionResponse"("questionId");

-- CreateIndex
CREATE INDEX "InspectionResponse_isFail_idx" ON "InspectionResponse"("isFail");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionResponse_inspectionId_questionId_key" ON "InspectionResponse"("inspectionId", "questionId");

-- CreateIndex
CREATE INDEX "InspectionAttachment_inspectionId_idx" ON "InspectionAttachment"("inspectionId");

-- CreateIndex
CREATE INDEX "InspectionAttachment_responseId_idx" ON "InspectionAttachment"("responseId");
