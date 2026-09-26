-- CreateTable
CREATE TABLE "EquipmentType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "inspectionFrequencyDays" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentCode" TEXT NOT NULL,
    "qrCodeValue" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "equipmentTypeId" TEXT NOT NULL,
    "serialNumber" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "capacity" TEXT,
    "assetNumber" TEXT,
    "installationDate" DATETIME,
    "unitId" TEXT NOT NULL,
    "departmentId" TEXT,
    "area" TEXT,
    "building" TEXT,
    "floor" TEXT,
    "location" TEXT,
    "exactLocation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Equipment_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Equipment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Equipment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentType_key_key" ON "EquipmentType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_equipmentCode_key" ON "Equipment"("equipmentCode");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_qrCodeValue_key" ON "Equipment"("qrCodeValue");

-- CreateIndex
CREATE INDEX "Equipment_equipmentTypeId_idx" ON "Equipment"("equipmentTypeId");

-- CreateIndex
CREATE INDEX "Equipment_unitId_idx" ON "Equipment"("unitId");

-- CreateIndex
CREATE INDEX "Equipment_departmentId_idx" ON "Equipment"("departmentId");

-- CreateIndex
CREATE INDEX "Equipment_status_idx" ON "Equipment"("status");

-- CreateIndex
CREATE INDEX "Equipment_isActive_idx" ON "Equipment"("isActive");
