-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "equipmentTypeId" TEXT NOT NULL,
    "frequencyDays" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistTemplate_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistTemplateUnit" (
    "templateId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,

    PRIMARY KEY ("templateId", "unitId"),
    CONSTRAINT "ChecklistTemplateUnit_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistTemplateUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistTemplateVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "publishedById" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistTemplateVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL,
    CONSTRAINT "ChecklistSection_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ChecklistTemplateVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "helpText" TEXT,
    "questionType" TEXT NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "isSafetyCritical" BOOLEAN NOT NULL DEFAULT false,
    "requiresCorrectiveActionOnFail" BOOLEAN NOT NULL DEFAULT false,
    "optionsJson" TEXT,
    "numericMin" REAL,
    "numericMax" REAL,
    "numericUnit" TEXT,
    "sequence" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ChecklistQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ChecklistSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ChecklistTemplate_equipmentTypeId_idx" ON "ChecklistTemplate"("equipmentTypeId");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_isActive_idx" ON "ChecklistTemplate"("isActive");

-- CreateIndex
CREATE INDEX "ChecklistTemplateUnit_unitId_idx" ON "ChecklistTemplateUnit"("unitId");

-- CreateIndex
CREATE INDEX "ChecklistTemplateVersion_templateId_isCurrent_idx" ON "ChecklistTemplateVersion"("templateId", "isCurrent");

-- CreateIndex
CREATE INDEX "ChecklistTemplateVersion_status_idx" ON "ChecklistTemplateVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplateVersion_templateId_versionNumber_key" ON "ChecklistTemplateVersion"("templateId", "versionNumber");

-- CreateIndex
CREATE INDEX "ChecklistSection_versionId_idx" ON "ChecklistSection"("versionId");

-- CreateIndex
CREATE INDEX "ChecklistQuestion_sectionId_idx" ON "ChecklistQuestion"("sectionId");
